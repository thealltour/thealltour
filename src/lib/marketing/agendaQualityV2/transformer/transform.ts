import { createHash, randomUUID } from "node:crypto";
import {
  AGENDA_EDITORIAL_OBJECTIVE_VERSION,
  AGENDA_QUALITY_VERSION,
  MARKETING_AGENDA_CANDIDATE_V2_CONTRACT,
  MARKETING_AGENDA_TRANSFORM_REVISION,
  parseAgendaEditorialArchetype,
  type MarketingAgendaCandidateV2,
  type MarketingAgendaTransformInput,
  type MarketingAgendaTransformerLlmOutput,
} from "@/lib/marketing/agendaQualityV2/contracts";
import { computeAgendaExpiresAt, parseAgendaFreshnessClass } from "@/lib/marketing/agendaQualityV2/freshness";
import {
  MARKETING_AGENDA_TRANSFORMER_ROLE_KEY,
  MARKETING_AGENDA_TRANSFORMER_SYSTEM_PROMPT,
  buildMarketingAgendaTransformerUserPrompt,
} from "@/lib/marketing/agendaQualityV2/transformer/prompt";
import { parseMarketingAgendaTransformerOutput } from "@/lib/marketing/agendaQualityV2/transformer/parse";
import { validateMarketingAgendaCandidateV2 } from "@/lib/marketing/agendaQualityV2/validate";
import { buildTopicFingerprint } from "@/lib/marketing/agendaQualityV2/memory/topicFingerprint";
import { buildDecisionAxisFingerprint } from "@/lib/marketing/agendaQualityV2/memory/decisionAxisFingerprint";
import { enforceEvidenceSensitiveClaimPolicy } from "@/lib/marketing/agendaQualityV2/transformer/evidenceSensitiveClaims";
import {
  AGENDA_QUALITY_V2_EDITORIAL_OBJECTIVE_VERSION,
  AGENDA_QUALITY_V2_PROMPT_VERSION,
} from "@/lib/marketing/agendaQualityV2/shadow/config";

export type AgendaTransformInvokeResult = {
  text: string;
  modelId?: string | null;
  routeSource?: string | null;
  provider?: string | null;
};

export type AgendaTransformInvoke = (params: {
  roleKey: typeof MARKETING_AGENDA_TRANSFORMER_ROLE_KEY;
  system: string;
  user: string;
}) => Promise<AgendaTransformInvokeResult>;

export type AgendaTransformResult = {
  agendaQualityVersion: typeof AGENDA_QUALITY_VERSION;
  transformStatus: "valid" | "invalid";
  transformFailureReason: string | null;
  candidate: MarketingAgendaCandidateV2 | null;
  transformModel: string | null;
  transformRouteSource: string | null;
  transformProvider: string | null;
  sourceSignalIds: string[];
};

function fingerprintSource(input: MarketingAgendaTransformInput): string {
  if (input.sourceFingerprint && input.sourceFingerprint.trim()) {
    return input.sourceFingerprint.trim();
  }
  const raw = JSON.stringify({
    t: input.originalTitle,
    s: input.originalSummary,
    types: input.sourceTypes,
    dest: input.destinations ?? [],
    topics: input.topics ?? [],
  });
  return createHash("sha256").update(raw).digest("hex").slice(0, 24);
}

export function llmOutputToCachePayload(
  llm: MarketingAgendaTransformerLlmOutput,
): Record<string, unknown> {
  return {
    targetTravelerKo: llm.targetTravelerKo,
    travelerProblemKo: llm.travelerProblemKo,
    decisionAtStakeKo: llm.decisionAtStakeKo,
    audienceTensionKo: llm.audienceTensionKo,
    readerPayoffKo: llm.readerPayoffKo,
    marketingStorySeedKo: llm.marketingStorySeedKo,
    whyNowKo: llm.whyNowKo,
    researchQuestionsKo: llm.researchQuestionsKo,
    nonGoalsKo: llm.nonGoalsKo,
    genericRiskKo: llm.genericRiskKo,
    storyArchetypeHint: llm.storyArchetypeHint,
    freshnessClass: llm.freshnessClass,
    signalSummaryKo: llm.signalSummaryKo,
    limitations: llm.limitations,
    editorialArchetype: llm.editorialArchetype,
    whyInterestingKo: llm.whyInterestingKo,
    curiosityHookKo: llm.curiosityHookKo,
    hiddenDetailKo: llm.hiddenDetailKo,
    whyKoreanTravelerCaresKo: llm.whyKoreanTravelerCaresKo,
    familiarReferenceKo: llm.familiarReferenceKo,
    alternativeAppealKo: llm.alternativeAppealKo,
    explorationPayoffKo: llm.explorationPayoffKo,
    contentImaginabilityKo: llm.contentImaginabilityKo,
  };
}

export function candidateToLlmCachePayload(
  candidate: MarketingAgendaCandidateV2,
): Record<string, unknown> {
  return {
    targetTravelerKo: candidate.traveler.targetTravelerKo,
    travelerProblemKo: candidate.traveler.travelerProblemKo,
    decisionAtStakeKo: candidate.traveler.decisionAtStakeKo,
    audienceTensionKo: candidate.traveler.audienceTensionKo,
    readerPayoffKo: candidate.traveler.readerPayoffKo,
    marketingStorySeedKo: candidate.editorial.marketingStorySeedKo,
    whyNowKo: candidate.editorial.whyNowKo,
    researchQuestionsKo: candidate.editorial.researchQuestionsKo,
    nonGoalsKo: candidate.editorial.nonGoalsKo,
    genericRiskKo: candidate.editorial.genericRiskKo,
    storyArchetypeHint: candidate.editorial.storyArchetypeHint,
    freshnessClass: candidate.signalContext.freshnessClass,
    signalSummaryKo: candidate.signalContext.signalSummaryKo,
    limitations: candidate.provenance.limitations,
    editorialArchetype: candidate.editorial.editorialArchetype,
    whyInterestingKo: candidate.editorial.whyInterestingKo,
    curiosityHookKo: candidate.editorial.curiosityHookKo,
    hiddenDetailKo: candidate.editorial.hiddenDetailKo,
    whyKoreanTravelerCaresKo: candidate.editorial.whyKoreanTravelerCaresKo,
    familiarReferenceKo: candidate.editorial.familiarReferenceKo,
    alternativeAppealKo: candidate.editorial.alternativeAppealKo,
    explorationPayoffKo: candidate.editorial.explorationPayoffKo,
    contentImaginabilityKo: candidate.editorial.contentImaginabilityKo,
  };
}

export function assembleMarketingAgendaCandidateV2(params: {
  input: MarketingAgendaTransformInput;
  llm: MarketingAgendaTransformerLlmOutput;
  transformModel?: string | null;
  nowIso?: string;
}): MarketingAgendaCandidateV2 {
  const now = params.nowIso ?? new Date().toISOString();
  const freshnessClass = parseAgendaFreshnessClass(params.llm.freshnessClass) ?? "timely";
  const sourceFingerprint = fingerprintSource(params.input);
  const signalSummaryKo =
    params.llm.signalSummaryKo?.trim() ||
    params.input.originalSummary.trim() ||
    params.input.originalTitle.trim();

  const topic = buildTopicFingerprint({
    title: params.input.originalTitle,
    summary: signalSummaryKo,
    destinations: params.input.destinations,
    topics: params.input.topics,
    sourceTypes: params.input.sourceTypes,
  });
  const decisionAxisFingerprint = buildDecisionAxisFingerprint({
    decisionAtStakeKo: params.llm.decisionAtStakeKo,
    audienceTensionKo: params.llm.audienceTensionKo,
    travelerProblemKo: params.llm.travelerProblemKo || params.llm.hiddenDetailKo,
    storyArchetypeHint: params.llm.storyArchetypeHint,
    targetTravelerKo: params.llm.targetTravelerKo,
  });

  const editorialArchetype =
    parseAgendaEditorialArchetype(params.llm.editorialArchetype) ??
    String(params.llm.editorialArchetype || "DISCOVERY").toUpperCase();

  return {
    contract: MARKETING_AGENDA_CANDIDATE_V2_CONTRACT,
    agendaId: `magv2_${randomUUID().replace(/-/g, "").slice(0, 16)}`,
    version: 1,
    sourceSignalIds: params.input.sourceSignalIds ?? [],
    sourceBriefIds: params.input.sourceBriefIds ?? [],
    sourceCandidateIds: params.input.sourceCandidateIds ?? [],
    createdAt: now,
    updatedAt: now,
    signalContext: {
      signalSummaryKo,
      sourceTypes: params.input.sourceTypes,
      destinations: params.input.destinations ?? [],
      topics: params.input.topics ?? [],
      observedAt: params.input.observedAt ?? null,
      freshnessClass,
    },
    traveler: {
      targetTravelerKo: params.llm.targetTravelerKo,
      travelerProblemKo: params.llm.travelerProblemKo ?? "",
      decisionAtStakeKo: params.llm.decisionAtStakeKo ?? "",
      audienceTensionKo: params.llm.audienceTensionKo ?? "",
      readerPayoffKo: params.llm.readerPayoffKo,
    },
    editorial: {
      marketingStorySeedKo: params.llm.marketingStorySeedKo,
      whyNowKo: params.llm.whyNowKo,
      researchQuestionsKo: params.llm.researchQuestionsKo,
      nonGoalsKo: params.llm.nonGoalsKo,
      genericRiskKo: params.llm.genericRiskKo,
      storyArchetypeHint: params.llm.storyArchetypeHint,
      editorialArchetype,
      whyInterestingKo: params.llm.whyInterestingKo ?? "",
      curiosityHookKo: params.llm.curiosityHookKo ?? "",
      hiddenDetailKo: params.llm.hiddenDetailKo ?? "",
      whyKoreanTravelerCaresKo: params.llm.whyKoreanTravelerCaresKo ?? "",
      familiarReferenceKo: params.llm.familiarReferenceKo ?? "",
      alternativeAppealKo: params.llm.alternativeAppealKo ?? "",
      explorationPayoffKo: params.llm.explorationPayoffKo ?? "",
      contentImaginabilityKo: params.llm.contentImaginabilityKo ?? "",
    },
    qualityInput: {
      sourceCredibility: params.input.sourceCredibility ?? null,
      sourceFreshness: params.input.sourceFreshness ?? null,
      koreanTravelerRelevance: params.input.koreanTravelerRelevance ?? null,
      researchabilityHint: params.input.researchabilityHint ?? null,
      commercialRelevanceHint: params.input.commercialRelevanceHint ?? null,
    },
    provenance: {
      transformSource:
        (params.input.sourceBriefIds?.length ?? 0) > 0
          ? "research_brief"
          : (params.input.sourceCandidateIds?.length ?? 0) > 0
            ? "agenda_candidate"
            : (params.input.sourceSignalIds?.length ?? 0) > 0
              ? "research_signal"
              : "mixed",
      transformModel: params.transformModel ?? null,
      transformRevision: MARKETING_AGENDA_TRANSFORM_REVISION,
      promptVersion: AGENDA_QUALITY_V2_PROMPT_VERSION,
      editorialObjectiveVersion:
        AGENDA_QUALITY_V2_EDITORIAL_OBJECTIVE_VERSION || AGENDA_EDITORIAL_OBJECTIVE_VERSION,
      sourceFingerprint,
      topicFingerprint: topic.topicFingerprint,
      decisionAxisFingerprint,
      limitations: params.llm.limitations ?? [],
    },
    lifecycleStatus: "QUALIFIED",
    expiresAt: computeAgendaExpiresAt({ freshnessClass, fromIso: now }),
  };
}

/**
 * Transform from LLM output object (tests / dry fixtures) without network.
 */
export function transformMarketingAgendaFromLlmOutput(params: {
  input: MarketingAgendaTransformInput;
  llm: MarketingAgendaTransformerLlmOutput;
  transformModel?: string | null;
  transformRouteSource?: string | null;
  transformProvider?: string | null;
  nowIso?: string;
}): AgendaTransformResult {
  const evidence = enforceEvidenceSensitiveClaimPolicy({
    input: params.input,
    llm: params.llm,
  });
  if (!evidence.ok) {
    return {
      agendaQualityVersion: AGENDA_QUALITY_VERSION,
      transformStatus: "invalid",
      transformFailureReason: "unsupported_sensitive_claim",
      candidate: null,
      transformModel: params.transformModel ?? null,
      transformRouteSource: params.transformRouteSource ?? null,
      transformProvider: params.transformProvider ?? null,
      sourceSignalIds: params.input.sourceSignalIds ?? [],
    };
  }

  const candidate = assembleMarketingAgendaCandidateV2({
    ...params,
    llm: evidence.llm,
  });
  const validation = validateMarketingAgendaCandidateV2(candidate, {
    originalTitle: params.input.originalTitle,
    originalSummary: params.input.originalSummary,
    enforceGenericRisk: true,
  });

  if (!validation.ok) {
    return {
      agendaQualityVersion: AGENDA_QUALITY_VERSION,
      transformStatus: "invalid",
      transformFailureReason: validation.reasons.join(";"),
      candidate: validation.candidate ?? candidate,
      transformModel: params.transformModel ?? null,
      transformRouteSource: params.transformRouteSource ?? null,
      transformProvider: params.transformProvider ?? null,
      sourceSignalIds: params.input.sourceSignalIds ?? [],
    };
  }

  return {
    agendaQualityVersion: AGENDA_QUALITY_VERSION,
    transformStatus: "valid",
    transformFailureReason: null,
    candidate: validation.candidate,
    transformModel: params.transformModel ?? null,
    transformRouteSource: params.transformRouteSource ?? null,
    transformProvider: params.transformProvider ?? null,
    sourceSignalIds: params.input.sourceSignalIds ?? [],
  };
}

/**
 * Invoke LLM transformer. Caller supplies invoke (no paid calls in unit tests).
 */
export async function transformMarketingAgendaWithInvoke(params: {
  input: MarketingAgendaTransformInput;
  invoke: AgendaTransformInvoke;
  nowIso?: string;
}): Promise<AgendaTransformResult> {
  const system = MARKETING_AGENDA_TRANSFORMER_SYSTEM_PROMPT;
  const user = buildMarketingAgendaTransformerUserPrompt(params.input);
  let invokeResult: AgendaTransformInvokeResult;
  try {
    invokeResult = await params.invoke({
      roleKey: MARKETING_AGENDA_TRANSFORMER_ROLE_KEY,
      system,
      user,
    });
  } catch (err) {
    return {
      agendaQualityVersion: AGENDA_QUALITY_VERSION,
      transformStatus: "invalid",
      transformFailureReason: `invoke_error:${err instanceof Error ? err.message : String(err)}`,
      candidate: null,
      transformModel: null,
      transformRouteSource: null,
      transformProvider: null,
      sourceSignalIds: params.input.sourceSignalIds ?? [],
    };
  }

  const llm = parseMarketingAgendaTransformerOutput(invokeResult.text);
  if (!llm) {
    return {
      agendaQualityVersion: AGENDA_QUALITY_VERSION,
      transformStatus: "invalid",
      transformFailureReason: "unparseable_transformer_output",
      candidate: null,
      transformModel: invokeResult.modelId ?? null,
      transformRouteSource: invokeResult.routeSource ?? null,
      transformProvider: invokeResult.provider ?? null,
      sourceSignalIds: params.input.sourceSignalIds ?? [],
    };
  }

  return transformMarketingAgendaFromLlmOutput({
    input: params.input,
    llm,
    transformModel: invokeResult.modelId ?? null,
    transformRouteSource: invokeResult.routeSource ?? null,
    transformProvider: invokeResult.provider ?? null,
    nowIso: params.nowIso,
  });
}
