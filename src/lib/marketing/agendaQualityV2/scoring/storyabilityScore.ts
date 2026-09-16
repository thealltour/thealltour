import type { MarketingAgendaCandidateV2 } from "@/lib/marketing/agendaQualityV2/contracts";
import { detectGenericAgendaRisk } from "@/lib/marketing/agendaQualityV2/genericRisk";
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

export function scoreMarketingDimensions(candidate: MarketingAgendaCandidateV2): AgendaV2ScoreBreakdown["dimensions"] {
  const t = candidate.traveler;
  const e = candidate.editorial;
  const decisionUtility =
    (hasDecisionLexicon(t.decisionAtStakeKo) ? 0.55 : 0.15) +
    lenScore(t.decisionAtStakeKo, 18, 80) * 0.45;
  const audienceSpecificity =
    (/(여행자|가족|커플|부모|혼자|허니문|골프|친구)/.test(t.targetTravelerKo) ? 0.5 : 0.2) +
    lenScore(t.targetTravelerKo, 10, 60) * 0.5;
  const tensionStrength =
    (/(vs|대비|트레이드|갈등|긴장|편의|경험|가격|시간)/.test(t.audienceTensionKo) ? 0.55 : 0.2) +
    lenScore(t.audienceTensionKo, 12, 70) * 0.45;
  const readerPayoffStrength =
    (/(판단|기준|체크|고를|피할|알|얻)/.test(t.readerPayoffKo) ? 0.5 : 0.2) +
    lenScore(t.readerPayoffKo, 12, 70) * 0.5;
  const researchability =
    e.researchQuestionsKo.length >= 2
      ? 0.85
      : e.researchQuestionsKo.length === 1
        ? 0.55
        : 0.15;
  const storyExpandability =
    (e.storyArchetypeHint && e.storyArchetypeHint !== "other" ? 0.45 : 0.2) +
    lenScore(e.marketingStorySeedKo, 20, 90) * 0.55;
  const channelPotential = clamp01(
    0.35 +
      (hasDecisionLexicon(e.marketingStorySeedKo) ? 0.35 : 0) +
      (e.researchQuestionsKo.length > 0 ? 0.15 : 0),
  );
  const commercialRaw = candidate.qualityInput.commercialRelevanceHint;
  const commercialRelevance =
    typeof commercialRaw === "string" && /high|높/.test(commercialRaw)
      ? 0.75
      : typeof commercialRaw === "string" && commercialRaw.trim()
        ? 0.45
        : 0.35;
  const specificity = clamp01(
    (audienceSpecificity + decisionUtility + tensionStrength) / 3,
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
    novelty: 1, // filled by caller with reuse-aware value
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

  const noveltyDim = input.reuse.kind === "NOVEL" || input.reuse.materialUpdate ? 0.9 : input.reuse.kind === "UPDATED_SIGNAL" ? 0.75 : 0.25;
  dims.novelty = noveltyDim;

  const marketingQualityScore = clamp01(
    dims.decisionUtility * 0.18 +
      dims.audienceSpecificity * 0.12 +
      dims.tensionStrength * 0.14 +
      dims.readerPayoffStrength * 0.14 +
      dims.researchability * 0.12 +
      dims.storyExpandability * 0.1 +
      dims.channelPotential * 0.06 +
      dims.commercialRelevance * 0.04 +
      dims.specificity * 0.05 +
      dims.novelty * 0.05,
  );

  const genericFindings = detectGenericAgendaRisk({
    originalTitle: input.originalTitle ?? c.signalContext.signalSummaryKo,
    originalSummary: c.signalContext.signalSummaryKo,
    travelerProblemKo: c.traveler.travelerProblemKo,
    decisionAtStakeKo: c.traveler.decisionAtStakeKo,
    audienceTensionKo: c.traveler.audienceTensionKo,
    readerPayoffKo: c.traveler.readerPayoffKo,
    marketingStorySeedKo: c.editorial.marketingStorySeedKo,
  });
  const genericRiskPenalty = Math.min(0.55, genericFindings.length * 0.18);

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
  };

  const penaltySum =
    penalties.reusePenalty +
    penalties.fatiguePenalty +
    penalties.genericRiskPenalty +
    penalties.staleTrendPenalty +
    penalties.decisionAxisRepeatPenalty;

  const blended =
    marketingQualityScore * cfg.marketingWeight + signalQualityScore * cfg.signalWeight;
  const totalScore = clamp01(blended - penaltySum);

  const hardReject =
    genericFindings.some((f) => f.code === "headline_echo" || f.code === "empty_decision_frame") ||
    !hasDecisionLexicon(`${c.traveler.decisionAtStakeKo} ${c.traveler.travelerProblemKo}`);

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
  };
}

/** Slate eligibility: STRONG or PUBLISHABLE only. WEAK never backfills. */
export function isAgendaV2SlateEligible(tier: AgendaQualityTier): boolean {
  return tier === "STRONG" || tier === "PUBLISHABLE";
}
