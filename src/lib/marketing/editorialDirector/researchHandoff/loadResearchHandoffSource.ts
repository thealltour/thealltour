/**
 * Server-only: resolves approved Canonical + Story/Proposition/EvidenceBrief from the
 * candidate package, then builds the research handoff. Reads only; never writes.
 */

import { existsSync } from "node:fs";

import { resolveMarketingAssetRoot } from "@/lib/marketing/assets/config";
import { resolvePackageDirectory } from "@/lib/marketing/assets/paths";
import { resolveCanonicalMarketingAsset } from "@/lib/marketing/canonicalAsset/persistence";
import { resolveCanonicalAssetDomainContext } from "@/lib/marketing/canonicalAsset/resolveCanonicalAssetDomainContext";
import type { CompletedMarketingCandidate } from "@/lib/marketing/cron/daily/types";

import {
  buildEditorialResearchHandoff,
  type BuildEditorialResearchHandoffResult,
} from "@/lib/marketing/editorialDirector/researchHandoff/buildResearchHandoff";

export function resolveCandidatePackageRoot(candidate: CompletedMarketingCandidate): string | null {
  const packageRoot = resolvePackageDirectory({
    assetRoot: resolveMarketingAssetRoot({}),
    businessDateKst: candidate.businessDateKst,
    candidateId: candidate.candidateId,
  });
  return existsSync(packageRoot) ? packageRoot : null;
}

export function buildEditorialResearchHandoffForCandidate(input: {
  candidate: CompletedMarketingCandidate;
  /** Defaults to the candidate's marketing package directory when it exists. */
  packageRoot?: string | null;
  canonicalLockedTerms?: readonly string[];
  now?: Date;
}): BuildEditorialResearchHandoffResult {
  const packageRoot =
    input.packageRoot === undefined ? resolveCandidatePackageRoot(input.candidate) : input.packageRoot;
  const asset = resolveCanonicalMarketingAsset({ candidate: input.candidate, packageRoot });
  const domain = asset
    ? resolveCanonicalAssetDomainContext({
        candidate: { ...input.candidate, canonicalMarketingAsset: asset },
        packageRoot,
      })
    : null;

  return buildEditorialResearchHandoff({
    candidateId: input.candidate.candidateId,
    asset,
    storyPoint: domain?.storyPoint ?? null,
    proposition: domain?.proposition ?? null,
    evidenceBrief: domain?.evidenceBrief ?? null,
    canonicalLockedTerms: input.canonicalLockedTerms,
    now: input.now,
  });
}
