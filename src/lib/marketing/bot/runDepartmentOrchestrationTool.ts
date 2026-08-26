import "server-only";

import { orchestrateDepartmentTask } from "@/lib/marketing/bot/organization/orchestrate";
import { stripForbiddenBotData } from "@/lib/marketing/bot/sanitize";
import type { MarketingBotDeps } from "@/lib/marketing/bot/types";

export type RunDepartmentOrchestrationInput = {
  userRequest: string;
  productId?: string | null;
  channel?: string | null;
};

export async function runDepartmentOrchestrationTool(
  input: RunDepartmentOrchestrationInput,
  deps: MarketingBotDeps = {},
) {
  const result = await orchestrateDepartmentTask(
    {
      userRequest: input.userRequest,
      productId: input.productId,
      channel: input.channel,
      depth: 0,
    },
    deps,
  );
  return stripForbiddenBotData(result);
}
