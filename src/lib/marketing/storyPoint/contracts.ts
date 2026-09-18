/**
 * Editorial Story/Content Point — MQ editorial layer ahead of RA-1 / CS.
 *
 * Hard quality is structural (gap + tension + payoff + falsifiable questions),
 * not banned vocabulary. Phrase heuristics are soft demerits only.
 */

export const STORY_CONTENT_POINT_CONTRACT = "story-content-point-v1" as const;
export const STORY_POINT_GATE_RESULT_CONTRACT = "story-point-gate-result-v1" as const;
export const STORY_POINT_CANDIDATE_SET_CONTRACT = "story-point-candidate-set-v1" as const;
/** @deprecated Prefer EVIDENCE_BACKED_STORY_BRIEF_CONTRACT. */
export const STORY_EVIDENCE_BRIEF_CONTRACT = "story-evidence-brief-v1" as const;
export const EVIDENCE_BACKED_STORY_BRIEF_CONTRACT = "evidence-backed-story-brief-v1" as const;
export const STORY_RESEARCH_CONTRACT_VERSION = "story-research-v1" as const;

export const STORY_MECHANISMS = [
  "curiosity_gap",
  "counter_intuition",
  "loss_avoidance",
  "identity_signal",
  "decision_relief",
  "status_or_insider",
] as const;
export type StoryMechanism = (typeof STORY_MECHANISMS)[number];

export const CHANNEL_POTENTIAL_LEVELS = ["high", "medium", "low"] as const;
export type ChannelPotentialLevel = (typeof CHANNEL_POTENTIAL_LEVELS)[number];

export type ChannelPotentialProfile = {
  conversation: ChannelPotentialLevel;
  visualExplainability: ChannelPotentialLevel;
  searchDepth: ChannelPotentialLevel;
  shortformHookability: ChannelPotentialLevel;
};

export const STORY_EVIDENCE_SUPPORT_STATUSES = [
  "SUPPORTED",
  "PARTIALLY_SUPPORTED",
  "REFUTED",
  "INSUFFICIENT_EVIDENCE",
] as const;
export type StoryEvidenceSupportStatus = (typeof STORY_EVIDENCE_SUPPORT_STATUSES)[number];

export type StoryContentPoint = {
  contract: typeof STORY_CONTENT_POINT_CONTRACT;
  pointId: string;
  storyQuestion: string | null;
  storyClaim: string | null;
  whyInteresting: string;
  audienceTension: string;
  curiosityGap: string;
  readerPayoff: string;
  mechanisms: StoryMechanism[];
  researchNeeded: string[];
  researchQuestions: string[];
  genericRisk: string;
  genericRiskMitigation: string | null;
  channelPotential: ChannelPotentialProfile;
  nonGoals: string[];
  agendaFitNotes?: string | null;
  /**
   * Editorial archetype from upstream (Editorial Director / Phase5).
   * Nullable for legacy StoryPoints; do not invent when absent.
   */
  editorialArchetype?: string | null;
};

export type StoryPointGateScores = {
  interestingness: number;
  specificity: number;
  curiosityStrength: number;
  readerPayoffStrength: number;
  researchability: number;
  genericRisk: number;
  agendaFit: number;
  noveltyAgainstRecentContent: number;
  composite: number;
};

export type StoryPointSoftDemerit = {
  code: string;
  weight: number;
  detail: string;
};

export type StoryPointGateResult = {
  contract: typeof STORY_POINT_GATE_RESULT_CONTRACT;
  pointId: string;
  verdict: "pass" | "fail";
  hardFailReasons: string[];
  softDemerits: StoryPointSoftDemerit[];
  scores: StoryPointGateScores;
};

export const STORY_POINT_SKIP_REASONS = [
  "story_point_generic",
  "story_point_generation_failed",
  "story_point_insufficient_diversity",
  "story_point_refuted",
  "story_point_insufficient_evidence",
  "story_point_research_failed",
  "story_point_all_alternates_exhausted",
] as const;
export type StoryPointSkipReason = (typeof STORY_POINT_SKIP_REASONS)[number];

export const STORY_RESEARCH_SKIP_REASONS = [
  "story_point_refuted",
  "story_point_insufficient_evidence",
  "story_point_research_failed",
  "story_point_all_alternates_exhausted",
] as const;
export type StoryResearchSkipReason = (typeof STORY_RESEARCH_SKIP_REASONS)[number];

export type StoryPointMineOutcome = "pass" | "skip";

export type StoryPointAttemptSummary = {
  attempt: number;
  generated: number;
  pass: number;
  diversityOk: boolean;
  reasons: string[];
};

export type StoryPointMineDiagnostics = {
  candidateCount: number;
  passCount: number;
  diversityRejectedCount: number;
  identityRejectedCount: number;
  mechanisms: string[];
  selectedPrimaryTitle: string | null;
  attemptSummaries: StoryPointAttemptSummary[];
};

export type DurableStoryPointCandidateSet = {
  contract: typeof STORY_POINT_CANDIDATE_SET_CONTRACT;
  minerVersion: string;
  agendaId: string;
  assignmentId: string;
  inputRevision: string;
  logicalIdentity: string;
  createdAt: string;
  attempts: number;
  llmCallCount: number;
  outcome: StoryPointMineOutcome;
  skipReason: StoryPointSkipReason | null;
  candidates: StoryContentPoint[];
  gateResults: StoryPointGateResult[];
  selectedPointIds: string[];
  primaryStoryPointId: string | null;
  alternateStoryPointIds: string[];
  primaryStoryPointHash: string | null;
  diagnostics: StoryPointMineDiagnostics;
};

export const STORY_MINER_VERSION = "story-miner-v1" as const;
export const PRODUCTION_REQUEST_STORY_POINT_METADATA_KEY = "storyPointCandidateSet" as const;
export const PRODUCTION_REQUEST_STORY_POINT_SAVED_AT_KEY = "storyPointCandidateSetSavedAt" as const;
export const PRODUCTION_OUTCOME_STORY_POINT_SKIP = "story_point_skip" as const;

export const RESEARCH_QUESTION_FINDING_STATUSES = [
  "answered",
  "partially_answered",
  "unresolved",
  "contradicted",
] as const;
export type ResearchQuestionFindingStatus = (typeof RESEARCH_QUESTION_FINDING_STATUSES)[number];

export const STORY_EVIDENCE_RELATIONSHIPS = [
  "supports",
  "partially_supports",
  "contradicts",
  "neutral",
  "unresolved",
] as const;
export type StoryEvidenceRelationship = (typeof STORY_EVIDENCE_RELATIONSHIPS)[number];

export const RESEARCH_EXECUTION_STATUSES = ["complete", "partial", "failed"] as const;
export type ResearchExecutionStatus = (typeof RESEARCH_EXECUTION_STATUSES)[number];

export type ResearchQuestionFinding = {
  question: string;
  status: ResearchQuestionFindingStatus;
  finding: string;
  evidenceRefs: string[];
  sourceClasses: string[];
  confidence: number;
  limitations: string[];
};

export type StoryEvidenceAssessmentItem = {
  evidenceId: string;
  relationship: StoryEvidenceRelationship;
  relevanceToStoryPoint: number;
  epistemicType: "verified_fact" | "observed_signal" | "inference" | "hypothesis";
  sourceClass: string | null;
  note: string | null;
};

export type EvidenceBackedStoryBrief = {
  contract: typeof EVIDENCE_BACKED_STORY_BRIEF_CONTRACT;
  researchContractVersion: typeof STORY_RESEARCH_CONTRACT_VERSION;
  storyPointId: string;
  storyPointHash: string;
  agendaLogicalIdentity: string;
  researchExecutionStatus: ResearchExecutionStatus;
  storySupportVerdict: StoryEvidenceSupportStatus;
  supportedClaimBoundary: string | null;
  researchQuestionFindings: ResearchQuestionFinding[];
  evidenceAssessment: StoryEvidenceAssessmentItem[];
  contradictedClaims: string[];
  unresolvedQuestions: string[];
  usableFactIds: string[];
  refutationNotes: string | null;
  limitations: string[];
  alternateFallbackUsed: boolean;
  researchSupportedFraming: string[];
  observability: {
    plannedQuestionCount: number;
    answeredQuestionCount: number;
    unresolvedQuestionCount: number;
    contradictingEvidenceCount: number;
    externalQueriesAttempted: number;
    externalQueriesSuccessful: number;
    sourceClasses: string[];
  };
};

export type StoryEvidenceBrief = {
  contract: typeof STORY_EVIDENCE_BRIEF_CONTRACT | typeof EVIDENCE_BACKED_STORY_BRIEF_CONTRACT;
  pointId: string;
  supportStatus: StoryEvidenceSupportStatus;
  claimWithinEvidence: string | null;
  usableFactIds: string[];
  openQuestions: string[];
  refutationNotes: string | null;
};

export const STORY_CANDIDATE_MIN = 5;
export const STORY_CANDIDATE_MAX = 8;
export const STORY_SELECTED_TOP_K = 3;
export const STORY_MINE_MAX_ATTEMPTS = 3;

export const STORY_RESEARCH_MAX_STORYPOINTS_PER_AGENDA = 2;
export const STORY_RESEARCH_MAX_QUERIES_PER_STORY = 6;
export const STORY_RESEARCH_MAX_TOTAL_SEARCH_REQUESTS = 8;
