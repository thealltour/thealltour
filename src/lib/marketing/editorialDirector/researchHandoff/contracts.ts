/**
 * External Editorial Research handoff — approved Canonical → ChatGPT research (verify and expand).
 * Separate from canonical-marketing-asset-chatgpt-edit-v1 (Canonical surface edit/import).
 * Channel copy is not requested here; Instagram cardnews copy has its own handoff
 * (instagram-cardnews-chatgpt-handoff-v1) once the Canonical is confirmed.
 */

export const EDITORIAL_RESEARCH_BUNDLE_CHATGPT_HANDOFF_CONTRACT =
  "editorial-research-bundle-chatgpt-handoff-v1" as const;
export const EDITORIAL_RESEARCH_BUNDLE_CHATGPT_HANDOFF_CONTRACT_VERSION = 1 as const;

/** Identity the external model must echo on its returned JSON. */
export const EDITORIAL_RESEARCH_BUNDLE_CHATGPT_RESULT_CONTRACT =
  "editorial-research-bundle-chatgpt-result-v1" as const;

export const EDITORIAL_RESEARCH_POLICY_VERIFY_AND_EXPAND = "verify_and_expand" as const;

export const RESEARCH_OUTPUT_STATUSES = ["completed", "partial", "not_needed", "blocked"] as const;
export type ResearchOutputStatus = (typeof RESEARCH_OUTPUT_STATUSES)[number];

export const RESEARCH_FINDING_SUPPORT_LEVELS = [
  "verified",
  "corroborated",
  "qualified",
  "weak",
  "conflicting",
] as const;
export type ResearchFindingSupportLevel = (typeof RESEARCH_FINDING_SUPPORT_LEVELS)[number];

export const RESEARCH_SOURCE_TIERS = [
  "official",
  "primary",
  "reputable_media",
  "industry",
  "community",
  "other",
] as const;
export type ResearchSourceTier = (typeof RESEARCH_SOURCE_TIERS)[number];

export const EDITORIAL_RESEARCH_REQUESTED_ARTIFACTS = ["research"] as const;
export type EditorialResearchRequestedArtifact =
  (typeof EDITORIAL_RESEARCH_REQUESTED_ARTIFACTS)[number];

export const RESEARCH_HANDOFF_CANONICAL_NOT_APPROVED_MESSAGE_KO =
  "현재 버전이 승인된 공통 원문만 Research Editorial JSON으로 내보낼 수 있습니다. 먼저 원문을 승인하세요." as const;
export const RESEARCH_HANDOFF_CANONICAL_MISSING_MESSAGE_KO =
  "공통 마케팅 원문이 없어 Research Editorial JSON을 만들 수 없습니다." as const;

export type ResearchHandoffApprovedCanonical = {
  authority: "factual_baseline";
  titleKo: string;
  dekKo: string | null;
  openingHookKo: string;
  bodyKo: string;
  keyTakeawaysKo: string[];
  decisionGuidanceKo: string;
  optionalCtaIntentKo: string | null;
  editorialArchetype: string | null;
  storySupportVerdict: string | null;
  supportedClaimBoundaryKo: string | null;
  limitationsKo: string[];
  forbiddenClaimsKo: string[];
  unresolvedQuestionsKo: string[];
  evidenceRefs: Array<{ evidenceId: string; noteKo: string | null }>;
  approvedAt: string | null;
  approvedVersion: number;
  approvalSource: "ai_original" | "human_edited" | null;
};

export type ResearchHandoffStoryContext = {
  storyPointId: string;
  storyQuestion: string | null;
  storyClaim: string | null;
  whyInteresting: string | null;
  audienceTension: string | null;
  curiosityGap: string | null;
  readerPayoff: string | null;
  researchQuestions: string[];
  nonGoals: string[];
};

export type ResearchHandoffPropositionContext = {
  angle: string | null;
  keyMessage: string | null;
  primaryAudience: string | null;
  audienceProblem: string | null;
  audienceTension: string | null;
  whyNow: string | null;
  contentPromise: string | null;
  readerGain: string | null;
  specificTakeaways: string[];
  commercialIntent: string | null;
  desiredAudienceAction: string | null;
  limitations: string[];
};

export type ResearchHandoffEditorialContext = {
  authority: "background_only_not_factual";
  noteKo: string;
  story: ResearchHandoffStoryContext | null;
  proposition: ResearchHandoffPropositionContext | null;
};

export type ResearchHandoffPriorFinding = {
  question: string;
  status: string;
  finding: string;
  confidence: number | null;
  sourceClasses: string[];
  evidenceRefs: string[];
  limitations: string[];
};

export type ResearchHandoffPriorEvidenceAssessment = {
  evidenceId: string;
  relationship: string;
  epistemicType: string;
  sourceClass: string | null;
  note: string | null;
};

export type ResearchHandoffResearchContext = {
  authority: "prior_research_state_to_verify";
  available: boolean;
  noteKo: string;
  /** Internal brief carries evidence IDs / source classes only — no title/publisher/date/url. */
  sourceMetadataAvailable: false;
  researchExecutionStatus: string | null;
  storySupportVerdict: string | null;
  supportedClaimBoundary: string | null;
  findings: ResearchHandoffPriorFinding[];
  evidenceAssessment: ResearchHandoffPriorEvidenceAssessment[];
  contradictedClaims: string[];
  unresolvedQuestions: string[];
  limitations: string[];
  researchSupportedFraming: string[];
  refutationNotes: string | null;
};

export type ResearchHandoffTerminologyPolicy = {
  preserveCanonicalSpelling: true;
  allowUnverifiedKoreanTransliteration: false;
  canonicalLockedTerms: string[];
  rulesKo: string[];
};

export type ResearchHandoffCitationPolicy = {
  researchProvenanceRequired: true;
  surfaceCitations: "none";
  surfaceSourceUrls: false;
  rulesKo: string[];
};

/** Human/model-readable schema descriptor: "type" strings, arrays of one element, nested objects. */
export type ResearchHandoffSchemaSpec =
  | string
  | readonly ResearchHandoffSchemaSpec[]
  | { readonly [key: string]: ResearchHandoffSchemaSpec };

export type ResearchHandoffOutputContract = {
  format: "single_json_object";
  researchRequired: true;
  topLevelKeyOrder: readonly string[];
  requiredEcho: {
    contract: typeof EDITORIAL_RESEARCH_BUNDLE_CHATGPT_RESULT_CONTRACT;
    candidateId: string;
    assetId: string;
    canonicalVersion: number;
    sourceRevision: string;
  };
  rulesKo: string[];
  schema: {
    research: ResearchHandoffSchemaSpec;
  };
};

export type EditorialResearchBundleChatGptHandoff = {
  contract: typeof EDITORIAL_RESEARCH_BUNDLE_CHATGPT_HANDOFF_CONTRACT;
  contractVersion: typeof EDITORIAL_RESEARCH_BUNDLE_CHATGPT_HANDOFF_CONTRACT_VERSION;
  candidateId: string;
  assetId: string;
  canonicalVersion: number;
  sourceRevision: string;
  exportedAt: string;
  canonicalStatus: "approved";
  researchPolicy: typeof EDITORIAL_RESEARCH_POLICY_VERIFY_AND_EXPAND;
  approvedCanonical: ResearchHandoffApprovedCanonical;
  editorialContext: ResearchHandoffEditorialContext;
  researchContext: ResearchHandoffResearchContext;
  terminology: ResearchHandoffTerminologyPolicy;
  citationPolicy: ResearchHandoffCitationPolicy;
  requestedArtifacts: readonly EditorialResearchRequestedArtifact[];
  outputContract: ResearchHandoffOutputContract;
};
