import type {
  AgendaHistoryItem,
  BookingInsightContext,
  ContentHistoryItem,
  ContextSource,
  ConversionSummary,
  CustomerInsightContext,
  MemoryContext,
  PerformanceSummary,
  ProductContext,
  PublicationContext,
  ReviewInsightContext,
  TaxonomyContext,
} from "@/lib/marketing/context/types";
import type { ExecutedRetrieval } from "@/lib/marketing/retrieval/types";
import type { ContextCandidate } from "@/lib/marketing/scoring/types";

export const NOW = "2026-08-24T00:00:00.000Z";
export const PRODUCT_ID = "11111111-1111-4111-8111-111111111111";
export const CAMPAIGN_ID = "22222222-2222-4222-8222-222222222222";
export const OTHER_PRODUCT_ID = "33333333-3333-4333-8333-333333333333";

export function source(sourceType: ContextSource["sourceType"], sourceTable: string): ContextSource {
  return {
    sourceType,
    sourceId: null,
    sourceTable,
    retrievedAt: NOW,
    periodStart: null,
    periodEnd: null,
  };
}

export function emptyConversion(): ConversionSummary {
  return { none: 0, reserved: 0, completed: 0, canceled: 0, other: 0 };
}

export function campaignTaxonomy(): TaxonomyContext {
  return {
    id: CAMPAIGN_ID,
    name: "봄",
    slug: "spring",
    taxonomyType: "campaign",
    parentId: null,
    displayLabel: null,
    badgeDescription: null,
    seoTitle: null,
    seoDescription: null,
  };
}

export function product(overrides: Partial<ProductContext> = {}): ProductContext {
  return {
    id: PRODUCT_ID,
    title: "다낭 4일",
    oneLiner: null,
    description: null,
    status: "AVAILABLE",
    isActive: true,
    price: 1_000_000,
    priceMeta: null,
    duration: "4일",
    destination: null,
    productLine: null,
    campaigns: [campaignTaxonomy()],
    unresolvedCampaignLabels: [],
    tags: [],
    sellingPoints: null,
    benefits: null,
    tourismPoints: null,
    guidePoints: null,
    inclusions: null,
    includedItems: null,
    exclusions: null,
    optionalTours: null,
    optionalExpenses: null,
    itinerary: null,
    detailedSchedule: null,
    itineraryDays: null,
    itineraryV2: null,
    departureSchedules: null,
    accommodation: null,
    transportation: null,
    insurance: null,
    bookingNotes: null,
    travelNotes: null,
    refundPolicy: null,
    images: [],
    sourceUrl: null,
    ...overrides,
  };
}

export function contentItem(overrides: Partial<ContentHistoryItem> = {}): ContentHistoryItem {
  return {
    id: "content-1",
    sourceType: "ai_content",
    sourceId: "content-1",
    channel: "threads",
    productId: PRODUCT_ID,
    title: "다낭",
    body: null,
    summary: null,
    publishedAt: NOW,
    createdAt: NOW,
    metadata: { campaignId: CAMPAIGN_ID },
    similarityAvailable: false,
    ...overrides,
  };
}

export function publication(overrides: Partial<PublicationContext> = {}): PublicationContext {
  return {
    id: "pub-1",
    contentId: "content-1",
    channel: "threads",
    externalPostId: null,
    externalUrl: null,
    status: "published",
    scheduledAt: null,
    publishedAt: NOW,
    lastCheckedAt: NOW,
    ...overrides,
  };
}

export function customerInsights(overrides: Partial<CustomerInsightContext> = {}): CustomerInsightContext {
  return {
    topic: "voice_of_customer",
    productId: PRODUCT_ID,
    period: { start: "2026-08-01T00:00:00.000Z", end: NOW },
    inquiryCount: 4,
    topQuestions: [],
    topConcerns: [],
    conversionSummary: emptyConversion(),
    reviewSummary: null,
    ...overrides,
  };
}

export function bookingInsights(overrides: Partial<BookingInsightContext> = {}): BookingInsightContext {
  return {
    bookingCount: 2,
    pendingDepositCount: 0,
    reservedCount: 1,
    completedCount: 1,
    canceledCount: 0,
    otherStatusCount: 0,
    travelerCount: 4,
    revenue: 2_000_000,
    period: { start: "2026-08-01T00:00:00.000Z", end: NOW },
    productId: PRODUCT_ID,
    departureDateRange: { start: null, end: null },
    ...overrides,
  };
}

export function reviewInsights(overrides: Partial<ReviewInsightContext> = {}): ReviewInsightContext {
  return {
    reviewCount: 3,
    averageRating: 4.5,
    summaryText: null,
    positivePoints: [],
    negativePoints: [],
    contentTips: [],
    scheduleRating: null,
    stayRating: null,
    guideRating: null,
    foodRating: null,
    recommendedFor: [],
    ...overrides,
  };
}

export function performance(overrides: Partial<PerformanceSummary> = {}): PerformanceSummary {
  return {
    period: { start: "2026-08-01T00:00:00.000Z", end: NOW },
    channel: "threads",
    productId: PRODUCT_ID,
    publicationCount: 2,
    metrics: [{ metricType: "impressions", value: 10, change: null, measuredAt: NOW }],
    topPerformingContent: [],
    bottomPerformingContent: [],
    topAgendas: [],
    conversionSummary: emptyConversion(),
    ...overrides,
  };
}

export function memory(overrides: Partial<MemoryContext> = {}): MemoryContext {
  return {
    id: "mem-1",
    memoryType: "customer_insight",
    title: null,
    content: "이동 거리 문의",
    sourceType: "inferred",
    sourceId: null,
    importance: 0.4,
    confidence: 0.5,
    embeddingModel: null,
    createdAt: NOW,
    updatedAt: NOW,
    expiresAt: null,
    ...overrides,
  };
}

export function agenda(overrides: Partial<AgendaHistoryItem> = {}): AgendaHistoryItem {
  return {
    id: "agenda-1",
    campaignId: CAMPAIGN_ID,
    topic: "다낭 걷기",
    agendaKey: "danang-walk",
    lastUsedAt: NOW,
    usageCount: 2,
    createdAt: NOW,
    ...overrides,
  };
}

export function emptyRetrieval(overrides: Partial<ExecutedRetrieval> = {}): ExecutedRetrieval {
  return {
    product: null,
    customerInsights: null,
    bookingInsights: null,
    reviewInsights: null,
    contentHistory: null,
    publications: null,
    performance: null,
    memory: null,
    agendaHistory: null,
    sources: [],
    retrievedAt: NOW,
    ...overrides,
  };
}

export function candidate<K extends ContextCandidate["kind"]>(
  kind: K,
  data: Extract<ContextCandidate, { kind: K }>["data"],
  extra?: Partial<Extract<ContextCandidate, { kind: K }>>,
): Extract<ContextCandidate, { kind: K }> {
  const sourceTypeByKind = {
    product: "product",
    customerInsights: "inquiry_insight",
    bookingInsights: "booking_insight",
    reviewInsights: "review_insight",
    contentHistory: "content_history",
    publications: "publication",
    performance: "performance",
    memory: "memory",
    agendaHistory: "agenda",
  } as const;
  const sourceKeyByKind = {
    product: "product",
    customerInsights: "customerInsights",
    bookingInsights: "bookings",
    reviewInsights: "reviews",
    contentHistory: "contentHistory",
    publications: "publications",
    performance: "performance",
    memory: "memory",
    agendaHistory: "agendas",
  } as const;
  return {
    id: `${kind}:1`,
    kind,
    sourceKey: sourceKeyByKind[kind],
    sourceType: sourceTypeByKind[kind],
    data,
    sources: [source(sourceTypeByKind[kind], kind)],
    ...extra,
  } as Extract<ContextCandidate, { kind: K }>;
}

export const createContentRequest = {
  purpose: "create_content",
  canonicalPurpose: "create_content",
  productId: PRODUCT_ID,
  campaignId: CAMPAIGN_ID,
  channel: "threads",
};
