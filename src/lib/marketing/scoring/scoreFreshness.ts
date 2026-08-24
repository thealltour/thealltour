import type { ContextSourceType } from "@/lib/marketing/context/types";
import {
  EVERGREEN_MEMORY_HALF_LIFE_DAYS,
  EVERGREEN_MEMORY_TYPES,
  FRESHNESS_HALF_LIFE_DAYS,
  MISSING_DATE_FRESHNESS,
} from "@/lib/marketing/scoring/constants";
import { candidateMemoryType, candidateOccurredAt } from "@/lib/marketing/scoring/candidateAccessors";
import { clamp01 } from "@/lib/marketing/scoring/clamp";
import type { ContextCandidate } from "@/lib/marketing/scoring/types";

const MS_PER_DAY = 24 * 60 * 60 * 1000;

export function freshnessHalfLifeDays(sourceType: ContextSourceType, memoryType?: string | null): number {
  if (sourceType === "memory" && memoryType && EVERGREEN_MEMORY_TYPES.has(memoryType)) {
    return EVERGREEN_MEMORY_HALF_LIFE_DAYS;
  }
  return FRESHNESS_HALF_LIFE_DAYS[sourceType];
}

export function scoreFreshnessFromAge(input: {
  occurredAt: string | null;
  sourceType: ContextSourceType;
  memoryType?: string | null;
  now?: Date;
}): number {
  if (!input.occurredAt) return MISSING_DATE_FRESHNESS[input.sourceType];
  const occurred = new Date(input.occurredAt);
  if (Number.isNaN(occurred.getTime())) return MISSING_DATE_FRESHNESS[input.sourceType];
  const now = input.now ?? new Date();
  const ageDays = (now.getTime() - occurred.getTime()) / MS_PER_DAY;
  if (ageDays <= 0) return 1;
  const halfLife = freshnessHalfLifeDays(input.sourceType, input.memoryType);
  return clamp01(2 ** (-ageDays / halfLife));
}

export function scoreFreshness(candidate: ContextCandidate, now: Date = new Date()): number {
  return scoreFreshnessFromAge({
    occurredAt: candidateOccurredAt(candidate),
    sourceType: candidate.sourceType,
    memoryType: candidateMemoryType(candidate),
    now,
  });
}
