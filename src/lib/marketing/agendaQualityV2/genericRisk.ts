/**
 * Deterministic generic-risk checks for Marketing Agenda V2.
 * Prefer structural + phrase-family checks over brittle single-keyword blocks.
 * Phase 5: decision frame is not universal; discovery/curiosity framing is valid.
 */

import { isDecisionOrientedArchetype } from "@/lib/marketing/agendaQualityV2/contracts";
import { evaluatePromotionalSignalGuard } from "@/lib/marketing/agendaQualityV2/promotionalGuard";

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

const EMPTY_PROMOTIONAL: RegExp[] = [
  /꼭\s*가봐야/,
  /숨은\s*명소\s*\d/,
  /베스트\s*\d/,
  /추천\s*여행지\s*\d/,
  /매력(적|이)\s*(인|다|인\s*곳)/,
  /특별(한|하다)\s*경험/,
  /새로운\s*매력/,
];

const ACADEMIC_MORAL_DEFAULT: RegExp[] = [
  /보존\s*(과|와)\s*관광/,
  /현지\s*(공동체|주민).*(부담|피해|책임)/,
  /관광의\s*사회적\s*책임/,
  /진정성(의)?\s*정의/,
  /지속가능.*가치\s*판단/,
  /윤리(적)?\s*(딜레마|균형|판단)/,
  /접근성.*보존.*사이/,
];

export type GenericRiskFinding = {
  code:
    | "placeholder_phrase"
    | "popularity_statement"
    | "headline_echo"
    | "empty_decision_frame"
    | "empty_editorial_interest"
    | "empty_promotional"
    | "academic_moral_default"
    | "article_summary_shape"
    | "promotional_specificity_fail"
    | "certification_as_hidden_detail"
    | "sensational_unsupported_claim";
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

function looksLikeReframe(text: string): boolean {
  return (
    /[?？]/.test(text) ||
    /어떻게|누구|언제|어디|무엇을|판단|선택|결정|이런|몰랐|다른|대신|말고|발견|호기심|살펴/.test(
      text,
    )
  );
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
    return !looksLikeReframe(params.marketingStorySeedKo);
  }
  if (params.travelerProblemKo) {
    const problem = normalizeForCompare(params.travelerProblemKo);
    if (problem && (problem === title || problem.includes(title))) {
      return !looksLikeReframe(params.travelerProblemKo);
    }
  }
  return false;
}

export function detectGenericAgendaRisk(params: {
  originalTitle: string;
  originalSummary?: string;
  sourceTypes?: string[];
  travelerProblemKo: string;
  decisionAtStakeKo: string;
  audienceTensionKo: string;
  readerPayoffKo: string;
  marketingStorySeedKo: string;
  editorialArchetype?: string;
  whyInterestingKo?: string;
  curiosityHookKo?: string;
  hiddenDetailKo?: string;
  contentImaginabilityKo?: string;
  familiarReferenceKo?: string;
  alternativeAppealKo?: string;
  explorationPayoffKo?: string;
}): GenericRiskFinding[] {
  const findings: GenericRiskFinding[] = [];
  const fields = [
    params.travelerProblemKo,
    params.decisionAtStakeKo,
    params.audienceTensionKo,
    params.readerPayoffKo,
    params.marketingStorySeedKo,
    params.whyInterestingKo ?? "",
    params.curiosityHookKo ?? "",
    params.hiddenDetailKo ?? "",
  ];

  for (const field of fields) {
    const text = collapseWs(field);
    if (!text) continue;
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
    for (const re of EMPTY_PROMOTIONAL) {
      if (re.test(text) && text.length < 40) {
        findings.push({
          code: "empty_promotional",
          message: "Empty promotional / listicle framing without concrete detail",
        });
        break;
      }
    }
  }

  const editorialBlob = [
    params.marketingStorySeedKo,
    params.whyInterestingKo ?? "",
    params.curiosityHookKo ?? "",
    params.hiddenDetailKo ?? "",
    params.travelerProblemKo,
    params.decisionAtStakeKo,
  ].join(" ");
  for (const re of ACADEMIC_MORAL_DEFAULT) {
    if (re.test(editorialBlob)) {
      findings.push({
        code: "academic_moral_default",
        message: "Unnecessary academic/moral/social-responsibility framing",
      });
      break;
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
      message: "Story seed / problem echoes source headline without editorial reframing",
    });
  }

  const decisionOriented = isDecisionOrientedArchetype(params.editorialArchetype);
  if (decisionOriented) {
    const decisionish =
      /선택|결정|판단|trade-?off|트레이드|언제|어디|누구|어떻게|무엇을|여부/.test(
        `${params.decisionAtStakeKo} ${params.travelerProblemKo} ${params.audienceTensionKo}`,
      );
    if (!decisionish) {
      findings.push({
        code: "empty_decision_frame",
        message: "Missing traveler decision/trade-off framing for decision-oriented archetype",
      });
    }
  } else {
    const interestish =
      collapseWs(params.whyInterestingKo ?? "").length >= 8 &&
      collapseWs(params.curiosityHookKo ?? "").length >= 8 &&
      collapseWs(params.hiddenDetailKo ?? "").length >= 8;
    const concrete =
      /구체|세부|차이|대신|말고|몰랐|발견|포인트|특징|경험|마을|문화|축제|숙소|위치|규정|비자|신분증|흙담|토축|소수민족|오토바이|골목|낮과\s*밤/.test(
        `${params.hiddenDetailKo ?? ""} ${params.whyInterestingKo ?? ""} ${params.marketingStorySeedKo}`,
      );
    if (!interestish || !concrete) {
      findings.push({
        code: "empty_editorial_interest",
        message: "Missing concrete curiosity / hidden-interest / discovery framing",
      });
    }
  }

  // Soft promotional emptiness: curiosity words alone without content imaginability
  const imaginability = collapseWs(params.contentImaginabilityKo ?? "");
  if (
    imaginability.length < 8 &&
    /새롭|특별|매력|흥미/.test(params.marketingStorySeedKo) &&
    params.marketingStorySeedKo.trim().length < 36
  ) {
    findings.push({
      code: "empty_promotional",
      message: "Inspiration-only seed without content imaginability",
    });
  }

  const summary = collapseWs(params.originalSummary ?? "");
  if (summary.length > 20) {
    const seedNorm = normalizeForCompare(params.marketingStorySeedKo);
    const summaryNorm = normalizeForCompare(summary);
    if (seedNorm && summaryNorm && (seedNorm === summaryNorm || summaryNorm.includes(seedNorm))) {
      findings.push({
        code: "article_summary_shape",
        message: "Story seed mirrors article summary rather than editorial seed",
      });
    }
  }

  const promo = evaluatePromotionalSignalGuard({
    originalTitle: params.originalTitle,
    originalSummary: params.originalSummary,
    sourceTypes: params.sourceTypes,
    marketingStorySeedKo: params.marketingStorySeedKo,
    whyInterestingKo: params.whyInterestingKo,
    curiosityHookKo: params.curiosityHookKo,
    hiddenDetailKo: params.hiddenDetailKo,
    familiarReferenceKo: params.familiarReferenceKo,
    alternativeAppealKo: params.alternativeAppealKo,
    explorationPayoffKo: params.explorationPayoffKo,
  });
  for (const f of promo.findings) {
    findings.push({ code: f.code, message: f.message });
  }

  return findings;
}
