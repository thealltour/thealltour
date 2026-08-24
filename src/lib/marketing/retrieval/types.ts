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
import type { RETRIEVAL_SOURCE_KEYS } from "@/lib/marketing/retrieval/constants";

export type MarketingRetrievalPurpose =
  | "create_content"
  | "analyze_performance"
  | "governance_check"
  | "trend_analysis"
  | "campaign_planning"
  | (string & {});

export type RetrievalSourceKey = (typeof RETRIEVAL_SOURCE_KEYS)[number];

export type MarketingRetrievalRequest = {
  purpose: string;
  productId?: string;
  campaignId?: string;
  agendaId?: string;
  taxonomyId?: string;
  channel?: string;
  lookbackDays?: number;
  startAt?: string;
  endAt?: string;
  periodStart?: string;
  periodEnd?: string;
  limit?: number;
  includeProduct?: boolean;
  includeCustomerInsights?: boolean;
  includeBookings?: boolean;
  includeReviews?: boolean;
  includeContentHistory?: boolean;
  includePublications?: boolean;
  includePerformance?: boolean;
  includeMemory?: boolean;
  includeAgendas?: boolean;
  contentId?: string;
  bookingStatus?: string;
  acquisitionChannel?: string;
  publicationStatus?: string;
  memoryType?: string;
  sourceType?: string;
  sourceId?: string;
  minImportance?: number;
  minConfidence?: number;
  excludeExpired?: boolean;
  activeOnly?: boolean;
};

export type ParsedMarketingRetrievalRequest = MarketingRetrievalRequest & {
  purpose: string;
  canonicalPurpose: string;
  limit: number;
  excludeExpired: boolean;
  activeOnly: boolean;
  period: { start: string; end: string } | null;
};

export type RetrievalPlan = {
  purpose: string;
  canonicalPurpose: string;
  sources: RetrievalSourceKey[];
};

export type RetrievalResult<T> = {
  data: T;
  sources: ContextSource[];
  retrievedAt: string;
};

export type ExecutedRetrieval = {
  product: ProductContext | null;
  customerInsights: CustomerInsightContext | null;
  bookingInsights: BookingInsightContext | null;
  reviewInsights: ReviewInsightContext | null;
  contentHistory: ContentHistoryItem[] | null;
  publications: PublicationContext[] | null;
  performance: PerformanceSummary | null;
  memory: MemoryContext[] | null;
  agendaHistory: AgendaHistoryItem[] | null;
  sources: ContextSource[];
  retrievedAt: string;
};

export type RetrievalAdapters = {
  retrieveProduct: (
    request: ParsedMarketingRetrievalRequest,
  ) => Promise<RetrievalResult<ProductContext | null>>;
  retrieveCustomerInsights: (
    request: ParsedMarketingRetrievalRequest,
  ) => Promise<RetrievalResult<CustomerInsightContext>>;
  retrieveBookings: (
    request: ParsedMarketingRetrievalRequest,
  ) => Promise<RetrievalResult<BookingInsightContext>>;
  retrieveReviews: (
    request: ParsedMarketingRetrievalRequest,
  ) => Promise<RetrievalResult<ReviewInsightContext>>;
  retrieveContentHistory: (
    request: ParsedMarketingRetrievalRequest,
  ) => Promise<RetrievalResult<ContentHistoryItem[]>>;
  retrievePublications: (
    request: ParsedMarketingRetrievalRequest,
  ) => Promise<RetrievalResult<PublicationContext[]>>;
  retrievePerformance: (
    request: ParsedMarketingRetrievalRequest,
  ) => Promise<RetrievalResult<PerformanceSummary>>;
  retrieveMemory: (
    request: ParsedMarketingRetrievalRequest,
  ) => Promise<RetrievalResult<MemoryContext[]>>;
  retrieveAgendas: (
    request: ParsedMarketingRetrievalRequest,
  ) => Promise<RetrievalResult<AgendaHistoryItem[]>>;
};
