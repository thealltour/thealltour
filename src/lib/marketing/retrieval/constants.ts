export const DEFAULT_RETRIEVAL_LIMIT = 100;
export const MAX_RETRIEVAL_LIMIT = 100;
export const DEFAULT_CONTEXT_LIMIT = 20;
export const MAX_CONTEXT_LIMIT = 100;

export const RETRIEVAL_SOURCE_KEYS = [
  "product",
  "customerInsights",
  "bookings",
  "reviews",
  "contentHistory",
  "publications",
  "performance",
  "memory",
  "agendas",
] as const;

export const PERIOD_REQUIRED_SOURCES = [
  "customerInsights",
  "bookings",
  "reviews",
  "contentHistory",
  "publications",
  "performance",
  "agendas",
] as const;

export const KAKAO_CHANNELS = new Set(["kakao", "kakao_moment", "kakao_channel"]);
