import type {
  AgendaHistoryItem,
  BookingInsightContext,
  ContentHistoryItem,
  ContextSource,
  CustomerInsightContext,
  MemoryContext,
  PerformanceSummary,
  ProductContext,
  PublicationContext,
  ReviewInsightContext,
} from "@/lib/marketing/context/types";
import type { RetrievalResult, RetrievalSourceKey } from "@/lib/marketing/retrieval/types";

export type ContextScore = {
  relevance: number;
  freshness: number;
  reliability: number;
  businessImportance: number;
  total: number;
};

export type ScoringWeights = {
  relevance: number;
  freshness: number;
  reliability: number;
  businessImportance: number;
};

export type ScoringRequest = {
  purpose: string;
  canonicalPurpose?: string;
  productId?: string;
  campaignId?: string;
  agendaId?: string;
  channel?: string;
};

export type ContextCandidateKind =
  | "product"
  | "customerInsights"
  | "bookingInsights"
  | "reviewInsights"
  | "contentHistory"
  | "publications"
  | "performance"
  | "memory"
  | "agendaHistory";

type CandidateBase = {
  id: string;
  sourceKey: RetrievalSourceKey;
  sourceType: ContextSource["sourceType"];
  sources: ContextSource[];
};

export type ProductCandidate = CandidateBase & { kind: "product"; data: ProductContext };
export type CustomerInsightCandidate = CandidateBase & {
  kind: "customerInsights";
  data: CustomerInsightContext;
};
export type BookingInsightCandidate = CandidateBase & {
  kind: "bookingInsights";
  data: BookingInsightContext;
};
export type ReviewInsightCandidate = CandidateBase & {
  kind: "reviewInsights";
  data: ReviewInsightContext;
};
export type ContentHistoryCandidate = CandidateBase & {
  kind: "contentHistory";
  data: ContentHistoryItem;
};
export type PublicationCandidate = CandidateBase & {
  kind: "publications";
  data: PublicationContext;
};
export type PerformanceCandidate = CandidateBase & {
  kind: "performance";
  data: PerformanceSummary;
};
export type MemoryCandidate = CandidateBase & { kind: "memory"; data: MemoryContext };
export type AgendaCandidate = CandidateBase & { kind: "agendaHistory"; data: AgendaHistoryItem };

export type ContextCandidate =
  | ProductCandidate
  | CustomerInsightCandidate
  | BookingInsightCandidate
  | ReviewInsightCandidate
  | ContentHistoryCandidate
  | PublicationCandidate
  | PerformanceCandidate
  | MemoryCandidate
  | AgendaCandidate;

export type ScoredContextCandidate = ContextCandidate & {
  score: ContextScore;
};

export type ScoredRetrievalResult<T> = RetrievalResult<T> & {
  score: ContextScore;
};

export type RankedContextSelection = {
  candidates: ScoredContextCandidate[];
  selected: ScoredContextCandidate[];
  contextLimit: number;
};
