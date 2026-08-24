import { HYBRID_SCORE_WEIGHTS } from "@/lib/marketing/scoring/constants";
import { clamp01 } from "@/lib/marketing/scoring/clamp";

export function combineHybridScores(input: {
  semanticScore: number | null;
  contextScore: number;
  semanticWeight?: number;
  contextWeight?: number;
}): number {
  if (input.semanticScore == null) return clamp01(input.contextScore);
  const semanticWeight = input.semanticWeight ?? HYBRID_SCORE_WEIGHTS.semantic;
  const contextWeight = input.contextWeight ?? HYBRID_SCORE_WEIGHTS.context;
  return clamp01(input.semanticScore * semanticWeight + input.contextScore * contextWeight);
}
