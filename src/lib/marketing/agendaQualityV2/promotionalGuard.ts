/**
 * Phase 5A — Promotional source laundering guard.
 * Tourism-board / DMO provenance may produce strong Agendas, but only with
 * concrete consumer-interest detail. Certification ≠ hidden detail.
 */

export const PROMOTIONAL_SOURCE_TYPE_MARKERS = [
  "tourism_board",
  "destination_marketing",
  "official_promotional_editorial",
  "tourism",
  "dmo",
  "visit_",
] as const;

/** Claims that are provenance/marketing — not concrete hidden detail by themselves. */
const CERTIFICATION_OR_PROMO_CLAIM: RegExp[] = [
  /UN\s*Tourism/i,
  /유엔\s*관광/,
  /Best\s*Tourism\s*Villages/i,
  /최우수\s*관광\s*마을/,
  /공식\s*(선정|추천|인증)/,
  /국제\s*기구.*(선정|인증|추천)/,
  /인증(을)?\s*(받은|한|된)/,
  /선정증/,
  /숨은\s*명소/,
  /숨겨둔/,
  /꼭\s*가봐야/,
  /must[- ]?visit/i,
  /hidden\s*gem/i,
  /지속가능(성|한)?\s*(브랜딩|여행|관광)?/,
  /sustainable\s+trail/i,
  /discover\s+["']?best/i,
];

/** Sensational / unsupported amplification — reject unless source explicitly supports. */
const SENSATIONAL_UNSUPPORTED: RegExp[] = [
  /UN이\s*숨겨둔/,
  /유엔이\s*숨겨둔/,
  /진짜\s*숨은/,
  /아무도\s*모르는/,
  /현지인만\s*아는/,
  /한국인(은|이)?\s*아직\s*모르는/,
  /비밀의/,
  /완전히\s*새로운/,
  /절대\s*접할\s*수\s*없는/,
];

/**
 * Concrete consumer-interest substance (architecture, custom, access, contrast detail…).
 * Certification words alone do NOT match these.
 */
const CONCRETE_SUBSTANCE: RegExp[] = [
  /흙담|토축|rammed[- ]?earth|전통\s*가옥|건축\s*구조/,
  /소수민족|다오\s*족|Dao|생활\s*문화|생활\s*유산/,
  /랑선|Lang\s*Son|국경\s*지대|북부\s*(산악|국경)/i,
  /낮과\s*밤|오토바이\s*행렬|골목|나이트라이프|거리\s*음식|사이공|호치민/,
  /숙소\s*위치|프라이빗|리조트\s*클러스터|입지/,
  /수확\s*축제|미식\s*축제|계절\s*경험/,
  /비자|입출국\s*카드|신분증|입국\s*요건/,
  /이동\s*경로|접근\s*방식|교통\s*패턴/,
  /와이키키|공연\s*티켓|상설\s*공연/,
];

const PROMOTIONAL_TITLE_HEURISTICS: RegExp[] = [
  /best\s+tourism\s+villages/i,
  /sustainable\s+trail/i,
  /discover\s+.+\s+vietnam/i,
  /꼭\s*가봐야/,
  /숨은\s*명소/,
  /must[- ]?visit/i,
  /hidden\s+gem/i,
  /official\s+tourism/i,
  /visit\s+\w+\s+board/i,
];

export type PromotionalGuardFinding = {
  code:
    | "promotional_specificity_fail"
    | "certification_as_hidden_detail"
    | "sensational_unsupported_claim";
  message: string;
};

export type PromotionalSignalAssessment = {
  promotionalSource: boolean;
  promotionalGenericRisk: boolean;
  promotionalSpecificityPass: boolean;
  sensationalUnsupported: boolean;
  certificationOnlyHiddenDetail: boolean;
  findings: PromotionalGuardFinding[];
};

function collapseWs(value: string): string {
  return value.replace(/\s+/g, " ").trim();
}

export function isPromotionalSourceType(sourceTypes: string[] | null | undefined): boolean {
  if (!sourceTypes?.length) return false;
  return sourceTypes.some((t) => {
    const low = t.toLowerCase();
    return PROMOTIONAL_SOURCE_TYPE_MARKERS.some(
      (m) => low === m || low.includes(m) || low.startsWith(m),
    );
  });
}

export function detectPromotionalTitleHeuristic(title: string, summary?: string): boolean {
  const blob = `${title}\n${summary ?? ""}`;
  return PROMOTIONAL_TITLE_HEURISTICS.some((re) => re.test(blob));
}

export function textHasConcreteSubstance(text: string): boolean {
  return CONCRETE_SUBSTANCE.some((re) => re.test(text));
}

export function textIsCertificationOrPromoClaimHeavy(text: string): boolean {
  const t = collapseWs(text);
  if (!t) return false;
  const certHits = CERTIFICATION_OR_PROMO_CLAIM.filter((re) => re.test(t)).length;
  if (certHits === 0) return false;
  // Certification-heavy without concrete substance
  return !textHasConcreteSubstance(t);
}

export function detectSensationalUnsupportedClaims(texts: string[]): string[] {
  const hits: string[] = [];
  for (const text of texts) {
    for (const re of SENSATIONAL_UNSUPPORTED) {
      if (re.test(text)) hits.push(text.trim().slice(0, 120));
    }
  }
  return [...new Set(hits)];
}

/**
 * Strip certification/promo claim phrases when judging whether hiddenDetail is concrete.
 */
export function stripCertificationClaims(text: string): string {
  let out = text;
  for (const re of CERTIFICATION_OR_PROMO_CLAIM) {
    out = out.replace(re, " ");
  }
  return collapseWs(out);
}

export function evaluatePromotionalSignalGuard(params: {
  originalTitle: string;
  originalSummary?: string;
  sourceTypes?: string[];
  marketingStorySeedKo: string;
  whyInterestingKo?: string;
  curiosityHookKo?: string;
  hiddenDetailKo?: string;
  familiarReferenceKo?: string;
  alternativeAppealKo?: string;
  explorationPayoffKo?: string;
}): PromotionalSignalAssessment {
  const promotionalSource =
    isPromotionalSourceType(params.sourceTypes) ||
    detectPromotionalTitleHeuristic(params.originalTitle, params.originalSummary);

  const editorialBlob = [
    params.marketingStorySeedKo,
    params.whyInterestingKo ?? "",
    params.curiosityHookKo ?? "",
    params.hiddenDetailKo ?? "",
    params.familiarReferenceKo ?? "",
    params.alternativeAppealKo ?? "",
    params.explorationPayoffKo ?? "",
  ].join("\n");

  const sensationalHits = detectSensationalUnsupportedClaims([
    params.marketingStorySeedKo,
    params.whyInterestingKo ?? "",
    params.curiosityHookKo ?? "",
    params.hiddenDetailKo ?? "",
  ]);
  const sensationalUnsupported = sensationalHits.length > 0;

  const hidden = collapseWs(params.hiddenDetailKo ?? "");
  const hiddenWithoutCert = stripCertificationClaims(hidden);
  const certificationOnlyHiddenDetail =
    hidden.length >= 8 &&
    (textIsCertificationOrPromoClaimHeavy(hidden) ||
      (hiddenWithoutCert.length < 12 && CERTIFICATION_OR_PROMO_CLAIM.some((re) => re.test(hidden))));

  const concreteElsewhere =
    textHasConcreteSubstance(editorialBlob) ||
    textHasConcreteSubstance(hiddenWithoutCert) ||
    // Contrast + familiar reference with a named place difference can count when substance present
    (/다낭|나트랑|리조트/.test(params.familiarReferenceKo ?? "") &&
      textHasConcreteSubstance(
        `${params.hiddenDetailKo ?? ""} ${params.whyInterestingKo ?? ""} ${params.marketingStorySeedKo}`,
      ));

  const promotionalSpecificityPass = concreteElsewhere && !certificationOnlyHiddenDetail;

  const findings: PromotionalGuardFinding[] = [];

  if (sensationalUnsupported) {
    findings.push({
      code: "sensational_unsupported_claim",
      message: `Unsupported sensational framing: ${sensationalHits[0] ?? ""}`,
    });
  }

  if (certificationOnlyHiddenDetail) {
    findings.push({
      code: "certification_as_hidden_detail",
      message:
        "Award/certification/recommendation alone does not count as hiddenDetailValue",
    });
  }

  if (promotionalSource && !promotionalSpecificityPass) {
    findings.push({
      code: "promotional_specificity_fail",
      message:
        "Promotional/tourism-board source requires concrete consumer-interest detail beyond certification/promotion",
    });
  }

  // Even non-promotional sources: certification-only "hidden detail" is invalid substance
  if (!promotionalSource && certificationOnlyHiddenDetail && !concreteElsewhere) {
    findings.push({
      code: "certification_as_hidden_detail",
      message: "Certification claim used as sole hidden detail",
    });
  }

  const promotionalGenericRisk =
    findings.some(
      (f) =>
        f.code === "promotional_specificity_fail" ||
        f.code === "certification_as_hidden_detail" ||
        f.code === "sensational_unsupported_claim",
    ) ||
    (promotionalSource && !promotionalSpecificityPass);

  return {
    promotionalSource,
    promotionalGenericRisk,
    promotionalSpecificityPass: promotionalSource ? promotionalSpecificityPass : true,
    sensationalUnsupported,
    certificationOnlyHiddenDetail,
    findings,
  };
}
