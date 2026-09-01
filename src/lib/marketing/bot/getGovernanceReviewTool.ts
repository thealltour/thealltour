import "server-only";

import { stripForbiddenBotData, jsonContainsForbiddenBotLeak } from "@/lib/marketing/bot/sanitize";
import type { MarketingBotDeps } from "@/lib/marketing/bot/types";
import { getGovernanceReviewById } from "@/lib/marketing/content/governance/store/governanceReviewStore";
import type { GetGovernanceReviewResult } from "@/lib/marketing/content/governance/types";

export type GetGovernanceReviewInput = {
  reviewId: string;
};

export async function getGovernanceReviewTool(
  input: GetGovernanceReviewInput,
  deps: MarketingBotDeps = {},
): Promise<GetGovernanceReviewResult> {
  const reviewId = input.reviewId?.trim();
  if (!reviewId) throw new Error("reviewId is required");

  const store = deps.governanceReviewStore;
  const result = store ? getGovernanceReviewById(reviewId, store) : getGovernanceReviewById(reviewId);

  const safe = stripForbiddenBotData(result);
  if (jsonContainsForbiddenBotLeak(safe)) {
    throw new Error("governance review sanitization failed");
  }
  return safe;
}
