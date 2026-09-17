/**
 * Deterministic evidence-sensitive claim guard for Agenda Transformer outputs.
 * Framing stage only — no external research / grounding / search.
 */

import type {
  MarketingAgendaCandidateV2,
  MarketingAgendaTransformInput,
  MarketingAgendaTransformerLlmOutput,
} from "@/lib/marketing/agendaQualityV2/contracts";

export const SENSITIVE_FACTUAL_CLASSES = [
  "visa",
  "immigration",
  "entry_requirements",
  "id_passport_rules",
  "fees_taxes",
  "laws_regulations",
  "safety_restrictions",
  "flight_route_schedules",
  "cancellation_rules",
  "mandatory_requirements",
] as const;

export type SensitiveFactualClass = (typeof SENSITIVE_FACTUAL_CLASSES)[number];

export type SensitiveClaimValidation =
  | { status: "PASS"; classes: SensitiveFactualClass[]; reframed: boolean }
  | {
      status: "EVIDENCE_REQUIRED";
      classes: SensitiveFactualClass[];
      reason: string;
      assertions: string[];
    };

const SENSITIVE_DOMAIN_PATTERNS: Array<{ cls: SensitiveFactualClass; re: RegExp }> = [
  { cls: "visa", re: /비자|visa|사증/i },
  { cls: "immigration", re: /입국|출국|이민|immigration|customs|세관/i },
  {
    cls: "entry_requirements",
    re: /입국\s*요건|entry\s*requirement|국경\s*통과|공동여행구역|common\s*travel\s*area/i,
  },
  {
    cls: "id_passport_rules",
    re: /신분증|여권|passport|identity\s*document|ID\s*card|신분\s*확인/i,
  },
  { cls: "fees_taxes", re: /수수료|세금|tax|fee|요금|과태료|벌금/i },
  {
    cls: "laws_regulations",
    re: /법\s*개정|법령|규제|regulation|법률|규정|요건\s*변경|규정\s*변경/i,
  },
  {
    cls: "safety_restrictions",
    re: /금지|restricted|restriction|통제|통행\s*금지|여행\s*경보/i,
  },
  {
    cls: "flight_route_schedules",
    re: /항공\s*편|비행\s*일정|flight\s*schedule|노선\s*시간|출발\s*시각|도착\s*시각/i,
  },
  {
    cls: "cancellation_rules",
    re: /취소\s*규정|환불\s*규정|cancellation\s*policy|변경\s*수수료/i,
  },
  {
    cls: "mandatory_requirements",
    re: /필수\s*지참|반드시\s*필요|mandatory|required\s*to\s*carry|필수로\s*지참/i,
  },
];

/** Assertive factual phrasing (not questions / hypotheses). */
const ASSERTION_PATTERNS: RegExp[] = [
  /바뀌었[다어]/,
  /변경되[었어]/,
  /변경점/,
  /이\s*바뀌/,
  /은\s*바뀌/,
  /는\s*바뀌/,
  /필수(?:다|입니다|이다|로)/,
  /반드시\s*(?:필요|지참|제출)/,
  /요구(?:된다|됩니다|한다)/,
  /금지(?:다|됩니다|된다)/,
  /costs?\s+\d/i,
  /is\s+required/i,
  /are\s+required/i,
  /has\s+changed/i,
  /have\s+changed/i,
  /is\s+prohibited/i,
  /must\s+carry/i,
  /must\s+bring/i,
];

const QUESTION_OR_HYPOTHESIS_MARKERS: RegExp[] = [
  /\?/,
  /인가\?/,
  /할까/,
  /해야\s*하는\s*상황/,
  /확인해야/,
  /검증해야/,
  /가설/,
  /hypothesis/i,
  /research\s*needed/i,
  /ED-2/,
  /출발\s*전\s*다시\s*확인/,
  /사실\s*확인/,
];

export function detectSensitiveClasses(text: string): SensitiveFactualClass[] {
  const found = new Set<SensitiveFactualClass>();
  for (const { cls, re } of SENSITIVE_DOMAIN_PATTERNS) {
    if (re.test(text)) found.add(cls);
  }
  return [...found];
}

export function textLooksLikeQuestionOrHypothesis(text: string): boolean {
  return QUESTION_OR_HYPOTHESIS_MARKERS.some((re) => re.test(text));
}

export function textContainsSensitiveAssertion(text: string): boolean {
  const classes = detectSensitiveClasses(text);
  if (classes.length === 0) return false;
  if (textLooksLikeQuestionOrHypothesis(text)) return false;
  return ASSERTION_PATTERNS.some((re) => re.test(text));
}

function collectCandidateTexts(candidate: MarketingAgendaCandidateV2): string[] {
  return [
    candidate.signalContext.signalSummaryKo,
    candidate.traveler.travelerProblemKo,
    candidate.traveler.decisionAtStakeKo,
    candidate.traveler.audienceTensionKo,
    candidate.traveler.readerPayoffKo,
    candidate.editorial.marketingStorySeedKo,
    candidate.editorial.whyNowKo,
    candidate.editorial.whyInterestingKo,
    candidate.editorial.curiosityHookKo,
    candidate.editorial.hiddenDetailKo,
    candidate.editorial.whyKoreanTravelerCaresKo,
    candidate.editorial.familiarReferenceKo,
    candidate.editorial.alternativeAppealKo,
    candidate.editorial.explorationPayoffKo,
    candidate.editorial.contentImaginabilityKo,
    ...candidate.editorial.researchQuestionsKo,
  ];
}

function collectLlmTexts(llm: MarketingAgendaTransformerLlmOutput): string[] {
  return [
    llm.signalSummaryKo ?? "",
    llm.travelerProblemKo,
    llm.decisionAtStakeKo,
    llm.audienceTensionKo,
    llm.readerPayoffKo,
    llm.marketingStorySeedKo,
    llm.whyNowKo,
    llm.whyInterestingKo,
    llm.curiosityHookKo,
    llm.hiddenDetailKo,
    llm.whyKoreanTravelerCaresKo,
    llm.familiarReferenceKo ?? "",
    llm.alternativeAppealKo ?? "",
    llm.explorationPayoffKo,
    llm.contentImaginabilityKo,
    ...llm.researchQuestionsKo,
  ];
}

function sourceEvidenceBlob(input: MarketingAgendaTransformInput): string {
  return [input.originalTitle, input.originalSummary, ...(input.topics ?? [])].join("\n");
}

/**
 * Source "supports" a sensitive assertion only when the source text itself
 * contains an explicit assertive claim in the same sensitive class —
 * not merely mentioning the topic family.
 */
export function sourceExplicitlySupportsSensitiveAssertion(
  sourceText: string,
  assertedText: string,
): boolean {
  const sourceClasses = detectSensitiveClasses(sourceText);
  const assertedClasses = detectSensitiveClasses(assertedText);
  if (assertedClasses.length === 0) return true;
  const overlap = assertedClasses.filter((c) => sourceClasses.includes(c));
  if (overlap.length === 0) return false;
  // Source must itself assert (not just mention) in overlapping class.
  return textContainsSensitiveAssertion(sourceText);
}

export function findUnsupportedSensitiveAssertions(params: {
  sourceTitle: string;
  sourceSummary: string;
  texts: string[];
}): { classes: SensitiveFactualClass[]; assertions: string[] } {
  const sourceText = `${params.sourceTitle}\n${params.sourceSummary}`;
  const classes = new Set<SensitiveFactualClass>();
  const assertions: string[] = [];
  for (const text of params.texts) {
    if (!text?.trim()) continue;
    if (!textContainsSensitiveAssertion(text)) continue;
    if (sourceExplicitlySupportsSensitiveAssertion(sourceText, text)) continue;
    for (const cls of detectSensitiveClasses(text)) classes.add(cls);
    assertions.push(text.trim().slice(0, 180));
  }
  return { classes: [...classes], assertions };
}

function reframeAssertiveToResearchQuestion(text: string): string {
  const trimmed = text.trim();
  if (!trimmed) return trimmed;
  if (textLooksLikeQuestionOrHypothesis(trimmed)) return trimmed;
  if (!textContainsSensitiveAssertion(trimmed)) return trimmed;

  // Prefer conditional research framing over asserted fact.
  const withoutPeriod = trimmed.replace(/[.。]\s*$/, "");
  if (/바뀌었|변경되|변경점|has changed|have changed/i.test(withoutPeriod)) {
    return `${withoutPeriod.replace(/바뀌었[다어]|변경되[었어]다?|변경점/g, "요건이 달라졌는지").replace(/\s+/g, " ").trim()}를 출발 전 공식 기준으로 다시 확인해야 하는 상황인가?`;
  }
  if (/필수|반드시|요구|required|must /i.test(withoutPeriod)) {
    return `${withoutPeriod} — 현재 공식 요건인지 ED-2에서 사실 확인이 필요한가?`;
  }
  if (/금지|prohibited|restricted/i.test(withoutPeriod)) {
    return `${withoutPeriod} — 실제 제한 여부를 출발 전 확인해야 하는 가설인가?`;
  }
  return `${withoutPeriod}를 사실로 단정하기 전에 출발 전 공식 근거로 검증해야 하는가?`;
}

export function reframeUnsupportedSensitiveClaimsInLlm(params: {
  input: MarketingAgendaTransformInput;
  llm: MarketingAgendaTransformerLlmOutput;
}): {
  llm: MarketingAgendaTransformerLlmOutput;
  reframed: boolean;
  remainingAssertions: string[];
  classes: SensitiveFactualClass[];
} {
  const sourceTitle = params.input.originalTitle;
  const sourceSummary = params.input.originalSummary;
  let reframed = false;

  const mapField = (value: string): string => {
    if (!textContainsSensitiveAssertion(value)) return value;
    if (sourceExplicitlySupportsSensitiveAssertion(`${sourceTitle}\n${sourceSummary}`, value)) {
      return value;
    }
    reframed = true;
    return reframeAssertiveToResearchQuestion(value);
  };

  const llm: MarketingAgendaTransformerLlmOutput = {
    ...params.llm,
    travelerProblemKo: mapField(params.llm.travelerProblemKo),
    decisionAtStakeKo: mapField(params.llm.decisionAtStakeKo),
    audienceTensionKo: mapField(params.llm.audienceTensionKo),
    readerPayoffKo: mapField(params.llm.readerPayoffKo),
    marketingStorySeedKo: mapField(params.llm.marketingStorySeedKo),
    whyNowKo: mapField(params.llm.whyNowKo),
    whyInterestingKo: mapField(params.llm.whyInterestingKo),
    curiosityHookKo: mapField(params.llm.curiosityHookKo),
    hiddenDetailKo: mapField(params.llm.hiddenDetailKo),
    whyKoreanTravelerCaresKo: mapField(params.llm.whyKoreanTravelerCaresKo),
    familiarReferenceKo: mapField(params.llm.familiarReferenceKo ?? ""),
    alternativeAppealKo: mapField(params.llm.alternativeAppealKo ?? ""),
    explorationPayoffKo: mapField(params.llm.explorationPayoffKo),
    contentImaginabilityKo: mapField(params.llm.contentImaginabilityKo),
    signalSummaryKo: params.llm.signalSummaryKo
      ? mapField(params.llm.signalSummaryKo)
      : params.llm.signalSummaryKo,
    researchQuestionsKo: [
      ...params.llm.researchQuestionsKo,
      ...(reframed
        ? ["ED-2 사실 확인: 관련 비자/입국/신분증/규정/요금 주장이 현재 공식 근거로 뒷받침되는가?"]
        : []),
    ],
    limitations: [
      ...(params.llm.limitations ?? []),
      ...(reframed ? ["evidence_required:sensitive_claim_reframed_to_research_question"] : []),
    ],
  };

  const remaining = findUnsupportedSensitiveAssertions({
    sourceTitle,
    sourceSummary,
    texts: collectLlmTexts(llm),
  });

  return {
    llm,
    reframed,
    remainingAssertions: remaining.assertions,
    classes: remaining.classes,
  };
}

/**
 * Validate candidate text for unsupported sensitive factual assertions.
 */
export function validateSensitiveClaimsForCandidate(params: {
  input: MarketingAgendaTransformInput;
  candidate: MarketingAgendaCandidateV2;
}): SensitiveClaimValidation {
  const found = findUnsupportedSensitiveAssertions({
    sourceTitle: params.input.originalTitle,
    sourceSummary: params.input.originalSummary,
    texts: collectCandidateTexts(params.candidate),
  });
  if (found.assertions.length === 0) {
    return {
      status: "PASS",
      classes: detectSensitiveClasses(sourceEvidenceBlob(params.input)),
      reframed: params.candidate.provenance.limitations.some((l) =>
        l.includes("sensitive_claim_reframed"),
      ),
    };
  }
  return {
    status: "EVIDENCE_REQUIRED",
    classes: found.classes,
    reason: "unsupported_sensitive_claim",
    assertions: found.assertions,
  };
}

/**
 * Apply after LLM parse: reframe when possible; otherwise caller must reject.
 */
export function enforceEvidenceSensitiveClaimPolicy(params: {
  input: MarketingAgendaTransformInput;
  llm: MarketingAgendaTransformerLlmOutput;
}):
  | { ok: true; llm: MarketingAgendaTransformerLlmOutput; reframed: boolean }
  | { ok: false; reason: "unsupported_sensitive_claim"; classes: SensitiveFactualClass[]; assertions: string[] } {
  const initial = findUnsupportedSensitiveAssertions({
    sourceTitle: params.input.originalTitle,
    sourceSummary: params.input.originalSummary,
    texts: collectLlmTexts(params.llm),
  });
  if (initial.assertions.length === 0) {
    return { ok: true, llm: params.llm, reframed: false };
  }

  const reframed = reframeUnsupportedSensitiveClaimsInLlm(params);
  if (reframed.remainingAssertions.length === 0) {
    return { ok: true, llm: reframed.llm, reframed: true };
  }
  return {
    ok: false,
    reason: "unsupported_sensitive_claim",
    classes: reframed.classes.length ? reframed.classes : initial.classes,
    assertions: reframed.remainingAssertions,
  };
}
