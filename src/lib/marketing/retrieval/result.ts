import { createContextSource } from "@/lib/marketing/context/provenance";
import type { ContextSource, ContextSourceType } from "@/lib/marketing/context/types";
import type { RetrievalResult } from "@/lib/marketing/retrieval/types";

export function createRetrievalResult<T>(input: {
  data: T;
  sourceType: ContextSourceType;
  sourceTable: string;
  sourceId?: string | null;
  periodStart?: string | null;
  periodEnd?: string | null;
  retrievedAt?: string;
  extraSources?: ContextSource[];
}): RetrievalResult<T> {
  const retrievedAt = input.retrievedAt ?? new Date().toISOString();
  return {
    data: input.data,
    retrievedAt,
    sources: [
      createContextSource({
        sourceType: input.sourceType,
        sourceTable: input.sourceTable,
        sourceId: input.sourceId,
        retrievedAt,
        periodStart: input.periodStart,
        periodEnd: input.periodEnd,
      }),
      ...(input.extraSources ?? []),
    ],
  };
}
