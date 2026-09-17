import {
  isDecisionOrientedArchetype,
  parseAgendaEditorialArchetype,
  type MarketingAgendaCandidateV2,
} from "@/lib/marketing/agendaQualityV2/contracts";
import { detectGenericAgendaRisk } from "@/lib/marketing/agendaQualityV2/genericRisk";
import { evaluatePromotionalSignalGuard } from "@/lib/marketing/agendaQualityV2/promotionalGuard";
import { computeFreshnessDecayScore } from "@/lib/marketing/agendaQualityV2/decay/freshnessDecay";
import { computePresentationFatiguePenalty } from "@/lib/marketing/agendaQualityV2/decay/freshnessDecay";
import type { AgendaReuseAssessment } from "@/lib/marketing/agendaQualityV2/memory/reuseDetection";
import {
  AGENDA_V2_PRESENTATION_FATIGUE_CALIBRATED,
  resolveAgendaV2ScoreConfig,
  type AgendaV2ScoreConfig,
} from "@/lib/marketing/agendaQualityV2/scoring/calibrationConfig";

export const AGENDA_QUALITY_TIERS = ["STRONG", "PUBLISHABLE", "WEAK", "REJECT"] as const;
export type AgendaQualityTier = (typeof AGENDA_QUALITY_TIERS)[number];

export type AgendaV2ScoreBreakdown = {
  signalQualityScore: number;
  marketingQualityScore: number;
  totalScore: number;
  qualityTier: AgendaQualityTier;
  novelty: {
    topicRepeat: boolean;
    decisionRepeat: boolean;
    storySeedRepeat: boolean;
    materialUpdate: boolean;
    reuseKind: AgendaReuseAssessment["kind"];
  };
  penalties: {
    reusePenalty: number;
    fatiguePenalty: number;
    genericRiskPenalty: number;
    staleTrendPenalty: number;
    decisionAxisRepeatPenalty: number;
    promotionalGenericRiskPenalty: number;
  };
  dimensions: {
    decisionUtility: number;
    audienceSpecificity: number;
    tensionStrength: number;
    readerPayoffStrength: number;
    researchability: number;
    storyExpandability: number;
    channelPotential: number;
    commercialRelevance: number;
    specificity: number;
    novelty: number;
    curiosityStrength: number;
    unexpectedness: number;
    hiddenDetailValue: number;
    koreanTravelerRelevanceDim: number;
    alternativeAppeal: number;
    explorationPull: number;
    contentImaginability: number;
  };
  promotional: {
    promotionalSource: boolean;
    promotionalGenericRisk: boolean;
    promotionalSpecificityPass: boolean;
    sensationalUnsupported: boolean;
    certificationOnlyHiddenDetail: boolean;
  };
};

export type { AgendaV2ScoreConfig };

export const AGENDA_V2_SCORE_DEFAULTS: AgendaV2ScoreConfig = resolveAgendaV2ScoreConfig();

function clamp01(n: number): number {
  return Math.max(0, Math.min(1, n));
}

function lenScore(text: string, goodMin: number, goodMax: number): number {
  const n = text.trim().length;
  if (n < 8) return 0.1;
  if (n < goodMin) return 0.35;
  if (n <= goodMax) return 0.85;
  return 0.7;
}

function hasDecisionLexicon(text: string): boolean {
  return /선택|결정|판단|trade-?off|트레이드|언제|어디|누구|어떻게|무엇을|여부|맞는지/.test(
    text,
  );
}

function hasCuriosityLexicon(text: string): boolean {
  return /이런|몰랐|발견|호기심|흥미|다른|대신|말고|살펴|포인트|특징|숨은|의외/.test(text);
}

type DimWeights = Record<keyof AgendaV2ScoreBreakdown["dimensions"], number>;

function archetypeWeights(archetype: string | null): DimWeights {
  const base: DimWeights = {
    decisionUtility: 0.08,
    audienceSpecificity: 0.08,
    tensionStrength: 0.06,
    readerPayoffStrength: 0.08,
    researchability: 0.08,
    storyExpandability: 0.07,
    channelPotential: 0.04,
    commercialRelevance: 0.03,
    specificity: 0.08,
    novelty: 0.05,
    curiosityStrength: 0.1,
    unexpectedness: 0.08,
    hiddenDetailValue: 0.09,
    koreanTravelerRelevanceDim: 0.08,
    alternativeAppeal: 0.05,
    explorationPull: 0.08,
    contentImaginability: 0.09,
  };

  const a = (archetype ?? "DISCOVERY").toUpperCase();
  if (a === "DISCOVERY") {
    return {
      ...base,
      curiosityStrength: 0.14,
      unexpectedness: 0.12,
      explorationPull: 0.12,
      specificity: 0.1,
      decisionUtility: 0.03,
      tensionStrength: 0.03,
      contentImaginability: 0.1,
    };
  }
  if (a === "HIDDEN_DETAIL") {
    return {
      ...base,
      hiddenDetailValue: 0.16,
      unexpectedness: 0.12,
      curiosityStrength: 0.1,
      decisionUtility: 0.04,
      tensionStrength: 0.04,
    };
  }
  if (a === "CONTRAST") {
    return {
      ...base,
      unexpectedness: 0.12,
      alternativeAppeal: 0.1,
      specificity: 0.12,
      curiosityStrength: 0.1,
      decisionUtility: 0.04,
    };
  }
  if (a === "ALTERNATIVE") {
    return {
      ...base,
      alternativeAppeal: 0.16,
      explorationPull: 0.1,
      koreanTravelerRelevanceDim: 0.1,
      decisionUtility: 0.05,
    };
  }
  if (a === "CULTURAL_CURIOSITY") {
    return {
      ...base,
      curiosityStrength: 0.12,
      koreanTravelerRelevanceDim: 0.12,
      specificity: 0.12,
      hiddenDetailValue: 0.1,
      decisionUtility: 0.03,
      tensionStrength: 0.03,
    };
  }
  if (a === "EXPERIENCE_FIT") {
    return {
      ...base,
      audienceSpecificity: 0.14,
      readerPayoffStrength: 0.12,
      explorationPull: 0.1,
      decisionUtility: 0.1,
      tensionStrength: 0.08,
    };
  }
  if (a === "DECISION") {
    return {
      ...base,
      decisionUtility: 0.16,
      tensionStrength: 0.12,
      readerPayoffStrength: 0.12,
      curiosityStrength: 0.05,
      unexpectedness: 0.04,
      explorationPull: 0.04,
    };
  }
  if (a === "PRACTICAL") {
    return {
      ...base,
      decisionUtility: 0.14,
      researchability: 0.14,
      specificity: 0.12,
      readerPayoffStrength: 0.12,
      curiosityStrength: 0.04,
      explorationPull: 0.04,
      alternativeAppeal: 0.02,
    };
  }
  return base;
}

function normalizeWeights(w: DimWeights): DimWeights {
  const sum = Object.values(w).reduce((a, b) => a + b, 0) || 1;
  const out = { ...w };
  for (const k of Object.keys(out) as (keyof DimWeights)[]) {
    out[k] = out[k] / sum;
  }
  return out;
}

export function scoreMarketingDimensions(candidate: MarketingAgendaCandidateV2): AgendaV2ScoreBreakdown["dimensions"] {
  const t = candidate.traveler;
  const e = candidate.editorial;
  const decisionUtility =
    (hasDecisionLexicon(t.decisionAtStakeKo || t.travelerProblemKo) ? 0.55 : 0.15) +
    lenScore(t.decisionAtStakeKo || t.travelerProblemKo, 18, 80) * 0.45;
  const audienceSpecificity =
    (/(여행자|가족|커플|부모|혼자|허니문|골프|친구|한국)/.test(t.targetTravelerKo) ? 0.5 : 0.2) +
    lenScore(t.targetTravelerKo, 10, 60) * 0.5;
  const tensionStrength =
    t.audienceTensionKo.trim().length < 8
      ? 0.15
      : (/(vs|대비|트레이드|갈등|긴장|편의|경험|가격|시간)/.test(t.audienceTensionKo) ? 0.55 : 0.2) +
        lenScore(t.audienceTensionKo, 12, 70) * 0.45;
  const readerPayoffStrength =
    (/(판단|기준|체크|고를|피할|알|얻|발견|호기심|살펴|비교)/.test(t.readerPayoffKo) ? 0.5 : 0.2) +
    lenScore(t.readerPayoffKo, 12, 70) * 0.5;
  const researchability =
    e.researchQuestionsKo.length >= 2
      ? 0.85
      : e.researchQuestionsKo.length === 1
        ? 0.55
        : 0.15;
  const storyExpandability =
    (e.storyArchetypeHint && e.storyArchetypeHint !== "other" ? 0.35 : 0.15) +
    (e.editorialArchetype ? 0.15 : 0) +
    lenScore(e.marketingStorySeedKo, 20, 90) * 0.5;
  const channelPotential = clamp01(
    0.3 +
      (hasCuriosityLexicon(e.marketingStorySeedKo) || hasDecisionLexicon(e.marketingStorySeedKo)
        ? 0.35
        : 0) +
      (e.researchQuestionsKo.length > 0 ? 0.15 : 0) +
      (e.contentImaginabilityKo.trim().length > 12 ? 0.15 : 0),
  );
  const commercialRaw = candidate.qualityInput.commercialRelevanceHint;
  const commercialRelevance =
    typeof commercialRaw === "string" && /high|높/.test(commercialRaw)
      ? 0.75
      : typeof commercialRaw === "string" && commercialRaw.trim()
        ? 0.45
        : 0.35;

  const curiosityStrength = clamp01(
    (hasCuriosityLexicon(`${e.curiosityHookKo} ${e.whyInterestingKo} ${e.marketingStorySeedKo}`)
      ? 0.55
      : 0.2) +
      lenScore(e.curiosityHookKo, 12, 70) * 0.45,
  );
  const unexpectedness = clamp01(
    (/(다른|대신|말고|몰랐|의외|익숙|리조트|다낭|나트랑|오사카|도쿄)/.test(
      `${e.hiddenDetailKo} ${e.familiarReferenceKo} ${e.whyInterestingKo}`,
    )
      ? 0.55
      : 0.2) + lenScore(e.whyInterestingKo, 12, 70) * 0.45,
  );
  // Do NOT treat award/certification/"숨은" promo words as hidden-detail substance.
  const hiddenDetailValue = clamp01(
    (/(포인트|세부|특징|놓치|구체|흙담|토축|소수민족|축제|규정|위치|프라이빗|오토바이|골목|낮과\s*밤|가옥)/.test(
      e.hiddenDetailKo,
    )
      ? 0.55
      : 0.2) + lenScore(e.hiddenDetailKo, 12, 80) * 0.45,
  );
  const koreanTravelerRelevanceDim = clamp01(
    (/(한국|다낭|나트랑|도쿄|오사카|부산|첫\s*여행|재방문)/.test(e.whyKoreanTravelerCaresKo)
      ? 0.5
      : 0.25) +
      lenScore(e.whyKoreanTravelerCaresKo, 12, 80) * 0.5 +
      (candidate.qualityInput.koreanTravelerRelevance ?? 0.4) * 0.15,
  );
  const alternativeAppeal = clamp01(
    (e.alternativeAppealKo.trim().length >= 8 ||
    /대신|말고|대안|다른\s*선택/.test(`${e.alternativeAppealKo} ${e.marketingStorySeedKo}`)
      ? 0.55
      : 0.15) + lenScore(e.alternativeAppealKo || e.familiarReferenceKo, 10, 70) * 0.45,
  );
  const explorationPull = clamp01(
    (/(알아보고|살펴|검색|읽어|상상|가보고|발견)/.test(
      `${e.explorationPayoffKo} ${e.curiosityHookKo} ${t.readerPayoffKo}`,
    )
      ? 0.55
      : 0.2) + lenScore(e.explorationPayoffKo, 12, 70) * 0.45,
  );
  const contentImaginability = clamp01(
    (/(헤드라인|제목|섹션|구성|시각|사진|사례|본문|훅)/.test(e.contentImaginabilityKo)
      ? 0.5
      : 0.25) + lenScore(e.contentImaginabilityKo, 16, 100) * 0.5,
  );

  const specificity = clamp01(
    (audienceSpecificity +
      Math.max(decisionUtility, hiddenDetailValue) +
      Math.max(tensionStrength, unexpectedness)) /
      3,
  );

  return {
    decisionUtility: clamp01(decisionUtility),
    audienceSpecificity: clamp01(audienceSpecificity),
    tensionStrength: clamp01(tensionStrength),
    readerPayoffStrength: clamp01(readerPayoffStrength),
    researchability: clamp01(researchability),
    storyExpandability: clamp01(storyExpandability),
    channelPotential,
    commercialRelevance: clamp01(commercialRelevance),
    specificity,
    novelty: 1,
    curiosityStrength,
    unexpectedness,
    hiddenDetailValue,
    koreanTravelerRelevanceDim: clamp01(koreanTravelerRelevanceDim),
    alternativeAppeal,
    explorationPull,
    contentImaginability,
  };
}

function tierFromScores(params: {
  total: number;
  marketing: number;
  cfg: AgendaV2ScoreConfig;
  hardReject: boolean;
}): AgendaQualityTier {
  if (params.hardReject) return "REJECT";
  if (params.marketing < params.cfg.marketingFloorForPublishable) {
    if (params.total >= params.cfg.weakMin) return "WEAK";
    return "REJECT";
  }
  if (params.total >= params.cfg.strongMin) return "STRONG";
  if (params.total >= params.cfg.publishableMin) return "PUBLISHABLE";
  if (params.total >= params.cfg.weakMin) return "WEAK";
  return "REJECT";
}

export type ScoreAgendaV2Input = {
  candidate: MarketingAgendaCandidateV2;
  reuse: AgendaReuseAssessment;
  nowIso: string;
  presentedCount?: number;
  lastPresentedAt?: string | null;
  originalTitle?: string;
  config?: Partial<AgendaV2ScoreConfig>;
};

export function scoreMarketingAgendaV2(input: ScoreAgendaV2Input): AgendaV2ScoreBreakdown {
  const cfg = { ...AGENDA_V2_SCORE_DEFAULTS, ...input.config };
  const c = input.candidate;
  const dims = scoreMarketingDimensions(c);
  const archetype =
    parseAgendaEditorialArchetype(String(c.editorial.editorialArchetype ?? "")) ??
    String(c.editorial.editorialArchetype ?? "DISCOVERY");

  const promo = evaluatePromotionalSignalGuard({
    originalTitle: input.originalTitle ?? c.signalContext.signalSummaryKo,
    originalSummary: c.signalContext.signalSummaryKo,
    sourceTypes: c.signalContext.sourceTypes,
    marketingStorySeedKo: c.editorial.marketingStorySeedKo,
    whyInterestingKo: c.editorial.whyInterestingKo,
    curiosityHookKo: c.editorial.curiosityHookKo,
    hiddenDetailKo: c.editorial.hiddenDetailKo,
    familiarReferenceKo: c.editorial.familiarReferenceKo,
    alternativeAppealKo: c.editorial.alternativeAppealKo,
    explorationPayoffKo: c.editorial.explorationPayoffKo,
  });

  // Promotional laundering: certification/curiosity words must not inflate discovery dims.
  if (promo.certificationOnlyHiddenDetail || (promo.promotionalSource && !promo.promotionalSpecificityPass)) {
    dims.hiddenDetailValue = Math.min(dims.hiddenDetailValue, 0.22);
    dims.unexpectedness = Math.min(dims.unexpectedness, 0.28);
    dims.explorationPull = Math.min(dims.explorationPull, 0.3);
    dims.curiosityStrength = Math.min(dims.curiosityStrength, 0.35);
    dims.specificity = Math.min(dims.specificity, 0.3);
  }
  if (promo.sensationalUnsupported) {
    dims.curiosityStrength = Math.min(dims.curiosityStrength, 0.25);
    dims.unexpectedness = Math.min(dims.unexpectedness, 0.2);
  }

  const freshnessDecay = computeFreshnessDecayScore({
    freshnessClass: c.signalContext.freshnessClass,
    observedAt: c.signalContext.observedAt,
    nowIso: input.nowIso,
    presentedCount: input.presentedCount,
    materialUpdate: input.reuse.materialUpdate,
  });

  const credibility = clamp01(c.qualityInput.sourceCredibility ?? 0.45);
  const sourceFreshness = clamp01(c.qualityInput.sourceFreshness ?? freshnessDecay);
  const kr = clamp01(c.qualityInput.koreanTravelerRelevance ?? 0.45);

  const signalQualityScore = clamp01(
    credibility * 0.35 + sourceFreshness * 0.25 + freshnessDecay * 0.25 + kr * 0.15,
  );

  const noveltyDim =
    input.reuse.kind === "NOVEL" || input.reuse.materialUpdate
      ? 0.9
      : input.reuse.kind === "UPDATED_SIGNAL"
        ? 0.75
        : 0.25;
  dims.novelty = noveltyDim;

  const weights = normalizeWeights(archetypeWeights(String(archetype)));
  let marketingQualityScore = 0;
  for (const k of Object.keys(weights) as (keyof DimWeights)[]) {
    marketingQualityScore += dims[k] * weights[k];
  }
  marketingQualityScore = clamp01(marketingQualityScore);

  const genericFindings = detectGenericAgendaRisk({
    originalTitle: input.originalTitle ?? c.signalContext.signalSummaryKo,
    originalSummary: c.signalContext.signalSummaryKo,
    sourceTypes: c.signalContext.sourceTypes,
    travelerProblemKo: c.traveler.travelerProblemKo,
    decisionAtStakeKo: c.traveler.decisionAtStakeKo,
    audienceTensionKo: c.traveler.audienceTensionKo,
    readerPayoffKo: c.traveler.readerPayoffKo,
    marketingStorySeedKo: c.editorial.marketingStorySeedKo,
    editorialArchetype: String(c.editorial.editorialArchetype ?? ""),
    whyInterestingKo: c.editorial.whyInterestingKo,
    curiosityHookKo: c.editorial.curiosityHookKo,
    hiddenDetailKo: c.editorial.hiddenDetailKo,
    contentImaginabilityKo: c.editorial.contentImaginabilityKo,
    familiarReferenceKo: c.editorial.familiarReferenceKo,
    alternativeAppealKo: c.editorial.alternativeAppealKo,
    explorationPayoffKo: c.editorial.explorationPayoffKo,
  });
  const genericRiskPenalty = Math.min(0.55, genericFindings.length * 0.18);
  const promotionalGenericRiskPenalty = promo.promotionalGenericRisk
    ? Math.min(0.4, 0.22 + (promo.sensationalUnsupported ? 0.12 : 0))
    : 0;

  const fatiguePenalty = computePresentationFatiguePenalty({
    presentedCount: input.presentedCount ?? 0,
    lastPresentedAt: input.lastPresentedAt ?? null,
    nowIso: input.nowIso,
    materialUpdate: input.reuse.materialUpdate,
    config: AGENDA_V2_PRESENTATION_FATIGUE_CALIBRATED,
  });

  const penalties = {
    reusePenalty: input.reuse.reusePenalty,
    fatiguePenalty,
    genericRiskPenalty,
    staleTrendPenalty: input.reuse.staleTrendPenalty,
    decisionAxisRepeatPenalty: input.reuse.decisionAxisRepeatPenalty,
    promotionalGenericRiskPenalty,
  };

  const penaltySum =
    penalties.reusePenalty +
    penalties.fatiguePenalty +
    penalties.genericRiskPenalty +
    penalties.staleTrendPenalty +
    penalties.decisionAxisRepeatPenalty +
    penalties.promotionalGenericRiskPenalty;

  const blended =
    marketingQualityScore * cfg.marketingWeight + signalQualityScore * cfg.signalWeight;
  const totalScore = clamp01(blended - penaltySum);

  const decisionOriented = isDecisionOrientedArchetype(String(archetype));
  const hardReject =
    genericFindings.some(
      (f) =>
        f.code === "headline_echo" ||
        f.code === "empty_decision_frame" ||
        f.code === "empty_editorial_interest" ||
        f.code === "empty_promotional" ||
        f.code === "academic_moral_default" ||
        f.code === "promotional_specificity_fail" ||
        f.code === "certification_as_hidden_detail" ||
        f.code === "sensational_unsupported_claim",
    ) ||
    (decisionOriented &&
      !hasDecisionLexicon(`${c.traveler.decisionAtStakeKo} ${c.traveler.travelerProblemKo}`)) ||
    (!decisionOriented &&
      dims.curiosityStrength < 0.25 &&
      dims.hiddenDetailValue < 0.25);

  const qualityTier = tierFromScores({
    total: totalScore,
    marketing: marketingQualityScore,
    cfg,
    hardReject,
  });

  return {
    signalQualityScore,
    marketingQualityScore,
    totalScore,
    qualityTier,
    novelty: {
      topicRepeat: input.reuse.topicRepeat,
      decisionRepeat: input.reuse.decisionRepeat,
      storySeedRepeat: input.reuse.storySeedRepeat,
      materialUpdate: input.reuse.materialUpdate,
      reuseKind: input.reuse.kind,
    },
    penalties,
    dimensions: dims,
    promotional: {
      promotionalSource: promo.promotionalSource,
      promotionalGenericRisk: promo.promotionalGenericRisk,
      promotionalSpecificityPass: promo.promotionalSpecificityPass,
      sensationalUnsupported: promo.sensationalUnsupported,
      certificationOnlyHiddenDetail: promo.certificationOnlyHiddenDetail,
    },
  };
}

/** Slate eligibility: STRONG or PUBLISHABLE only. WEAK never backfills. */
export function isAgendaV2SlateEligible(tier: AgendaQualityTier): boolean {
  return tier === "STRONG" || tier === "PUBLISHABLE";
}
