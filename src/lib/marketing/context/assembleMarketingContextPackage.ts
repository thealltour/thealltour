import type {
  AgendaHistoryItem,
  BookingInsightContext,
  ContentHistoryItem,
  CustomerInsightContext,
  MarketingContextPackage,
  MarketingContextRequest,
  MemoryContext,
  PerformanceSummary,
  ProductContext,
  PublicationContext,
  ReviewInsightContext,
  ContextSource,
} from "@/lib/marketing/context/types";

export function assembleMarketingContextPackage(input: {
  request: MarketingContextRequest;
  product?: ProductContext | null;
  customerInsights?: CustomerInsightContext | null;
  bookingInsights?: BookingInsightContext | null;
  reviewInsights?: ReviewInsightContext | null;
  contentHistory?: ContentHistoryItem[] | null;
  publications?: PublicationContext[] | null;
  performance?: PerformanceSummary | null;
  memory?: MemoryContext[] | null;
  agendaHistory?: AgendaHistoryItem[] | null;
  sources: ContextSource[];
  generatedAt?: string;
}): MarketingContextPackage {
  return {
    request: input.request,
    context: {
      product: input.product ?? null,
      customerInsights: input.customerInsights ?? null,
      bookingInsights: input.bookingInsights ?? null,
      reviewInsights: input.reviewInsights ?? null,
      contentHistory: input.contentHistory ?? null,
      publications: input.publications ?? null,
      performance: input.performance ?? null,
      memory: input.memory ?? null,
    },
    governance: {
      recentAgendaUsage: input.agendaHistory ?? undefined,
      recentPublications: undefined,
    },
    sources: input.sources,
    generatedAt: input.generatedAt ?? new Date().toISOString(),
  };
}
