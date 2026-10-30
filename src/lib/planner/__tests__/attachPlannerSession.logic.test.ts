import { describe, expect, it } from "vitest";
import { decidePlannerOwnershipAttach } from "@/lib/planner/claimDecision";
import type { PlannerSession } from "@/types/planner";
import { createEmptyPlannerDraftInput } from "@/lib/planner/constants";
import { plannerPlanSchema } from "@/lib/planner/planSchemas";

/**
 * In-memory model of attachPlannerSessionToMember (conditional UPDATE semantics).
 * Verifies status/updated_at unchanged and concurrent safety under a session lock.
 */

type Row = {
  id: string;
  memberId: string | null;
  anonymousKey: string;
  status: "draft" | "generated" | "saved";
  plan: ReturnType<typeof plannerPlanSchema.parse> | null;
  updatedAt: string;
};

const MEMBER_A = "11111111-1111-4111-8111-111111111111";
const MEMBER_B = "22222222-2222-4222-8222-222222222222";

const plan = plannerPlanSchema.parse({
  title: "오사카",
  summary: "요약",
  destination: { name: "오사카", country: "일본" },
  tripOverview: {
    startDate: "2026-10-01",
    endDate: "2026-10-02",
    nights: 1,
    days: 2,
    travelersSummary: "2명",
    styleSummary: "여유",
  },
  days: [
    {
      day: 1,
      date: "2026-10-01",
      title: "1",
      summary: "s",
      items: [
        {
          order: 1,
          time: "10:00",
          type: "attraction",
          name: "장소",
          area: null,
          description: "d",
          estimatedDurationMinutes: 60,
          travelToNext: null,
          bookingRecommended: false,
        },
      ],
      tips: [],
    },
    {
      day: 2,
      date: "2026-10-02",
      title: "2",
      summary: "s",
      items: [
        {
          order: 1,
          time: "11:00",
          type: "other",
          name: "이동",
          area: null,
          description: "d",
          estimatedDurationMinutes: 30,
          travelToNext: null,
          bookingRecommended: false,
        },
      ],
      tips: [],
    },
  ],
  preparation: { travelTips: ["팁"], packingHints: ["신발"] },
});

function toSession(row: Row): PlannerSession {
  return {
    id: row.id,
    anonymousKey: row.anonymousKey,
    memberId: row.memberId,
    status: row.status,
    input: createEmptyPlannerDraftInput("오사카"),
    plan: row.plan,
    sourceProductId: null,
    createdAt: "T0",
    updatedAt: row.updatedAt,
  };
}

function createStore(initial: Row) {
  const row: Row = { ...initial };
  let lock = Promise.resolve();

  async function withLock<T>(fn: () => T | Promise<T>): Promise<T> {
    const prev = lock;
    let release!: () => void;
    lock = new Promise<void>((resolve) => {
      release = resolve;
    });
    await prev;
    try {
      return await fn();
    } finally {
      release();
    }
  }

  async function attach(params: { memberId: string; anonymousKey: string }) {
    return withLock(() => {
      const decision = decidePlannerOwnershipAttach({
        session: toSession(row),
        memberId: params.memberId,
        anonymousKey: params.anonymousKey,
      });
      if (decision.action === "reject") {
        return { ok: false as const, reason: decision.reason };
      }
      if (decision.action === "idempotent_owned") {
        return { ok: true as const, claimed: false, row: { ...row } };
      }
      // Conditional UPDATE: member_id IS NULL AND anonymous_key AND status=generated
      if (
        row.memberId === null &&
        row.anonymousKey === params.anonymousKey &&
        row.status === "generated"
      ) {
        row.memberId = params.memberId;
        // status / updatedAt intentionally unchanged
        return { ok: true as const, claimed: true, row: { ...row } };
      }
      if (row.memberId === params.memberId) {
        return { ok: true as const, claimed: false, row: { ...row } };
      }
      if (row.memberId && row.memberId !== params.memberId) {
        return { ok: false as const, reason: "forbidden" as const };
      }
      return { ok: false as const, reason: "conflict" as const };
    });
  }

  return { attach, get: () => ({ ...row }) };
}

describe("attachPlannerSessionToMember logic", () => {
  it("guest generated claim success: member set, status generated, updated_at unchanged", async () => {
    const store = createStore({
      id: "s1",
      memberId: null,
      anonymousKey: "A",
      status: "generated",
      plan,
      updatedAt: "T0",
    });
    const result = await store.attach({ memberId: MEMBER_A, anonymousKey: "A" });
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.claimed).toBe(true);
    expect(store.get()).toMatchObject({
      memberId: MEMBER_A,
      anonymousKey: "A",
      status: "generated",
      updatedAt: "T0",
    });
  });

  it("same member idempotent", async () => {
    const store = createStore({
      id: "s1",
      memberId: MEMBER_A,
      anonymousKey: "A",
      status: "generated",
      plan,
      updatedAt: "T0",
    });
    const result = await store.attach({ memberId: MEMBER_A, anonymousKey: "B" });
    expect(result).toMatchObject({ ok: true, claimed: false });
    expect(store.get().updatedAt).toBe("T0");
  });

  it("wrong anonymous / other member / draft / null plan", async () => {
    const base = {
      id: "s1",
      memberId: null as string | null,
      anonymousKey: "A",
      status: "generated" as const,
      plan,
      updatedAt: "T0",
    };
    expect(
      (await createStore(base).attach({ memberId: MEMBER_A, anonymousKey: "wrong" })).ok,
    ).toBe(false);
    expect(
      (
        await createStore({ ...base, memberId: MEMBER_A }).attach({
          memberId: MEMBER_B,
          anonymousKey: "A",
        })
      ).ok,
    ).toBe(false);
    expect(
      (
        await createStore({ ...base, status: "draft" }).attach({
          memberId: MEMBER_A,
          anonymousKey: "A",
        })
      ).ok,
    ).toBe(false);
    expect(
      (
        await createStore({ ...base, plan: null }).attach({
          memberId: MEMBER_A,
          anonymousKey: "A",
        })
      ).ok,
    ).toBe(false);
  });

  it("concurrent claim: exactly one attach, same member result safe", async () => {
    const store = createStore({
      id: "s1",
      memberId: null,
      anonymousKey: "A",
      status: "generated",
      plan,
      updatedAt: "T0",
    });
    const [a, b] = await Promise.all([
      store.attach({ memberId: MEMBER_A, anonymousKey: "A" }),
      store.attach({ memberId: MEMBER_A, anonymousKey: "A" }),
    ]);
    expect(a.ok && b.ok).toBe(true);
    const claimedCount = [a, b].filter((r) => r.ok && r.claimed).length;
    expect(claimedCount).toBe(1);
    expect(store.get().memberId).toBe(MEMBER_A);
    expect(store.get().status).toBe("generated");
    expect(store.get().updatedAt).toBe("T0");
  });

  it("concurrent different members: one wins, other forbidden", async () => {
    const store = createStore({
      id: "s1",
      memberId: null,
      anonymousKey: "A",
      status: "generated",
      plan,
      updatedAt: "T0",
    });
    const [a, b] = await Promise.all([
      store.attach({ memberId: MEMBER_A, anonymousKey: "A" }),
      store.attach({ memberId: MEMBER_B, anonymousKey: "A" }),
    ]);
    const outcomes = [a, b].map((r) => (r.ok ? "ok" : r.reason)).sort();
    expect(outcomes).toEqual(["forbidden", "ok"]);
    expect([MEMBER_A, MEMBER_B]).toContain(store.get().memberId);
  });
});
