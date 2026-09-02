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

export type MorningReviewOperationsContext = {
  runStatus: string | null;
  executionAttempt: number | null;
  priorIncidentCount: number;
  recovered: boolean;
  notice: string | null;
  workflowIssue: "missing_review" | null;
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
