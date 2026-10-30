import { describe, expect, it } from "vitest";
import {
  PLANNER_AI_EDIT_DAILY_LIMIT,
  PLANNER_QUOTA_RESERVATION_TTL_MS,
} from "@/lib/planner/quota/types";

/**
 * In-memory model of reserve/consume/release AI Edit RPCs
 * (mirrors supabase/migrations/20261031140000_planner_ai_edit_quota.sql).
 */
type AiEditRow = {
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

function createAiEditQuotaStore() {
  const rows: AiEditRow[] = [];
  let seq = 0;

  function activeCount(params: {
    subjectType: string;
    subjectId: string;
    windowType: string;
    windowKey: string;
    now: number;
    staleAfterMs: number;
  }): number {
    const staleBefore = params.now - params.staleAfterMs;
    return rows.filter(
      (r) =>
        r.subjectType === params.subjectType &&
        r.subjectId === params.subjectId &&
        r.windowType === params.windowType &&
        r.windowKey === params.windowKey &&
        (r.status === "consumed" ||
          (r.status === "reserved" && r.reservedAt >= staleBefore)),
    ).length;
  }

  function reserve(params: {
    subjectType: string;
    subjectId: string;
    windowType: string;
    windowKey: string;
    sessionId: string;
    now: number;
    limit?: number;
    enforceLimit?: boolean;
    staleAfterMs?: number;
  }): "reserved" | "already_consumed" | "already_reserved" {
    const staleAfter = params.staleAfterMs ?? PLANNER_QUOTA_RESERVATION_TTL_MS;
    const limit = params.limit ?? PLANNER_AI_EDIT_DAILY_LIMIT;
    const enforceLimit = params.enforceLimit ?? params.subjectType === "member";
    const staleBefore = params.now - staleAfter;

    // Drop stale reserved for this session
    for (let i = rows.length - 1; i >= 0; i -= 1) {
      const r = rows[i]!;
      if (
        r.sessionId === params.sessionId &&
        r.status === "reserved" &&
        r.reservedAt < staleBefore
      ) {
        rows.splice(i, 1);
      }
    }

    const activeForSession = rows.find(
      (r) => r.sessionId === params.sessionId && r.status === "reserved",
    );
    if (activeForSession) return "already_reserved";

    if (enforceLimit) {
      const count = activeCount({
        subjectType: params.subjectType,
        subjectId: params.subjectId,
        windowType: params.windowType,
        windowKey: params.windowKey,
        now: params.now,
        staleAfterMs: staleAfter,
      });
      if (count >= limit) return "already_consumed";
    }

    rows.push({
      id: `ae-${++seq}`,
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

  function consume(params: {
    sessionId: string;
    now: number;
  }): "consumed" | "not_found" {
    const row = rows.find(
      (r) => r.sessionId === params.sessionId && r.status === "reserved",
    );
    if (!row) return "not_found";
    row.status = "consumed";
    row.consumedAt = params.now;
    return "consumed";
  }

  function release(params: { sessionId: string }): "released" | "not_found" {
    const idx = rows.findIndex(
      (r) => r.sessionId === params.sessionId && r.status === "reserved",
    );
    if (idx < 0) return "not_found";
    rows.splice(idx, 1);
    return "released";
  }

  return { reserve, consume, release, rows };
}

describe("planner AI edit quota RPC logic", () => {
  const memberDay = {
    subjectType: "member",
    subjectId: "11111111-1111-4111-8111-111111111111",
    windowType: "kst_day",
    windowKey: "2026-10-31",
  };
  const otherMember = {
    ...memberDay,
    subjectId: "22222222-2222-4222-8222-222222222222",
  };

  it("member AI edit #1 #2 #3 success", () => {
    const store = createAiEditQuotaStore();
    for (let i = 1; i <= 3; i += 1) {
      expect(
        store.reserve({ ...memberDay, sessionId: `s${i}`, now: i * 1000 }),
      ).toBe("reserved");
      expect(store.consume({ sessionId: `s${i}`, now: i * 1000 + 1 })).toBe(
        "consumed",
      );
    }
    expect(store.rows.filter((r) => r.status === "consumed")).toHaveLength(3);
  });

  it("4th AI edit blocked before LLM (already_consumed)", () => {
    const store = createAiEditQuotaStore();
    for (let i = 1; i <= 3; i += 1) {
      expect(
        store.reserve({ ...memberDay, sessionId: `s${i}`, now: i * 1000 }),
      ).toBe("reserved");
      expect(store.consume({ sessionId: `s${i}`, now: i * 1000 + 1 })).toBe(
        "consumed",
      );
    }
    expect(
      store.reserve({ ...memberDay, sessionId: "s4", now: 5000 }),
    ).toBe("already_consumed");
  });

  it("KST next day resets quota", () => {
    const store = createAiEditQuotaStore();
    for (let i = 1; i <= 3; i += 1) {
      store.reserve({ ...memberDay, sessionId: `s${i}`, now: i * 1000 });
      store.consume({ sessionId: `s${i}`, now: i * 1000 + 1 });
    }
    expect(
      store.reserve({
        ...memberDay,
        windowKey: "2026-11-01",
        sessionId: "s-next",
        now: 9000,
      }),
    ).toBe("reserved");
  });

  it("different member has separate quota", () => {
    const store = createAiEditQuotaStore();
    for (let i = 1; i <= 3; i += 1) {
      store.reserve({ ...memberDay, sessionId: `a${i}`, now: i * 1000 });
      store.consume({ sessionId: `a${i}`, now: i * 1000 + 1 });
    }
    expect(
      store.reserve({ ...otherMember, sessionId: "b1", now: 5000 }),
    ).toBe("reserved");
  });

  it("cross-device semantic: same member shares quota across sessions", () => {
    const store = createAiEditQuotaStore();
    expect(
      store.reserve({ ...memberDay, sessionId: "device-a", now: 1000 }),
    ).toBe("reserved");
    expect(store.consume({ sessionId: "device-a", now: 1001 })).toBe("consumed");
    expect(
      store.reserve({ ...memberDay, sessionId: "device-b", now: 2000 }),
    ).toBe("reserved");
    expect(store.consume({ sessionId: "device-b", now: 2001 })).toBe("consumed");
    expect(
      store.reserve({ ...memberDay, sessionId: "device-c", now: 3000 }),
    ).toBe("reserved");
    expect(store.consume({ sessionId: "device-c", now: 3001 })).toBe("consumed");
    expect(
      store.reserve({ ...memberDay, sessionId: "device-d", now: 4000 }),
    ).toBe("already_consumed");
  });

  it("LLM/validation/persist failure release → retry PASS", () => {
    const store = createAiEditQuotaStore();
    expect(
      store.reserve({ ...memberDay, sessionId: "s1", now: 1000 }),
    ).toBe("reserved");
    expect(store.release({ sessionId: "s1" })).toBe("released");
    expect(
      store.reserve({ ...memberDay, sessionId: "s1", now: 2000 }),
    ).toBe("reserved");
    expect(store.rows.filter((r) => r.status === "consumed")).toHaveLength(0);
  });

  it("same planner concurrent: second already_reserved", () => {
    const store = createAiEditQuotaStore();
    expect(
      store.reserve({ ...memberDay, sessionId: "same", now: 1000 }),
    ).toBe("reserved");
    expect(
      store.reserve({ ...memberDay, sessionId: "same", now: 1001 }),
    ).toBe("already_reserved");
  });

  it("different planner sessions can run concurrently", () => {
    const store = createAiEditQuotaStore();
    expect(
      store.reserve({ ...memberDay, sessionId: "p1", now: 1000 }),
    ).toBe("reserved");
    expect(
      store.reserve({ ...memberDay, sessionId: "p2", now: 1001 }),
    ).toBe("reserved");
  });

  it("after A completes, same session can edit again", () => {
    const store = createAiEditQuotaStore();
    expect(
      store.reserve({ ...memberDay, sessionId: "same", now: 1000 }),
    ).toBe("reserved");
    expect(store.consume({ sessionId: "same", now: 1001 })).toBe("consumed");
    expect(
      store.reserve({ ...memberDay, sessionId: "same", now: 2000 }),
    ).toBe("reserved");
  });

  it("guest enforceLimit=false does not hit daily cap", () => {
    const store = createAiEditQuotaStore();
    const guest = {
      subjectType: "anonymous_key",
      subjectId: "anon-device-key-aaaa",
      windowType: "lifetime",
      windowKey: "lifetime",
    };
    for (let i = 1; i <= 5; i += 1) {
      expect(
        store.reserve({
          ...guest,
          sessionId: `g${i}`,
          now: i * 1000,
          enforceLimit: false,
        }),
      ).toBe("reserved");
      expect(store.release({ sessionId: `g${i}` })).toBe("released");
    }
  });

  it("stale reserved on session can be reclaimed", () => {
    const store = createAiEditQuotaStore();
    const t0 = 1_000_000;
    expect(
      store.reserve({ ...memberDay, sessionId: "s1", now: t0 }),
    ).toBe("reserved");
    expect(
      store.reserve({
        ...memberDay,
        sessionId: "s1",
        now: t0 + PLANNER_QUOTA_RESERVATION_TTL_MS + 1,
      }),
    ).toBe("reserved");
  });

  it("generation-style binary store is independent (regression note)", () => {
    // AI edit consumed slots must not block a separate generation counter.
    const store = createAiEditQuotaStore();
    for (let i = 1; i <= 3; i += 1) {
      store.reserve({ ...memberDay, sessionId: `s${i}`, now: i * 1000 });
      store.consume({ sessionId: `s${i}`, now: i * 1000 + 1 });
    }
    // Separate generation table would still allow 1/day — verified by generation rpcLogic tests.
    expect(store.rows).toHaveLength(3);
  });
});
