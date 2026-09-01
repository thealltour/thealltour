/** App-level enums for Research Intelligence (no Postgres ENUM). */

export const RESEARCH_SOURCE_TYPES = [
  "official_government",
  "tourism_board",
  "airline",
  "airport",
  "hotel_resort",
  "travel_industry",
  "news",
  "search_trend",
  "weather",
  "fx",
  "event",
  "community",
  "social",
  "internal_product",
  "internal_content",
  "performance_memory",
  "other",
] as const;

export type ResearchSourceType = (typeof RESEARCH_SOURCE_TYPES)[number];

export const RESEARCH_SIGNAL_TYPES = [
  "policy_change",
  "entry_requirement",
  "visa",
  "flight_route",
  "airfare",
  "exchange_rate",
  "weather",
  "seasonal_condition",
  "event",
  "festival",
  "destination_trend",
  "search_interest",
  "product_opportunity",
  "hotel_resort",
  "golf",
  "safety",
  "disruption",
  "demand_signal",
  "competitor_signal",
  "content_performance",
  "internal_product",
  "general_travel_news",
] as const;

export type ResearchSignalType = (typeof RESEARCH_SIGNAL_TYPES)[number];

export const RESEARCH_EVIDENCE_TYPES = [
  "direct_source",
  "official_statement",
  "search_result",
  "internal_record",
  "structured_api",
  "derived_signal",
] as const;

export type ResearchEvidenceType = (typeof RESEARCH_EVIDENCE_TYPES)[number];

export const RESEARCH_SIGNAL_STATUSES = [
  "observed",
  "normalized",
  "enriched",
  "duplicate",
  "stale",
  "rejected",
  "eligible",
] as const;

export type ResearchSignalStatus = (typeof RESEARCH_SIGNAL_STATUSES)[number];

export const RESEARCH_BRIEF_STATUSES = [
  "draft",
  "active",
  "superseded",
  "expired",
] as const;

export type ResearchBriefStatus = (typeof RESEARCH_BRIEF_STATUSES)[number];

export const AGENDA_CANDIDATE_STATUSES = [
  "candidate",
  "shortlisted",
  "rejected",
  "expired",
] as const;

export type AgendaCandidateStatus = (typeof AGENDA_CANDIDATE_STATUSES)[number];

export const CREDIBILITY_LEVELS = ["high", "medium", "low", "unknown"] as const;

export type CredibilityLevel = (typeof CREDIBILITY_LEVELS)[number];

export const COMMERCIAL_RELEVANCE_LEVELS = [
  "none",
  "low",
  "medium",
  "high",
  "unknown",
] as const;

export type CommercialRelevanceLevel = (typeof COMMERCIAL_RELEVANCE_LEVELS)[number];

export const CLAIM_SOURCES = ["source", "derived", "llm_summary"] as const;

export type ClaimSource = (typeof CLAIM_SOURCES)[number];

export const AUTHORITY_LEVELS = ["official", "primary", "secondary", "community", "unknown"] as const;

export type AuthorityLevel = (typeof AUTHORITY_LEVELS)[number];
