import type { ProductSellingPoints } from "@/types/product";
import type { JsonObject } from "@/lib/marketing/context/json";

export type ContextSourceType =
  | "product"
  | "taxonomy"
  | "inquiry_insight"
  | "booking_insight"
  | "review_insight"
  | "content_history"
  | "publication"
  | "performance"
  | "memory"
  | "agenda";

export type ContextSource = {
  sourceType: ContextSourceType;
  sourceId?: string | null;
  sourceTable: string;
  retrievedAt: string;
  periodStart?: string | null;
  periodEnd?: string | null;
};

export type TaxonomyContext = {
  id: string;
  name: string;
  slug: string | null;
  taxonomyType: string;
  parentId: string | null;
  displayLabel: string | null;
  badgeDescription: string | null;
  seoTitle: string | null;
  seoDescription: string | null;
};

export type ProductContext = {
  id: string;
  title: string;
  oneLiner: string | null;
  description: string | null;
  status: string | null;
  isActive: boolean;
  price: number | null;
  priceMeta: string | null;
  duration: string | null;
  destination: TaxonomyContext | null;
  productLine: TaxonomyContext | null;
  campaigns: TaxonomyContext[];
  unresolvedCampaignLabels: string[];
  tags: string[];
  sellingPoints: ProductSellingPoints | null;
  benefits: string | null;
  tourismPoints: string | null;
  guidePoints: string | null;
  inclusions: string | null;
  includedItems: string | null;
  exclusions: string | null;
  optionalTours: string | null;
  optionalExpenses: string | null;
  itinerary: string | null;
  detailedSchedule: string | null;
  itineraryDays: unknown;
  itineraryV2: unknown;
  departureSchedules: unknown;
  accommodation: string | null;
  transportation: string | null;
  insurance: string | null;
  bookingNotes: string | null;
  travelNotes: string | null;
  refundPolicy: string | null;
  images: string[];
  sourceUrl: string | null;
};

export type InquiryInsightContext = {
  content: string;
  productId: string | null;
  productTitle: string | null;
  acquisitionChannel: string | null;
  acquisitionSourceLabel: string | null;
  acquisitionMedium: string | null;
  firstTouch: JsonObject | null;
  consultationStatus: string | null;
  bookingStatus: string | null;
  createdAt: string | null;
};

export type ConversionSummary = {
  none: number;
  reserved: number;
  completed: number;
  canceled: number;
  other: number;
};

export type CustomerInsightContext = {
  topic: string;
  productId: string | null;
  period: { start: string; end: string };
  inquiryCount: number;
  topQuestions: string[];
  topConcerns: string[];
  conversionSummary: ConversionSummary;
  reviewSummary: ReviewInsightContext | null;
};

export type BookingInsightContext = {
  bookingCount: number;
  pendingDepositCount: number;
  reservedCount: number;
  completedCount: number;
  canceledCount: number;
  otherStatusCount: number;
  travelerCount: number;
  revenue: number;
  period: { start: string; end: string };
  productId: string | null;
  departureDateRange: { start: string | null; end: string | null };
};

export type ReviewInsightContext = {
  reviewCount: number;
  averageRating: number | null;
  positivePoints: string[];
  negativePoints: string[];
  contentTips: string[];
  scheduleRating: number | null;
  stayRating: number | null;
  guideRating: number | null;
  foodRating: number | null;
  recommendedFor: string[];
};

export type ContentHistoryItem = {
  id: string;
  sourceType:
    | "thread_marketing_post"
    | "ai_content"
    | "notice"
    | "guide"
    | "flyer_draft"
    | "home_hero_content"
    | "home_banner"
    | "mobile_golf_ad_landing";
  sourceId: string;
  channel: string | null;
  productId: string | null;
  title: string | null;
  body: string | null;
  summary: string | null;
  publishedAt: string | null;
  createdAt: string | null;
  metadata: JsonObject | null;
  similarityAvailable: boolean;
};

export type PublicationContext = {
  id: string;
  contentId: string;
  channel: string;
  externalPostId: string | null;
  externalUrl: string | null;
  status: string;
  scheduledAt: string | null;
  publishedAt: string | null;
  lastCheckedAt: string | null;
};

export type MetricSummary = {
  metricType: string;
  value: number;
  change: number | null;
  measuredAt: string | null;
};

export type PerformanceSummary = {
  period: { start: string; end: string };
  channel: string | null;
  productId: string | null;
  publicationCount: number;
  metrics: MetricSummary[];
  topPerformingContent: string[];
  bottomPerformingContent: string[];
  topAgendas: string[];
  conversionSummary: ConversionSummary | null;
};

export type AgendaHistoryItem = {
  id: string;
  campaignId: string | null;
  topic: string;
  agendaKey: string;
  lastUsedAt: string | null;
  usageCount: number;
  createdAt: string | null;
};

export type MemoryContext = {
  id: string;
  memoryType: string;
  title: string | null;
  content: string;
  sourceType: string | null;
  sourceId: string | null;
  importance: number | null;
  confidence: number | null;
  embeddingModel: string | null;
  createdAt: string | null;
  updatedAt: string | null;
  expiresAt: string | null;
};

export type MarketingContextPurpose =
  | "create_content"
  | "analyze_performance"
  | "governance_check"
  | "trend_analysis"
  | "campaign_planning"
  | (string & {});

export type MarketingContextRequest = {
  purpose: string;
  productId?: string;
  campaignId?: string;
  channel?: string;
  lookbackDays?: number;
  periodStart?: string;
  periodEnd?: string;
};

export type MarketingContextPackage = {
  request: MarketingContextRequest;
  context: {
    product?: ProductContext | null;
    customerInsights?: CustomerInsightContext | null;
    bookingInsights?: BookingInsightContext | null;
    reviewInsights?: ReviewInsightContext | null;
    contentHistory?: ContentHistoryItem[] | null;
    publications?: PublicationContext[] | null;
    performance?: PerformanceSummary | null;
    memory?: MemoryContext[] | null;
  };
  governance: {
    recentAgendaUsage?: AgendaHistoryItem[] | unknown;
    recentPublications?: unknown;
  };
  sources: ContextSource[];
  generatedAt: string;
  ranking?: {
    candidateCount: number;
    selectedCount: number;
    contextLimit: number;
  };
  semantic?: {
    status: "skipped" | "ok" | "failed";
    reason?: string;
  };
};
