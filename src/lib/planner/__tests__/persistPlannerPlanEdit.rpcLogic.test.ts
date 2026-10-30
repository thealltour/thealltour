import { describe, expect, it } from "vitest";

/**
 * In-memory model of persist_planner_plan_edit
 * (mirrors supabase/migrations/20261031130000_persist_planner_plan_edit.sql).
 * Session row is exclusive-locked for the duration of each call (serialized).
 */

type SessionRow = {
  id: string;
  status: "draft" | "generated" | "saved";
  planJson: Record<string, unknown>;
  updatedAt: string;
};

type VersionRow = {
  versionNumber: number;
  planJson: Record<string, unknown>;
  editInstruction: string | null;
};

function createStore(initial: SessionRow) {
  const session: SessionRow = { ...initial, planJson: structuredClone(initial.planJson) };
  const versions: VersionRow[] = [];
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

  async function persist(params: {
    nextPlan: Record<string, unknown>;
    editInstruction: string;
    expectedUpdatedAt?: string | null;
    now: string;
  }) {
    return withLock(() => {
      if (session.status !== "generated" && session.status !== "saved") {
        return { outcome: "invalid_status" as const, status: session.status };
      }
      if (session.planJson == null) {
        return { outcome: "missing_plan" as const };
      }
      if (
        params.expectedUpdatedAt != null &&
        session.updatedAt !== params.expectedUpdatedAt
      ) {
        return {
          outcome: "conflict" as const,
          updatedAt: session.updatedAt,
          status: session.status,
        };
      }

      if (versions.length === 0) {
        versions.push({
          versionNumber: 1,
          planJson: structuredClone(session.planJson),
          editInstruction: null,
        });
      }

      const max = versions.reduce((m, v) => Math.max(m, v.versionNumber), 0);
      const nextVersion = max + 1;
      versions.push({
        versionNumber: nextVersion,
        planJson: structuredClone(params.nextPlan),
        editInstruction: params.editInstruction,
      });

      session.planJson = structuredClone(params.nextPlan);
      session.updatedAt = params.now;

      return {
        outcome: "updated" as const,
        versionNumber: nextVersion,
        updatedAt: session.updatedAt,
        status: session.status,
      };
    });
  }

  return {
    persist,
    getSession: () => structuredClone(session),
    getVersions: () => versions.map((v) => ({ ...v, planJson: structuredClone(v.planJson) })),
  };
}

const basePlan = { title: "A", days: [{ day: 1 }] };
const planB = { title: "B", days: [{ day: 1 }] };
const planC = { title: "C", days: [{ day: 1 }] };

describe("persist_planner_plan_edit RPC logic", () => {
  it("A. first edit: bootstrap v1 + edited v2 + session updated", async () => {
    const store = createStore({
      id: "s1",
      status: "generated",
      planJson: basePlan,
      updatedAt: "T0",
    });
    const result = await store.persist({
      nextPlan: planB,
      editInstruction: "[manual:update_day]",
      expectedUpdatedAt: "T0",
      now: "T1",
    });
    expect(result).toEqual({
      outcome: "updated",
      versionNumber: 2,
      updatedAt: "T1",
      status: "generated",
    });
    expect(store.getVersions().map((v) => v.versionNumber)).toEqual([1, 2]);
    expect(store.getVersions()[0]!.editInstruction).toBeNull();
    expect(store.getVersions()[0]!.planJson).toEqual(basePlan);
    expect(store.getVersions()[1]!.planJson).toEqual(planB);
    expect(store.getSession().planJson).toEqual(planB);
  });

  it("B. next edit: v3 + session updated", async () => {
    const store = createStore({
      id: "s1",
      status: "generated",
      planJson: basePlan,
      updatedAt: "T0",
    });
    await store.persist({
      nextPlan: planB,
      editInstruction: "[manual:update_day]",
      expectedUpdatedAt: "T0",
      now: "T1",
    });
    const result = await store.persist({
      nextPlan: planC,
      editInstruction: "[manual:update_item]",
      expectedUpdatedAt: "T1",
      now: "T2",
    });
    expect(result.outcome).toBe("updated");
    if (result.outcome === "updated") expect(result.versionNumber).toBe(3);
    expect(store.getVersions().map((v) => v.versionNumber)).toEqual([1, 2, 3]);
  });

  it("C. Manual CAS conflict: no new version, session unchanged", async () => {
    const store = createStore({
      id: "s1",
      status: "generated",
      planJson: basePlan,
      updatedAt: "T0",
    });
    await store.persist({
      nextPlan: planB,
      editInstruction: "x",
      expectedUpdatedAt: "T0",
      now: "T1",
    });
    const before = store.getVersions().length;
    const result = await store.persist({
      nextPlan: planC,
      editInstruction: "stale",
      expectedUpdatedAt: "T0",
      now: "T2",
    });
    expect(result.outcome).toBe("conflict");
    expect(store.getVersions()).toHaveLength(before);
    expect(store.getSession().planJson).toEqual(planB);
    expect(store.getSession().updatedAt).toBe("T1");
  });

  it("D. concurrent Manual same expectedUpdatedAt: one success, one conflict, no orphan", async () => {
    const store = createStore({
      id: "s1",
      status: "generated",
      planJson: basePlan,
      updatedAt: "T0",
    });
    const [a, b] = await Promise.all([
      store.persist({
        nextPlan: planB,
        editInstruction: "[manual:a]",
        expectedUpdatedAt: "T0",
        now: "T1a",
      }),
      store.persist({
        nextPlan: planC,
        editInstruction: "[manual:b]",
        expectedUpdatedAt: "T0",
        now: "T1b",
      }),
    ]);
    const outcomes = [a.outcome, b.outcome].sort();
    expect(outcomes).toEqual(["conflict", "updated"]);
    expect(store.getVersions().map((v) => v.versionNumber)).toEqual([1, 2]);
    // Contiguous, exactly one applied edit version beyond bootstrap.
    expect(store.getVersions()).toHaveLength(2);
  });

  it("E. concurrent version numbering: no duplicates", async () => {
    const store = createStore({
      id: "s1",
      status: "saved",
      planJson: basePlan,
      updatedAt: "T0",
    });
    // Chain CAS tokens via sequentialized lock (AI path null expected).
    const results = await Promise.all(
      Array.from({ length: 5 }, (_, i) =>
        store.persist({
          nextPlan: { title: `P${i}`, days: [] },
          editInstruction: `[ai:${i}]`,
          expectedUpdatedAt: null,
          now: `T${i + 1}`,
        }),
      ),
    );
    expect(results.every((r) => r.outcome === "updated")).toBe(true);
    const numbers = store.getVersions().map((v) => v.versionNumber);
    expect(numbers).toEqual([1, 2, 3, 4, 5, 6]);
    expect(new Set(numbers).size).toBe(numbers.length);
  });

  it("F. saved status remains saved", async () => {
    const store = createStore({
      id: "s1",
      status: "saved",
      planJson: basePlan,
      updatedAt: "T0",
    });
    const result = await store.persist({
      nextPlan: planB,
      editInstruction: "[manual:update_day]",
      expectedUpdatedAt: "T0",
      now: "T1",
    });
    expect(result).toMatchObject({ outcome: "updated", status: "saved" });
    expect(store.getSession().status).toBe("saved");
  });

  it("G. generated status remains generated", async () => {
    const store = createStore({
      id: "s1",
      status: "generated",
      planJson: basePlan,
      updatedAt: "T0",
    });
    const result = await store.persist({
      nextPlan: planB,
      editInstruction: "ai",
      expectedUpdatedAt: null,
      now: "T1",
    });
    expect(result).toMatchObject({ outcome: "updated", status: "generated" });
  });

  it("H. draft reject", async () => {
    const store = createStore({
      id: "s1",
      status: "draft",
      planJson: basePlan,
      updatedAt: "T0",
    });
    const result = await store.persist({
      nextPlan: planB,
      editInstruction: "x",
      expectedUpdatedAt: "T0",
      now: "T1",
    });
    expect(result.outcome).toBe("invalid_status");
    expect(store.getVersions()).toHaveLength(0);
    expect(store.getSession().planJson).toEqual(basePlan);
  });

  it("AI null expectedUpdatedAt: history matches DB transitions under lock", async () => {
    const store = createStore({
      id: "s1",
      status: "generated",
      planJson: basePlan,
      updatedAt: "T0",
    });
    const [a, b] = await Promise.all([
      store.persist({
        nextPlan: planB,
        editInstruction: "ai-a",
        expectedUpdatedAt: null,
        now: "T1",
      }),
      store.persist({
        nextPlan: planC,
        editInstruction: "ai-b",
        expectedUpdatedAt: null,
        now: "T2",
      }),
    ]);
    expect(a.outcome).toBe("updated");
    expect(b.outcome).toBe("updated");
    const versions = store.getVersions();
    expect(versions.map((v) => v.versionNumber)).toEqual([1, 2, 3]);
    // Bootstrap = old; then whichever ran first; final session = last writer.
    expect(versions[0]!.planJson).toEqual(basePlan);
    expect(store.getSession().planJson).toEqual(
      versions[versions.length - 1]!.planJson,
    );
  });
});
