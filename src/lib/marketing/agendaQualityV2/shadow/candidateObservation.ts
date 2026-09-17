/**
 * Complete candidate observation records for Live Shadow daily JSON.
 * Observability only — does not affect scoring/selection behavior.
 */

import type { CompactManagerAgendaCandidate } from "@/lib/marketing/research/manager/types";
import type { AgendaReservoirItem } from "@/lib/marketing/agendaQualityV2/reservoir/types";
import type { AgendaV2ScoreBreakdown } from "@/lib/marketing/agendaQualityV2/scoring/storyabilityScore";
import type { MarketingAgendaCandidateV2 } from "@/lib/marketing/agendaQualityV2/contracts";
import {
  AGENDA_QUALITY_V2_PROMPT_VERSION,
  AGENDA_QUALITY_V2_TRANSFORM_REVISION,
} from "@/lib/marketing/agendaQualityV2/shadow/config";
import { AGENDA_QUALITY_V2_TRANSFORMER_CONTRACT_VERSION } from "@/lib/marketing/agendaQualityV2/shadow/validationManifest";
import { MARKETING_AGENDA_TRANSFORMER_ROLE_KEY } from "@/lib/marketing/agendaQualityV2/transformer/prompt";

export type LiveShadowExclusionReason =
  | "transform_failed"
  | "unsupported_sensitive_claim"
  | "quality_gate"
  | "weak_no_backfill"
  | "expired"
  | "selected_before"
  | "rejected_cooldown"
  | "reuse_penalty"
  | "fatigue"
  | "decision_diversity"
  | "slate_max_cap"
  | "reservoir_write_failed"
  | "not_transformed_budget"
  | "version_incompatible_historical"
  | "other";

export type LiveShadowCandidateObservation = {
  agendaId: string | null;
  source: {
    sourceTitle: string | null;
    sourceSummary: string | null;
    sourceType: string[] | null;
    sourceUrl: string | null;
    sourceId: string | null;
    sourceDomain: string | null;
    observedAt: string | null;
    sourceSignalIds: string[];
    sourceBriefIds: string[];
    sourceCandidateIds: string[];
    transformInputExcerpt: string | null;
  };
  transform: {
    targetTravelerKo: string | null;
    travelerProblemKo: string | null;
    decisionAtStakeKo: string | null;
    audienceTensionKo: string | null;
    readerPayoffKo: string | null;
    marketingStorySeedKo: string | null;
    whyNowKo: string | null;
    researchQuestionsKo: string[];
    nonGoalsKo: string[];
    genericRiskKo: string | null;
    storyArchetypeHint: string | null;
    editorialArchetype: string | null;
    whyInterestingKo: string | null;
    curiosityHookKo: string | null;
    hiddenDetailKo: string | null;
    whyKoreanTravelerCaresKo: string | null;
    familiarReferenceKo: string | null;
    alternativeAppealKo: string | null;
    explorationPayoffKo: string | null;
    contentImaginabilityKo: string | null;
    limitations: string[];
    signalSummaryKo: string | null;
    freshnessClass: string | null;
  } | null;
  provenance: {
    sourceFingerprint: string | null;
    topicFingerprint: string | null;
    decisionAxisFingerprint: string | null;
    storySeedFingerprint: string | null;
    transformRevision: string;
    transformerContractVersion: string;
    promptVersion: string;
    roleKey: string;
    provider: string | null;
    model: string | null;
    routeSource: string | null;
    transformStatus: "valid" | "invalid" | "skipped" | null;
    transformFailureReason: string | null;
    transformCacheHit: boolean;
  };
  scoring: {
    signalQualityScore: number | null;
    marketingQualityScore: number | null;
    totalScore: number | null;
    qualityTier: string | null;
    dimensions?: {
      curiosityStrength?: number;
      unexpectedness?: number;
      hiddenDetailValue?: number;
      koreanTravelerRelevanceDim?: number;
      alternativeAppeal?: number;
      explorationPull?: number;
      contentImaginability?: number;
      decisionUtility?: number;
      tensionStrength?: number;
      specificity?: number;
      researchability?: number;
      storyExpandability?: number;
    } | null;
  } | null;
  promotional?: {
    promotionalSource: boolean;
    promotionalGenericRisk: boolean;
    promotionalSpecificityPass: boolean;
    sensationalUnsupported?: boolean;
    certificationOnlyHiddenDetail?: boolean;
  } | null;
  penalties: {
    reusePenalty: number;
    fatiguePenalty: number;
    genericRiskPenalty: number;
    staleTrendPenalty: number;
    decisionRepeatPenalty: number;
    promotionalGenericRiskPenalty?: number;
  } | null;
  reservoir: {
    lifecycleStatus: string | null;
    origin: "NEW" | "CARRYOVER" | null;
    firstQualifiedAt: string | null;
    lastPresentedAt: string | null;
    presentedCount: number | null;
    deferredAt: string | null;
    expiresAt: string | null;
    carriedFromDate: string | null;
  } | null;
  selection: {
    eligible: boolean;
    selectedIntoSlate: boolean;
    finalRank: number | null;
    inclusionReason: string | null;
    exclusionReason: LiveShadowExclusionReason | string | null;
  };
};

function nullIfEmpty(value: string | null | undefined): string | null {
  if (value == null) return null;
  const t = value.trim();
  return t.length ? t : null;
}

export function buildSourceObservationFromCompact(
  cand: CompactManagerAgendaCandidate,
): LiveShadowCandidateObservation["source"] {
  const evidenceUrl =
    cand.evidence?.find((e) => typeof (e as { url?: string }).url === "string") as
      | { url?: string; domain?: string }
      | undefined;
  return {
    sourceTitle: nullIfEmpty(cand.title),
    sourceSummary: nullIfEmpty(cand.summary),
    sourceType: cand.signalTypes?.length ? [...cand.signalTypes] : ["agenda_candidate"],
    sourceUrl: nullIfEmpty(evidenceUrl?.url ?? null),
    sourceId: nullIfEmpty(cand.agendaCandidateId),
    sourceDomain: nullIfEmpty(evidenceUrl?.domain ?? null),
    observedAt: nullIfEmpty(cand.observedAt ?? cand.publishedAt),
    sourceSignalIds: [],
    sourceBriefIds: cand.researchBriefId ? [cand.researchBriefId] : [],
    sourceCandidateIds: cand.agendaCandidateId ? [cand.agendaCandidateId] : [],
    transformInputExcerpt: nullIfEmpty(
      [cand.title, cand.summary].filter(Boolean).join("\n").slice(0, 2000),
    ),
  };
}

export function buildTransformObservationFromCandidate(
  candidate: MarketingAgendaCandidateV2,
): NonNullable<LiveShadowCandidateObservation["transform"]> {
  return {
    targetTravelerKo: candidate.traveler.targetTravelerKo,
    travelerProblemKo: candidate.traveler.travelerProblemKo,
    decisionAtStakeKo: candidate.traveler.decisionAtStakeKo,
    audienceTensionKo: candidate.traveler.audienceTensionKo,
    readerPayoffKo: candidate.traveler.readerPayoffKo,
    marketingStorySeedKo: candidate.editorial.marketingStorySeedKo,
    whyNowKo: candidate.editorial.whyNowKo,
    researchQuestionsKo: [...candidate.editorial.researchQuestionsKo],
    nonGoalsKo: [...candidate.editorial.nonGoalsKo],
    genericRiskKo: candidate.editorial.genericRiskKo,
    storyArchetypeHint: String(candidate.editorial.storyArchetypeHint),
    editorialArchetype: String(candidate.editorial.editorialArchetype ?? ""),
    whyInterestingKo: candidate.editorial.whyInterestingKo ?? null,
    curiosityHookKo: candidate.editorial.curiosityHookKo ?? null,
    hiddenDetailKo: candidate.editorial.hiddenDetailKo ?? null,
    whyKoreanTravelerCaresKo: candidate.editorial.whyKoreanTravelerCaresKo ?? null,
    familiarReferenceKo: candidate.editorial.familiarReferenceKo || null,
    alternativeAppealKo: candidate.editorial.alternativeAppealKo || null,
    explorationPayoffKo: candidate.editorial.explorationPayoffKo ?? null,
    contentImaginabilityKo: candidate.editorial.contentImaginabilityKo ?? null,
    limitations: [...candidate.provenance.limitations],
    signalSummaryKo: candidate.signalContext.signalSummaryKo,
    freshnessClass: candidate.signalContext.freshnessClass,
  };
}

export function mapExclusionReason(raw: string | null | undefined): LiveShadowExclusionReason | string {
  if (!raw) return "other";
  if (raw === "version_incompatible_historical") return "version_incompatible_historical";
  if (raw === "unsupported_sensitive_claim") return "unsupported_sensitive_claim";
  if (raw.startsWith("transform_failed") || raw === "unparseable_transformer_output") {
    return "transform_failed";
  }
  if (raw.startsWith("reservoir_write_failed")) return "reservoir_write_failed";
  if (raw === "slate_max_cap") return "slate_max_cap";
  if (raw === "decision_axis_soft_diversity") return "decision_diversity";
  if (raw === "weak_no_backfill") return "weak_no_backfill";
  if (raw === "quality_gate_reject" || raw === "not_eligible") return "quality_gate";
  if (raw.includes("expired")) return "expired";
  if (raw.includes("fatigue")) return "fatigue";
  if (raw.includes("reuse") || raw.includes("repeat")) return "reuse_penalty";
  return raw;
}

export function buildObservationFromReservoirScore(params: {
  item: AgendaReservoirItem;
  score: AgendaV2ScoreBreakdown;
  origin: "NEW" | "CARRYOVER";
  carriedFromDate: string | null;
  selectedIntoSlate: boolean;
  finalRank: number | null;
  inclusionReason: string | null;
  exclusionReason: string | null;
  sourceFallback?: LiveShadowCandidateObservation["source"] | null;
  provider?: string | null;
  model?: string | null;
  routeSource?: string | null;
  transformCacheHit?: boolean;
}): LiveShadowCandidateObservation {
  const c = params.item.candidate;
  return {
    agendaId: params.item.agendaId,
    source: params.sourceFallback ?? {
      sourceTitle: nullIfEmpty(c.signalContext.signalSummaryKo),
      sourceSummary: nullIfEmpty(c.signalContext.signalSummaryKo),
      sourceType: c.signalContext.sourceTypes?.length ? [...c.signalContext.sourceTypes] : null,
      sourceUrl: null,
      sourceId: c.sourceCandidateIds[0] ?? null,
      sourceDomain: null,
      observedAt: c.signalContext.observedAt,
      sourceSignalIds: [...c.sourceSignalIds],
      sourceBriefIds: [...c.sourceBriefIds],
      sourceCandidateIds: [...c.sourceCandidateIds],
      transformInputExcerpt: nullIfEmpty(c.signalContext.signalSummaryKo),
    },
    transform: buildTransformObservationFromCandidate(c),
    provenance: {
      sourceFingerprint: params.item.sourceFingerprint,
      topicFingerprint: params.item.topicFingerprint,
      decisionAxisFingerprint: params.item.decisionAxisFingerprint,
      storySeedFingerprint: params.item.storySeedFingerprint,
      transformRevision: c.provenance.transformRevision || AGENDA_QUALITY_V2_TRANSFORM_REVISION,
      transformerContractVersion: AGENDA_QUALITY_V2_TRANSFORMER_CONTRACT_VERSION,
      promptVersion:
        c.provenance.promptVersion ||
        (c.provenance.transformRevision === "agenda-transform-v1"
          ? "agenda-transform-prompt-v1"
          : AGENDA_QUALITY_V2_PROMPT_VERSION),
      roleKey: MARKETING_AGENDA_TRANSFORMER_ROLE_KEY,
      provider: params.provider ?? null,
      model: params.model ?? c.provenance.transformModel,
      routeSource: params.routeSource ?? null,
      transformStatus: "valid",
      transformFailureReason: null,
      transformCacheHit: Boolean(params.transformCacheHit),
    },
    scoring: {
      signalQualityScore: params.score.signalQualityScore,
      marketingQualityScore: params.score.marketingQualityScore,
      totalScore: params.score.totalScore,
      qualityTier: params.score.qualityTier,
      dimensions: {
        curiosityStrength: params.score.dimensions.curiosityStrength,
        unexpectedness: params.score.dimensions.unexpectedness,
        hiddenDetailValue: params.score.dimensions.hiddenDetailValue,
        koreanTravelerRelevanceDim: params.score.dimensions.koreanTravelerRelevanceDim,
        alternativeAppeal: params.score.dimensions.alternativeAppeal,
        explorationPull: params.score.dimensions.explorationPull,
        contentImaginability: params.score.dimensions.contentImaginability,
        decisionUtility: params.score.dimensions.decisionUtility,
        tensionStrength: params.score.dimensions.tensionStrength,
        specificity: params.score.dimensions.specificity,
        researchability: params.score.dimensions.researchability,
        storyExpandability: params.score.dimensions.storyExpandability,
      },
    },
    promotional: params.score.promotional
      ? {
          promotionalSource: params.score.promotional.promotionalSource,
          promotionalGenericRisk: params.score.promotional.promotionalGenericRisk,
          promotionalSpecificityPass: params.score.promotional.promotionalSpecificityPass,
          sensationalUnsupported: params.score.promotional.sensationalUnsupported,
          certificationOnlyHiddenDetail: params.score.promotional.certificationOnlyHiddenDetail,
        }
      : null,
    penalties: {
      reusePenalty: params.score.penalties.reusePenalty,
      fatiguePenalty: params.score.penalties.fatiguePenalty,
      genericRiskPenalty: params.score.penalties.genericRiskPenalty,
      staleTrendPenalty: params.score.penalties.staleTrendPenalty,
      decisionRepeatPenalty: params.score.penalties.decisionAxisRepeatPenalty,
      promotionalGenericRiskPenalty: params.score.penalties.promotionalGenericRiskPenalty,
    },
    reservoir: {
      lifecycleStatus: params.item.status,
      origin: params.origin,
      firstQualifiedAt: params.item.firstQualifiedAt,
      lastPresentedAt: params.item.lastPresentedAt,
      presentedCount: params.item.presentedCount,
      deferredAt: params.item.deferredAt,
      expiresAt: params.item.expiresAt,
      carriedFromDate: params.carriedFromDate,
    },
    selection: {
      eligible: params.selectedIntoSlate || params.exclusionReason == null,
      selectedIntoSlate: params.selectedIntoSlate,
      finalRank: params.finalRank,
      inclusionReason: params.inclusionReason,
      exclusionReason: params.exclusionReason
        ? mapExclusionReason(params.exclusionReason)
        : null,
    },
  };
}

export function buildTransformFailureObservation(params: {
  cand: CompactManagerAgendaCandidate;
  sourceFingerprint: string;
  failureReason: string;
  provider?: string | null;
  model?: string | null;
  routeSource?: string | null;
  transformCacheHit?: boolean;
}): LiveShadowCandidateObservation {
  return {
    agendaId: null,
    source: buildSourceObservationFromCompact(params.cand),
    transform: null,
    provenance: {
      sourceFingerprint: params.sourceFingerprint,
      topicFingerprint: null,
      decisionAxisFingerprint: null,
      storySeedFingerprint: null,
      transformRevision: AGENDA_QUALITY_V2_TRANSFORM_REVISION,
      transformerContractVersion: AGENDA_QUALITY_V2_TRANSFORMER_CONTRACT_VERSION,
      promptVersion: AGENDA_QUALITY_V2_PROMPT_VERSION,
      roleKey: MARKETING_AGENDA_TRANSFORMER_ROLE_KEY,
      provider: params.provider ?? null,
      model: params.model ?? null,
      routeSource: params.routeSource ?? null,
      transformStatus: "invalid",
      transformFailureReason: params.failureReason,
      transformCacheHit: Boolean(params.transformCacheHit),
    },
    scoring: null,
    penalties: null,
    reservoir: null,
    selection: {
      eligible: false,
      selectedIntoSlate: false,
      finalRank: null,
      inclusionReason: null,
      exclusionReason: mapExclusionReason(params.failureReason),
    },
  };
}
