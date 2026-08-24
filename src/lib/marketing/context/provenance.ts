import type { ContextSource, ContextSourceType } from "@/lib/marketing/context/types";

export function createContextSource(input: {
  sourceType: ContextSourceType;
  sourceTable: string;
  sourceId?: string | null;
  retrievedAt?: string;
  periodStart?: string | null;
  periodEnd?: string | null;
}): ContextSource {
  return {
    sourceType: input.sourceType,
    sourceId: input.sourceId ?? null,
    sourceTable: input.sourceTable,
    retrievedAt: input.retrievedAt ?? new Date().toISOString(),
    periodStart: input.periodStart ?? null,
    periodEnd: input.periodEnd ?? null,
  };
}
