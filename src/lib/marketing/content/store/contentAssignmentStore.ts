import type {
  ContentAssignment,
  GetAssignmentResearchEvidenceResult,
  GetContentAssignmentResult,
  SelectedAgenda,
} from "@/lib/marketing/content/types";

export type ContentAssignmentStoreRecord = {
  assignment: ContentAssignment;
  selectedAgenda: SelectedAgenda;
  idempotencyKey: string;
};

export type ContentAssignmentStore = {
  save(record: ContentAssignmentStoreRecord): ContentAssignmentStoreRecord;
  findByAssignmentId(assignmentId: string): ContentAssignmentStoreRecord | null;
  findByIdempotencyKey(key: string): ContentAssignmentStoreRecord | null;
  list(limit?: number): ContentAssignmentStoreRecord[];
};

export function createInMemoryContentAssignmentStore(): ContentAssignmentStore {
  const byAssignmentId = new Map<string, ContentAssignmentStoreRecord>();
  const byIdempotencyKey = new Map<string, ContentAssignmentStoreRecord>();

  return {
    save(record) {
      const existing = byIdempotencyKey.get(record.idempotencyKey);
      if (existing) return existing;
      byAssignmentId.set(record.assignment.assignmentId, record);
      byIdempotencyKey.set(record.idempotencyKey, record);
      return record;
    },
    findByAssignmentId(assignmentId) {
      return byAssignmentId.get(assignmentId) ?? null;
    },
    findByIdempotencyKey(key) {
      return byIdempotencyKey.get(key) ?? null;
    },
    list(limit = 20) {
      return [...byAssignmentId.values()].slice(0, limit);
    },
  };
}

let defaultStore: ContentAssignmentStore | null = null;

export function getDefaultContentAssignmentStore(): ContentAssignmentStore {
  if (!defaultStore) defaultStore = createInMemoryContentAssignmentStore();
  return defaultStore;
}

export function resetDefaultContentAssignmentStore(): void {
  defaultStore = null;
}

export function getContentAssignmentById(
  assignmentId: string,
  store: ContentAssignmentStore = getDefaultContentAssignmentStore(),
): GetContentAssignmentResult {
  const record = store.findByAssignmentId(assignmentId);
  if (!record) return { status: "not_found", assignmentId };
  return {
    status: "ok",
    assignment: record.assignment,
    selectedAgenda: record.selectedAgenda,
  };
}

export function getAssignmentResearchEvidence(
  assignmentId: string,
  store: ContentAssignmentStore = getDefaultContentAssignmentStore(),
): GetAssignmentResearchEvidenceResult {
  const record = store.findByAssignmentId(assignmentId);
  if (!record) return { status: "not_found", assignmentId };
  return {
    status: "ok",
    assignmentId,
    evidenceRefs: record.assignment.evidenceRefs,
    facts: record.assignment.facts,
  };
}
