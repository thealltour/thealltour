import "server-only";

import { resolveMarketingAssetRoot } from "@/lib/marketing/assets/config";
import {
  renderInstagramCardnewsForPackage,
  type RenderInstagramCardnewsResult,
} from "@/lib/marketing/assets/cardnews/instagramCardnews";
import { MarketingAssetPathError } from "@/lib/marketing/assets/errors";
import { loadCompletedMarketingCandidateForAssets } from "@/lib/marketing/assets/candidateAssetPackageService";
import { resolvePackageDirectory } from "@/lib/marketing/assets/paths";

/**
 * Operator-triggered Instagram cardnews render for one CompletedMarketingCandidate.
 * Reads only persisted HDD package artifacts (same as CLI/timer). No SNS side effects.
 */
export async function renderCandidateInstagramCardnews(input: {
  candidateId: string;
  dryRun?: boolean;
  graphicOnly?: boolean;
}): Promise<
  | { ok: true; result: RenderInstagramCardnewsResult; businessDateKst: string; packageRoot: string }
  | { ok: false; reason: "candidate_not_found" }
> {
  const candidate = await loadCompletedMarketingCandidateForAssets(input.candidateId);
  if (!candidate) return { ok: false, reason: "candidate_not_found" };

  let assetRoot: string;
  try {
    assetRoot = resolveMarketingAssetRoot({});
  } catch (error) {
    throw error instanceof Error ? error : new MarketingAssetPathError(String(error));
  }

  const packageRoot = resolvePackageDirectory({
    assetRoot,
    businessDateKst: candidate.businessDateKst,
    candidateId: candidate.candidateId,
  });

  const result = await renderInstagramCardnewsForPackage({
    packageRoot,
    assetRoot,
    dryRun: Boolean(input.dryRun),
    graphicOnly: Boolean(input.graphicOnly),
  });

  return {
    ok: true,
    result,
    businessDateKst: candidate.businessDateKst,
    packageRoot,
  };
}
