import "server-only";

import { stripForbiddenBotData, jsonContainsForbiddenBotLeak } from "@/lib/marketing/bot/sanitize";
import type {
  GetResearchContextInput,
  GetResearchContextResult,
  MarketingBotDeps,
} from "@/lib/marketing/bot/types";
import { getMarketingManagerResearchContext } from "@/lib/marketing/research/manager/getMarketingManagerResearchContext";

export async function getResearchContextTool(
  input: GetResearchContextInput = {},
  deps: MarketingBotDeps = {},
): Promise<GetResearchContextResult> {
  const options = {
    limit: input.limit,
    lookbackHours: input.lookbackHours,
    topic: input.topic,
    destination: input.destination,
    now: deps.now,
  };

  const context = deps.getManagerResearchContext
    ? await deps.getManagerResearchContext(options)
    : await getMarketingManagerResearchContext(options, { now: deps.now });

  const safe = stripForbiddenBotData(context);
  if (jsonContainsForbiddenBotLeak(safe)) {
    throw new Error("research context sanitization failed");
  }
  return safe;
}
