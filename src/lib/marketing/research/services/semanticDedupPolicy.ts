/** Conservative thresholds — precision over recall for L3 merge. */
export type SemanticDedupPolicy = {
  /** Minimum cosine similarity to consider a pair at all (after prefilter). */
  candidateThreshold: number;
  /** Middle band: linkage only, no hard merge. */
  uncertainThreshold: number;
  /** Auto-merge when similarity >= mergeThreshold and guards pass. */
  mergeThreshold: number;
  /** Strong merge even with slightly weaker temporal overlap. */
  strongMergeThreshold: number;
  /** Max age difference (hours) for time-sensitive types. */
  maxTimeSensitiveAgeHours: number;
};

export const DEFAULT_SEMANTIC_DEDUP_POLICY: SemanticDedupPolicy = {
  candidateThreshold: 0.72,
  uncertainThreshold: 0.82,
  mergeThreshold: 0.88,
  strongMergeThreshold: 0.93,
  maxTimeSensitiveAgeHours: 72,
};

export type SemanticDuplicateDecision = "merge" | "link" | "distinct";

export function resolveDuplicateDecision(
  similarity: number,
  policy: SemanticDedupPolicy = DEFAULT_SEMANTIC_DEDUP_POLICY,
): SemanticDuplicateDecision {
  if (similarity >= policy.mergeThreshold) return "merge";
  if (similarity >= policy.uncertainThreshold) return "link";
  if (similarity >= policy.candidateThreshold) return "distinct";
  return "distinct";
}
