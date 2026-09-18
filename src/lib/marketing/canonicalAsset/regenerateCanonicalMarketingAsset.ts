/**
 * Operator rewrite: regenerate Canonical Marketing Asset with current ASW prompt.
 * Preserves Story / Evidence / Proposition locks; does not approve or publish.
 */

import { existsSync, mkdirSync } from "node:fs";

import { resolveMarketingAssetRoot } from "@/lib/marketing/assets/config";
import { exportMarketingCandidatePackage } from "@/lib/marketing/assets/exportMarketingCandidatePackage";
import { ensurePackageLayout, resolvePackageDirectory } from "@/lib/marketing/assets/paths";
import type { MarketingProductionRequest } from "@/lib/marketing/cron/daily/agendaSlate/productionRequestTypes";
import type { CompletedMarketingCandidate } from "@/lib/marketing/cron/daily/types";
import type { DailyMarketingRunRepository } from "@/lib/marketing/cron/daily/repository/createDailyMarketingRunRepository";
import {
  ensureCanonicalMarketingAsset,
  type AssetSourceWriterInvoke,
  type EnsureCanonicalMarketingAssetResult,
} from "@/lib/marketing/canonicalAsset/ensureCanonicalMarketingAsset";
import {
  attachCanonicalAssetToCandidate,
  persistCanonicalAssetToPackage,
  readCanonicalAssetFromPackage,
} from "@/lib/marketing/canonicalAsset/persistence";
import {
  canValidateCanonicalAssetAgainstDomain,
  resolveCanonicalAssetDomainContext,
} from "@/lib/marketing/canonicalAsset/resolveCanonicalAssetDomainContext";
import { resolveStoryEditorialArchetype } from "@/lib/marketing/canonicalAsset/revisions";
import type { CanonicalMarketingAsset } from "@/lib/marketing/canonicalAsset/contracts";
import type { DurableStoryPointCandidateSet } from "@/lib/marketing/storyPoint/contracts";
import { createStoryPointHash } from "@/lib/marketing/storyPoint/hash";
import { parseAudienceContentResearchBrief } from "@/lib/marketing/audienceResearch/validate";
import { AUDIENCE_CONTENT_RESEARCH_BRIEF_RELATIVE_PATH } from "@/lib/marketing/audienceResearch/paths";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { PRODUCTION_REQUEST_EXTERNAL_STORY_PROVENANCE_KEY } from "@/lib/marketing/editorialDirector/contracts";

function readAcrb(packageRoot: string) {
  try {
    const path = join(packageRoot, AUDIENCE_CONTENT_RESEARCH_BRIEF_RELATIVE_PATH);
    if (!existsSync(path)) return null;
    return parseAudienceContentResearchBrief(JSON.parse(readFileSync(path, "utf8")));
  } catch {
    return null;
  }
}

function storySetFromProductionRequest(
  request: MarketingProductionRequest | null | undefined,
): DurableStoryPointCandidateSet | null {
  const meta = request?.metadata as Record<string, unknown> | undefined;
  if (!meta) return null;
  const raw = meta.storyPointCandidateSetFull ?? meta.storyPointCandidateSet ?? null;
  if (!raw || typeof raw !== "object") return null;
  return raw as DurableStoryPointCandidateSet;
}

function withResolvedArchetype(
  story: NonNullable<ReturnType<typeof resolveCanonicalAssetDomainContext>["storyPoint"]>,
  productionRequest?: MarketingProductionRequest | null,
) {
  const existing = resolveStoryEditorialArchetype(story);
  if (existing) {
    return { ...story, editorialArchetype: existing };
  }
  const meta = productionRequest?.metadata as Record<string, unknown> | undefined;
  const provMap = meta?.[PRODUCTION_REQUEST_EXTERNAL_STORY_PROVENANCE_KEY] as
    | Record<string, { editorialArchetype?: string | null }>
    | undefined;
  const fromProv = provMap?.[story.pointId]?.editorialArchetype?.trim();
  if (fromProv) {
    return { ...story, editorialArchetype: fromProv };
  }
  return story;
}

export type RegenerateCanonicalMarketingAssetResult = {
  candidate: CompletedMarketingCandidate;
  asset: CanonicalMarketingAsset;
  ensure: EnsureCanonicalMarketingAssetResult;
  packageRoot: string;
};

/**
 * Force Asset Source Writer rewrite for an awaiting-approval (or draft) candidate.
 * Does not trigger channel generation.
 */
export async function regenerateCanonicalMarketingAsset(input: {
  candidate: CompletedMarketingCandidate;
  runRepo: DailyMarketingRunRepository;
  invoke: AssetSourceWriterInvoke;
  productionRequest?: MarketingProductionRequest | null;
  storyPointCandidateSet?: DurableStoryPointCandidateSet | null;
  now?: Date;
}): Promise<RegenerateCanonicalMarketingAssetResult> {
  const now = input.now ?? new Date();
  const assetRoot = resolveMarketingAssetRoot({});
  const packageRoot = resolvePackageDirectory({
    assetRoot,
    businessDateKst: input.candidate.businessDateKst,
    candidateId: input.candidate.candidateId,
  });
  mkdirSync(packageRoot, { recursive: true });
  ensurePackageLayout(packageRoot);

  const storySet =
    input.storyPointCandidateSet ?? storySetFromProductionRequest(input.productionRequest);
  const acrb = readAcrb(packageRoot);
  const ctx = resolveCanonicalAssetDomainContext({
    candidate: input.candidate,
    packageRoot,
    audienceContentResearchBrief: acrb,
    storyPointCandidateSet: storySet,
  });
  if (!canValidateCanonicalAssetAgainstDomain(ctx)) {
    throw new Error("canonical_asset_validation_context_missing");
  }

  const storyPoint = withResolvedArchetype(ctx.storyPoint, input.productionRequest);
  const storyPointHash = ctx.storyPointHash || createStoryPointHash(storyPoint);
  const topicIdentitySummary = [
    input.candidate.selectedAgenda.title,
    input.candidate.selectedAgenda.destinations?.join(", ") ?? "",
    input.candidate.contentAssignment.topic,
  ]
    .filter(Boolean)
    .join(" · ");

  const ensure = await ensureCanonicalMarketingAsset({
    agendaId: input.candidate.selectedAgenda.id,
    storyPoint,
    storyPointHash,
    evidenceBrief: ctx.evidenceBrief,
    proposition: ctx.proposition,
    topicIdentitySummary,
    brandContextKo: null,
    existing: readCanonicalAssetFromPackage(packageRoot) ?? input.candidate.canonicalMarketingAsset,
    forceRegenerate: true,
    invoke: input.invoke,
    now,
  });

  if (!ensure.asset) {
    const err = new Error("canonical_asset_regenerate_failed") as Error & {
      issues?: typeof ensure.validationIssues;
      outcome?: string;
    };
    err.issues = ensure.validationIssues;
    err.outcome = ensure.outcome;
    throw err;
  }
  if (ensure.outcome === "validation_failed" || ensure.outcome === "parse_failed") {
    const err = new Error("canonical_asset_validation_failed") as Error & {
      issues?: typeof ensure.validationIssues;
    };
    err.issues = ensure.validationIssues;
    // Still persist failed draft for operator visibility.
    persistCanonicalAssetToPackage({ packageRoot, asset: ensure.asset });
    throw err;
  }

  persistCanonicalAssetToPackage({ packageRoot, asset: ensure.asset });
  let candidate = attachCanonicalAssetToCandidate(input.candidate, ensure.asset);
  try {
    candidate = await input.runRepo.saveCandidate(candidate);
  } catch {
    /* keep local candidate */
  }

  exportMarketingCandidatePackage({
    candidate,
    assetRoot,
    now,
    overwriteArtifacts: true,
    audienceContentResearchBrief: acrb,
    publishableBundle: null,
    canonicalMarketingAsset: ensure.asset,
  });

  return { candidate, asset: ensure.asset, ensure, packageRoot };
}
