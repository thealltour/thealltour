/**
 * Pure builder for editorial-research-bundle-chatgpt-handoff-v1.
 * No fs / network — the server loader supplies asset + domain context.
 */

import type { CanonicalMarketingAsset } from "@/lib/marketing/canonicalAsset/contracts";
import { isApprovedCanonicalAsset } from "@/lib/marketing/canonicalAsset/validateCanonicalMarketingAsset";
import type { ContentProposition } from "@/lib/marketing/content/proposition/contracts";
import type {
  EvidenceBackedStoryBrief,
  StoryContentPoint,
} from "@/lib/marketing/storyPoint/contracts";

import {
  EDITORIAL_RESEARCH_BUNDLE_CHATGPT_HANDOFF_CONTRACT,
  EDITORIAL_RESEARCH_BUNDLE_CHATGPT_HANDOFF_CONTRACT_VERSION,
  EDITORIAL_RESEARCH_POLICY_VERIFY_AND_EXPAND,
  EDITORIAL_RESEARCH_REQUESTED_ARTIFACTS,
  RESEARCH_HANDOFF_CANONICAL_MISSING_MESSAGE_KO,
  RESEARCH_HANDOFF_CANONICAL_NOT_APPROVED_MESSAGE_KO,
  type EditorialResearchBundleChatGptHandoff,
  type ResearchHandoffApprovedCanonical,
  type ResearchHandoffCitationPolicy,
  type ResearchHandoffEditorialContext,
  type ResearchHandoffPropositionContext,
  type ResearchHandoffResearchContext,
  type ResearchHandoffStoryContext,
  type ResearchHandoffTerminologyPolicy,
} from "@/lib/marketing/editorialDirector/researchHandoff/contracts";
import { buildEditorialResearchOutputContract } from "@/lib/marketing/editorialDirector/researchHandoff/outputContract";

export type BuildEditorialResearchHandoffInput = {
  candidateId: string;
  asset: CanonicalMarketingAsset | null;
  storyPoint?: StoryContentPoint | null;
  proposition?: ContentProposition | null;
  evidenceBrief?: EvidenceBackedStoryBrief | null;
  /** Operator-locked spellings; never derived speculatively. */
  canonicalLockedTerms?: readonly string[];
  now?: Date;
};

export type EditorialResearchHandoffFailureCode = "canonical_asset_missing" | "canonical_not_approved";

export type BuildEditorialResearchHandoffResult =
  | { ok: true; payload: EditorialResearchBundleChatGptHandoff }
  | { ok: false; code: EditorialResearchHandoffFailureCode; messageKo: string };

const EDITORIAL_CONTEXT_NOTE_KO =
  "기획 배경(Story/Proposition)입니다. 사실 근거가 아니며, 사실 판단은 approvedCanonical과 직접 수행한 research로만 합니다.";

const RESEARCH_CONTEXT_AVAILABLE_NOTE_KO =
  "내부 사전 리서치 상태입니다. 검증 대상이며 확정 사실이 아닙니다. 내부 기록에는 증거 ID와 출처 분류만 있고 출처 제목·발행처·날짜·URL은 없습니다. 출처 메타데이터는 직접 조사해 research.findings[].sources에 적으세요.";

const RESEARCH_CONTEXT_UNAVAILABLE_NOTE_KO =
  "이 원문에 연결된 내부 사전 리서치(EvidenceBackedStoryBrief)가 없습니다. approvedCanonical을 기준으로 직접 검증하세요.";

const TERMINOLOGY_RULES_KO: readonly string[] = [
  "approvedCanonical과 출처에 쓰인 고유명사·상품명·지명 표기를 그대로 유지합니다.",
  "확인되지 않은 한글 음역을 새로 만들지 않습니다. 공식 한글 표기를 확인할 수 없으면 원문 표기를 씁니다.",
  "canonicalLockedTerms에 있는 표기는 모든 결과에서 글자 그대로 사용합니다.",
];

const CITATION_RULES_KO: readonly string[] = [
  "research.findings[].sources에 출처 근거를 반드시 남깁니다.",
  "narrative와 모든 채널 문안에는 인용 표기, 각주, 출처명 나열을 넣지 않습니다. 근거 연결은 evidenceRefs로만 합니다.",
  "narrative와 모든 채널 문안에 출처 URL을 넣지 않습니다.",
];

function textOrNull(value: string | null | undefined): string | null {
  const trimmed = typeof value === "string" ? value.trim() : "";
  return trimmed ? trimmed : null;
}

function strings(values: readonly string[] | null | undefined): string[] {
  if (!Array.isArray(values)) return [];
  return values.map((v) => (typeof v === "string" ? v.trim() : "")).filter(Boolean);
}

function projectApprovedCanonical(asset: CanonicalMarketingAsset): ResearchHandoffApprovedCanonical {
  return {
    authority: "factual_baseline",
    titleKo: asset.titleKo,
    dekKo: textOrNull(asset.dekKo),
    openingHookKo: asset.openingHookKo,
    bodyKo: asset.bodyKo,
    keyTakeawaysKo: [...asset.keyTakeawaysKo],
    decisionGuidanceKo: asset.decisionGuidanceKo,
    optionalCtaIntentKo: textOrNull(asset.optionalCtaIntentKo),
    editorialArchetype: textOrNull(asset.editorialArchetype),
    storySupportVerdict: textOrNull(asset.storySupportVerdict),
    supportedClaimBoundaryKo: textOrNull(asset.supportedClaimBoundaryKo),
    limitationsKo: strings(asset.limitationsKo),
    forbiddenClaimsKo: strings(asset.forbiddenClaimsKo),
    unresolvedQuestionsKo: strings(asset.unresolvedQuestionsKo),
    evidenceRefs: asset.evidenceRefs.map((ref) => ({
      evidenceId: ref.evidenceId,
      noteKo: textOrNull(ref.noteKo),
    })),
    approvedAt: asset.approvedAt,
    approvedVersion: asset.version,
    approvalSource: asset.approvalSource,
  };
}

function projectStory(
  asset: CanonicalMarketingAsset,
  storyPoint: StoryContentPoint | null | undefined,
): ResearchHandoffStoryContext | null {
  if (!storyPoint || storyPoint.pointId !== asset.storyPointId) return null;
  const projected: ResearchHandoffStoryContext = {
    storyPointId: storyPoint.pointId,
    storyQuestion: textOrNull(storyPoint.storyQuestion),
    storyClaim: textOrNull(storyPoint.storyClaim),
    whyInteresting: textOrNull(storyPoint.whyInteresting),
    audienceTension: textOrNull(storyPoint.audienceTension),
    curiosityGap: textOrNull(storyPoint.curiosityGap),
    readerPayoff: textOrNull(storyPoint.readerPayoff),
    researchQuestions: strings(storyPoint.researchQuestions),
    nonGoals: strings(storyPoint.nonGoals),
  };
  const hasEditorialText =
    projected.storyQuestion ||
    projected.storyClaim ||
    projected.whyInteresting ||
    projected.audienceTension ||
    projected.curiosityGap ||
    projected.readerPayoff ||
    projected.researchQuestions.length > 0;
  // Lock-only stubs carry identity but no editorial text.
  return hasEditorialText ? projected : null;
}

function projectProposition(
  proposition: ContentProposition | null | undefined,
): ResearchHandoffPropositionContext | null {
  if (!proposition) return null;
  return {
    angle: textOrNull(proposition.angle),
    keyMessage: textOrNull(proposition.keyMessage),
    primaryAudience: textOrNull(proposition.primaryAudience),
    audienceProblem: textOrNull(proposition.audienceProblem),
    audienceTension: textOrNull(proposition.audienceTension),
    whyNow: textOrNull(proposition.whyNow),
    contentPromise: textOrNull(proposition.contentPromise),
    readerGain: textOrNull(proposition.readerGain),
    specificTakeaways: strings(proposition.specificTakeaways),
    commercialIntent: textOrNull(proposition.commercialIntent),
    desiredAudienceAction: textOrNull(proposition.desiredAudienceAction),
    limitations: strings(proposition.limitations),
  };
}

function emptyResearchContext(): ResearchHandoffResearchContext {
  return {
    authority: "prior_research_state_to_verify",
    available: false,
    noteKo: RESEARCH_CONTEXT_UNAVAILABLE_NOTE_KO,
    sourceMetadataAvailable: false,
    researchExecutionStatus: null,
    storySupportVerdict: null,
    supportedClaimBoundary: null,
    findings: [],
    evidenceAssessment: [],
    contradictedClaims: [],
    unresolvedQuestions: [],
    limitations: [],
    researchSupportedFraming: [],
    refutationNotes: null,
  };
}

function projectResearchContext(
  asset: CanonicalMarketingAsset,
  brief: EvidenceBackedStoryBrief | null | undefined,
): ResearchHandoffResearchContext {
  // A brief for a different Story would misattribute research to this Canonical.
  if (!brief || brief.storyPointId !== asset.storyPointId) return emptyResearchContext();
  return {
    authority: "prior_research_state_to_verify",
    available: true,
    noteKo: RESEARCH_CONTEXT_AVAILABLE_NOTE_KO,
    sourceMetadataAvailable: false,
    researchExecutionStatus: textOrNull(brief.researchExecutionStatus),
    storySupportVerdict: textOrNull(brief.storySupportVerdict),
    supportedClaimBoundary: textOrNull(brief.supportedClaimBoundary),
    findings: (brief.researchQuestionFindings ?? []).map((f) => ({
      question: f.question,
      status: f.status,
      finding: f.finding,
      confidence: typeof f.confidence === "number" && Number.isFinite(f.confidence) ? f.confidence : null,
      sourceClasses: strings(f.sourceClasses),
      evidenceRefs: strings(f.evidenceRefs),
      limitations: strings(f.limitations),
    })),
    evidenceAssessment: (brief.evidenceAssessment ?? []).map((item) => ({
      evidenceId: item.evidenceId,
      relationship: item.relationship,
      epistemicType: item.epistemicType,
      sourceClass: textOrNull(item.sourceClass),
      note: textOrNull(item.note),
    })),
    contradictedClaims: strings(brief.contradictedClaims),
    unresolvedQuestions: strings(brief.unresolvedQuestions),
    limitations: strings(brief.limitations),
    researchSupportedFraming: strings(brief.researchSupportedFraming),
    refutationNotes: textOrNull(brief.refutationNotes),
  };
}

function uniqueTerms(terms: readonly string[] | undefined): string[] {
  const out: string[] = [];
  for (const term of terms ?? []) {
    const t = typeof term === "string" ? term.trim() : "";
    if (t && !out.includes(t)) out.push(t);
  }
  return out;
}

export function buildEditorialResearchHandoff(
  input: BuildEditorialResearchHandoffInput,
): BuildEditorialResearchHandoffResult {
  const asset = input.asset;
  if (!asset) {
    return {
      ok: false,
      code: "canonical_asset_missing",
      messageKo: RESEARCH_HANDOFF_CANONICAL_MISSING_MESSAGE_KO,
    };
  }
  if (!isApprovedCanonicalAsset(asset)) {
    return {
      ok: false,
      code: "canonical_not_approved",
      messageKo: RESEARCH_HANDOFF_CANONICAL_NOT_APPROVED_MESSAGE_KO,
    };
  }

  const identity = {
    candidateId: input.candidateId,
    assetId: asset.assetId,
    canonicalVersion: asset.version,
    sourceRevision: asset.sourceRevision,
  };

  const editorialContext: ResearchHandoffEditorialContext = {
    authority: "background_only_not_factual",
    noteKo: EDITORIAL_CONTEXT_NOTE_KO,
    story: projectStory(asset, input.storyPoint),
    proposition: projectProposition(input.proposition),
  };

  const terminology: ResearchHandoffTerminologyPolicy = {
    preserveCanonicalSpelling: true,
    allowUnverifiedKoreanTransliteration: false,
    canonicalLockedTerms: uniqueTerms(input.canonicalLockedTerms),
    rulesKo: [...TERMINOLOGY_RULES_KO],
  };

  const citationPolicy: ResearchHandoffCitationPolicy = {
    researchProvenanceRequired: true,
    surfaceCitations: "none",
    surfaceSourceUrls: false,
    rulesKo: [...CITATION_RULES_KO],
  };

  return {
    ok: true,
    payload: {
      contract: EDITORIAL_RESEARCH_BUNDLE_CHATGPT_HANDOFF_CONTRACT,
      contractVersion: EDITORIAL_RESEARCH_BUNDLE_CHATGPT_HANDOFF_CONTRACT_VERSION,
      ...identity,
      exportedAt: (input.now ?? new Date()).toISOString(),
      canonicalStatus: "approved",
      researchPolicy: EDITORIAL_RESEARCH_POLICY_VERIFY_AND_EXPAND,
      approvedCanonical: projectApprovedCanonical(asset),
      editorialContext,
      researchContext: projectResearchContext(asset, input.evidenceBrief),
      terminology,
      citationPolicy,
      requestedArtifacts: EDITORIAL_RESEARCH_REQUESTED_ARTIFACTS,
      outputContract: buildEditorialResearchOutputContract(identity),
    },
  };
}

export function serializeEditorialResearchHandoff(payload: EditorialResearchBundleChatGptHandoff): string {
  return JSON.stringify(payload, null, 2);
}
