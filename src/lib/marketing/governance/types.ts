export const GOVERNANCE_REASON_CODES = [
  "EXACT_DUPLICATE",
  "NORMALIZED_DUPLICATE",
  "SEMANTIC_SIMILARITY_HIGH",
  "SEMANTIC_SIMILARITY_REVIEW",
  "AGENDA_RECENT_REPEAT",
  "AGENDA_OVERUSED",
  "CHANNEL_DAILY_LIMIT",
  "SAME_CHANNEL_RECENT_SIMILAR",
  "CROSS_CHANNEL_ADAPTATION",
  "NO_RISK_SIGNAL",
] as const;

export type GovernanceReasonCode = (typeof GOVERNANCE_REASON_CODES)[number];
export type GovernanceDecision = "ALLOW" | "REVIEW" | "BLOCK";
export type GovernanceSeverity = "info" | "low" | "medium" | "high" | "critical";

export type GovernanceCandidate = {
  title?: string | null;
  body: string;
  channel: string;
  productId?: string | null;
  campaignId?: string | null;
  agendaId?: string | null;
  agendaKey?: string | null;
  scheduledAt?: string | null;
  contentType?: string | null;
  sourceContentId?: string | null;
};

export type ParsedGovernanceCandidate = {
  title: string | null;
  body: string;
  channel: string;
  productId: string | null;
  campaignId: string | null;
  agendaId: string | null;
  agendaKey: string | null;
  scheduledAt: string | null;
  contentType: string | null;
  sourceContentId: string | null;
  exactHash: string;
  normalizedHash: string;
  embeddingQuery: string;
};

export type GovernanceReason = {
  code: GovernanceReasonCode;
  severity: GovernanceSeverity;
  value?: number | null;
  matchedContentId?: string | null;
};

export type GovernanceMatchedMemory = {
  memoryId: string;
  contentId: string | null;
  score: number;
  title: string | null;
  channels: string[];
  agendaId: string | null;
};

export type GovernanceAgendaStats = {
  agendaId: string | null;
  agendaKey: string | null;
  usageCount: number | null;
  lastUsedAt: string | null;
  publicationsLast7Days: number;
  publicationsLast30Days: number;
};

export type GovernanceChannelStats = {
  channel: string;
  dailyCount: number;
  dailyMax: number;
  cooldownDays: number;
  sameAgendaRecentCount: number;
};

export type GovernanceResult = {
  decision: GovernanceDecision;
  riskScore: number;
  reasons: GovernanceReason[];
  checkedAt: string;
  semanticAvailable: boolean;
  matchedMemories: GovernanceMatchedMemory[];
  agendaStats: GovernanceAgendaStats;
  channelStats: GovernanceChannelStats;
};

export type ExactDuplicateEvaluation = {
  hash: string;
  matchedContentId: string | null;
  reasons: GovernanceReason[];
};

export type NormalizedDuplicateEvaluation = {
  hash: string;
  matchedContentId: string | null;
  reasons: GovernanceReason[];
};

export type SemanticSimilarityEvaluation = {
  available: boolean;
  reasons: GovernanceReason[];
  matches: GovernanceMatchedMemory[];
  topScore: number | null;
  sameAgenda: boolean;
  sameChannelRecent: boolean;
  crossChannelAdaptation: boolean;
};

export type AgendaFrequencyEvaluation = {
  stats: GovernanceAgendaStats;
  reasons: GovernanceReason[];
  recentRepeat: boolean;
  overused: boolean;
};

export type ChannelFrequencyEvaluation = {
  stats: GovernanceChannelStats;
  reasons: GovernanceReason[];
  dailyLimitExceeded: boolean;
};
