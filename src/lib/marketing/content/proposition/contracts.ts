/**
 * MQ-3 — Content Proposition contract.
 * First-class strategist output: what the audience gains and why attention is deserved.
 */

export const CONTENT_PROPOSITION_CONTRACT = "content-proposition-v1" as const;

export const PROPOSITION_STRENGTHS = ["strong", "usable", "weak", "insufficient"] as const;
export type PropositionStrength = (typeof PROPOSITION_STRENGTHS)[number];

export const DESIRED_AUDIENCE_ACTIONS = [
  "save",
  "compare",
  "verify",
  "comment",
  "ask",
  "click",
  "consult",
  "shortlist",
] as const;
export type DesiredAudienceAction = (typeof DESIRED_AUDIENCE_ACTIONS)[number];

export const ENGAGEMENT_MECHANISMS = [
  "save_worthy_checklist",
  "self_identification_question",
  "comparison_debate",
  "mistake_avoidance",
  "practical_template",
  "decision_aid",
  "timely_alert",
  "experience_sharing_prompt",
  "other",
] as const;
export type EngagementMechanism = (typeof ENGAGEMENT_MECHANISMS)[number];

export type ProofRequirement = {
  claimArea: string;
  requiredProof: string;
  severity: "must" | "should" | "nice";
};

export type ContentProposition = {
  contract: typeof CONTENT_PROPOSITION_CONTRACT;
  primaryAudience: string;
  audienceProblem: string;
  audienceTension: string;
  /** Null/empty when no real temporal trigger exists. */
  whyNow: string | null;
  contentPromise: string;
  readerGain: string;
  specificTakeaways: string[];
  proofRequirements: ProofRequirement[];
  contentGapUsed: string;
  engagementMechanism: EngagementMechanism | string;
  desiredAudienceAction: DesiredAudienceAction | string;
  angle: string;
  keyMessage: string;
  commercialIntent: "informational" | "commercial" | "mixed" | string;
  channelIntentHints?: Partial<
    Record<"threads" | "shortform" | "naver_blog" | "naver_band" | "kakao_channel", string>
  > | null;
  propositionStrength: PropositionStrength;
  limitations: string[];
  /**
   * ED-3 additive provenance — Story lock identity (backward compatible).
   * Optional on legacy propositions.
   */
  storyPointRef?: {
    storyPointId: string;
    storyPointHash: string;
    researchContractVersion?: string;
  } | null;
  storyPointHash?: string | null;
  storySupportVerdict?:
    | import("@/lib/marketing/storyPoint/contracts").StoryEvidenceSupportStatus
    | null;
  /** Boundary actually used when PARTIALLY_SUPPORTED. */
  supportedClaimBoundaryUsed?: string | null;
  evidenceBriefRevision?: string | null;
  propositionLockVersion?: string | null;
  propositionSourceRevision?: string | null;
  /** Lightweight takeaway → evidence provenance. */
  takeawayEvidenceRefs?: Array<{ takeaway: string; evidenceRefs: string[] }> | null;
};

export type ContentPropositionCompact = {
  contract: typeof CONTENT_PROPOSITION_CONTRACT;
  contentPromise: string;
  readerGain: string;
  specificTakeaways: string[];
  proofRequirements: ProofRequirement[];
  propositionStrength: PropositionStrength;
  limitations: string[];
  engagementMechanism: string;
  desiredAudienceAction: string;
  angle: string;
};

export function toContentPropositionCompact(
  proposition: ContentProposition,
): ContentPropositionCompact {
  return {
    contract: CONTENT_PROPOSITION_CONTRACT,
    contentPromise: proposition.contentPromise,
    readerGain: proposition.readerGain,
    specificTakeaways: proposition.specificTakeaways.slice(0, 5),
    proofRequirements: proposition.proofRequirements.slice(0, 8),
    propositionStrength: proposition.propositionStrength,
    limitations: proposition.limitations.slice(0, 8),
    engagementMechanism: String(proposition.engagementMechanism),
    desiredAudienceAction: String(proposition.desiredAudienceAction),
    angle: proposition.angle,
  };
}
