import type {
  GetAssignmentGovernanceStatusResult,
  GetGovernanceReviewResult,
  GovernanceReviewRecord,
  StructuredGovernanceDecision,
  StructuredGovernanceReviewRequest,
} from "@/lib/marketing/content/governance/types";

export type GovernanceReviewStore = {
  save(record: GovernanceReviewRecord): GovernanceReviewRecord;
  findByReviewId(reviewId: string): GovernanceReviewRecord | null;
  findByIdempotencyKey(key: string): GovernanceReviewRecord | null;
  listByAssignmentId(assignmentId: string, limit?: number): GovernanceReviewRecord[];
};

export function createInMemoryGovernanceReviewStore(): GovernanceReviewStore {
  const byReviewId = new Map<string, GovernanceReviewRecord>();
  const byIdempotencyKey = new Map<string, GovernanceReviewRecord>();
  const byAssignmentId = new Map<string, GovernanceReviewRecord[]>();

  return {
    save(record) {
      const existing = byIdempotencyKey.get(record.idempotencyKey);
      if (existing) {
        if (record.decision && !existing.decision) {
          byReviewId.set(record.reviewId, record);
          byIdempotencyKey.set(record.idempotencyKey, record);
          if (record.assignmentId) {
            const list = byAssignmentId.get(record.assignmentId) ?? [];
            const idx = list.findIndex((item) => item.reviewId === record.reviewId);
            if (idx >= 0) list[idx] = record;
            else list.unshift(record);
            byAssignmentId.set(record.assignmentId, list.slice(0, 20));
          }
          return record;
        }
        return existing;
      }
      byReviewId.set(record.reviewId, record);
      byIdempotencyKey.set(record.idempotencyKey, record);
      if (record.assignmentId) {
        const list = byAssignmentId.get(record.assignmentId) ?? [];
        list.unshift(record);
        byAssignmentId.set(record.assignmentId, list.slice(0, 20));
      }
      return record;
    },
    findByReviewId(reviewId) {
      return byReviewId.get(reviewId) ?? null;
    },
    findByIdempotencyKey(key) {
      return byIdempotencyKey.get(key) ?? null;
    },
    listByAssignmentId(assignmentId, limit = 10) {
      return (byAssignmentId.get(assignmentId) ?? []).slice(0, limit);
    },
  };
}

let defaultStore: GovernanceReviewStore | null = null;

export function getDefaultGovernanceReviewStore(): GovernanceReviewStore {
  if (!defaultStore) defaultStore = createInMemoryGovernanceReviewStore();
  return defaultStore;
}

export function resetDefaultGovernanceReviewStore(): void {
  defaultStore = null;
}

export function recordGovernanceReview(input: {
  request: StructuredGovernanceReviewRequest;
  decision: StructuredGovernanceDecision | null;
  idempotencyKey: string;
  store?: GovernanceReviewStore;
  now?: Date;
}): GovernanceReviewRecord {
  const store = input.store ?? getDefaultGovernanceReviewStore();
  const now = input.now ?? new Date();
  const existing = store.findByIdempotencyKey(input.idempotencyKey);
  if (existing) {
    if (input.decision && !existing.decision) {
      const updated: GovernanceReviewRecord = {
        ...existing,
        decision: input.decision,
        updatedAt: now.toISOString(),
      };
      store.save(updated);
      return updated;
    }
    return existing;
  }

  const record: GovernanceReviewRecord = {
    reviewId: input.request.reviewId,
    assignmentId: input.request.assignmentId,
    draftVersion: input.request.priorRevision,
    request: input.request,
    decision: input.decision,
    createdAt: now.toISOString(),
    updatedAt: now.toISOString(),
    idempotencyKey: input.idempotencyKey,
  };
  return store.save(record);
}

export function getGovernanceReviewById(
  reviewId: string,
  store: GovernanceReviewStore = getDefaultGovernanceReviewStore(),
): GetGovernanceReviewResult {
  const record = store.findByReviewId(reviewId);
  if (!record) return { status: "not_found", reviewId };
  return { status: "ok", record };
}

export function getAssignmentGovernanceStatus(
  assignmentId: string,
  store: GovernanceReviewStore = getDefaultGovernanceReviewStore(),
): GetAssignmentGovernanceStatusResult {
  const records = store.listByAssignmentId(assignmentId, 20);
  if (records.length === 0) return { status: "not_found", assignmentId };
  const latest = records[0]!;
  return {
    status: "ok",
    assignmentId,
    latestReviewId: latest.reviewId,
    latestDecision: latest.decision?.decision ?? null,
    revisionNumber: latest.draftVersion,
    reviewCount: records.length,
  };
}
