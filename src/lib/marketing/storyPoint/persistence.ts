import type { MarketingProductionRequest } from "@/lib/marketing/cron/daily/agendaSlate/productionRequestTypes";
import type { MarketingProductionRequestRepository } from "@/lib/marketing/cron/daily/repository/createMarketingProductionRequestRepository";
import {
  PRODUCTION_OUTCOME_STORY_POINT_SKIP,
  PRODUCTION_REQUEST_STORY_POINT_METADATA_KEY,
  PRODUCTION_REQUEST_STORY_POINT_SAVED_AT_KEY,
  STORY_POINT_CANDIDATE_SET_CONTRACT,
  STORY_POINT_SKIP_REASONS,
  type DurableStoryPointCandidateSet,
  type StoryPointMineOutcome,
  type StoryPointSkipReason,
} from "@/lib/marketing/storyPoint/contracts";

function isSkipReason(value: unknown): value is StoryPointSkipReason {
  return (
    typeof value === "string" &&
    (STORY_POINT_SKIP_REASONS as readonly string[]).includes(value)
  );
}

function isMineOutcome(value: unknown): value is StoryPointMineOutcome {
  return value === "pass" || value === "skip";
}

/** Best-effort parse of durable CandidateSet from production-request metadata. */
export function parseDurableStoryPointCandidateSet(
  raw: unknown,
): DurableStoryPointCandidateSet | null {
  if (!raw || typeof raw !== "object") return null;
  const o = raw as Record<string, unknown>;
  if (o.contract !== STORY_POINT_CANDIDATE_SET_CONTRACT) return null;
  if (typeof o.agendaId !== "string" || !o.agendaId.trim()) return null;
  if (typeof o.assignmentId !== "string" || !o.assignmentId.trim()) return null;
  if (typeof o.inputRevision !== "string" || !o.inputRevision.trim()) return null;
  if (!isMineOutcome(o.outcome)) return null;
  if (!Array.isArray(o.candidates) || !Array.isArray(o.gateResults)) return null;

  return {
    contract: STORY_POINT_CANDIDATE_SET_CONTRACT,
    minerVersion: typeof o.minerVersion === "string" ? o.minerVersion : "unknown",
    agendaId: o.agendaId.trim(),
    assignmentId: o.assignmentId.trim(),
    inputRevision: o.inputRevision.trim(),
    logicalIdentity:
      typeof o.logicalIdentity === "string" ? o.logicalIdentity : o.inputRevision.trim(),
    createdAt: typeof o.createdAt === "string" ? o.createdAt : new Date(0).toISOString(),
    attempts: typeof o.attempts === "number" ? o.attempts : 0,
    llmCallCount: typeof o.llmCallCount === "number" ? o.llmCallCount : 0,
    outcome: o.outcome,
    skipReason: isSkipReason(o.skipReason) ? o.skipReason : null,
    candidates: o.candidates as DurableStoryPointCandidateSet["candidates"],
    gateResults: o.gateResults as DurableStoryPointCandidateSet["gateResults"],
    selectedPointIds: Array.isArray(o.selectedPointIds)
      ? (o.selectedPointIds.filter((x) => typeof x === "string") as string[])
      : [],
    primaryStoryPointId:
      typeof o.primaryStoryPointId === "string" ? o.primaryStoryPointId : null,
    alternateStoryPointIds: Array.isArray(o.alternateStoryPointIds)
      ? (o.alternateStoryPointIds.filter((x) => typeof x === "string") as string[])
      : [],
    primaryStoryPointHash:
      typeof o.primaryStoryPointHash === "string" ? o.primaryStoryPointHash : null,
    diagnostics: (o.diagnostics && typeof o.diagnostics === "object"
      ? o.diagnostics
      : {
          candidateCount: 0,
          passCount: 0,
          diversityRejectedCount: 0,
          identityRejectedCount: 0,
          mechanisms: [],
          selectedPrimaryTitle: null,
          attemptSummaries: [],
        }) as DurableStoryPointCandidateSet["diagnostics"],
  };
}

export function readStoryPointCandidateSetFromProductionRequest(
  request: MarketingProductionRequest | null | undefined,
): DurableStoryPointCandidateSet | null {
  if (!request?.metadata) return null;
  const primary = parseDurableStoryPointCandidateSet(
    request.metadata[PRODUCTION_REQUEST_STORY_POINT_METADATA_KEY],
  );
  const full = parseDurableStoryPointCandidateSet(
    request.metadata.storyPointCandidateSetFull,
  );
  if (!primary && !full) return null;
  if (!primary) return full;
  if (!full) return primary;
  const extCount = (set: DurableStoryPointCandidateSet) =>
    set.candidates.filter((c) => String(c.pointId).startsWith("sp_ext_")).length;
  const primaryExt = extCount(primary);
  const fullExt = extCount(full);
  if (fullExt > primaryExt) return full;
  if (full.candidates.length > primary.candidates.length) return full;
  return primary;
}

export async function loadDurableStoryPointCandidateSet(input: {
  repo: MarketingProductionRequestRepository;
  logicalRunKey: string;
  expectedInputRevision?: string | null;
}): Promise<DurableStoryPointCandidateSet | null> {
  const request = await input.repo.findByLogicalKey(input.logicalRunKey);
  const set = readStoryPointCandidateSetFromProductionRequest(request);
  if (!set) return null;
  if (input.expectedInputRevision && set.inputRevision !== input.expectedInputRevision) {
    return null;
  }
  return set;
}

export async function persistDurableStoryPointCandidateSet(input: {
  repo: MarketingProductionRequestRepository;
  logicalRunKey: string;
  candidateSet: DurableStoryPointCandidateSet;
  now?: Date;
}): Promise<DurableStoryPointCandidateSet> {
  const existing = await input.repo.findByLogicalKey(input.logicalRunKey);
  if (!existing) {
    throw new Error(`production_request_missing_for_story_point:${input.logicalRunKey}`);
  }
  const nowIso = (input.now ?? new Date()).toISOString();
  await input.repo.update({
    ...existing,
    updatedAt: nowIso,
    metadata: {
      ...existing.metadata,
      [PRODUCTION_REQUEST_STORY_POINT_METADATA_KEY]: input.candidateSet,
      [PRODUCTION_REQUEST_STORY_POINT_SAVED_AT_KEY]: nowIso,
    },
  });
  return input.candidateSet;
}

export async function finalizeProductionStoryPointSkip(input: {
  repo: MarketingProductionRequestRepository;
  request: MarketingProductionRequest;
  candidateSet: DurableStoryPointCandidateSet;
  now?: Date;
}): Promise<MarketingProductionRequest> {
  const nowIso = (input.now ?? new Date()).toISOString();
  return input.repo.update({
    ...input.request,
    status: "COMPLETED",
    completedAt: nowIso,
    failedAt: null,
    lastError: null,
    errorMessage: null,
    completedCandidateId: null,
    updatedAt: nowIso,
    metadata: {
      ...input.request.metadata,
      [PRODUCTION_REQUEST_STORY_POINT_METADATA_KEY]: input.candidateSet,
      [PRODUCTION_REQUEST_STORY_POINT_SAVED_AT_KEY]: nowIso,
      productionOutcome: PRODUCTION_OUTCOME_STORY_POINT_SKIP,
      storyPointOutcome: input.candidateSet.outcome,
      storyPointSkipReason: input.candidateSet.skipReason,
      storyPointDiagnostics: input.candidateSet.diagnostics,
    },
  });
}

export function isProductionStoryPointSkip(request: MarketingProductionRequest): boolean {
  return request.metadata?.productionOutcome === PRODUCTION_OUTCOME_STORY_POINT_SKIP;
}
