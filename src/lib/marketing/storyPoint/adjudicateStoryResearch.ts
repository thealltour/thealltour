/**
 * ED-2 — StoryPoint-targeted evidence adjudication (Research & Fact Desk).
 * Deterministic from external evidence + researchQuestions; does not invent angles.
 */

import type {
  ExternalEvidenceItem,
  ExternalResearchBundle,
} from "@/lib/marketing/audienceResearch/external/runExternalResearch";
import { sourceClassAllowsVerifiedFact } from "@/lib/marketing/audienceResearch/external/sourceClassify";
import type {
  EvidenceBackedStoryBrief,
  ResearchExecutionStatus,
  ResearchQuestionFinding,
  ResearchQuestionFindingStatus,
  StoryContentPoint,
  StoryEvidenceAssessmentItem,
  StoryEvidenceRelationship,
  StoryEvidenceSupportStatus,
} from "@/lib/marketing/storyPoint/contracts";
import {
  EVIDENCE_BACKED_STORY_BRIEF_CONTRACT,
  STORY_RESEARCH_CONTRACT_VERSION,
} from "@/lib/marketing/storyPoint/contracts";
import { storyEvidenceAllowsContentStrategy } from "@/lib/marketing/storyPoint/evaluateStoryPointQuality";

const SOCIALISH = new Set(["public_social", "community", "commercial_blog", "unknown"]);

function tokenize(text: string): string[] {
  return text
    .toLowerCase()
    .replace(/[^\p{L}\p{N}\s]/gu, " ")
    .split(/\s+/)
    .filter((t) => t.length >= 2);
}

function overlapScore(a: string, b: string): number {
  const left = new Set(tokenize(a));
  const right = new Set(tokenize(b));
  if (left.size === 0 || right.size === 0) return 0;
  let hit = 0;
  for (const t of left) {
    if (right.has(t)) hit += 1;
  }
  return hit / Math.max(left.size, right.size);
}

function evidenceBlob(item: ExternalEvidenceItem): string {
  return `${item.title} ${item.excerpt} ${item.query}`;
}

const CONTRADICT_HINTS =
  /아니|틀렸|오히려|반대|등급이 더|위치가 덜|상관없|무관|과장|myth|false|debunk|not true|등급.?중요|위치.?중요하지/i;
const SUPPORT_HINTS =
  /위치|접근|교통|BTS|MRT|이동|거리|불편|부모|시니어|호텔.?등급|숙소.?위치|중요|유의|차이/i;

function classifyRelationship(
  item: ExternalEvidenceItem,
  storyText: string,
  questions: string[],
): StoryEvidenceRelationship {
  const blob = evidenceBlob(item);
  const relevance = Math.max(
    overlapScore(blob, storyText),
    ...questions.map((q) => overlapScore(blob, q)),
    0,
  );
  if (relevance < 0.08) return "neutral";
  if (CONTRADICT_HINTS.test(blob) && SUPPORT_HINTS.test(storyText)) return "contradicts";
  if (relevance >= 0.22 && SUPPORT_HINTS.test(blob)) return "supports";
  if (relevance >= 0.12) return "partially_supports";
  return "unresolved";
}

function epistemicFor(item: ExternalEvidenceItem): StoryEvidenceAssessmentItem["epistemicType"] {
  if (item.fromSnippetOnly) return "observed_signal";
  if (sourceClassAllowsVerifiedFact(item.sourceClass) && !SOCIALISH.has(item.sourceClass)) {
    return "verified_fact";
  }
  if (SOCIALISH.has(item.sourceClass)) return "observed_signal";
  return "inference";
}

function findingForQuestion(
  question: string,
  assessments: StoryEvidenceAssessmentItem[],
  evidenceById: Map<string, ExternalEvidenceItem>,
): {
  status: ResearchQuestionFindingStatus;
  finding: string;
  refs: string[];
  classes: string[];
  confidence: number;
  limitations: string[];
} {
  const related = assessments.filter((a) => {
    const ev = evidenceById.get(a.evidenceId);
    if (!ev) return false;
    return overlapScore(evidenceBlob(ev), question) >= 0.1 || a.relationship !== "neutral";
  });
  const contradicts = related.filter((a) => a.relationship === "contradicts");
  const supports = related.filter(
    (a) => a.relationship === "supports" || a.relationship === "partially_supports",
  );
  const refs = related.map((a) => a.evidenceId);
  const classes = [
    ...new Set(related.map((a) => a.sourceClass).filter((c): c is string => Boolean(c))),
  ];

  if (contradicts.length > 0 && supports.length === 0) {
    return {
      status: "contradicted",
      finding: "증거상 해당 연구 질문에 반하는 신호가 우세합니다.",
      refs,
      classes,
      confidence: Math.min(0.85, 0.45 + contradicts.length * 0.15),
      limitations: ["counterevidence_present"],
    };
  }
  if (supports.length === 0) {
    return {
      status: "unresolved",
      finding: "관련·신뢰 가능한 증거가 부족해 연구 질문을 답할 수 없습니다.",
      refs,
      classes,
      confidence: 0.15,
      limitations: ["no_relevant_evidence"],
    };
  }
  const onlySocial = supports.every((a) => SOCIALISH.has(a.sourceClass ?? "unknown"));
  const strong = supports.filter(
    (a) => a.relationship === "supports" && a.relevanceToStoryPoint >= 0.2,
  );
  if (onlySocial && strong.length < 2) {
    return {
      status: "partially_answered",
      finding: "커뮤니티/후기 수준의 관찰 신호만 있어 부분 답변입니다.",
      refs,
      classes,
      confidence: 0.35,
      limitations: ["social_or_snippet_only"],
    };
  }
  if (strong.length >= 1 && !onlySocial) {
    return {
      status: "answered",
      finding: "스토리포인트 범위 안에서 연구 질문에 대한 근거가 확인되었습니다.",
      refs,
      classes,
      confidence: Math.min(0.9, 0.5 + strong.length * 0.12),
      limitations: [],
    };
  }
  return {
    status: "partially_answered",
    finding: "핵심 긴장은 유지되나 주장 범위를 좁혀야 합니다.",
    refs,
    classes,
    confidence: 0.45,
    limitations: ["needs_qualification"],
  };
}

function resolveExecutionStatus(bundle: ExternalResearchBundle | null): ResearchExecutionStatus {
  if (!bundle) return "failed";
  const status = bundle.externalSearchStatus;
  if (status === "failed") return "failed";
  if (status === "not_attempted" && !bundle.available) return "failed";
  if (status === "sufficient" && (bundle.successfulQueryCount ?? 0) > 0) return "complete";
  if ((bundle.attemptedQueryCount ?? bundle.queryCount ?? 0) > 0) return "partial";
  if (bundle.available && bundle.evidence.length > 0) return "partial";
  return "failed";
}

function onlyWeakOrIrrelevant(assessments: StoryEvidenceAssessmentItem[]): boolean {
  if (assessments.length === 0) return true;
  return assessments.every(
    (a) =>
      a.relationship === "neutral" ||
      a.relationship === "unresolved" ||
      a.relevanceToStoryPoint < 0.1,
  );
}

function narrowClaimBoundary(point: StoryContentPoint): string {
  const base = point.storyClaim ?? point.storyQuestion ?? point.audienceTension;
  const audienceHint = /부모|시니어|가족|동반/.test(
    `${point.audienceTension} ${point.whyInteresting} ${point.storyQuestion ?? ""}`,
  )
    ? "부모님 동반 일정에서는 "
    : "해당 일정·맥락에서는 ";
  if (/호텔.?등급|위치/.test(base)) {
    return `${audienceHint}위치가 호텔 등급만큼 중요하게 작용할 수 있다`;
  }
  return `${audienceHint}${base.replace(/[?？]/g, "").trim()} — 증거 범위 안에서만 말함`;
}

export type AdjudicateStoryResearchInput = {
  storyPoint: StoryContentPoint;
  storyPointHash: string;
  agendaLogicalIdentity: string;
  externalResearch: ExternalResearchBundle | null;
  questionFindingsOverride?: ResearchQuestionFinding[] | null;
  verdictOverride?: StoryEvidenceSupportStatus | null;
  supportedClaimBoundaryOverride?: string | null;
  alternateFallbackUsed?: boolean;
};

export function adjudicateStoryResearch(
  input: AdjudicateStoryResearchInput,
): EvidenceBackedStoryBrief {
  const storyText = [
    input.storyPoint.storyQuestion ?? "",
    input.storyPoint.storyClaim ?? "",
    input.storyPoint.audienceTension,
    input.storyPoint.curiosityGap,
  ].join(" ");
  const questions = input.storyPoint.researchQuestions ?? [];
  const evidence = input.externalResearch?.evidence ?? [];
  const evidenceById = new Map(evidence.map((e) => [e.evidenceId, e]));

  const assessments: StoryEvidenceAssessmentItem[] = evidence.map((item) => {
    const relationship = classifyRelationship(item, storyText, questions);
    const relevance = Math.max(
      overlapScore(evidenceBlob(item), storyText),
      ...questions.map((q) => overlapScore(evidenceBlob(item), q)),
      0,
    );
    return {
      evidenceId: item.evidenceId,
      relationship,
      relevanceToStoryPoint: Number(relevance.toFixed(3)),
      epistemicType: epistemicFor(item),
      sourceClass: item.sourceClass,
      note: item.fromSnippetOnly ? "snippet_only_not_verified_fact" : null,
    };
  });

  const execution = resolveExecutionStatus(input.externalResearch);

  const findings: ResearchQuestionFinding[] =
    input.questionFindingsOverride ??
    questions.map((question) => {
      const r = findingForQuestion(question, assessments, evidenceById);
      return {
        question,
        status: r.status,
        finding: r.finding,
        evidenceRefs: r.refs,
        sourceClasses: r.classes,
        confidence: r.confidence,
        limitations: r.limitations,
      };
    });

  const answered = findings.filter((f) => f.status === "answered").length;
  const partial = findings.filter((f) => f.status === "partially_answered").length;
  const unresolved = findings.filter((f) => f.status === "unresolved").length;
  const contradictedQs = findings.filter((f) => f.status === "contradicted").length;
  const contradictingEvidence = assessments.filter((a) => a.relationship === "contradicts").length;
  const supportingRelevant = assessments.filter(
    (a) =>
      (a.relationship === "supports" || a.relationship === "partially_supports") &&
      a.relevanceToStoryPoint >= 0.12,
  );
  const onlyWeakSocial =
    supportingRelevant.length > 0 &&
    supportingRelevant.every((a) => SOCIALISH.has(a.sourceClass ?? "unknown")) &&
    supportingRelevant.every((a) => a.epistemicType !== "verified_fact");

  let verdict: StoryEvidenceSupportStatus;
  let boundary: string | null = null;
  let refutationNotes: string | null = null;
  const limitations: string[] = [];
  const contradictedClaims: string[] = [];

  if (input.verdictOverride) {
    verdict = input.verdictOverride;
    boundary = input.supportedClaimBoundaryOverride ?? null;
  } else if (execution === "failed" && evidence.length === 0) {
    verdict = "INSUFFICIENT_EVIDENCE";
    limitations.push("research_execution_failed", "do_not_overconfident_refute");
  } else if (contradictedQs > 0 && answered === 0 && supportingRelevant.length === 0) {
    verdict = "REFUTED";
    refutationNotes = "핵심 연구 질문이 반증되었고 지지 증거가 없습니다.";
    if (input.storyPoint.storyClaim) contradictedClaims.push(input.storyPoint.storyClaim);
  } else if (contradictingEvidence >= 2 && supportingRelevant.length === 0) {
    verdict = "REFUTED";
    refutationNotes = "반증 증거가 우세합니다.";
    if (input.storyPoint.storyClaim) contradictedClaims.push(input.storyPoint.storyClaim);
  } else if (
    (answered === 0 && partial === 0) ||
    (supportingRelevant.length === 0 && evidence.length > 0 && onlyWeakOrIrrelevant(assessments)) ||
    (onlyWeakSocial &&
      answered === 0 &&
      partial <= 1 &&
      unresolved + contradictedQs >= Math.max(0, questions.length - 1))
  ) {
    verdict = "INSUFFICIENT_EVIDENCE";
    limitations.push("insufficient_relevant_or_reliable_evidence");
  } else if (
    answered >= Math.ceil(Math.max(1, questions.length) * 0.5) &&
    contradictingEvidence === 0 &&
    !onlyWeakSocial
  ) {
    verdict = "SUPPORTED";
    boundary =
      input.storyPoint.storyClaim ??
      input.storyPoint.storyQuestion ??
      input.storyPoint.readerPayoff;
  } else if (answered + partial >= 1 && supportingRelevant.length >= 1) {
    verdict = "PARTIALLY_SUPPORTED";
    boundary = narrowClaimBoundary(input.storyPoint);
    limitations.push("claim_narrowed_to_supported_boundary");
  } else {
    verdict = "INSUFFICIENT_EVIDENCE";
    limitations.push("insufficient_to_support_or_refute");
  }

  if (input.supportedClaimBoundaryOverride && verdict === "PARTIALLY_SUPPORTED") {
    boundary = input.supportedClaimBoundaryOverride;
  }

  const unresolvedQuestions = findings
    .filter((f) => f.status === "unresolved" || f.status === "contradicted")
    .map((f) => f.question);

  const usableFactIds = assessments
    .filter(
      (a) =>
        a.epistemicType === "verified_fact" &&
        (a.relationship === "supports" || a.relationship === "partially_supports"),
    )
    .map((a) => a.evidenceId);

  const framing =
    verdict === "PARTIALLY_SUPPORTED" && boundary
      ? [boundary]
      : verdict === "SUPPORTED"
        ? [
            input.storyPoint.storyQuestion ??
              input.storyPoint.storyClaim ??
              input.storyPoint.readerPayoff,
          ]
        : [];

  const sourceClasses = [
    ...new Set(assessments.map((a) => a.sourceClass).filter((c): c is string => Boolean(c))),
  ];

  return {
    contract: EVIDENCE_BACKED_STORY_BRIEF_CONTRACT,
    researchContractVersion: STORY_RESEARCH_CONTRACT_VERSION,
    storyPointId: input.storyPoint.pointId,
    storyPointHash: input.storyPointHash,
    agendaLogicalIdentity: input.agendaLogicalIdentity,
    researchExecutionStatus: execution,
    storySupportVerdict: verdict,
    supportedClaimBoundary: boundary,
    researchQuestionFindings: findings,
    evidenceAssessment: assessments,
    contradictedClaims,
    unresolvedQuestions,
    usableFactIds,
    refutationNotes,
    limitations,
    alternateFallbackUsed: Boolean(input.alternateFallbackUsed),
    researchSupportedFraming: framing,
    observability: {
      plannedQuestionCount: questions.length,
      answeredQuestionCount: answered,
      unresolvedQuestionCount: unresolved,
      contradictingEvidenceCount: contradictingEvidence,
      externalQueriesAttempted:
        input.externalResearch?.attemptedQueryCount ?? input.externalResearch?.queryCount ?? 0,
      externalQueriesSuccessful: input.externalResearch?.successfulQueryCount ?? 0,
      sourceClasses,
    },
  };
}

export function assertStoryResearchCanProceed(brief: EvidenceBackedStoryBrief): {
  ok: boolean;
  reason: import("@/lib/marketing/storyPoint/contracts").StoryResearchSkipReason | null;
} {
  if (!storyEvidenceAllowsContentStrategy(brief.storySupportVerdict)) {
    return {
      ok: false,
      reason:
        brief.storySupportVerdict === "REFUTED"
          ? "story_point_refuted"
          : brief.storySupportVerdict === "INSUFFICIENT_EVIDENCE"
            ? "story_point_insufficient_evidence"
            : "story_point_research_failed",
    };
  }
  return { ok: true, reason: null };
}

export function toLegacyStoryEvidenceBrief(
  brief: EvidenceBackedStoryBrief,
): import("@/lib/marketing/storyPoint/contracts").StoryEvidenceBrief {
  return {
    contract: "story-evidence-brief-v1",
    pointId: brief.storyPointId,
    supportStatus: brief.storySupportVerdict,
    claimWithinEvidence: brief.supportedClaimBoundary,
    usableFactIds: brief.usableFactIds,
    openQuestions: brief.unresolvedQuestions,
    refutationNotes: brief.refutationNotes,
  };
}
