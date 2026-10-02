/**
 * Server-only: resolves approved Canonical + Story/Proposition from the candidate package,
 * then builds the Instagram cardnews handoff. Reads only; never writes.
 */

import { resolveCanonicalMarketingAsset } from "@/lib/marketing/canonicalAsset/persistence";
import { resolveCanonicalAssetDomainContext } from "@/lib/marketing/canonicalAsset/resolveCanonicalAssetDomainContext";
import type { CompletedMarketingCandidate } from "@/lib/marketing/cron/daily/types";
import { resolveCandidatePackageRoot } from "@/lib/marketing/editorialDirector/researchHandoff/loadResearchHandoffSource";

import {
  buildInstagramCardnewsHandoff,
  type BuildInstagramCardnewsHandoffResult,
} from "@/lib/marketing/editorialDirector/instagramCardnewsHandoff/buildInstagramCardnewsHandoff";

export function buildInstagramCardnewsHandoffForCandidate(input: {
  candidate: CompletedMarketingCandidate;
  packageRoot?: string | null;
  canonicalLockedTerms?: readonly string[];
  now?: Date;
}): BuildInstagramCardnewsHandoffResult {
  const packageRoot =
    input.packageRoot === undefined ? resolveCandidatePackageRoot(input.candidate) : input.packageRoot;
  const asset = resolveCanonicalMarketingAsset({ candidate: input.candidate, packageRoot });
  const domain = asset
    ? resolveCanonicalAssetDomainContext({
        candidate: { ...input.candidate, canonicalMarketingAsset: asset },
        packageRoot,
      })
    : null;

  return buildInstagramCardnewsHandoff({
    candidateId: input.candidate.candidateId,
    asset,
    storyPoint: domain?.storyPoint ?? null,
    proposition: domain?.proposition ?? null,
    canonicalLockedTerms: input.canonicalLockedTerms,
    now: input.now,
  });
}
