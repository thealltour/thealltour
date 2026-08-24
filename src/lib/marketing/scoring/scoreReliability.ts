import { MEMORY_RELIABILITY_CAP, SOURCE_RELIABILITY } from "@/lib/marketing/scoring/constants";
import { clamp01 } from "@/lib/marketing/scoring/clamp";
import type { ContextCandidate } from "@/lib/marketing/scoring/types";

function normalizeUnitInterval(value: number | null | undefined): number | null {
  if (value == null || !Number.isFinite(value)) return null;
  if (value >= 0 && value <= 1) return value;
  if (value > 1 && value <= 10) return clamp01(value / 10);
  return clamp01(value);
}

export function scoreReliability(candidate: ContextCandidate): number {
  const base = SOURCE_RELIABILITY[candidate.sourceType];
  if (candidate.kind !== "memory") return clamp01(base);
  const confidence = normalizeUnitInterval(candidate.data.confidence) ?? 0;
  const importance = normalizeUnitInterval(candidate.data.importance) ?? 0;
  return clamp01(Math.min(MEMORY_RELIABILITY_CAP, base + 0.2 * confidence + 0.1 * importance));
}
