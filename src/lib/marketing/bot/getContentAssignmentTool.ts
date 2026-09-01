import "server-only";

import { stripForbiddenBotData, jsonContainsForbiddenBotLeak } from "@/lib/marketing/bot/sanitize";
import type { MarketingBotDeps } from "@/lib/marketing/bot/types";
import { getContentAssignmentById } from "@/lib/marketing/content/store/contentAssignmentStore";
import type { GetContentAssignmentResult } from "@/lib/marketing/content/types";

export type GetContentAssignmentInput = {
  assignmentId: string;
};

export async function getContentAssignmentTool(
  input: GetContentAssignmentInput,
  deps: MarketingBotDeps = {},
): Promise<GetContentAssignmentResult> {
  const assignmentId = input.assignmentId?.trim();
  if (!assignmentId) throw new Error("assignmentId is required");

  const store = deps.contentAssignmentStore;
  const result = store
    ? getContentAssignmentById(assignmentId, store)
    : getContentAssignmentById(assignmentId);

  const safe = stripForbiddenBotData(result);
  if (jsonContainsForbiddenBotLeak(safe)) {
    throw new Error("content assignment sanitization failed");
  }
  return safe;
}
