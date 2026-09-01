export const HUMAN_MARKETING_REVIEW_CONTRACT = "human-marketing-review-v1" as const;

export type HumanMarketingReviewStatus =
  | "pending"
  | "editing"
  | "approved_for_manual_publish"
  | "deferred"
  | "rejected"
  | "manually_published";

export type HumanReviewDraft = {
  title: string | null;
  body: string;
  channel: string;
};

export type ManualPublicationRecord = {
  platform?: string;
  publishedAt?: string;
  externalUrl?: string;
  externalPostId?: string;
  notes?: string;
};

export type HumanMarketingReview = {
  contract: typeof HUMAN_MARKETING_REVIEW_CONTRACT;
  reviewId: string;
  candidateId: string;
  runId: string;
  status: HumanMarketingReviewStatus;
  originalDraft: HumanReviewDraft;
  currentDraft: HumanReviewDraft;
  humanNotes: string | null;
  rejectionReason: string | null;
  deferredUntil: string | null;
  manualPublication: ManualPublicationRecord | null;
  reviewedBy: string | null;
  governanceReviewedDraftBody: string;
  humanEditedAfterGovernance: boolean;
  createdAt: string;
  updatedAt: string;
  approvedAt: string | null;
  manuallyPublishedAt: string | null;
};

export type HumanReviewQueueFilter =
  | "all"
  | "pending"
  | "needs_review"
  | "approved"
  | "deferred"
  | "manually_published"
  | "blocked_failed"
  | "today";

export type HumanReviewQueueItem = {
  candidateId: string;
  runId: string;
  logicalRunKey: string;
  businessDateKst: string;
  title: string;
  candidateStatus: import("@/lib/marketing/cron/daily/types").CompletedMarketingCandidateStatus;
  humanReviewStatus: HumanMarketingReviewStatus | null;
  governanceDecision: string | null;
  channel: string;
  revisionCount: number;
  createdAt: string;
  updatedAt: string;
  degraded: boolean;
  productLinked: boolean;
  actionNeeded: boolean;
  humanEditedAfterGovernance: boolean;
};

export type HumanReviewDetail = {
  candidate: import("@/lib/marketing/cron/daily/types").CompletedMarketingCandidate;
  review: HumanMarketingReview | null;
  canApprove: boolean;
  canEdit: boolean;
  canDefer: boolean;
  canReject: boolean;
  canMarkManuallyPublished: boolean;
  governanceStale: boolean;
  diagnosticsOnly: boolean;
};
