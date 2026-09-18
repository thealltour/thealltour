/**
 * Canonical Marketing Asset — channel-agnostic Korean source of truth.
 * Approved version feeds all channel editors.
 */

export const CANONICAL_MARKETING_ASSET_CONTRACT = "canonical-marketing-asset-v1" as const;
export const ASSET_SOURCE_WRITER_ROLE = "asset-source-writer" as const;

export const CANONICAL_ASSET_STATUSES = [
  "draft",
  "human_edited",
  "approved",
  "stale",
  "validation_failed",
] as const;
export type CanonicalAssetStatus = (typeof CANONICAL_ASSET_STATUSES)[number];

export type CanonicalAssetEvidenceRef = {
  evidenceId: string;
  noteKo: string | null;
};

export type CanonicalMarketingAsset = {
  contract: typeof CANONICAL_MARKETING_ASSET_CONTRACT;
  assetId: string;
  /** Semantic content version (increments on meaningful human edit). */
  version: number;
  status: CanonicalAssetStatus;

  // Source identity
  agendaId: string;
  storyPointId: string;
  storyPointHash: string;
  evidenceBriefRef: string | null;
  evidenceRevision: string;
  contentPropositionRef: string | null;
  propositionRevision: string;
  /** Hash of story+evidence+proposition lock inputs (not a timestamp). */
  sourceRevision: string;

  // Korean content
  titleKo: string;
  dekKo: string | null;
  openingHookKo: string;
  bodyKo: string;
  keyTakeawaysKo: string[];
  decisionGuidanceKo: string;
  optionalCtaIntentKo: string | null;

  // Evidence / safety
  evidenceRefs: CanonicalAssetEvidenceRef[];
  limitationsKo: string[];
  forbiddenClaimsKo: string[];
  supportedClaimBoundaryKo: string | null;
  unresolvedQuestionsKo: string[];
  storySupportVerdict: string | null;

  // Versioning / approval
  generatedAt: string;
  editedAt: string | null;
  approvedAt: string | null;
  approvedVersion: number | null;
  humanEdited: boolean;
  approvalSource: "ai_original" | "human_edited" | null;
  approvedBy: string | null;

  // Provenance
  generatedBy: typeof ASSET_SOURCE_WRITER_ROLE | string;
  repairCount: number;
  validationIssues: string[];

  /**
   * Exact Story editorialArchetype locked at ASW generation time.
   * Optional for legacy packages — never invent when absent.
   * Not part of Korean body content; used by channel StoryLock / Marketing Value.
   */
  editorialArchetype?: string | null;

  /** Prior approved channel bundle revisions keyed by sourceAssetVersion (optional). */
  downstreamChannelSourceVersions?: number[];
};

export const PRODUCTION_OUTCOME_AWAITING_ASSET_APPROVAL = "awaiting_asset_approval" as const;
export const CANDIDATE_CANONICAL_ASSET_KEY = "canonicalMarketingAsset" as const;
export const PRODUCTION_REQUEST_CANONICAL_ASSET_KEY = "canonicalMarketingAsset" as const;
export const PRODUCTION_REQUEST_RESUME_CHANNELS_KEY = "resumeChannelGenerationFromApprovedAsset" as const;

export type CanonicalAssetWriterInput = {
  agendaId: string;
  storyPointId: string;
  storyPointHash: string;
  storyQuestion: string | null;
  storyClaim: string | null;
  whyInteresting: string;
  audienceTension: string;
  curiosityGap: string;
  readerPayoff: string;
  /** Exact upstream Story archetype; null for legacy / unknown. Never invent. */
  editorialArchetype: string | null;
  storySupportVerdict: string;
  supportedClaimBoundary: string | null;
  evidenceBriefRef: string | null;
  evidenceRevision: string;
  researchQuestionFindings: Array<{ question: string; status: string; finding: string }>;
  contradictedClaims: string[];
  unresolvedQuestions: string[];
  evidenceLimitations: string[];
  researchSupportedFraming: string[];
  proposition: {
    angle: string;
    keyMessage: string;
    audienceProblem: string;
    audienceTension: string;
    contentPromise: string;
    readerGain: string;
    specificTakeaways: string[];
    limitations: string[];
    commercialIntent: string;
    propositionRevision: string;
    contentPropositionRef: string | null;
    supportedClaimBoundaryUsed: string | null;
  };
  topicIdentitySummary: string;
  commercialIntent: string;
  brandContextKo: string | null;
};
