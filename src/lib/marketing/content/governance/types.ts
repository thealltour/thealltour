import type {
  AssignmentEvidenceRef,
  CommercialIntent,
  ContentAssignment,
  ContentPlan,
  SelectedAgenda,
} from "@/lib/marketing/content/types";
import type { ContentStrategistOutput } from "@/lib/marketing/bot/organization/handoffs";

export const GOVERNANCE_REVIEW_REQUEST_CONTRACT = "governance-review-request-v1" as const;
export const GOVERNANCE_DECISION_CONTRACT = "governance-decision-v1" as const;

export type GovernanceClaimType =
  | "factual"
  | "price"
  | "schedule"
  | "visa_entry"
  | "safety"
  | "weather"
  | "route_flight"
  | "product"
  | "promotional"
  | "opinion";

export type GovernanceClaim = {
  claimId: string;
  text: string;
  claimType: GovernanceClaimType;
  evidenceRefs: string[];
  requiresVerification: boolean;
  commercialClaim: boolean;
  timeSensitive: boolean;
  destination: string | null;
  entity: string | null;
  sourcedFrom: "content_plan" | "assignment" | "draft_scan";
};

export type GovernancePreflightSignals = {
  unsupportedClaims: string[];
  factualRisks: string[];
  evidenceGaps: string[];
  commercialRisks: string[];
  staleEvidenceIds: string[];
  suggestedConcerns: string[];
};

export type GovernanceReviewObservability = {
  reviewId: string;
  assignmentId: string | null;
  claimCount: number;
  unsupportedClaimCount: number;
  evidenceGapCount: number;
  revisionNumber: number;
  requestedAt: string;
};

export type StructuredGovernanceReviewRequest = {
  contract: typeof GOVERNANCE_REVIEW_REQUEST_CONTRACT;
  reviewId: string;
  assignmentId: string | null;
  selectedAgendaId: string | null;
  createdAt: string;
  topic: string | null;
  objective: string | null;
  format: string | null;
  channel: string;
  title: string | null;
  body: string;
  draft: {
    title: string | null;
    body: string;
    channel: string;
    agenda: string | null;
    assignmentId: string | null;
    sourceReferences: string[];
  };
  contentPlan: ContentPlan | null;
  claims: GovernanceClaim[];
  evidenceRefs: AssignmentEvidenceRef[];
  commercialIntent: CommercialIntent | null;
  matchedProductIds: string[];
  cta: string | null;
  constraints: string[];
  priorRevision: number;
  productId: string | null;
  campaignId: string | null;
  agendaId: string | null;
  agendaKey: string | null;
  preflightSignals: GovernancePreflightSignals;
  observability: GovernanceReviewObservability;
};

export type StructuredGovernanceDecision = {
  contract: typeof GOVERNANCE_DECISION_CONTRACT;
  reviewId: string;
  assignmentId: string | null;
  decidedAt: string;
  decision: "ALLOW" | "REVIEW" | "BLOCK";
  reasons: string[];
  unsupportedClaims: string[];
  factualRisks: string[];
  evidenceGaps: string[];
  commercialRisks: string[];
  policyRisks: string[];
  requiredRevisions: string[];
  verifiedEvidenceRefs: string[];
  riskScore: number;
  humanApprovalRequired: boolean;
  semanticAvailable: boolean;
  revisionHints: string[];
  claimCount: number;
  unsupportedClaimCount: number;
  evidenceGapCount: number;
  revisionNumber: number;
  malformed: boolean;
};

export type GovernanceReviewRecord = {
  reviewId: string;
  assignmentId: string | null;
  draftVersion: number;
  request: StructuredGovernanceReviewRequest;
  decision: StructuredGovernanceDecision | null;
  createdAt: string;
  updatedAt: string;
  idempotencyKey: string;
};

export type PrepareContentToGovernanceHandoffInput = {
  draft: ContentStrategistOutput;
  assignment?: ContentAssignment | null;
  selectedAgenda?: SelectedAgenda | null;
  contentPlan?: ContentPlan | null;
  productId: string;
  channel: string;
  priorRevision?: number;
  now?: Date;
};

export type ContentToGovernanceHandoffResult = {
  request: StructuredGovernanceReviewRequest;
};

export type GetGovernanceReviewResult =
  | { status: "ok"; record: GovernanceReviewRecord }
  | { status: "not_found"; reviewId: string };

export type GetAssignmentGovernanceStatusResult =
  | {
      status: "ok";
      assignmentId: string;
      latestReviewId: string | null;
      latestDecision: "ALLOW" | "REVIEW" | "BLOCK" | null;
      revisionNumber: number;
      reviewCount: number;
    }
  | { status: "not_found"; assignmentId: string };
