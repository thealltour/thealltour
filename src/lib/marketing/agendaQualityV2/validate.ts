import {
  AGENDA_FRESHNESS_CLASSES,
  AGENDA_RESERVOIR_LIFECYCLE_STATUSES,
  AGENDA_STORY_ARCHETYPE_HINTS,
  MARKETING_AGENDA_CANDIDATE_V2_CONTRACT,
  isDecisionOrientedArchetype,
  parseAgendaEditorialArchetype,
  type MarketingAgendaCandidateV2,
} from "@/lib/marketing/agendaQualityV2/contracts";
import { detectGenericAgendaRisk } from "@/lib/marketing/agendaQualityV2/genericRisk";

export type MarketingAgendaValidationResult =
  | { ok: true; candidate: MarketingAgendaCandidateV2 }
  | { ok: false; reasons: string[]; candidate?: MarketingAgendaCandidateV2 };

function nonEmpty(value: unknown, min = 8): value is string {
  return typeof value === "string" && value.trim().length >= min;
}

function isFreshnessClass(value: unknown): value is MarketingAgendaCandidateV2["signalContext"]["freshnessClass"] {
  return typeof value === "string" && (AGENDA_FRESHNESS_CLASSES as readonly string[]).includes(value);
}

function isLifecycle(value: unknown): value is MarketingAgendaCandidateV2["lifecycleStatus"] {
  return (
    typeof value === "string" &&
    (AGENDA_RESERVOIR_LIFECYCLE_STATUSES as readonly string[]).includes(value)
  );
}

/**
 * Structural + semantic validity for MarketingAgendaCandidateV2.
 * Decision fields required only for DECISION / PRACTICAL / EXPERIENCE_FIT.
 * Discovery-family archetypes require curiosity / hidden-interest fields instead.
 */
export function validateMarketingAgendaCandidateV2(
  input: unknown,
  options?: { originalTitle?: string; originalSummary?: string; enforceGenericRisk?: boolean },
): MarketingAgendaValidationResult {
  if (!input || typeof input !== "object") {
    return { ok: false, reasons: ["candidate_not_object"] };
  }
  const c = input as Partial<MarketingAgendaCandidateV2>;
  const reasons: string[] = [];

  if (c.contract !== MARKETING_AGENDA_CANDIDATE_V2_CONTRACT) {
    reasons.push("invalid_contract");
  }
  if (!nonEmpty(c.agendaId, 4)) reasons.push("missing_agendaId");
  if (typeof c.version !== "number" || !Number.isFinite(c.version)) reasons.push("missing_version");

  const editorial = c.editorial;
  const archetypeRaw =
    editorial && typeof editorial === "object"
      ? String(editorial.editorialArchetype ?? "")
      : "";
  const archetype = parseAgendaEditorialArchetype(archetypeRaw);
  const decisionOriented = isDecisionOrientedArchetype(archetype ?? archetypeRaw);

  const traveler = c.traveler;
  if (!traveler || typeof traveler !== "object") {
    reasons.push("missing_traveler");
  } else {
    if (!nonEmpty(traveler.targetTravelerKo, 4)) reasons.push("missing_targetTravelerKo");
    if (!nonEmpty(traveler.readerPayoffKo)) reasons.push("missing_readerPayoffKo");
    if (decisionOriented) {
      if (!nonEmpty(traveler.travelerProblemKo)) reasons.push("missing_travelerProblemKo");
      if (!nonEmpty(traveler.decisionAtStakeKo)) reasons.push("missing_decisionAtStakeKo");
      if (!nonEmpty(traveler.audienceTensionKo)) reasons.push("missing_audienceTensionKo");
    }
  }

  if (!editorial || typeof editorial !== "object") {
    reasons.push("missing_editorial");
  } else {
    if (!nonEmpty(editorial.marketingStorySeedKo)) reasons.push("missing_marketingStorySeedKo");
    if (!nonEmpty(editorial.whyNowKo, 4)) reasons.push("missing_whyNowKo");
    if (!Array.isArray(editorial.researchQuestionsKo)) reasons.push("missing_researchQuestionsKo");
    if (!archetype) reasons.push("missing_or_invalid_editorialArchetype");
    if (!nonEmpty(editorial.whyInterestingKo)) reasons.push("missing_whyInterestingKo");
    if (!nonEmpty(editorial.curiosityHookKo)) reasons.push("missing_curiosityHookKo");
    if (!nonEmpty(editorial.hiddenDetailKo)) reasons.push("missing_hiddenDetailKo");
    if (!nonEmpty(editorial.whyKoreanTravelerCaresKo)) {
      reasons.push("missing_whyKoreanTravelerCaresKo");
    }
    if (!nonEmpty(editorial.explorationPayoffKo)) reasons.push("missing_explorationPayoffKo");
    if (!nonEmpty(editorial.contentImaginabilityKo)) {
      reasons.push("missing_contentImaginabilityKo");
    }
  }

  const signalContext = c.signalContext;
  if (!signalContext || typeof signalContext !== "object") {
    reasons.push("missing_signalContext");
  } else if (!isFreshnessClass(signalContext.freshnessClass)) {
    reasons.push("invalid_freshnessClass");
  }

  if (!isLifecycle(c.lifecycleStatus)) {
    reasons.push("invalid_lifecycleStatus");
  }

  if (!c.provenance || typeof c.provenance !== "object") {
    reasons.push("missing_provenance");
  }

  if (reasons.length === 0 && options?.enforceGenericRisk !== false && traveler && editorial) {
    const findings = detectGenericAgendaRisk({
      originalTitle: options?.originalTitle ?? c.signalContext?.signalSummaryKo ?? "",
      originalSummary: options?.originalSummary,
      sourceTypes: c.signalContext?.sourceTypes,
      travelerProblemKo: traveler.travelerProblemKo ?? "",
      decisionAtStakeKo: traveler.decisionAtStakeKo ?? "",
      audienceTensionKo: traveler.audienceTensionKo ?? "",
      readerPayoffKo: traveler.readerPayoffKo ?? "",
      marketingStorySeedKo: editorial.marketingStorySeedKo,
      editorialArchetype: String(editorial.editorialArchetype ?? ""),
      whyInterestingKo: editorial.whyInterestingKo ?? "",
      curiosityHookKo: editorial.curiosityHookKo ?? "",
      hiddenDetailKo: editorial.hiddenDetailKo ?? "",
      contentImaginabilityKo: editorial.contentImaginabilityKo ?? "",
      familiarReferenceKo: editorial.familiarReferenceKo ?? "",
      alternativeAppealKo: editorial.alternativeAppealKo ?? "",
      explorationPayoffKo: editorial.explorationPayoffKo ?? "",
    });
    for (const f of findings) {
      reasons.push(`generic_risk:${f.code}`);
    }
  }

  if (reasons.length > 0) {
    return { ok: false, reasons, candidate: c as MarketingAgendaCandidateV2 };
  }

  return { ok: true, candidate: c as MarketingAgendaCandidateV2 };
}

export function isAllowedStoryArchetypeHint(value: string): boolean {
  return (AGENDA_STORY_ARCHETYPE_HINTS as readonly string[]).includes(value) || value === "other";
}
