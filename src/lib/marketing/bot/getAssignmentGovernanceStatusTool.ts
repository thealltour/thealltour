import "server-only";

import { stripForbiddenBotData, jsonContainsForbiddenBotLeak } from "@/lib/marketing/bot/sanitize";
import type { MarketingBotDeps } from "@/lib/marketing/bot/types";
import { getAssignmentGovernanceStatus } from "@/lib/marketing/content/governance/store/governanceReviewStore";
import type { GetAssignmentGovernanceStatusResult } from "@/lib/marketing/content/governance/types";

export type GetAssignmentGovernanceStatusInput = {
  assignmentId: string;
};

export async function getAssignmentGovernanceStatusTool(
  input: GetAssignmentGovernanceStatusInput,
  deps: MarketingBotDeps = {},
): Promise<GetAssignmentGovernanceStatusResult> {
  const assignmentId = input.assignmentId?.trim();
  if (!assignmentId) throw new Error("assignmentId is required");

  const store = deps.governanceReviewStore;
  const result = store
    ? getAssignmentGovernanceStatus(assignmentId, store)
    : getAssignmentGovernanceStatus(assignmentId);

  const safe = stripForbiddenBotData(result);
  if (jsonContainsForbiddenBotLeak(safe)) {
    throw new Error("assignment governance status sanitization failed");
  }
  return safe;
}
