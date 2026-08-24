import { mapAiMemoryRow } from "@/lib/marketing/context/mappers/memoryContextMapper";
import { fetchAiMemoryRows } from "@/lib/marketing/context/sources/memorySource";
import { createRetrievalResult } from "@/lib/marketing/retrieval/result";
import type { MemoryContext } from "@/lib/marketing/context/types";
import type { ParsedMarketingRetrievalRequest, RetrievalResult } from "@/lib/marketing/retrieval/types";

export async function retrieveMemory(
  request: ParsedMarketingRetrievalRequest,
): Promise<RetrievalResult<MemoryContext[]>> {
  const rows = await fetchAiMemoryRows({
    memoryType: request.memoryType,
    sourceType: request.sourceType ?? (request.productId ? "product" : undefined),
    sourceId: request.sourceId ?? request.productId,
    minImportance: request.minImportance,
    minConfidence: request.minConfidence,
    excludeExpired: request.excludeExpired,
    limit: request.limit,
  });

  return createRetrievalResult({
    data: rows.map(mapAiMemoryRow).filter((item): item is MemoryContext => item != null),
    sourceType: "memory",
    sourceTable: "ai_memory",
    sourceId: request.productId ?? request.sourceId,
  });
}
