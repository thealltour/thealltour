import type { ScoredContextCandidate } from "@/lib/marketing/scoring/types";

export function compareScoredCandidates(a: ScoredContextCandidate, b: ScoredContextCandidate): number {
  if (b.score.total !== a.score.total) return b.score.total - a.score.total;
  if (b.score.freshness !== a.score.freshness) return b.score.freshness - a.score.freshness;
  if (b.score.relevance !== a.score.relevance) return b.score.relevance - a.score.relevance;
  return a.id.localeCompare(b.id);
}

export function rankContextCandidates(candidates: ScoredContextCandidate[]): ScoredContextCandidate[] {
  return [...candidates].sort(compareScoredCandidates);
}

export function selectTopK(
  candidates: ScoredContextCandidate[],
  limit: number,
): ScoredContextCandidate[] {
  return rankContextCandidates(candidates).slice(0, Math.max(0, limit));
}
