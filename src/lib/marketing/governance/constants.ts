/**
 * v1 initial thresholds. Tune after live traffic; do not scatter these literals.
 * Semantic scores alone never BLOCK — they combine with agenda/channel signals.
 */
export const GOVERNANCE_SEMANTIC_STRONG_MATCH = 0.82;
export const GOVERNANCE_SEMANTIC_REVIEW_MATCH = 0.7;
export const GOVERNANCE_SEMANTIC_TOP_K = 15;

export const GOVERNANCE_AGENDA_REVIEW_LAST_7_DAYS = 2;
export const GOVERNANCE_AGENDA_BLOCK_LAST_7_DAYS = 3;
export const GOVERNANCE_AGENDA_REVIEW_LAST_30_DAYS = 5;

export const GOVERNANCE_RISK_EXACT = 1;
export const GOVERNANCE_RISK_NORMALIZED = 0.95;
export const GOVERNANCE_RISK_SEMANTIC_STRONG = 0.72;
export const GOVERNANCE_RISK_SEMANTIC_REVIEW = 0.55;
export const GOVERNANCE_RISK_AGENDA_REPEAT = 0.15;
export const GOVERNANCE_RISK_AGENDA_OVERUSED = 0.25;
export const GOVERNANCE_RISK_CHANNEL_OVER = 0.2;
export const GOVERNANCE_RISK_SAME_CHANNEL_RECENT = 0.2;

export const GOVERNANCE_BLOCK_MIN_RISK = 0.8;
export const GOVERNANCE_REVIEW_MIN_RISK = 0.4;
export const GOVERNANCE_REVIEW_MAX_RISK = 0.79;
export const GOVERNANCE_ALLOW_MAX_RISK = 0.2;

export const GOVERNANCE_POLICY_VERSION = "governance-v1";

export const GOVERNANCE_CHANNEL_POLICIES = {
  threads: {
    dailyMax: 3,
    sameAgendaCooldownDays: 7,
    autoPublishEnabled: true,
    reviewRequiredOnSemanticUnavailable: true,
  },
  instagram: {
    dailyMax: 1,
    sameAgendaCooldownDays: 0,
    autoPublishEnabled: false,
    reviewRequiredOnSemanticUnavailable: true,
  },
  naver_blog: {
    dailyMax: 1,
    sameAgendaCooldownDays: 7,
    autoPublishEnabled: false,
    reviewRequiredOnSemanticUnavailable: true,
  },
  naver_band: {
    dailyMax: 2,
    sameAgendaCooldownDays: 0,
    autoPublishEnabled: false,
    reviewRequiredOnSemanticUnavailable: true,
  },
  kakao_channel: {
    dailyMax: 2,
    sameAgendaCooldownDays: 0,
    autoPublishEnabled: false,
    reviewRequiredOnSemanticUnavailable: true,
  },
} as const;

export const GOVERNANCE_DEFAULT_CHANNEL_POLICY = {
  dailyMax: 2,
  sameAgendaCooldownDays: 7,
  autoPublishEnabled: false,
  reviewRequiredOnSemanticUnavailable: true,
} as const;

export type GovernanceChannelPolicy = {
  dailyMax: number;
  sameAgendaCooldownDays: number;
  autoPublishEnabled: boolean;
  reviewRequiredOnSemanticUnavailable: boolean;
};

export const GOVERNANCE_HIGH_RISK_REASON_CODES = [
  "EXACT_DUPLICATE",
  "NORMALIZED_DUPLICATE",
  "CHANNEL_DAILY_LIMIT",
  "AGENDA_OVERUSED",
  "SAME_CHANNEL_RECENT_SIMILAR",
] as const;

export function channelGovernancePolicy(channel: string): GovernanceChannelPolicy {
  const key = channel.trim().toLowerCase() as keyof typeof GOVERNANCE_CHANNEL_POLICIES;
  const policy = GOVERNANCE_CHANNEL_POLICIES[key];
  if (policy) {
    return {
      dailyMax: policy.dailyMax,
      sameAgendaCooldownDays: policy.sameAgendaCooldownDays,
      autoPublishEnabled: policy.autoPublishEnabled,
      reviewRequiredOnSemanticUnavailable: policy.reviewRequiredOnSemanticUnavailable,
    };
  }
  return { ...GOVERNANCE_DEFAULT_CHANNEL_POLICY };
}
