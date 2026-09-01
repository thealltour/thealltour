import "server-only";

import { stripForbiddenBotData, jsonContainsForbiddenBotLeak } from "@/lib/marketing/bot/sanitize";
import type { MarketingBotDeps } from "@/lib/marketing/bot/types";
import { getAssignmentResearchEvidence } from "@/lib/marketing/content/store/contentAssignmentStore";
import type { GetAssignmentResearchEvidenceResult } from "@/lib/marketing/content/types";

export type GetAssignmentResearchEvidenceInput = {
  assignmentId: string;
};

export async function getAssignmentResearchEvidenceTool(
  input: GetAssignmentResearchEvidenceInput,
  deps: MarketingBotDeps = {},
): Promise<GetAssignmentResearchEvidenceResult> {
  const assignmentId = input.assignmentId?.trim();
  if (!assignmentId) throw new Error("assignmentId is required");

  const store = deps.contentAssignmentStore;
  const result = store
    ? getAssignmentResearchEvidence(assignmentId, store)
    : getAssignmentResearchEvidence(assignmentId);

  const safe = stripForbiddenBotData(result);
  if (jsonContainsForbiddenBotLeak(safe)) {
    throw new Error("assignment evidence sanitization failed");
  }
  return safe;
}
