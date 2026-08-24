import type { ContextSource } from "@/lib/marketing/context/types";
import { DEFAULT_CONTEXT_LIMIT } from "@/lib/marketing/retrieval/constants";
import type { ExecutedRetrieval } from "@/lib/marketing/retrieval/types";
import { flattenRetrievalCandidates } from "@/lib/marketing/scoring/flattenRetrievalCandidates";
import { selectTopK } from "@/lib/marketing/scoring/rankContextCandidates";
import { scoreContextCandidate } from "@/lib/marketing/scoring/scoreContext";
import type {
  ContextCandidateKind,
  RankedContextSelection,
  ScoredContextCandidate,
  ScoringRequest,
} from "@/lib/marketing/scoring/types";

export type SelectScoredContextResult = RankedContextSelection & {
  retrieval: ExecutedRetrieval;
};

function uniqueSources(sources: ContextSource[]): ContextSource[] {
  const seen = new Set<string>();
  const out: ContextSource[] = [];
  for (const source of sources) {
    const key = [
      source.sourceType,
      source.sourceTable,
      source.sourceId ?? "",
      source.retrievedAt,
      source.periodStart ?? "",
      source.periodEnd ?? "",
    ].join("|");
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(source);
  }
  return out;
}

function selectedOfKind<K extends ContextCandidateKind>(
  selected: ScoredContextCandidate[],
  kind: K,
): Extract<ScoredContextCandidate, { kind: K }>[] {
  return selected.filter(
    (candidate): candidate is Extract<ScoredContextCandidate, { kind: K }> => candidate.kind === kind,
  );
}

export function rebuildRetrievalFromSelected(
  retrieved: ExecutedRetrieval,
  selected: ScoredContextCandidate[],
): ExecutedRetrieval {
  const product = selectedOfKind(selected, "product")[0]?.data ?? null;
  const customerInsights =
    retrieved.customerInsights == null
      ? null
      : (selectedOfKind(selected, "customerInsights")[0]?.data ?? null);
  const bookingInsights =
    retrieved.bookingInsights == null
      ? null
      : (selectedOfKind(selected, "bookingInsights")[0]?.data ?? null);
  const reviewInsights =
    retrieved.reviewInsights == null
      ? null
      : (selectedOfKind(selected, "reviewInsights")[0]?.data ?? null);
  const contentHistory =
    retrieved.contentHistory == null
      ? null
      : selectedOfKind(selected, "contentHistory").map((candidate) => candidate.data);
  const publications =
    retrieved.publications == null
      ? null
      : selectedOfKind(selected, "publications").map((candidate) => candidate.data);
  const performance =
    retrieved.performance == null ? null : (selectedOfKind(selected, "performance")[0]?.data ?? null);
  const memory =
    retrieved.memory == null ? null : selectedOfKind(selected, "memory").map((candidate) => candidate.data);
  const agendaHistory =
    retrieved.agendaHistory == null
      ? null
      : selectedOfKind(selected, "agendaHistory").map((candidate) => candidate.data);

  return {
    product,
    customerInsights,
    bookingInsights,
    reviewInsights,
    contentHistory,
    publications,
    performance,
    memory,
    agendaHistory,
    sources: uniqueSources(selected.flatMap((candidate) => candidate.sources)),
    retrievedAt: retrieved.retrievedAt,
  };
}

export function selectScoredContext(
  retrieved: ExecutedRetrieval,
  request: ScoringRequest,
  options?: { contextLimit?: number; now?: Date },
): SelectScoredContextResult {
  const contextLimit = options?.contextLimit ?? DEFAULT_CONTEXT_LIMIT;
  const now = options?.now ?? new Date();
  const candidates = flattenRetrievalCandidates(retrieved).map((candidate) => ({
    ...candidate,
    score: scoreContextCandidate(candidate, request, now),
  }));
  const selected = selectTopK(candidates, contextLimit);
  return {
    candidates,
    selected,
    contextLimit,
    retrieval: rebuildRetrievalFromSelected(retrieved, selected),
  };
}
