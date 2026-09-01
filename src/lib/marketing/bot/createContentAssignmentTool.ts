import "server-only";

import { stripForbiddenBotData, jsonContainsForbiddenBotLeak } from "@/lib/marketing/bot/sanitize";
import type { MarketingBotDeps } from "@/lib/marketing/bot/types";
import { prepareManagerToContentHandoff } from "@/lib/marketing/content/prepareManagerToContentHandoff";
import type { CreateSelectedAgendaInput, ManagerToContentHandoffResult } from "@/lib/marketing/content/types";

export type CreateContentAssignmentInput = CreateSelectedAgendaInput & {
  channel?: string;
};

export async function createContentAssignmentTool(
  input: CreateContentAssignmentInput,
  deps: MarketingBotDeps = {},
): Promise<ManagerToContentHandoffResult> {
  const result = prepareManagerToContentHandoff(
    { ...input, now: deps.now },
    { store: deps.contentAssignmentStore, now: deps.now },
  );
  const safe = stripForbiddenBotData(result);
  if (jsonContainsForbiddenBotLeak(safe)) {
    throw new Error("content assignment creation sanitization failed");
  }
  return safe;
}
