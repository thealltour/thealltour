import type { ContextSourceType } from "@/lib/marketing/context/types";
import type { RetrievalSourceKey } from "@/lib/marketing/retrieval/types";
import type { ScoringWeights } from "@/lib/marketing/scoring/types";

export const SCORING_WEIGHTS: ScoringWeights = {
  relevance: 0.4,
  freshness: 0.25,
  reliability: 0.2,
  businessImportance: 0.15,
};

export const HYBRID_SCORE_WEIGHTS = {
  semantic: 0.45,
  context: 0.55,
} as const;

export const MATCH_EXACT = 1;
export const MATCH_NEUTRAL = 0.5;
export const MATCH_MISS = 0.12;

export const SOURCE_PRIORITY_WEIGHT = 0.55;
export const MATCH_SCORE_WEIGHT = 0.45;

export const PURPOSE_SOURCE_PRIORITY: Record<string, RetrievalSourceKey[]> = {
  create_content: ["product", "customerInsights", "contentHistory", "publications", "memory"],
  analyze_performance: ["performance", "publications", "customerInsights", "bookings", "reviews"],
  governance_check: ["publications", "contentHistory", "agendas", "memory"],
  trend_analysis: ["customerInsights", "performance", "memory"],
  campaign_planning: ["product", "performance", "customerInsights", "contentHistory", "memory"],
};

export const FRESHNESS_HALF_LIFE_DAYS: Record<ContextSourceType, number> = {
  product: 365,
  taxonomy: 365,
  inquiry_insight: 14,
  booking_insight: 21,
  review_insight: 60,
  content_history: 21,
  publication: 14,
  performance: 5,
  memory: 180,
  agenda: 30,
};

export const MISSING_DATE_FRESHNESS: Record<ContextSourceType, number> = {
  product: 0.85,
  taxonomy: 0.85,
  inquiry_insight: 0.45,
  booking_insight: 0.45,
  review_insight: 0.5,
  content_history: 0.4,
  publication: 0.4,
  performance: 0.3,
  memory: 0.7,
  agenda: 0.5,
};

export const EVERGREEN_MEMORY_HALF_LIFE_DAYS = 2000;

export const EVERGREEN_MEMORY_TYPES = new Set([
  "brand_knowledge",
  "brand",
  "evergreen",
  "policy",
  "guideline",
]);

export const SOURCE_RELIABILITY: Record<ContextSourceType, number> = {
  product: 0.95,
  taxonomy: 0.93,
  booking_insight: 0.92,
  review_insight: 0.9,
  publication: 0.91,
  content_history: 0.82,
  agenda: 0.8,
  performance: 0.72,
  inquiry_insight: 0.7,
  memory: 0.45,
};

export const MEMORY_RELIABILITY_CAP = 0.75;
