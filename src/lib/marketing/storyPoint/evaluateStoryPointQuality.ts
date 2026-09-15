import {
  CHANNEL_POTENTIAL_LEVELS,
  STORY_CONTENT_POINT_CONTRACT,
  STORY_MECHANISMS,
  STORY_POINT_GATE_RESULT_CONTRACT,
  type ChannelPotentialLevel,
  type ChannelPotentialProfile,
  type StoryContentPoint,
  type StoryEvidenceSupportStatus,
  type StoryMechanism,
  type StoryPointGateResult,
  type StoryPointGateScores,
  type StoryPointSoftDemerit,
} from "@/lib/marketing/storyPoint/contracts";

const MIN_FIELD_CHARS = 18;
const MIN_QUESTION_CHARS = 16;

/**
 * Soft demerit only — never sole hard-fail.
 * "가이드/체크리스트" wording can still pass if structure is concrete.
 */
const GENERIC_PHRASE_PATTERNS: Array<{ code: string; re: RegExp; weight: number }> = [
  { code: "phrase_look_over", re: /살펴볼\s*(점|것|부분)/, weight: 0.08 },
  { code: "phrase_prep_tips", re: /준비\s*팁|여행\s*팁|알아두면\s*좋은/, weight: 0.08 },
  { code: "phrase_cautions", re: /주의\s*사항|주의할\s*점/, weight: 0.07 },
  { code: "phrase_summary", re: /총정리|한눈에|완벽\s*정리/, weight: 0.08 },
  { code: "phrase_guide", re: /가이드|체크리스트/, weight: 0.05 },
  { code: "phrase_must_know", re: /꼭\s*알아야\s*할|충격적인\s*진실|99\s*%/, weight: 0.06 },
];

/** Structural emptiness / tautology — hard fail. */
const EMPTY_PAYOFF_PATTERNS = [
  /도움이\s*됨/,
  /도움이\s*됩니다?$/,
  /참고(가\s*)?됩니다?$/,
  /여행\s*준비에\s*도움/,
  /유익한\s*정보/,
  /유용한\s*정보/,
];

const EMPTY_GAP_PATTERNS = [
  /여러\s*(주의|준비|살펴볼)/,
  /다양한\s*(정보|팁|포인트)/,
  /알아두면\s*좋은\s*점들?/,
  /주의점이?\s*있/,
  /살펴볼\s*점이?\s*있/,
];

function clamp01(n: number): number {
  if (!Number.isFinite(n)) return 0;
  return Math.max(0, Math.min(1, n));
}

function nonempty(text: string | null | undefined): string {
  return (text ?? "").trim();
}

function isChannelLevel(value: unknown): value is ChannelPotentialLevel {
  return typeof value === "string" && (CHANNEL_POTENTIAL_LEVELS as readonly string[]).includes(value);
}

function defaultChannelPotential(): ChannelPotentialProfile {
  return {
    conversation: "medium",
    visualExplainability: "medium",
    searchDepth: "medium",
    shortformHookability: "medium",
  };
}

function parseChannelPotential(raw: unknown): ChannelPotentialProfile {
  if (!raw || typeof raw !== "object") return defaultChannelPotential();
  const o = raw as Record<string, unknown>;
  return {
    conversation: isChannelLevel(o.conversation) ? o.conversation : "medium",
    visualExplainability: isChannelLevel(o.visualExplainability)
      ? o.visualExplainability
      : isChannelLevel(o.visual_explainability)
        ? o.visual_explainability
        : "medium",
    searchDepth: isChannelLevel(o.searchDepth)
      ? o.searchDepth
      : isChannelLevel(o.search_depth)
        ? o.search_depth
        : "medium",
    shortformHookability: isChannelLevel(o.shortformHookability)
      ? o.shortformHookability
      : isChannelLevel(o.shortform_hookability)
        ? o.shortform_hookability
        : "medium",
  };
}

function parseMechanisms(raw: unknown): StoryMechanism[] {
  if (!Array.isArray(raw)) return [];
  const out: StoryMechanism[] = [];
  for (const item of raw) {
    if (typeof item !== "string") continue;
    if ((STORY_MECHANISMS as readonly string[]).includes(item)) {
      out.push(item as StoryMechanism);
    }
  }
  return [...new Set(out)].slice(0, 2);
}

function parseStringList(raw: unknown, limit: number): string[] {
  if (!Array.isArray(raw)) return [];
  return raw
    .filter((item): item is string => typeof item === "string")
    .map((item) => item.trim())
    .filter(Boolean)
    .slice(0, limit);
}

/** Best-effort normalize of miner JSON into a StoryContentPoint (may still fail gate). */
export function parseStoryContentPoint(
  raw: unknown,
  fallbackPointId?: string,
): StoryContentPoint | null {
  if (!raw || typeof raw !== "object") return null;
  const o = raw as Record<string, unknown>;
  const pointId =
    typeof o.pointId === "string" && o.pointId.trim()
      ? o.pointId.trim()
      : typeof o.id === "string" && o.id.trim()
        ? o.id.trim()
        : fallbackPointId?.trim() || null;
  if (!pointId) return null;

  const storyQuestion =
    typeof o.storyQuestion === "string" && o.storyQuestion.trim()
      ? o.storyQuestion.trim()
      : typeof o.story_question === "string" && o.story_question.trim()
        ? o.story_question.trim()
        : null;
  const storyClaim =
    typeof o.storyClaim === "string" && o.storyClaim.trim()
      ? o.storyClaim.trim()
      : typeof o.story_claim === "string" && o.story_claim.trim()
        ? o.story_claim.trim()
        : null;

  return {
    contract: STORY_CONTENT_POINT_CONTRACT,
    pointId,
    storyQuestion,
    storyClaim,
    whyInteresting: nonempty(
      (o.whyInteresting as string) ?? (o.why_interesting as string) ?? "",
    ),
    audienceTension: nonempty(
      (o.audienceTension as string) ?? (o.audience_tension as string) ?? "",
    ),
    curiosityGap: nonempty(
      (o.curiosityGap as string) ?? (o.curiosity_gap as string) ?? "",
    ),
    readerPayoff: nonempty(
      (o.readerPayoff as string) ?? (o.reader_payoff as string) ?? "",
    ),
    mechanisms: parseMechanisms(o.mechanisms ?? o.mechanism),
    researchNeeded: parseStringList(o.researchNeeded ?? o.research_needed, 8),
    researchQuestions: parseStringList(o.researchQuestions ?? o.research_questions, 8),
    genericRisk: nonempty((o.genericRisk as string) ?? (o.generic_risk as string) ?? ""),
    genericRiskMitigation:
      typeof o.genericRiskMitigation === "string" && o.genericRiskMitigation.trim()
        ? o.genericRiskMitigation.trim()
        : typeof o.generic_risk_mitigation === "string" && o.generic_risk_mitigation.trim()
          ? o.generic_risk_mitigation.trim()
          : null,
    channelPotential: parseChannelPotential(o.channelPotential ?? o.channel_potential),
    nonGoals: parseStringList(o.nonGoals ?? o.non_goals, 8),
    agendaFitNotes:
      typeof o.agendaFitNotes === "string"
        ? o.agendaFitNotes
        : typeof o.agenda_fit_notes === "string"
          ? o.agenda_fit_notes
          : null,
  };
}

function looksLikeFalsifiableQuestion(q: string): boolean {
  const t = q.trim();
  if (t.length < MIN_QUESTION_CHARS) return false;
  const hasInterrogative =
    /[?？]/.test(t) || /(인가|있을까|있는지|얼마나|차이|반복|실제로|trade-?off|근거|후기)/i.test(t);
  if (!hasInterrogative && /^[가-힣A-Za-z0-9\s/·-]{2,24}$/.test(t)) return false;
  return hasInterrogative;
}

function fieldTooThin(text: string): boolean {
  return text.trim().length < MIN_FIELD_CHARS;
}

function matchesAny(text: string, patterns: RegExp[]): boolean {
  return patterns.some((re) => re.test(text));
}

function softPhraseDemerits(blob: string): StoryPointSoftDemerit[] {
  const out: StoryPointSoftDemerit[] = [];
  for (const row of GENERIC_PHRASE_PATTERNS) {
    if (row.re.test(blob)) {
      out.push({
        code: row.code,
        weight: row.weight,
        detail: `generic phrase heuristic matched (${row.code})`,
      });
    }
  }
  return out;
}

function scoreSpecificity(point: StoryContentPoint): number {
  const blob = [
    point.storyQuestion,
    point.storyClaim,
    point.curiosityGap,
    point.audienceTension,
    point.readerPayoff,
  ]
    .filter(Boolean)
    .join(" ");
  let score = 0.35;
  if (/(부모|가족|아이|직장인|허니문|혼자|커플|시니어|초보)/.test(blob)) score += 0.15;
  if (/(전에|보다|먼저|대신|trade-?off|충돌|직관)/i.test(blob)) score += 0.15;
  if (/(방콕|파타야|치앙마이|푸켓|BTS|MRT|숙소|항공|비자|환전)/i.test(blob)) score += 0.1;
  if (blob.length >= 80) score += 0.1;
  if (blob.length >= 140) score += 0.05;
  if (/살펴볼\s*점|주의\s*사항|준비\s*팁/.test(blob) && !/(부모|먼저|보다|차이)/.test(blob)) {
    score -= 0.15;
  }
  return clamp01(score);
}

function scoreCuriosity(point: StoryContentPoint): number {
  let score = 0.3;
  if (!fieldTooThin(point.curiosityGap)) score += 0.25;
  if (/(직관|알고\s*있|생각보다|반대로|충돌|빈칸|몰랐)/.test(point.curiosityGap)) score += 0.2;
  if (point.mechanisms.includes("curiosity_gap") || point.mechanisms.includes("counter_intuition")) {
    score += 0.15;
  }
  if (matchesAny(point.curiosityGap, EMPTY_GAP_PATTERNS)) score -= 0.35;
  return clamp01(score);
}

function scorePayoff(point: StoryContentPoint): number {
  let score = 0.3;
  if (!fieldTooThin(point.readerPayoff)) score += 0.25;
  if (/(판단|기준|비교|결정|우선|고를|피할|확인)/.test(point.readerPayoff)) score += 0.25;
  if (matchesAny(point.readerPayoff, EMPTY_PAYOFF_PATTERNS)) score -= 0.4;
  return clamp01(score);
}

function scoreResearchability(point: StoryContentPoint): number {
  const goodQs = point.researchQuestions.filter(looksLikeFalsifiableQuestion);
  if (goodQs.length === 0) return 0.05;
  let score = Math.min(0.35 + goodQs.length * 0.15, 0.85);
  if (point.researchNeeded.length >= 2) score += 0.1;
  return clamp01(score);
}

function scoreInterestingness(
  point: StoryContentPoint,
  specificity: number,
  curiosity: number,
): number {
  let score = specificity * 0.35 + curiosity * 0.4;
  if (point.mechanisms.length > 0) score += 0.1;
  if (!fieldTooThin(point.whyInteresting)) score += 0.1;
  if (!fieldTooThin(point.audienceTension)) score += 0.1;
  return clamp01(score);
}

function scoreGenericRisk(point: StoryContentPoint, softDemerits: StoryPointSoftDemerit[]): number {
  let risk = 0.15;
  risk += softDemerits.reduce((sum, d) => sum + d.weight, 0);
  if (matchesAny(point.curiosityGap, EMPTY_GAP_PATTERNS)) risk += 0.25;
  if (matchesAny(point.readerPayoff, EMPTY_PAYOFF_PATTERNS)) risk += 0.25;
  if (point.researchQuestions.every((q) => !looksLikeFalsifiableQuestion(q))) risk += 0.2;
  if (!point.genericRiskMitigation && softDemerits.length > 0) risk += 0.05;
  return clamp01(risk);
}

function buildScores(
  point: StoryContentPoint,
  softDemerits: StoryPointSoftDemerit[],
  options?: { agendaFit?: number; noveltyAgainstRecentContent?: number },
): StoryPointGateScores {
  const specificity = scoreSpecificity(point);
  const curiosityStrength = scoreCuriosity(point);
  const readerPayoffStrength = scorePayoff(point);
  const researchability = scoreResearchability(point);
  const interestingness = scoreInterestingness(point, specificity, curiosityStrength);
  const genericRisk = scoreGenericRisk(point, softDemerits);
  const agendaFit = clamp01(options?.agendaFit ?? 0.7);
  const noveltyAgainstRecentContent = clamp01(options?.noveltyAgainstRecentContent ?? 0.7);
  const demeritPenalty = softDemerits.reduce((sum, d) => sum + d.weight, 0);

  const composite = clamp01(
    interestingness * 0.18 +
      specificity * 0.18 +
      curiosityStrength * 0.18 +
      readerPayoffStrength * 0.16 +
      researchability * 0.14 +
      agendaFit * 0.08 +
      noveltyAgainstRecentContent * 0.08 -
      genericRisk * 0.25 -
      demeritPenalty * 0.5,
  );

  return {
    interestingness,
    specificity,
    curiosityStrength,
    readerPayoffStrength,
    researchability,
    genericRisk,
    agendaFit,
    noveltyAgainstRecentContent,
    composite,
  };
}

export type EvaluateStoryPointQualityOptions = {
  agendaFit?: number;
  noveltyAgainstRecentContent?: number;
  /** Minimum composite for PASS (default 0.42). */
  minComposite?: number;
};

/**
 * Structural Point Quality Gate.
 * Phrase heuristics demote; they never alone hard-fail a concrete point.
 */
export function evaluateStoryPointQuality(
  point: StoryContentPoint | null | undefined,
  options?: EvaluateStoryPointQualityOptions,
): StoryPointGateResult {
  if (!point) {
    return {
      contract: STORY_POINT_GATE_RESULT_CONTRACT,
      pointId: "missing",
      verdict: "fail",
      hardFailReasons: ["missing_point"],
      softDemerits: [],
      scores: {
        interestingness: 0,
        specificity: 0,
        curiosityStrength: 0,
        readerPayoffStrength: 0,
        researchability: 0,
        genericRisk: 1,
        agendaFit: 0,
        noveltyAgainstRecentContent: 0,
        composite: 0,
      },
    };
  }

  const hardFailReasons: string[] = [];
  const blob = [
    point.storyQuestion,
    point.storyClaim,
    point.whyInteresting,
    point.audienceTension,
    point.curiosityGap,
    point.readerPayoff,
  ]
    .filter(Boolean)
    .join("\n");

  const softDemerits = softPhraseDemerits(blob);

  if (!point.storyQuestion && !point.storyClaim) {
    hardFailReasons.push("missing_story_question_or_claim");
  }
  if (fieldTooThin(point.curiosityGap)) {
    hardFailReasons.push("curiosity_gap_too_thin");
  }
  if (fieldTooThin(point.audienceTension)) {
    hardFailReasons.push("audience_tension_too_thin");
  }
  if (fieldTooThin(point.readerPayoff)) {
    hardFailReasons.push("reader_payoff_too_thin");
  }
  if (point.mechanisms.length < 1) {
    hardFailReasons.push("mechanism_required");
  }
  if (matchesAny(point.curiosityGap, EMPTY_GAP_PATTERNS)) {
    hardFailReasons.push("curiosity_gap_structurally_generic");
  }
  if (matchesAny(point.readerPayoff, EMPTY_PAYOFF_PATTERNS)) {
    hardFailReasons.push("reader_payoff_structurally_generic");
  }

  const falsifiable = point.researchQuestions.filter(looksLikeFalsifiableQuestion);
  if (falsifiable.length < 1) {
    hardFailReasons.push("research_questions_not_falsifiable");
  }

  if (point.researchNeeded.length === 0 && falsifiable.length > 0) {
    softDemerits.push({
      code: "research_needed_empty",
      weight: 0.04,
      detail: "researchNeeded scope empty; questions alone may underspecify desk work",
    });
  }

  const scores = buildScores(point, softDemerits, options);
  const minComposite = options?.minComposite ?? 0.42;

  if (hardFailReasons.length === 0 && scores.composite < minComposite) {
    hardFailReasons.push("composite_below_threshold");
  }

  return {
    contract: STORY_POINT_GATE_RESULT_CONTRACT,
    pointId: point.pointId,
    verdict: hardFailReasons.length === 0 ? "pass" : "fail",
    hardFailReasons,
    softDemerits,
    scores,
  };
}

/** Rank PASS results by composite; return top K point ids. */
export function selectTopStoryPoints(gateResults: StoryPointGateResult[], topK: number): string[] {
  return gateResults
    .filter((r) => r.verdict === "pass")
    .sort((a, b) => b.scores.composite - a.scores.composite)
    .slice(0, Math.max(0, topK))
    .map((r) => r.pointId);
}

/** True when CS may receive this evidence status. */
export function storyEvidenceAllowsContentStrategy(status: StoryEvidenceSupportStatus): boolean {
  return status === "SUPPORTED" || status === "PARTIALLY_SUPPORTED";
}
