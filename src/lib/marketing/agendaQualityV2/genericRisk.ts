/**
 * Deterministic generic-risk checks for Marketing Agenda V2.
 * Prefer structural + phrase-family checks over brittle single-keyword blocks.
 */

const GENERIC_PHRASE_FAMILIES: RegExp[] = [
  /여행\s*계획에?\s*참고/,
  /최신\s*정보(를)?\s*확인/,
  /관광객(에게|에게는)?\s*유용/,
  /여행자(들)?의?\s*관심(이)?\s*(높다|증가|커지고)/,
  /인기(가)?\s*(높다|증가|많다)/,
  /관광\s*(산업\s*)?(성장|호황|붐)/,
  /개장(을)?\s*(알리|발표)/,
  /공급(이)?\s*(증가|확대)한다?\s*$/,
];

const POPULARITY_ONLY: RegExp[] = [
  /^(?:.{0,40})(?:인기|트렌드|핫한|붐)(?:.{0,40})$/,
  /관심\s*증가/,
  /화제(가)?\s*(되고|다)/,
];

export type GenericRiskFinding = {
  code:
    | "placeholder_phrase"
    | "popularity_statement"
    | "headline_echo"
    | "empty_decision_frame"
    | "article_summary_shape";
  message: string;
};

function collapseWs(value: string): string {
  return value.replace(/\s+/g, " ").trim();
}

function normalizeForCompare(value: string): string {
  return collapseWs(value)
    .toLowerCase()
    .replace(/["""'']/g, "")
    .replace(/[?!.,~…·\-–—:;/\\|()[\]{}]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

export function isHeadlineEcho(params: {
  originalTitle: string;
  marketingStorySeedKo: string;
  travelerProblemKo?: string;
}): boolean {
  const title = normalizeForCompare(params.originalTitle);
  const seed = normalizeForCompare(params.marketingStorySeedKo);
  if (!title || !seed) return false;
  if (title === seed) return true;
  if (seed.includes(title) || title.includes(seed)) {
    // Allow only if seed clearly reframes as a question/decision.
    const looksLikeDecision =
      /[?？]/.test(params.marketingStorySeedKo) ||
      /어떻게|누구|언제|어디|무엇을|판단|선택|결정/.test(params.marketingStorySeedKo);
    return !looksLikeDecision;
  }
  if (params.travelerProblemKo) {
    const problem = normalizeForCompare(params.travelerProblemKo);
    if (problem && (problem === title || problem.includes(title))) {
      const looksLikeDecision =
        /[?？]/.test(params.travelerProblemKo) ||
        /어떻게|누구|언제|어디|무엇을|판단|선택|결정/.test(params.travelerProblemKo);
      return !looksLikeDecision;
    }
  }
  return false;
}

export function detectGenericAgendaRisk(params: {
  originalTitle: string;
  originalSummary?: string;
  travelerProblemKo: string;
  decisionAtStakeKo: string;
  audienceTensionKo: string;
  readerPayoffKo: string;
  marketingStorySeedKo: string;
}): GenericRiskFinding[] {
  const findings: GenericRiskFinding[] = [];
  const fields = [
    params.travelerProblemKo,
    params.decisionAtStakeKo,
    params.audienceTensionKo,
    params.readerPayoffKo,
    params.marketingStorySeedKo,
  ];

  for (const field of fields) {
    const text = collapseWs(field);
    for (const re of GENERIC_PHRASE_FAMILIES) {
      if (re.test(text)) {
        findings.push({
          code: "placeholder_phrase",
          message: `Generic placeholder/family match: ${re.source}`,
        });
        break;
      }
    }
    for (const re of POPULARITY_ONLY) {
      if (re.test(text)) {
        findings.push({
          code: "popularity_statement",
          message: "Output reduces to popularity/trend statement",
        });
        break;
      }
    }
  }

  if (
    isHeadlineEcho({
      originalTitle: params.originalTitle,
      marketingStorySeedKo: params.marketingStorySeedKo,
      travelerProblemKo: params.travelerProblemKo,
    })
  ) {
    findings.push({
      code: "headline_echo",
      message: "Story seed / problem echoes source headline without decision reframing",
    });
  }

  const decisionish =
    /선택|결정|판단|trade-?off|트레이드|언제|어디|누구|어떻게|무엇을|여부/.test(
      `${params.decisionAtStakeKo} ${params.travelerProblemKo} ${params.audienceTensionKo}`,
    );
  if (!decisionish) {
    findings.push({
      code: "empty_decision_frame",
      message: "Missing traveler decision/trade-off framing",
    });
  }

  const summary = collapseWs(params.originalSummary ?? "");
  if (summary.length > 20) {
    const seedNorm = normalizeForCompare(params.marketingStorySeedKo);
    const summaryNorm = normalizeForCompare(summary);
    if (seedNorm && summaryNorm && (seedNorm === summaryNorm || summaryNorm.includes(seedNorm))) {
      findings.push({
        code: "article_summary_shape",
        message: "Story seed mirrors article summary rather than decision seed",
      });
    }
  }

  return findings;
}
