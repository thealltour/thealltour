import type { CompletedMarketingCandidateStatus } from "@/lib/marketing/cron/daily/types";
import type { HumanMarketingReviewStatus, HumanReviewDetail } from "@/lib/marketing/review/types";

export const MORNING_MARKETING_REVIEW_CONTEXT_CONTRACT = "morning-marketing-review-context-v1" as const;

export type MorningReviewWorkflowState =
  | "pending"
  | "missing"
  | "editing"
  | "approved"
  | "deferred"
  | "rejected"
  | "published";

export type MorningReviewIdentity = {
  businessDateKst: string;
  candidateId: string;
  reviewId: string | null;
  reviewStatus: HumanMarketingReviewStatus | null;
  candidateStatus: CompletedMarketingCandidateStatus;
  isVerificationFixture: boolean;
};

export type MorningReviewAgendaContext = {
  title: string;
  summary: string;
  objective: string | null;
  audience: string | null;
  commercialIntent: string | null;
  destinations: string[];
  rationale: string[];
  researchScoreAtSelection: number | null;
  timelinessNote: string | null;
  recommendedFormat: string | null;
  channel: string;
};

export type MorningReviewEvidenceSupport = {
  evidenceId: string;
  sourceName: string | null;
  sourceDomain: string | null;
  publishedAt: string | null;
  observedAt: string | null;
  credibilityHint: number | null;
  excerpt: string | null;
  url: string | null;
  isOfficial: boolean;
};

export type MorningReviewEvidenceClaim = {
  claim: string;
  supports: MorningReviewEvidenceSupport[];
  linkage: "assignment_fact" | "unlinked";
};

export type MorningReviewGovernanceContext = {
  decision: string | null;
  summary: string;
  /**
   * Why candidate appears blocked in UI.
   * - governance_block: GA decision BLOCK
   * - pipeline_blocked_without_governance: status=blocked but no GA decision (e.g. revision_required / completeness)
   */
  blockKind: "governance_block" | "pipeline_blocked_without_governance" | null;
  humanApprovalStillRequired: boolean;
  riskScore: number | null;
  reasons: string[];
  factualRisks: string[];
  policyRisks: string[];
  commercialRisks: string[];
  unsupportedClaims: string[];
  evidenceGaps: string[];
  revisionHints: string[];
  revisionCount: number;
  decidedAt: string | null;
  governanceStale: boolean;
};

export type MorningReviewPerformanceItem = {
  snapshotId: string;
  platform: string;
  publishedAt: string | null;
  observedAt: string;
  collectionStatus: string;
  dataAvailability: string;
  metrics: Record<string, number>;
};

export type MorningReviewDegradationCode =
  | "manager_deterministic_fallback"
  | "channel_composer_fallback"
  | "channel_value_weak"
  | "research_limited"
  | "run_degraded"
  | "semantic_infra_degraded";

/** A degradation that previously stayed silent in run metadata / channel warnings. */
export type MorningReviewDegradation = {
  code: MorningReviewDegradationCode;
  severity: "warning" | "critical";
  message: string;
  detail?: string | null;
};

export type MorningReviewOperationsContext = {
  runStatus: string | null;
  executionAttempt: number | null;
  priorIncidentCount: number;
  recovered: boolean;
  notice: string | null;
  workflowIssue: "missing_review" | null;
  degradations: MorningReviewDegradation[];
};

export type MorningReviewHumanAction = {
  status: HumanMarketingReviewStatus | null;
  label: string;
  canApprove: boolean;
  canEdit: boolean;
  canDefer: boolean;
  canReject: boolean;
  canMarkManuallyPublished: boolean;
  reviewedBy: string | null;
  approvedAt: string | null;
  manuallyPublishedAt: string | null;
  deferredUntil: string | null;
  rejectionReason: string | null;
  manualPublicationPlatform: string | null;
};

export type MorningChannelReviewView = {
  channel: import("@/lib/marketing/review/channelReviews").ReviewablePublishableChannel;
  label: string;
  status: import("@/lib/marketing/review/channelReviews").ChannelReviewStatus;
  statusLabel: string;
  title: string | null;
  body: string;
  aiTitle: string | null;
  aiBody: string;
  source: "human" | "ai";
  validationWarnings: string[];
  /** True when target/offerable slot has no body yet — regenerate to fill. */
  awaitingGeneration?: boolean;
  blogMeta?: {
    selectedTitle?: string | null;
    titleCandidates?: string[];
    primaryTopic?: string | null;
    searchIntent?: string | null;
  } | null;
  /** MQ-5 — marketing usefulness (not Governance). */
  marketingValue?: {
    verdict: string;
    overallScore: number;
    reasons: string[];
    improvementHints: string[];
    stale?: boolean;
    hardFail?: boolean;
  } | null;
};

export type MorningResearchSummary = {
  primaryAudience: string[];
  strongestTension: string | null;
  recommendedAngle: string | null;
  verdict: string | null;
  limitations: string[];
  topQuestions: string[];
  contentGaps: string[];
};

export type MorningStrategySummary = {
  selectedAngle: string | null;
  keyMessage: string | null;
  targetChannels: string[];
  commercialIntent: string | null;
};

export type MorningCanonicalAssetView = {
  present: boolean;
  legacyWithoutAsset: boolean;
  assetId: string | null;
  status: string | null;
  statusLabelKo: string;
  version: number | null;
  approvedVersion: number | null;
  sourceRevision: string | null;
  humanEdited: boolean;
  storyTitle: string | null;
  storyQuestionKo: string | null;
  audienceProblemKo: string | null;
  decisionAtStakeKo: string | null;
  readerPayoffKo: string | null;
  storySupportVerdict: string | null;
  supportedClaimBoundaryKo: string | null;
  keyEvidenceKo: string[];
  contentPromiseKo: string | null;
  titleKo: string;
  dekKo: string | null;
  openingHookKo: string;
  bodyKo: string;
  keyTakeawaysKo: string[];
  decisionGuidanceKo: string;
  optionalCtaIntentKo: string | null;
  limitationsKo: string[];
  forbiddenClaimsKo: string[];
  canApproveOriginal: boolean;
  canApproveEdited: boolean;
  canEdit: boolean;
  channelsBlockedUntilApproved: boolean;
  staleChannelNoticeKo: string | null;
};

export type MorningMarketingReviewContext = {
  contract: typeof MORNING_MARKETING_REVIEW_CONTEXT_CONTRACT;
  identity: MorningReviewIdentity;
  agenda: MorningReviewAgendaContext;
  draft: {
    title: string | null;
    body: string;
    channel: string;
    cta: string | null;
    format: string | null;
    originalBody: string;
    humanEditedAfterGovernance: boolean;
  };
  /** CG-4C — only generated channels. */
  channelReviews: MorningChannelReviewView[];
  researchSummary: MorningResearchSummary | null;
  strategySummary: MorningStrategySummary;
  canonicalAsset: MorningCanonicalAssetView;
  evidence: {
    claims: MorningReviewEvidenceClaim[];
    unlinkedEvidenceCount: number;
    hasEvidence: boolean;
    message: string;
  };
  governance: MorningReviewGovernanceContext;
  performance: {
    items: MorningReviewPerformanceItem[];
    absent: boolean;
    message: string;
  };
  operations: MorningReviewOperationsContext;
  humanAction: MorningReviewHumanAction;
  detail: HumanReviewDetail;
};

export type MorningReviewQueueRow = {
  candidateId: string;
  businessDateKst: string;
  title: string;
  candidateStatus: CompletedMarketingCandidateStatus;
  humanReviewStatus: HumanMarketingReviewStatus | null;
  governanceDecision: string | null;
  channel: string;
  formatLabel: string | null;
  commercialIntent: string | null;
  actionNeeded: boolean;
  reviewWorkflowState: MorningReviewWorkflowState;
  operationalIssue: boolean;
  operationalMessage: string | null;
  actionLabel: string;
  isToday: boolean;
  productLinked: boolean;
  humanEditedAfterGovernance: boolean;
};

export type MorningReviewQueueSummary = {
  contract: typeof MORNING_MARKETING_REVIEW_CONTEXT_CONTRACT;
  pendingCount: number;
  todayCandidate: MorningReviewQueueRow | null;
  items: MorningReviewQueueRow[];
};
