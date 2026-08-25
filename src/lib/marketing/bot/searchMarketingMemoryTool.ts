import "server-only";

import { parseSemanticRetrievalRequest } from "@/lib/marketing/semantic/validateSemanticRequest";
import { compactSemanticMatches } from "@/lib/marketing/bot/compactContext";
import { MarketingBotValidationError } from "@/lib/marketing/bot/errors";
import { stripForbiddenBotData } from "@/lib/marketing/bot/sanitize";
import type {
  MarketingBotDeps,
  SearchMarketingMemoryInput,
  SearchMarketingMemoryResult,
} from "@/lib/marketing/bot/types";

export async function searchMarketingMemoryTool(
  input: SearchMarketingMemoryInput,
  deps: MarketingBotDeps = {},
): Promise<SearchMarketingMemoryResult> {
  if (!input.query?.trim()) {
    throw new MarketingBotValidationError("query is required");
  }
  const parsed = parseSemanticRetrievalRequest({
    query: input.query,
    limit: input.limit,
    memoryTypes: input.memoryType?.trim() ? [input.memoryType.trim()] : undefined,
    sourceTypes: input.sourceType?.trim() ? [input.sourceType.trim()] : undefined,
  });
  const retrieve =
    deps.semanticRetrieve ??
    (await import("@/lib/marketing/semantic/semanticRetrieve")).semanticRetrieve;
  const result = await retrieve(parsed, { env: deps.env });
  return stripForbiddenBotData({
    status: result.status,
    reason: result.reason,
    matchCount: result.matches.length,
    matches: compactSemanticMatches(result.matches),
  });
}
