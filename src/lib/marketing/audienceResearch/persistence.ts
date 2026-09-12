import type { MarketingProductionRequest } from "@/lib/marketing/cron/daily/agendaSlate/productionRequestTypes";
import type { MarketingProductionRequestRepository } from "@/lib/marketing/cron/daily/repository/createMarketingProductionRequestRepository";
import {
  PRODUCTION_OUTCOME_RESEARCH_SKIP,
  PRODUCTION_REQUEST_ACRB_METADATA_KEY,
  PRODUCTION_REQUEST_ACRB_SAVED_AT_KEY,
  type AudienceContentResearchBrief,
} from "@/lib/marketing/audienceResearch/contracts";
import { parseAudienceContentResearchBrief } from "@/lib/marketing/audienceResearch/validate";

export function readAcrbFromProductionRequest(
  request: MarketingProductionRequest | null | undefined,
): AudienceContentResearchBrief | null {
  if (!request?.metadata) return null;
  return parseAudienceContentResearchBrief(request.metadata[PRODUCTION_REQUEST_ACRB_METADATA_KEY]);
}

export async function loadDurableAcrb(input: {
  repo: MarketingProductionRequestRepository;
  logicalRunKey: string;
  expectedLogicalIdentity?: string | null;
}): Promise<AudienceContentResearchBrief | null> {
  const request = await input.repo.findByLogicalKey(input.logicalRunKey);
  const brief = readAcrbFromProductionRequest(request);
  if (!brief) return null;
  if (
    input.expectedLogicalIdentity &&
    brief.logicalIdentity !== input.expectedLogicalIdentity
  ) {
    return null;
  }
  return brief;
}

/**
 * Persist ACRB on the production request before Content Strategist.
 * Survives worker crash / queue retry without DB migration.
 */
export async function persistDurableAcrb(input: {
  repo: MarketingProductionRequestRepository;
  logicalRunKey: string;
  brief: AudienceContentResearchBrief;
  now?: Date;
}): Promise<AudienceContentResearchBrief> {
  const existing = await input.repo.findByLogicalKey(input.logicalRunKey);
  if (!existing) {
    throw new Error(`production_request_missing_for_acrb:${input.logicalRunKey}`);
  }
  const nowIso = (input.now ?? new Date()).toISOString();
  await input.repo.update({
    ...existing,
    updatedAt: nowIso,
    metadata: {
      ...existing.metadata,
      [PRODUCTION_REQUEST_ACRB_METADATA_KEY]: input.brief,
      [PRODUCTION_REQUEST_ACRB_SAVED_AT_KEY]: nowIso,
    },
  });
  return input.brief;
}

export async function finalizeProductionResearchSkip(input: {
  repo: MarketingProductionRequestRepository;
  request: MarketingProductionRequest;
  brief: AudienceContentResearchBrief;
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
      [PRODUCTION_REQUEST_ACRB_METADATA_KEY]: input.brief,
      [PRODUCTION_REQUEST_ACRB_SAVED_AT_KEY]: nowIso,
      productionOutcome: PRODUCTION_OUTCOME_RESEARCH_SKIP,
      researchVerdict: input.brief.researchVerdict,
      researchSkipReasons: input.brief.verdictReasons,
    },
  });
}

export function isProductionResearchSkip(request: MarketingProductionRequest): boolean {
  return request.metadata?.productionOutcome === PRODUCTION_OUTCOME_RESEARCH_SKIP;
}
