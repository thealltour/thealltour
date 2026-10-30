import { describe, expect, it } from "vitest";
import { PLANNER_QUOTA_RESERVATION_TTL_MS } from "@/lib/planner/quota/types";

/**
 * In-memory model of reserve/consume/release RPCs
 * (mirrors supabase/migrations/20261031120000_planner_generation_quota.sql).
 */
type QuotaRow = {
  id: string;
  subjectType: string;
  subjectId: string;
  windowType: string;
  windowKey: string;
  status: "reserved" | "consumed";
  sessionId: string;
  reservedAt: number;
  consumedAt: number | null;
};

type WindowKey = string;

function windowId(s: {
  subjectType: string;
  subjectId: string;
  windowType: string;
  windowKey: string;
}): WindowKey {
  return `${s.subjectType}|${s.subjectId}|${s.windowType}|${s.windowKey}`;
}

function createQuotaStore() {
  const byWindow = new Map<WindowKey, QuotaRow>();
  let seq = 0;

  function reserve(params: {
    subjectType: string;
    subjectId: string;
    windowType: string;
    windowKey: string;
    sessionId: string;
    now: number;
    staleAfterMs?: number;
  }): "reserved" | "already_consumed" | "already_reserved" {
    const key = windowId(params);
    const staleAfter = params.staleAfterMs ?? PLANNER_QUOTA_RESERVATION_TTL_MS;
    const existing = byWindow.get(key);

    if (!existing) {
      byWindow.set(key, {
        id: `q-${++seq}`,
        subjectType: params.subjectType,
        subjectId: params.subjectId,
        windowType: params.windowType,
        windowKey: params.windowKey,
        status: "reserved",
        sessionId: params.sessionId,
        reservedAt: params.now,
        consumedAt: null,
      });
      return "reserved";
    }

    if (existing.status === "consumed") return "already_consumed";

    if (existing.sessionId === params.sessionId) {
      existing.reservedAt = params.now;
      return "reserved";
    }

    if (existing.reservedAt < params.now - staleAfter) {
      existing.sessionId = params.sessionId;
      existing.reservedAt = params.now;
      existing.status = "reserved";
      existing.consumedAt = null;
      return "reserved";
    }

    return "already_reserved";
  }

  function consume(params: {
    sessionId: string;
    now: number;
  }): "consumed" | "not_found" {
    for (const row of byWindow.values()) {
      if (row.sessionId === params.sessionId && row.status === "reserved") {
        row.status = "consumed";
        row.consumedAt = params.now;
        return "consumed";
      }
    }
    return "not_found";
  }

  function release(params: { sessionId: string }): "released" | "not_found" {
    for (const [key, row] of byWindow.entries()) {
      if (row.sessionId === params.sessionId && row.status === "reserved") {
        byWindow.delete(key);
        return "released";
      }
    }
    return "not_found";
  }

  return { reserve, consume, release, byWindow };
}

describe("planner generation quota RPC logic", () => {
  const anon = {
    subjectType: "anonymous_key",
    subjectId: "anon-device-key-aaaa",
    windowType: "lifetime",
    windowKey: "lifetime",
  };
  const memberDay = {
    subjectType: "member",
    subjectId: "11111111-1111-4111-8111-111111111111",
    windowType: "kst_day",
    windowKey: "2026-10-31",
  };

  it("anonymous lifetime first reserve PASS", () => {
    const store = createQuotaStore();
    expect(
      store.reserve({ ...anon, sessionId: "s1", now: 1_000 }),
    ).toBe("reserved");
  });

  it("anonymous lifetime consumed 후 second reserve BLOCK", () => {
    const store = createQuotaStore();
    expect(store.reserve({ ...anon, sessionId: "s1", now: 1_000 })).toBe("reserved");
    expect(store.consume({ sessionId: "s1", now: 2_000 })).toBe("consumed");
    expect(store.reserve({ ...anon, sessionId: "s2", now: 3_000 })).toBe(
      "already_consumed",
    );
  });

  it("member KST day first PASS", () => {
    const store = createQuotaStore();
    expect(
      store.reserve({ ...memberDay, sessionId: "s1", now: 1_000 }),
    ).toBe("reserved");
  });

  it("same member same KST day BLOCK", () => {
    const store = createQuotaStore();
    expect(store.reserve({ ...memberDay, sessionId: "s1", now: 1_000 })).toBe(
      "reserved",
    );
    expect(store.consume({ sessionId: "s1", now: 2_000 })).toBe("consumed");
    expect(store.reserve({ ...memberDay, sessionId: "s2", now: 3_000 })).toBe(
      "already_consumed",
    );
  });

  it("same member next KST day PASS", () => {
    const store = createQuotaStore();
    expect(store.reserve({ ...memberDay, sessionId: "s1", now: 1_000 })).toBe(
      "reserved",
    );
    expect(store.consume({ sessionId: "s1", now: 2_000 })).toBe("consumed");
    expect(
      store.reserve({
        ...memberDay,
        windowKey: "2026-11-01",
        sessionId: "s2",
        now: 3_000,
      }),
    ).toBe("reserved");
  });

  it("concurrent reserve: exactly one PASS", () => {
    const store = createQuotaStore();
    const results = ["s-a", "s-b", "s-c"].map((sessionId) =>
      store.reserve({ ...memberDay, sessionId, now: 1_000 }),
    );
    expect(results.filter((r) => r === "reserved")).toHaveLength(1);
    expect(results.filter((r) => r === "already_reserved")).toHaveLength(2);
  });

  it("failure release: same window retry PASS", () => {
    const store = createQuotaStore();
    expect(store.reserve({ ...anon, sessionId: "s1", now: 1_000 })).toBe("reserved");
    expect(store.release({ sessionId: "s1" })).toBe("released");
    expect(store.reserve({ ...anon, sessionId: "s2", now: 2_000 })).toBe("reserved");
  });

  it("stale reservation reclaim PASS", () => {
    const store = createQuotaStore();
    const t0 = 1_000_000;
    expect(store.reserve({ ...memberDay, sessionId: "s1", now: t0 })).toBe(
      "reserved",
    );
    expect(
      store.reserve({
        ...memberDay,
        sessionId: "s2",
        now: t0 + PLANNER_QUOTA_RESERVATION_TTL_MS + 1,
      }),
    ).toBe("reserved");
  });

  it("consumed reservation reclaim 금지", () => {
    const store = createQuotaStore();
    const t0 = 1_000_000;
    expect(store.reserve({ ...memberDay, sessionId: "s1", now: t0 })).toBe(
      "reserved",
    );
    expect(store.consume({ sessionId: "s1", now: t0 + 1 })).toBe("consumed");
    expect(
      store.reserve({
        ...memberDay,
        sessionId: "s2",
        now: t0 + PLANNER_QUOTA_RESERVATION_TTL_MS * 10,
      }),
    ).toBe("already_consumed");
  });

  it("same session can re-reserve while still reserved", () => {
    const store = createQuotaStore();
    expect(store.reserve({ ...anon, sessionId: "s1", now: 1_000 })).toBe("reserved");
    expect(store.reserve({ ...anon, sessionId: "s1", now: 2_000 })).toBe("reserved");
  });
});
