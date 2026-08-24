import { canonicalPurpose } from "@/lib/marketing/retrieval/validation";
import type {
  MarketingRetrievalRequest,
  ParsedMarketingRetrievalRequest,
  RetrievalPlan,
  RetrievalSourceKey,
} from "@/lib/marketing/retrieval/types";

const PURPOSE_SOURCES: Record<string, RetrievalSourceKey[]> = {
  create_content: ["product", "customerInsights", "contentHistory", "publications", "memory"],
  analyze_performance: ["publications", "performance", "customerInsights", "bookings", "reviews"],
  governance_check: ["contentHistory", "publications", "agendas", "memory"],
  trend_analysis: ["customerInsights", "performance", "memory"],
  campaign_planning: ["product", "customerInsights", "performance", "contentHistory", "memory"],
};

const INCLUDE_FLAG_BY_SOURCE: Record<RetrievalSourceKey, keyof MarketingRetrievalRequest> = {
  product: "includeProduct",
  customerInsights: "includeCustomerInsights",
  bookings: "includeBookings",
  reviews: "includeReviews",
  contentHistory: "includeContentHistory",
  publications: "includePublications",
  performance: "includePerformance",
  memory: "includeMemory",
  agendas: "includeAgendas",
};

export function defaultSourcesForPurpose(purpose: string): RetrievalSourceKey[] {
  return PURPOSE_SOURCES[canonicalPurpose(purpose)] ?? [];
}

export function buildRetrievalPlan(
  request: ParsedMarketingRetrievalRequest | MarketingRetrievalRequest,
): RetrievalPlan {
  const purpose = request.purpose;
  const canonical = canonicalPurpose(purpose);
  const defaults = new Set(defaultSourcesForPurpose(purpose));

  const sources: RetrievalSourceKey[] = [];
  for (const source of Object.keys(INCLUDE_FLAG_BY_SOURCE) as RetrievalSourceKey[]) {
    const flag = request[INCLUDE_FLAG_BY_SOURCE[source]];
    if (flag === false) continue;
    if (flag === true || defaults.has(source)) sources.push(source);
  }

  return { purpose, canonicalPurpose: canonical, sources };
}
