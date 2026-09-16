/**
 * ED-3 — Deterministic ContentProposition lock against StoryPoint + EvidenceBrief.
 * CS may structure/express the approved Story; it may not invent a new one.
 */

import { createHash } from "node:crypto";

import type { AgendaTopicIdentity } from "@/lib/marketing/audienceResearch/topicIdentity/contracts";
import { identityIsCruise } from "@/lib/marketing/audienceResearch/topicIdentity/contracts";
import {
  textLooksCruiseSpecific,
  validateAngleAgainstAgendaIdentity,
} from "@/lib/marketing/audienceResearch/topicIdentity/validateAgainstIdentity";
import type { ContentProposition } from "@/lib/marketing/content/proposition/contracts";
import type {
  EvidenceBackedStoryBrief,
  StoryContentPoint,
  StoryEvidenceSupportStatus,
} from "@/lib/marketing/storyPoint/contracts";
import { storyEvidenceAllowsContentStrategy } from "@/lib/marketing/storyPoint/evaluateStoryPointQuality";
import { validateStoryResearchLock } from "@/lib/marketing/storyPoint/researchLock";

export const PROPOSITION_LOCK_VERSION = "proposition-lock-v1" as const;

export const CONTENT_PROPOSITION_STORY_LOCK_REASONS = [
  "content_proposition_story_drift",
  "content_proposition_boundary_violation",
  "content_proposition_unsupported_takeaway",
  "content_proposition_generic_fallback",
  "content_proposition_evidence_mismatch",
  "content_proposition_validation_failed",
  "content_proposition_refuted_or_insufficient",
  "content_proposition_contradicted_claim_revival",
] as const;

export type ContentPropositionStoryLockReason =
  (typeof CONTENT_PROPOSITION_STORY_LOCK_REASONS)[number];

export type TakeawayEvidenceRef = {
  takeaway: string;
  evidenceRefs: string[];
};

export type ContentPropositionStoryLockInput = {
  proposition: ContentProposition;
  storyPoint: StoryContentPoint;
  evidenceBrief: EvidenceBackedStoryBrief;
  topicIdentity?: AgendaTopicIdentity | null;
};

export type ContentPropositionStoryLockIssue = {
  code: ContentPropositionStoryLockReason | string;
  field: string;
  message: string;
};

export type ContentPropositionStoryLockResult = {
  ok: boolean;
  issues: ContentPropositionStoryLockIssue[];
  evidenceBackedTakeawayCount: number;
  unsupportedTakeawayCount: number;
  boundaryUsed: boolean;
  driftReasons: string[];
};

const STRUCTURAL_GENERIC_FALLBACK =
  /(?:태국|방콕|나트랑|일본|여행)\s*(?:시|할\s*때)?\s*(?:알아둘\s*점|준비\s*팁|종합\s*가이드|여행\s*체크리스트)|여행\s*시\s*살펴볼\s*점|기본\s*여행\s*정보\s*소개/i;

const OVERBROAD_ABSOLUTE =
  /무조건|항상\s*더\s*중요|등급보다\s*위치가\s*더\s*중요하(다|며)|위치가\s*항상/i;

/** Language-agnostic stopwords — keep destination/entity tokens, drop glue words. */
const STOPWORDS = new Set([
  "the",
  "and",
  "for",
  "with",
  "from",
  "that",
  "this",
  "when",
  "what",
  "how",
  "are",
  "was",
  "were",
  "been",
  "have",
  "has",
  "had",
  "not",
  "but",
  "into",
  "onto",
  "than",
  "then",
  "also",
  "only",
  "more",
  "most",
  "such",
  "their",
  "they",
  "them",
  "does",
  "did",
  "can",
  "could",
  "should",
  "would",
  "will",
  "about",
  "over",
  "under",
  "between",
  "without",
  "within",
  "while",
  "where",
  "which",
  "whose",
  "whom",
  "being",
  "through",
  "during",
  "before",
  "after",
  "above",
  "below",
  "other",
  "some",
  "any",
  "each",
  "few",
  "own",
  "same",
  "too",
  "very",
  "just",
  "like",
  "vs",
  "or",
  "an",
  "of",
  "to",
  "in",
  "on",
  "at",
  "by",
  "as",
  "is",
  "it",
  "be",
  "a",
  "해당",
  "일정",
  "맥락",
  "에서는",
  "에서",
  "증거",
  "범위",
  "안에서만",
  "말함",
  "관련",
  "대한",
  "위한",
  "있는",
  "없는",
  "하는",
  "되는",
  "되는가",
  "인가",
  "할까",
  "있다",
  "없다",
  "한다",
  "된다",
  "위해",
  "통해",
  "따라",
  "같은",
  "다른",
  "보다",
  "가장",
  "매우",
  "정말",
  "부분",
  "답변",
  "입니다",
  "수준의",
  "관찰",
  "신호만",
  "있어",
  "군도는",
  "위치하며",
  "바탕으로",
  "방식을",
  "취함",
]);

/**
 * EN↔KO travel entity / theme aliases. Longer patterns first.
 * Fixes Con Dao vs 콘다오 style Story lock false negatives.
 */
const ENTITY_ALIAS_RULES: Array<{ canonical: string; pattern: RegExp }> = [
  { canonical: "condao", pattern: /côn\s*đảo|con[\s\-]?dao|콘\s*다오|꼰\s*다오|콘다오|꼰다오/gi },
  { canonical: "phuquoc", pattern: /ph[uú]\s*qu[oố]c|푸\s*꾸옥|푸꾸옥/gi },
  { canonical: "ninhbinh", pattern: /ninh\s*binh|닌\s*빈|닌빈/gi },
  { canonical: "danang", pattern: /da\s*nang|đ[àa]\s*n[ẵă]ng|다\s*낭|다낭/gi },
  { canonical: "nhatrang", pattern: /nha\s*trang|나\s*트랑|나트랑/gi },
  { canonical: "bangkok", pattern: /방콕|bangkok/gi },
  { canonical: "thailand", pattern: /태국|thailand/gi },
  { canonical: "vietnam", pattern: /vi[eệ]t\s*nam|베트남|vietnam/gi },
  { canonical: "masstourism", pattern: /mass\s*tourism|대규모\s*관광|대중\s*관광|오버투어리즘|과잉\s*관광/gi },
  { canonical: "overtourism", pattern: /overtourism|과잉관광/gi },
  { canonical: "conservation", pattern: /conservation|환경\s*보호|자연\s*보호|보존|보호된|보호\s*구역/gi },
  { canonical: "sustainable", pattern: /sustainable|지속\s*가능/gi },
  { canonical: "marine", pattern: /marine|해양|바다\s*생태계/gi },
  { canonical: "ecosystem", pattern: /ecosystem|생태계|생태\s*안식처|생태/gi },
  { canonical: "sanctuary", pattern: /sanctuary|안식처|성역/gi },
  { canonical: "tourism", pattern: /tourism|관광/gi },
  { canonical: "luxury", pattern: /luxury|럭셔리|호화|고급\s*휴양/gi },
  { canonical: "barefoot", pattern: /barefoot|맨발/gi },
  { canonical: "resort", pattern: /resort|리조트/gi },
  { canonical: "booking", pattern: /booking|예약\s*전|예약/gi },
];

function canonicalizeTravelText(text: string): string {
  let out = ` ${text} `;
  for (const rule of ENTITY_ALIAS_RULES) {
    out = out.replace(rule.pattern, ` ${rule.canonical} `);
  }
  return out.replace(/\s+/g, " ").trim();
}

function tokenize(text: string): string[] {
  return canonicalizeTravelText(text)
    .toLowerCase()
    .replace(/[^\p{L}\p{N}\s]/gu, " ")
    .split(/\s+/)
    .filter((t) => t.length >= 2);
}

function contentTokens(text: string): string[] {
  // Hangul content words are often 2 syllables (위치, 등급, 부모) — keep len>=2.
  return tokenize(text).filter((t) => !STOPWORDS.has(t) && t.length >= 2);
}

function significantOverlap(a: string, b: string, minHits = 1): boolean {
  const left = new Set(contentTokens(a));
  if (left.size === 0) return false;
  let hits = 0;
  for (const t of contentTokens(b)) {
    if (left.has(t)) hits += 1;
  }
  return hits >= minHits;
}

function storyCoreBlob(story: StoryContentPoint): string {
  return [
    story.storyQuestion ?? "",
    story.storyClaim ?? "",
    story.audienceTension,
    story.curiosityGap,
    story.readerPayoff,
    ...story.researchQuestions,
  ].join("\n");
}

function evidenceSupportBlob(brief: EvidenceBackedStoryBrief): string {
  return [
    brief.supportedClaimBoundary ?? "",
    ...brief.researchSupportedFraming,
    ...brief.researchQuestionFindings.map((f) => `${f.question}\n${f.finding}`),
    ...brief.usableFactIds,
  ].join("\n");
}

function claimScopeBlob(brief: EvidenceBackedStoryBrief): string {
  return [
    brief.supportedClaimBoundary ?? "",
    ...brief.researchSupportedFraming,
    ...brief.researchQuestionFindings
      .filter((f) => f.status === "answered" || f.status === "partially_answered")
      .map((f) => `${f.question}\n${f.finding}`),
  ].join("\n");
}

/** Topic-agnostic evidence lexicon (EN/KO). Do not hardcode destination vocab. */
function collectEvidenceTokens(brief: EvidenceBackedStoryBrief): Set<string> {
  return new Set(contentTokens(evidenceSupportBlob(brief)));
}

function distinctiveAnchors(...blobs: string[]): Set<string> {
  const out = new Set<string>();
  for (const blob of blobs) {
    for (const t of contentTokens(blob)) {
      // Prefer entity-like / longer tokens for cross-lingual residual anchors.
      if (t.length >= 4) out.add(t);
    }
  }
  return out;
}

function sharesDistinctiveAnchors(text: string, anchors: Set<string>, minHits = 1): boolean {
  if (anchors.size === 0) return false;
  let hits = 0;
  for (const t of contentTokens(text)) {
    if (anchors.has(t)) {
      hits += 1;
      if (hits >= minHits) return true;
    }
  }
  return false;
}

function fieldAlignsWithStory(input: {
  fieldText: string;
  primary: string;
  storyCore: string;
  claimScope: string;
  anchors: Set<string>;
}): boolean {
  const text = input.fieldText.trim();
  if (!text) return true;
  if (significantOverlap(input.primary, text, 1)) return true;
  if (significantOverlap(input.storyCore, text, 2)) return true;
  // PARTIAL boundary is often EN while CS writes KO — 1 thematic hit after alias normalize is enough.
  if (significantOverlap(input.claimScope, text, 1)) return true;
  // English StoryPoint + Korean CS paraphrase: shared canonical entities (condao, conservation…).
  if (sharesDistinctiveAnchors(text, input.anchors, 1)) return true;
  return false;
}

function knownEvidenceIds(brief: EvidenceBackedStoryBrief): Set<string> {
  return new Set([
    ...brief.evidenceAssessment.map((a) => a.evidenceId),
    ...brief.usableFactIds,
    ...brief.researchQuestionFindings.flatMap((f) => f.evidenceRefs),
  ]);
}

function takeawayHasEvidenceSupport(
  takeaway: string,
  brief: EvidenceBackedStoryBrief,
  explicitRefs?: TakeawayEvidenceRef[] | null,
): boolean {
  const mapped = explicitRefs?.find((r) => r.takeaway.trim() === takeaway.trim());
  if (mapped && mapped.evidenceRefs.length > 0) {
    const known = knownEvidenceIds(brief);
    const refsKnown = mapped.evidenceRefs.some((id) => known.has(id));
    if (refsKnown) return true;
    if (significantOverlap(evidenceSupportBlob(brief), takeaway, 1)) return true;
  }
  const evidenceTokens = collectEvidenceTokens(brief);
  if (contentTokens(takeaway).some((t) => evidenceTokens.has(t))) return true;
  if (significantOverlap(claimScopeBlob(brief), takeaway, 1)) return true;
  return brief.researchQuestionFindings.some(
    (f) =>
      (f.status === "answered" || f.status === "partially_answered") &&
      significantOverlap(`${f.finding} ${f.question}`, takeaway, 1),
  );
}

function issue(
  code: ContentPropositionStoryLockReason | string,
  field: string,
  message: string,
): ContentPropositionStoryLockIssue {
  return { code, field, message };
}

/** Fail closed before CS when story research is REFUTED / INSUFFICIENT_EVIDENCE. */
export function assertStoryVerdictAllowsContentStrategist(
  verdict: StoryEvidenceSupportStatus | null | undefined,
): { ok: true } | { ok: false; reason: string } {
  if (!verdict) return { ok: true };
  if (!storyEvidenceAllowsContentStrategy(verdict)) {
    return { ok: false, reason: "content_proposition_refuted_or_insufficient" };
  }
  return { ok: true };
}

export function computePropositionSourceRevision(input: {
  storyPointHash: string;
  storySupportVerdict: StoryEvidenceSupportStatus;
  supportedClaimBoundary: string | null | undefined;
  evidenceBrief: Pick<
    EvidenceBackedStoryBrief,
    | "storyPointHash"
    | "storySupportVerdict"
    | "supportedClaimBoundary"
    | "researchQuestionFindings"
    | "researchSupportedFraming"
    | "contradictedClaims"
    | "unresolvedQuestions"
    | "limitations"
  >;
}): string {
  const payload = {
    lock: PROPOSITION_LOCK_VERSION,
    storyPointHash: input.storyPointHash,
    storySupportVerdict: input.storySupportVerdict,
    supportedClaimBoundary: input.supportedClaimBoundary ?? null,
    findings: input.evidenceBrief.researchQuestionFindings.map((f) => ({
      q: f.question,
      s: f.status,
      f: f.finding,
    })),
    framing: input.evidenceBrief.researchSupportedFraming,
    contradicted: input.evidenceBrief.contradictedClaims,
    unresolved: input.evidenceBrief.unresolvedQuestions,
    limitations: input.evidenceBrief.limitations,
  };
  return createHash("sha256").update(JSON.stringify(payload), "utf8").digest("hex").slice(0, 24);
}

export function computeEvidenceBriefRevision(brief: EvidenceBackedStoryBrief): string {
  return computePropositionSourceRevision({
    storyPointHash: brief.storyPointHash,
    storySupportVerdict: brief.storySupportVerdict,
    supportedClaimBoundary: brief.supportedClaimBoundary,
    evidenceBrief: brief,
  });
}

/** Deterministic Story-lock validation for ContentProposition. */
export function validateContentPropositionAgainstStory(
  input: ContentPropositionStoryLockInput,
): ContentPropositionStoryLockResult {
  const { proposition, storyPoint, evidenceBrief, topicIdentity } = input;
  const issues: ContentPropositionStoryLockIssue[] = [];
  const driftReasons: string[] = [];
  const boundaryUsed = Boolean(
    evidenceBrief.storySupportVerdict === "PARTIALLY_SUPPORTED" &&
      evidenceBrief.supportedClaimBoundary?.trim(),
  );

  const verdictGate = assertStoryVerdictAllowsContentStrategist(evidenceBrief.storySupportVerdict);
  if (!verdictGate.ok) {
    issues.push(
      issue(
        "content_proposition_refuted_or_insufficient",
        "storySupportVerdict",
        verdictGate.reason,
      ),
    );
    return {
      ok: false,
      issues,
      evidenceBackedTakeawayCount: 0,
      unsupportedTakeawayCount: proposition.specificTakeaways.length,
      boundaryUsed,
      driftReasons: [verdictGate.reason],
    };
  }

  const propBlob = [
    proposition.primaryAudience,
    proposition.audienceProblem,
    proposition.audienceTension,
    proposition.contentPromise,
    proposition.readerGain,
    proposition.angle,
    proposition.keyMessage,
    ...proposition.specificTakeaways,
  ].join("\n");

  if (topicIdentity) {
    const idCheck = validateAngleAgainstAgendaIdentity(propBlob, topicIdentity);
    if (!idCheck.ok) {
      for (const iss of idCheck.issues) {
        issues.push(
          issue("content_proposition_story_drift", "identity", `${iss.dimension}:${iss.reason}`),
        );
        driftReasons.push(`identity:${iss.dimension}`);
      }
    }
    if (textLooksCruiseSpecific(propBlob) && !identityIsCruise(topicIdentity)) {
      issues.push(issue("content_proposition_story_drift", "angle", "cruise_contamination"));
      driftReasons.push("cruise_contamination");
    }

    const storyLock = validateStoryResearchLock({
      storyPoint,
      brief: {
        ...evidenceBrief,
        researchSupportedFraming: [
          proposition.contentPromise,
          proposition.angle,
          proposition.keyMessage,
          ...evidenceBrief.researchSupportedFraming,
        ],
      },
      topicIdentity,
    });
    if (!storyLock.ok) {
      for (const code of storyLock.issues) {
        issues.push(issue("content_proposition_story_drift", "storyCore", code));
        driftReasons.push(code);
      }
    }
  }

  const storyCore = storyCoreBlob(storyPoint);
  const claimScope = claimScopeBlob(evidenceBrief);
  const anchors = distinctiveAnchors(storyCore, claimScope);

  if (
    !fieldAlignsWithStory({
      fieldText: proposition.audienceTension,
      primary: storyPoint.audienceTension,
      storyCore,
      claimScope,
      anchors,
    })
  ) {
    issues.push(
      issue(
        "content_proposition_story_drift",
        "audienceTension",
        "audienceTension unrelated to StoryPoint tension",
      ),
    );
    driftReasons.push("audience_tension_drift");
  }

  if (
    !fieldAlignsWithStory({
      fieldText: proposition.readerGain,
      primary: storyPoint.readerPayoff,
      storyCore,
      claimScope,
      anchors,
    })
  ) {
    issues.push(
      issue(
        "content_proposition_story_drift",
        "readerGain",
        "readerGain does not align with StoryPoint readerPayoff",
      ),
    );
    driftReasons.push("reader_payoff_drift");
  }

  const promiseAnchor =
    evidenceBrief.storySupportVerdict === "PARTIALLY_SUPPORTED" &&
    evidenceBrief.supportedClaimBoundary?.trim()
      ? evidenceBrief.supportedClaimBoundary
      : [storyPoint.storyQuestion ?? "", storyPoint.storyClaim ?? "", storyPoint.curiosityGap].join(
          " ",
        );

  if (
    !fieldAlignsWithStory({
      fieldText: proposition.contentPromise,
      primary: promiseAnchor,
      storyCore,
      claimScope,
      anchors,
    })
  ) {
    issues.push(
      issue(
        "content_proposition_boundary_violation",
        "contentPromise",
        "contentPromise not derivable from Story core / supportedClaimBoundary",
      ),
    );
  }

  if (
    evidenceBrief.storySupportVerdict === "PARTIALLY_SUPPORTED" &&
    evidenceBrief.supportedClaimBoundary?.trim() &&
    OVERBROAD_ABSOLUTE.test(`${proposition.contentPromise} ${proposition.keyMessage}`)
  ) {
    issues.push(
      issue(
        "content_proposition_boundary_violation",
        "contentPromise",
        "overbroad claim exceeds supportedClaimBoundary",
      ),
    );
  }

  if (STRUCTURAL_GENERIC_FALLBACK.test(propBlob)) {
    const keepsStory =
      significantOverlap(storyCore, propBlob, 2) ||
      significantOverlap(promiseAnchor, propBlob, 2) ||
      sharesDistinctiveAnchors(propBlob, anchors, 2);
    if (!keepsStory) {
      issues.push(
        issue(
          "content_proposition_generic_fallback",
          "contentPromise",
          "generic destination advice abandoned Story tension/payoff",
        ),
      );
    }
  }

  let evidenceBackedTakeawayCount = 0;
  let unsupportedTakeawayCount = 0;
  const explicitRefs = proposition.takeawayEvidenceRefs ?? null;
  for (const takeaway of proposition.specificTakeaways) {
    if (!takeaway.trim()) continue;
    if (takeawayHasEvidenceSupport(takeaway, evidenceBrief, explicitRefs)) {
      evidenceBackedTakeawayCount += 1;
    } else {
      unsupportedTakeawayCount += 1;
      issues.push(
        issue(
          "content_proposition_unsupported_takeaway",
          "specificTakeaways",
          `unsupported takeaway: ${takeaway.slice(0, 80)}`,
        ),
      );
    }
  }

  for (const contradicted of evidenceBrief.contradictedClaims) {
    if (!contradicted.trim()) continue;
    if (significantOverlap(propBlob, contradicted, 2)) {
      issues.push(
        issue(
          "content_proposition_contradicted_claim_revival",
          "contentPromise",
          `revives contradicted claim: ${contradicted.slice(0, 80)}`,
        ),
      );
    }
  }

  for (const unresolved of evidenceBrief.unresolvedQuestions) {
    if (!unresolved.trim()) continue;
    const unresolvedTokens = tokenize(unresolved).filter((t) => t.length >= 3);
    if (unresolvedTokens.length === 0) continue;
    const asFact = new RegExp(
      `(?:확인됨|입증|사실|확실|무조건).{0,24}${unresolvedTokens[0]}`,
      "i",
    );
    if (asFact.test(propBlob)) {
      issues.push(
        issue(
          "content_proposition_evidence_mismatch",
          "specificTakeaways",
          `unresolved question presented as fact: ${unresolved.slice(0, 80)}`,
        ),
      );
    }
  }

  if (
    evidenceBrief.limitations.length > 0 &&
    proposition.limitations.length === 0 &&
    proposition.propositionStrength !== "insufficient"
  ) {
    issues.push(
      issue(
        "content_proposition_evidence_mismatch",
        "limitations",
        "evidence limitations not reflected on proposition",
      ),
    );
  }

  return {
    ok: issues.length === 0,
    issues,
    evidenceBackedTakeawayCount,
    unsupportedTakeawayCount,
    boundaryUsed,
    driftReasons,
  };
}
