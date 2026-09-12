/**
 * Epistemic / overconfidence guards for RA-1C3 grounded research.
 * Model prose must not inflate source class or marketing performance claims.
 */

const PERFORMANCE_PREDICTION_PATTERNS = [
  /스크랩이\s*폭발/,
  /입소문\s*효과가\s*극대화/,
  /검색\s*유입이\s*폭발/,
  /가장\s*많이\s*클릭/,
  /바이럴이\s*확실/,
  /조회수가\s*폭발/,
  /무조건\s*반응/,
];

const OFFICIAL_SELF_DECLARE_PATTERNS = [
  /공식\s*출처입니다/,
  /this is (an )?official/i,
  /official source/i,
  /공식\s*사이트로\s*확인됨/,
];

export function looksLikeUnsupportedPerformancePrediction(text: string): boolean {
  return PERFORMANCE_PREDICTION_PATTERNS.some((re) => re.test(text));
}

export function looksLikeModelSelfDeclaredOfficial(text: string): boolean {
  return OFFICIAL_SELF_DECLARE_PATTERNS.some((re) => re.test(text));
}

/** Downgrade or drop unsupported marketing-performance certainty from finding text. */
export function sanitizeResearchFindingText(text: string): {
  text: string;
  downgraded: boolean;
  reason: string | null;
} {
  if (looksLikeUnsupportedPerformancePrediction(text)) {
    return {
      text: `[hypothesis/advisory only — measured performance evidence absent] ${text}`,
      downgraded: true,
      reason: "unsupported_performance_prediction",
    };
  }
  return { text, downgraded: false, reason: null };
}
