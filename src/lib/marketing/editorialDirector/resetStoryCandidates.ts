/**
 * Wipe all Story candidates (internal Story Miner + external imports) from a production
 * request so the agenda can be re-mined from scratch. Never touches finished productions.
 */

import {
  PRODUCTION_REQUEST_ACRB_METADATA_KEY,
  PRODUCTION_REQUEST_ACRB_SAVED_AT_KEY,
} from "@/lib/marketing/audienceResearch/contracts";
import { PRODUCTION_REQUEST_CANONICAL_ASSET_KEY } from "@/lib/marketing/canonicalAsset/contracts";
import type { MarketingProductionRequest } from "@/lib/marketing/cron/daily/agendaSlate/productionRequestTypes";
import {
  PRODUCTION_REQUEST_EXTERNAL_EDITORIAL_IMPORTS_KEY,
  PRODUCTION_REQUEST_EXTERNAL_STORY_PROVENANCE_KEY,
  type StoryCandidateResetReason,
  type StoryCandidateResetRecord,
} from "@/lib/marketing/editorialDirector/contracts";
import {
  PRODUCTION_REQUEST_STORY_POINT_METADATA_KEY,
  PRODUCTION_REQUEST_STORY_POINT_SAVED_AT_KEY,
} from "@/lib/marketing/storyPoint/contracts";
import {
  PRODUCTION_OUTCOME_AWAITING_STORY_SELECTION,
  PRODUCTION_REQUEST_HUMAN_STORY_SELECTION_KEY,
} from "@/lib/marketing/storyPoint/humanStorySelection";
import { parseDurableStoryPointCandidateSet } from "@/lib/marketing/storyPoint/persistence";

const IMPORT_LOG_LIMIT = 12;

const STORY_POINT_FULL_METADATA_KEY = "storyPointCandidateSetFull";

// Every key the importer, Story Miner, selection and story-targeted research write
// onto the request; readers fall back to the *Full set, so both must go.
const STORY_METADATA_KEYS = [
  PRODUCTION_REQUEST_STORY_POINT_METADATA_KEY,
  STORY_POINT_FULL_METADATA_KEY,
  PRODUCTION_REQUEST_STORY_POINT_SAVED_AT_KEY,
  PRODUCTION_REQUEST_EXTERNAL_STORY_PROVENANCE_KEY,
  PRODUCTION_REQUEST_ACRB_METADATA_KEY,
  PRODUCTION_REQUEST_ACRB_SAVED_AT_KEY,
  "selectedStoryPointId",
  "selectedStoryPointHash",
  "lastStoryResearchRejectReason",
  "storyResearch",
  "storyResearchSkipReason",
  "storyPointSkipReason",
  "researchVerdict",
  "researchSkipReasons",
] as const;

export type StoryCandidateResetBlockCode = "PRODUCTION_ALREADY_COMPLETE" | "PRODUCTION_BUSY";

export class StoryCandidateResetError extends Error {
  readonly code: StoryCandidateResetBlockCode;
  readonly status = 409;
  constructor(message: string, code: StoryCandidateResetBlockCode) {
    super(message);
    this.code = code;
  }
}

/** Null when resettable; otherwise the block reason. */
export function storyCandidateResetBlock(
  request: MarketingProductionRequest,
): { code: StoryCandidateResetBlockCode; messageKo: string } | null {
  if (request.completedCandidateId || request.metadata?.[PRODUCTION_REQUEST_CANONICAL_ASSET_KEY]) {
    return {
      code: "PRODUCTION_ALREADY_COMPLETE",
      messageKo: "공통 원문 단계까지 진행된 제작은 Story 후보를 지울 수 없습니다",
    };
  }
  if (request.status === "QUEUED" || request.status === "RUNNING") {
    return {
      code: "PRODUCTION_BUSY",
      messageKo: `제작이 ${request.status} 상태라 Story 후보를 지울 수 없습니다`,
    };
  }
  return null;
}

export function assertStoryCandidatesResettable(request: MarketingProductionRequest): void {
  const block = storyCandidateResetBlock(request);
  if (block) throw new StoryCandidateResetError(block.messageKo, block.code);
}

export function listStoryCandidatePointIds(metadata: Record<string, unknown> | null | undefined): string[] {
  const ids = new Set<string>();
  for (const key of [PRODUCTION_REQUEST_STORY_POINT_METADATA_KEY, STORY_POINT_FULL_METADATA_KEY]) {
    const set = parseDurableStoryPointCandidateSet(metadata?.[key]);
    for (const c of set?.candidates ?? []) ids.add(c.pointId);
  }
  return [...ids];
}

export function resetStoryCandidateMetadata(
  metadata: Record<string, unknown>,
  input: { nowIso: string; reason: StoryCandidateResetReason },
): { metadata: Record<string, unknown>; removedPointIds: string[] } {
  const removedPointIds = listStoryCandidatePointIds(metadata);
  const next: Record<string, unknown> = { ...metadata };
  for (const key of STORY_METADATA_KEYS) delete next[key];

  const priorLog = Array.isArray(metadata[PRODUCTION_REQUEST_EXTERNAL_EDITORIAL_IMPORTS_KEY])
    ? (metadata[PRODUCTION_REQUEST_EXTERNAL_EDITORIAL_IMPORTS_KEY] as unknown[])
    : [];
  const record: StoryCandidateResetRecord = {
    kind: "reset",
    at: input.nowIso,
    reason: input.reason,
    removedPointIds,
  };
  next[PRODUCTION_REQUEST_EXTERNAL_EDITORIAL_IMPORTS_KEY] = [...priorLog, record].slice(-IMPORT_LOG_LIMIT);
  next[PRODUCTION_REQUEST_HUMAN_STORY_SELECTION_KEY] = null;
  next.productionOutcome = PRODUCTION_OUTCOME_AWAITING_STORY_SELECTION;
  return { metadata: next, removedPointIds };
}

/** Full request after reset: parked in Story selection with no candidates. */
export function resetStoryCandidatesOnRequest(
  request: MarketingProductionRequest,
  input: { nowIso: string; reason: StoryCandidateResetReason },
): { request: MarketingProductionRequest; removedPointIds: string[] } {
  assertStoryCandidatesResettable(request);
  const { metadata, removedPointIds } = resetStoryCandidateMetadata(request.metadata ?? {}, input);
  return {
    request: {
      ...request,
      status: "COMPLETED",
      completedAt: request.completedAt ?? input.nowIso,
      failedAt: null,
      lastError: null,
      errorMessage: null,
      claimedAt: null,
      startedAt: null,
      claimToken: null,
      workerId: null,
      updatedAt: input.nowIso,
      metadata,
    },
    removedPointIds,
  };
}
