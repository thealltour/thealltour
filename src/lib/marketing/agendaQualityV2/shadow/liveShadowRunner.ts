/**
 * Live Shadow runner — observational only. Never mutates V1 Slate authority.
 */

import type { CompactManagerAgendaCandidate } from "@/lib/marketing/research/manager/types";
import type { DailyAgendaSlate } from "@/lib/marketing/cron/daily/agendaSlate/types";
import {
  isAgendaQualityV2JsonFallbackEnabled,
  isAgendaQualityV2ShadowEnabled,
  resolveAgendaQualityV2MaxTransforms,
  AGENDA_QUALITY_V2_PROMPT_VERSION,
  AGENDA_QUALITY_V2_TRANSFORM_REVISION,
} from "@/lib/marketing/agendaQualityV2/shadow/config";
import { probeAgendaReservoirV2Table } from "@/lib/marketing/agendaQualityV2/reservoir/migrationReadiness";
import {
  createDurableAgendaReservoirRepository,
} from "@/lib/marketing/agendaQualityV2/reservoir/createDurableRepository";
import {
  createInMemoryDurableAgendaReservoir,
  createReservoirItemFromQualified,
  stampAgendaReservoirShadowMarkers,
  type DurableAgendaReservoirRepository,
  type AgendaReservoirItem,
} from "@/lib/marketing/agendaQualityV2/reservoir/types";
import {
  markReservoirDeferred,
  markReservoirPresented,
} from "@/lib/marketing/agendaQualityV2/reservoir/transitions";
import {
  buildAgendaTransformCacheKey,
  createInMemoryAgendaTransformCache,
  createJsonFileAgendaTransformCache,
  type AgendaTransformCache,
} from "@/lib/marketing/agendaQualityV2/transformer/cache";
import {
  transformMarketingAgendaFromLlmOutput,
  transformMarketingAgendaWithInvoke,
  type AgendaTransformInvoke,
} from "@/lib/marketing/agendaQualityV2/transformer/transform";
import { parseMarketingAgendaTransformerOutput } from "@/lib/marketing/agendaQualityV2/transformer/parse";
import { selectDailyAgendaSlateV2 } from "@/lib/marketing/agendaQualityV2/slate/selectDailySlateV2";
import { explainAgendaV2Inclusion } from "@/lib/marketing/agendaQualityV2/calibration/explain";
import { classifyV1AgendaEditorially } from "@/lib/marketing/agendaQualityV2/calibration/classifyV1";
import {
  writeLiveShadowArtifacts,
  type LiveShadowDailySnapshot,
  type LiveShadowRunType,
} from "@/lib/marketing/agendaQualityV2/shadow/liveShadowArtifacts";
import { getMarketingAgendaTransformerRouteMeta } from "@/lib/marketing/agendaQualityV2/transformer/createInvoke";
import { MARKETING_AGENDA_TRANSFORMER_ROLE_KEY } from "@/lib/marketing/agendaQualityV2/transformer/prompt";
import { resolveAgendaTransformerRouteVisibility } from "@/lib/marketing/agendaQualityV2/shadow/routeVisibility";
import {
  evaluateValidationConfigStatus,
  readValidationManifest,
  AGENDA_QUALITY_V2_VALIDATION_ID,
} from "@/lib/marketing/agendaQualityV2/shadow/validationManifest";
import {
  buildObservationFromReservoirScore,
  buildSourceObservationFromCompact,
  buildTransformFailureObservation,
  type LiveShadowCandidateObservation,
} from "@/lib/marketing/agendaQualityV2/shadow/candidateObservation";
import { randomUUID } from "node:crypto";
import path from "node:path";

export type LiveShadowRunnerDeps = {
  invoke?: AgendaTransformInvoke;
  reservoir?: DurableAgendaReservoirRepository;
  transformCache?: AgendaTransformCache;
  env?: NodeJS.ProcessEnv | Record<string, string | undefined>;
  cwd?: string;
  nowIso?: string;
  writeArtifacts?: boolean;
  /** Force memory backends (unit tests). */
  forceMemory?: boolean;
  /** Explicit call-site metadata — do not infer from clock. */
  runType?: LiveShadowRunType;
  runId?: string;
  /** Optional git HEAD for validation metadata (observability only). */
  codeRevision?: string | null;
};

export type LiveShadowRunnerResult = {
  attempted: boolean;
  snapshot: LiveShadowDailySnapshot;
  artifactPaths: { jsonPath: string; mdPath: string } | null;
  /** Always true for this runner — V1 must ignore failures. */
  v1Unaffected: true;
};

function pickTopAgendaCandidates(
  candidates: CompactManagerAgendaCandidate[],
  max: number,
): CompactManagerAgendaCandidate[] {
  return [...candidates]
    .sort((a, b) => (b.totalResearchScore ?? 0) - (a.totalResearchScore ?? 0))
    .slice(0, max);
}

function emptySnapshot(partial: Partial<LiveShadowDailySnapshot> & {
  businessDateKst: string;
  generatedAt: string;
  status: LiveShadowDailySnapshot["status"];
  durationMs: number;
}): LiveShadowDailySnapshot {
  const runType = partial.runType ?? "MANUAL_RERUN";
  const runId = partial.runId ?? `aqv2_${randomUUID().slice(0, 12)}`;
  return {
    contract: "agenda-quality-v2-live-shadow-snapshot",
    qualityVersion: "v2",
    shadow: true,
    businessDateKst: partial.businessDateKst,
    generatedAt: partial.generatedAt,
    runId,
    runType,
    status: partial.status,
    blockerReason: partial.blockerReason ?? null,
    failureReason: partial.failureReason ?? null,
    durationMs: partial.durationMs,
    validation: partial.validation ?? {
      validationId: AGENDA_QUALITY_V2_VALIDATION_ID,
      validationConfigFingerprint: "unknown",
      validationConfigStatus: "UNKNOWN",
      configDriftFields: [],
      runType,
      businessDate: partial.businessDateKst,
      createdAt: partial.generatedAt,
      codeRevision: null,
    },
    source: partial.source ?? {
      rawCandidateCount: 0,
      transformedCount: 0,
      transformCacheHits: 0,
      transformFailures: 0,
      llmCallCount: 0,
      maxTransforms: 0,
    },
    v2: partial.v2 ?? {
      strongCount: 0,
      publishableCount: 0,
      weakCount: 0,
      rejectCount: 0,
      slateCount: 0,
      newCount: 0,
      carryoverCount: 0,
    },
    allCandidates: partial.allCandidates ?? [],
    slate: partial.slate ?? [],
    rejectedOrExcluded: partial.rejectedOrExcluded ?? [],
    rejected: partial.rejected ?? [],
    comparison: partial.comparison ?? {
      v1Count: 0,
      v2Count: 0,
      v1NewsLikeDropped: [],
      repeatedTopicsDropped: [],
      carryoverResurfaced: [],
    },
    observability: partial.observability ?? {
      roleKey: MARKETING_AGENDA_TRANSFORMER_ROLE_KEY,
      routeSource: null,
      selectedProviderId: null,
      selectedModelId: null,
      configuredRoute: [],
      availableRoute: [],
      reservoirBackend: "blocked",
      productionLiveShadowReady: false,
    },
    humanReview: null,
    humanReviewPreference: null,
  };
}

/**
 * Fail-open Live Shadow. Call after V1 slate persist.
 * Never throws to caller — all errors become snapshot failure/blocked.
 */
export async function runAgendaQualityV2LiveShadowSafe(params: {
  businessDateKst: string;
  v1Slate: DailyAgendaSlate;
  agendaCandidates: CompactManagerAgendaCandidate[];
  deps?: LiveShadowRunnerDeps;
}): Promise<LiveShadowRunnerResult> {
  const started = Date.now();
  const env = params.deps?.env ?? process.env;
  const nowIso = params.deps?.nowIso ?? new Date().toISOString();
  const routeMeta = getMarketingAgendaTransformerRouteMeta();
  const routeVisibility = resolveAgendaTransformerRouteVisibility(env);
  const runType = params.deps?.runType ?? "MANUAL_RERUN";
  const runId = params.deps?.runId ?? `aqv2_${randomUUID().slice(0, 12)}`;
  const baseObs = {
    roleKey: MARKETING_AGENDA_TRANSFORMER_ROLE_KEY,
    routeSource: routeMeta.routeSource,
    selectedProviderId: null as string | null,
    selectedModelId: null as string | null,
    configuredRoute: routeVisibility.configuredRoute,
    availableRoute: routeVisibility.availableRoute,
    reservoirBackend: "blocked" as const,
    productionLiveShadowReady: false,
  };

  if (!isAgendaQualityV2ShadowEnabled(env)) {
    return {
      attempted: false,
      v1Unaffected: true,
      artifactPaths: null,
      snapshot: emptySnapshot({
        businessDateKst: params.businessDateKst,
        generatedAt: nowIso,
        runId,
        runType,
        status: "disabled",
        durationMs: Date.now() - started,
        observability: baseObs,
      }),
    };
  }

  try {
    return await runLiveShadowInner({
      businessDateKst: params.businessDateKst,
      v1Slate: params.v1Slate,
      agendaCandidates: params.agendaCandidates,
      deps: params.deps,
      started,
      nowIso,
      env,
      routeMeta,
      routeVisibility,
      runId,
      runType,
    });
  } catch (err) {
    const snapshot = emptySnapshot({
      businessDateKst: params.businessDateKst,
      generatedAt: nowIso,
      runId,
      runType,
      status: "failed",
      failureReason: err instanceof Error ? err.message : String(err),
      durationMs: Date.now() - started,
      comparison: {
        v1Count: params.v1Slate.candidates.length,
        v2Count: 0,
        v1NewsLikeDropped: [],
        repeatedTopicsDropped: [],
        carryoverResurfaced: [],
      },
      observability: baseObs,
    });
    let artifactPaths = null;
    if (params.deps?.writeArtifacts !== false) {
      try {
        artifactPaths = await writeLiveShadowArtifacts({
          snapshot,
          cwd: params.deps?.cwd,
        });
      } catch {
        /* ignore artifact failure */
      }
    }
    return { attempted: true, v1Unaffected: true, snapshot, artifactPaths };
  }
}

async function runLiveShadowInner(params: {
  businessDateKst: string;
  v1Slate: DailyAgendaSlate;
  agendaCandidates: CompactManagerAgendaCandidate[];
  deps?: LiveShadowRunnerDeps;
  started: number;
  nowIso: string;
  env: NodeJS.ProcessEnv | Record<string, string | undefined>;
  routeMeta: ReturnType<typeof getMarketingAgendaTransformerRouteMeta>;
  routeVisibility: ReturnType<typeof resolveAgendaTransformerRouteVisibility>;
  runId: string;
  runType: LiveShadowRunType;
}): Promise<LiveShadowRunnerResult> {
  const maxTransforms = resolveAgendaQualityV2MaxTransforms(params.env);
  const readiness = await probeAgendaReservoirV2Table({
    forceMemory: params.deps?.forceMemory,
    jsonFallbackEnabled: isAgendaQualityV2JsonFallbackEnabled(params.env),
  });

  if (readiness.backend === "blocked") {
    const snapshot = emptySnapshot({
      businessDateKst: params.businessDateKst,
      generatedAt: params.nowIso,
      runId: params.runId,
      runType: params.runType,
      status: "blocked",
      blockerReason: readiness.reason,
      durationMs: Date.now() - params.started,
      source: {
        rawCandidateCount: params.agendaCandidates.length,
        transformedCount: 0,
        transformCacheHits: 0,
        transformFailures: 0,
        llmCallCount: 0,
        maxTransforms,
      },
      comparison: {
        v1Count: params.v1Slate.candidates.length,
        v2Count: 0,
        v1NewsLikeDropped: [],
        repeatedTopicsDropped: [],
        carryoverResurfaced: [],
      },
      observability: {
        roleKey: MARKETING_AGENDA_TRANSFORMER_ROLE_KEY,
        routeSource: params.routeMeta.routeSource,
        selectedProviderId: null,
        selectedModelId: null,
        configuredRoute: params.routeVisibility.configuredRoute,
        availableRoute: params.routeVisibility.availableRoute,
        reservoirBackend: "blocked",
        productionLiveShadowReady: false,
      },
    });
    const artifactPaths =
      params.deps?.writeArtifacts === false
        ? null
        : await writeLiveShadowArtifacts({ snapshot, cwd: params.deps?.cwd });
    return { attempted: true, v1Unaffected: true, snapshot, artifactPaths };
  }

  const reservoir =
    params.deps?.reservoir ??
    (readiness.backend === "memory_test"
      ? createInMemoryDurableAgendaReservoir()
      : readiness.backend === "json_fallback"
        ? await createDurableAgendaReservoirRepository({
            backend: "json",
            jsonFilePath: path.join(
              params.deps?.cwd ?? process.cwd(),
              "data/marketing/agenda-quality-v2/reservoir.json",
            ),
          })
        : await createDurableAgendaReservoirRepository({ backend: "supabase", env: params.env }));

  const transformCache =
    params.deps?.transformCache ??
    (params.deps?.forceMemory
      ? createInMemoryAgendaTransformCache()
      : createJsonFileAgendaTransformCache({
          filePath: path.join(
            params.deps?.cwd ?? process.cwd(),
            "data/marketing/agenda-quality-v2/transform-cache.json",
          ),
        }));

  if (!params.deps?.invoke) {
    throw new Error("live_shadow_invoke_missing: provide Runtime-backed marketing_agenda_transformer invoke");
  }
  const invoke = params.deps.invoke;

  const pool = pickTopAgendaCandidates(params.agendaCandidates, maxTransforms);
  let transformCacheHits = 0;
  let transformFailures = 0;
  let llmCallCount = 0;
  let transformedCount = 0;
  let lastModel: string | null = null;
  let lastProvider: string | null = null;
  let lastRoute: string | null = params.routeMeta.routeSource;

  const newlyQualified: AgendaReservoirItem[] = [];
  const rejectNotes: Array<Record<string, unknown>> = [];
  const sourceByCandidateId = new Map<string, LiveShadowCandidateObservation["source"]>();
  const sourceByAgendaId = new Map<string, LiveShadowCandidateObservation["source"]>();
  const transformMetaByAgendaId = new Map<
    string,
    { cacheHit: boolean; provider: string | null; model: string | null; routeSource: string | null }
  >();
  const transformFailureObservations: LiveShadowCandidateObservation[] = [];

  for (const cand of pool) {
    const sourceObservation = buildSourceObservationFromCompact(cand);
    sourceByCandidateId.set(cand.agendaCandidateId, sourceObservation);
    const sourceFingerprint = `v1cand:${cand.agendaCandidateId}:${cand.observedAt ?? cand.publishedAt ?? ""}`;
    const cacheKey = buildAgendaTransformCacheKey({
      sourceFingerprint,
      sourceCandidateId: cand.agendaCandidateId,
      transformRevision: AGENDA_QUALITY_V2_TRANSFORM_REVISION,
      promptVersion: AGENDA_QUALITY_V2_PROMPT_VERSION,
    });

    try {
      const cached = await transformCache.get(cacheKey);
      let transform;
      let cacheHit = false;
      if (cached) {
        transformCacheHits += 1;
        cacheHit = true;
        transform = transformMarketingAgendaFromLlmOutput({
          input: {
            originalTitle: cand.title,
            originalSummary: cand.summary,
            sourceTypes: cand.signalTypes?.length ? cand.signalTypes : ["agenda_candidate"],
            destinations: cand.destinations,
            topics: cand.topics,
            sourceCandidateIds: [cand.agendaCandidateId],
            sourceBriefIds: cand.researchBriefId ? [cand.researchBriefId] : [],
            sourceCredibility: cand.credibilityScore,
            sourceFreshness: cand.freshnessScore,
            koreanTravelerRelevance: cand.koreanOutboundRelevanceScore ?? cand.travelRelevanceScore,
            sourceFingerprint,
            observedAt: cand.observedAt ?? params.nowIso,
          },
          llm: cached.llm,
          transformModel: cached.transformModel,
          transformRouteSource: cached.transformRouteSource,
          transformProvider: cached.transformProvider,
          nowIso: params.nowIso,
        });
      } else {
        llmCallCount += 1;
        transform = await transformMarketingAgendaWithInvoke({
          input: {
            originalTitle: cand.title,
            originalSummary: cand.summary,
            sourceTypes: cand.signalTypes?.length ? cand.signalTypes : ["agenda_candidate"],
            destinations: cand.destinations,
            topics: cand.topics,
            sourceCandidateIds: [cand.agendaCandidateId],
            sourceBriefIds: cand.researchBriefId ? [cand.researchBriefId] : [],
            sourceCredibility: cand.credibilityScore,
            sourceFreshness: cand.freshnessScore,
            koreanTravelerRelevance: cand.koreanOutboundRelevanceScore ?? cand.travelRelevanceScore,
            sourceFingerprint,
            observedAt: cand.observedAt ?? params.nowIso,
          },
          invoke,
          nowIso: params.nowIso,
        });
        lastModel = transform.transformModel;
        lastProvider = transform.transformProvider;
        lastRoute = transform.transformRouteSource ?? lastRoute;

        if (transform.transformStatus === "valid" && transform.candidate) {
          const llm = parseMarketingAgendaTransformerOutput(
            JSON.stringify({
              targetTravelerKo: transform.candidate.traveler.targetTravelerKo,
              travelerProblemKo: transform.candidate.traveler.travelerProblemKo,
              decisionAtStakeKo: transform.candidate.traveler.decisionAtStakeKo,
              audienceTensionKo: transform.candidate.traveler.audienceTensionKo,
              readerPayoffKo: transform.candidate.traveler.readerPayoffKo,
              marketingStorySeedKo: transform.candidate.editorial.marketingStorySeedKo,
              whyNowKo: transform.candidate.editorial.whyNowKo,
              researchQuestionsKo: transform.candidate.editorial.researchQuestionsKo,
              nonGoalsKo: transform.candidate.editorial.nonGoalsKo,
              genericRiskKo: transform.candidate.editorial.genericRiskKo,
              storyArchetypeHint: transform.candidate.editorial.storyArchetypeHint,
              freshnessClass: transform.candidate.signalContext.freshnessClass,
              signalSummaryKo: transform.candidate.signalContext.signalSummaryKo,
              limitations: transform.candidate.provenance.limitations,
            }),
          );
          if (llm) {
            await transformCache.set({
              cacheKey,
              sourceFingerprint,
              transformRevision: AGENDA_QUALITY_V2_TRANSFORM_REVISION,
              promptVersion: AGENDA_QUALITY_V2_PROMPT_VERSION,
              llm,
              transformModel: transform.transformModel,
              transformProvider: transform.transformProvider,
              transformRouteSource: transform.transformRouteSource,
              cachedAt: params.nowIso,
            });
          }
        }
      }

      if (transform.transformStatus !== "valid" || !transform.candidate) {
        transformFailures += 1;
        const failureReason = transform.transformFailureReason ?? "transform_failed";
        rejectNotes.push({
          agendaId: cand.agendaCandidateId,
          title: cand.title,
          reason: failureReason,
        });
        transformFailureObservations.push(
          buildTransformFailureObservation({
            cand,
            sourceFingerprint,
            failureReason,
            provider: transform.transformProvider,
            model: transform.transformModel,
            routeSource: transform.transformRouteSource,
            transformCacheHit: cacheHit,
          }),
        );
        continue;
      }

      transformedCount += 1;
      const item = stampAgendaReservoirShadowMarkers(
        createReservoirItemFromQualified(transform.candidate, params.nowIso),
      );
      sourceByAgendaId.set(item.agendaId, sourceObservation);
      transformMetaByAgendaId.set(item.agendaId, {
        cacheHit,
        provider: transform.transformProvider,
        model: transform.transformModel,
        routeSource: transform.transformRouteSource,
      });
      newlyQualified.push(item);
      try {
        await reservoir.upsert(item);
      } catch (err) {
        rejectNotes.push({
          agendaId: item.agendaId,
          title: cand.title,
          reason: `reservoir_write_failed:${err instanceof Error ? err.message : String(err)}`,
        });
      }
    } catch (err) {
      transformFailures += 1;
      const failureReason = `transform_failed:${err instanceof Error ? err.message : String(err)}`;
      rejectNotes.push({
        agendaId: cand.agendaCandidateId,
        title: cand.title,
        reason: failureReason,
      });
      transformFailureObservations.push(
        buildTransformFailureObservation({
          cand,
          sourceFingerprint,
          failureReason,
          transformCacheHit: false,
        }),
      );
    }
  }

  const all = await reservoir.list();
  const slate = selectDailyAgendaSlateV2({
    businessDateKst: params.businessDateKst,
    nowIso: params.nowIso,
    newlyQualified,
    reservoirItems: all,
  });

  // Apply lifecycle transitions → persist → re-read final state before artifact.
  const finalizedSelected: Array<{
    origin: (typeof slate.selected)[number]["origin"];
    score: (typeof slate.selected)[number]["score"];
    item: AgendaReservoirItem;
    carriedFromDate: string | null;
  }> = [];
  for (const row of slate.selected) {
    let item = (await reservoir.get(row.item.agendaId)) ?? row.item;
    if (item.status === "QUALIFIED" || item.status === "DEFERRED" || item.status === "PRESENTED") {
      try {
        if (item.status === "QUALIFIED" || item.status === "DEFERRED") {
          item = markReservoirPresented(item, params.nowIso);
        }
        if (item.status === "PRESENTED") {
          item = markReservoirDeferred(item, params.nowIso);
        }
        item = stampAgendaReservoirShadowMarkers(item);
        await reservoir.upsert(item);
        item = (await reservoir.get(item.agendaId)) ?? item;
      } catch {
        /* ignore reservoir transition failure — observational */
      }
    }
    finalizedSelected.push({
      origin: row.origin,
      score: row.score,
      item,
      carriedFromDate: row.carriedFromDate,
    });
  }

  const selectedIds = new Set(finalizedSelected.map((s) => s.item.agendaId));
  const slateObservations: LiveShadowCandidateObservation[] = finalizedSelected.map((s, idx) => {
    const meta = transformMetaByAgendaId.get(s.item.agendaId);
    const sourceFallback =
      sourceByAgendaId.get(s.item.agendaId) ??
      sourceByCandidateId.get(s.item.candidate.sourceCandidateIds[0] ?? "") ??
      null;
    return buildObservationFromReservoirScore({
      item: s.item,
      score: s.score,
      origin: s.origin,
      carriedFromDate: s.carriedFromDate,
      selectedIntoSlate: true,
      finalRank: idx + 1,
      inclusionReason: explainAgendaV2Inclusion({ included: true, score: s.score }),
      exclusionReason: null,
      sourceFallback,
      provider: meta?.provider ?? lastProvider,
      model: meta?.model ?? lastModel,
      routeSource: meta?.routeSource ?? lastRoute,
      transformCacheHit: meta?.cacheHit,
    });
  });

  const rejectedObservations: LiveShadowCandidateObservation[] = slate.rejected.map((r) => {
    const item =
      all.find((x) => x.agendaId === r.agendaId) ??
      newlyQualified.find((x) => x.agendaId === r.agendaId);
    if (!item) {
      return {
        agendaId: r.agendaId,
        source: {
          sourceTitle: null,
          sourceSummary: null,
          sourceType: null,
          sourceUrl: null,
          sourceId: r.agendaId,
          sourceDomain: null,
          observedAt: null,
          sourceSignalIds: [],
          sourceBriefIds: [],
          sourceCandidateIds: [],
          transformInputExcerpt: null,
        },
        transform: null,
        provenance: {
          sourceFingerprint: null,
          topicFingerprint: null,
          decisionAxisFingerprint: null,
          storySeedFingerprint: null,
          transformRevision: AGENDA_QUALITY_V2_TRANSFORM_REVISION,
          transformerContractVersion: "marketing-agenda-candidate-v2",
          promptVersion: AGENDA_QUALITY_V2_PROMPT_VERSION,
          roleKey: MARKETING_AGENDA_TRANSFORMER_ROLE_KEY,
          provider: null,
          model: null,
          routeSource: null,
          transformStatus: null,
          transformFailureReason: null,
          transformCacheHit: false,
        },
        scoring: {
          signalQualityScore: null,
          marketingQualityScore: null,
          totalScore: r.totalScore,
          qualityTier: r.qualityTier,
        },
        penalties: null,
        reservoir: {
          lifecycleStatus: null,
          origin: r.origin,
          firstQualifiedAt: null,
          lastPresentedAt: null,
          presentedCount: null,
          deferredAt: null,
          expiresAt: null,
          carriedFromDate: null,
        },
        selection: {
          eligible: false,
          selectedIntoSlate: false,
          finalRank: null,
          inclusionReason: null,
          exclusionReason: r.reason,
        },
      };
    }
    const meta = transformMetaByAgendaId.get(item.agendaId);
    const sourceFallback =
      sourceByAgendaId.get(item.agendaId) ??
      sourceByCandidateId.get(item.candidate.sourceCandidateIds[0] ?? "") ??
      null;
    const scoreFallback = {
      signalQualityScore: 0,
      marketingQualityScore: 0,
      totalScore: r.totalScore,
      qualityTier: r.qualityTier,
      novelty: {
        topicRepeat: false,
        decisionRepeat: false,
        storySeedRepeat: false,
        materialUpdate: false,
        reuseKind: "NOVEL" as const,
      },
      penalties: {
        reusePenalty: 0,
        fatiguePenalty: 0,
        genericRiskPenalty: 0,
        staleTrendPenalty: 0,
        decisionAxisRepeatPenalty: 0,
      },
      dimensions: {
        decisionUtility: 0,
        audienceSpecificity: 0,
        tensionStrength: 0,
        readerPayoffStrength: 0,
        researchability: 0,
        storyExpandability: 0,
        channelPotential: 0,
        commercialRelevance: 0,
        specificity: 0,
        novelty: 0,
      },
    };
    const score = r.score ?? scoreFallback;
    return buildObservationFromReservoirScore({
      item,
      score,
      origin: r.origin,
      carriedFromDate: r.carriedFromDate ?? null,
      selectedIntoSlate: false,
      finalRank: null,
      inclusionReason: null,
      exclusionReason: r.reason,
      sourceFallback,
      provider: meta?.provider ?? lastProvider,
      model: meta?.model ?? lastModel,
      routeSource: meta?.routeSource ?? lastRoute,
      transformCacheHit: meta?.cacheHit,
    });
  });

  const allCandidates: LiveShadowCandidateObservation[] = [
    ...slateObservations,
    ...rejectedObservations.filter((o) => !selectedIds.has(o.agendaId ?? "")),
    ...transformFailureObservations,
  ];

  const tierCounts = { strong: 0, publishable: 0, weak: 0, reject: 0 };
  for (const row of [
    ...finalizedSelected,
    ...slate.rejected.map((r) => ({ score: { qualityTier: r.qualityTier } })),
  ]) {
    const t = row.score.qualityTier;
    if (t === "STRONG") tierCounts.strong += 1;
    else if (t === "PUBLISHABLE") tierCounts.publishable += 1;
    else if (t === "WEAK") tierCounts.weak += 1;
    else tierCounts.reject += 1;
  }
  tierCounts.reject += rejectNotes.length;

  const v1NewsLikeDropped: string[] = [];
  const repeatedTopicsDropped: string[] = [];
  for (const c of params.v1Slate.candidates) {
    const cls = classifyV1AgendaEditorially(c);
    const matched = finalizedSelected.some(
      (s) =>
        s.item.candidate.signalContext.signalSummaryKo.includes(c.title.slice(0, 12)) ||
        s.item.sourceFingerprint.includes(c.agendaCandidateId ?? c.slateItemId),
    );
    if (!matched && (cls === "NEWS_HEADLINE_LIKE" || cls === "GENERIC_INFORMATIONAL")) {
      v1NewsLikeDropped.push(c.title);
    }
  }
  for (const r of slate.rejected) {
    if (r.reason.includes("repeat") || r.reason.includes("fatigue") || r.reason.includes("generic")) {
      repeatedTopicsDropped.push(r.agendaId);
    }
  }
  for (const n of rejectNotes) {
    if (String(n.reason).includes("generic") || String(n.reason).includes("headline")) {
      v1NewsLikeDropped.push(String(n.title));
    }
  }

  const manifest = await readValidationManifest(params.deps?.cwd ?? process.cwd());
  const drift = evaluateValidationConfigStatus({
    manifest,
    env: params.env,
  });

  const snapshot: LiveShadowDailySnapshot = {
    contract: "agenda-quality-v2-live-shadow-snapshot",
    qualityVersion: "v2",
    shadow: true,
    businessDateKst: params.businessDateKst,
    generatedAt: params.nowIso,
    runId: params.runId,
    runType: params.runType,
    status: "ok",
    blockerReason: readiness.productionLiveShadowReady ? null : readiness.reason,
    failureReason: null,
    durationMs: Date.now() - params.started,
    validation: {
      validationId: drift.validationId,
      validationConfigFingerprint: drift.validationConfigFingerprint,
      validationConfigStatus: drift.validationConfigStatus,
      configDriftFields: drift.configDriftFields,
      runType: params.runType,
      businessDate: params.businessDateKst,
      createdAt: params.nowIso,
      codeRevision: params.deps?.codeRevision ?? null,
    },
    source: {
      rawCandidateCount: params.agendaCandidates.length,
      transformedCount,
      transformCacheHits,
      transformFailures,
      llmCallCount,
      maxTransforms,
    },
    v2: {
      strongCount: tierCounts.strong,
      publishableCount: tierCounts.publishable,
      weakCount: tierCounts.weak,
      rejectCount: tierCounts.reject,
      slateCount: finalizedSelected.length,
      newCount: finalizedSelected.filter((s) => s.origin === "NEW").length,
      carryoverCount: finalizedSelected.filter((s) => s.origin === "CARRYOVER").length,
    },
    allCandidates,
    slate: slateObservations,
    rejectedOrExcluded: allCandidates.filter((c) => !c.selection.selectedIntoSlate),
    rejected: [
      ...rejectNotes,
      ...slate.rejected.map((r) => ({
        agendaId: r.agendaId,
        reason: r.reason,
        qualityTier: r.qualityTier,
        totalScore: r.totalScore,
        origin: r.origin,
      })),
    ],
    comparison: {
      v1Count: params.v1Slate.candidates.length,
      v2Count: finalizedSelected.length,
      v1NewsLikeDropped,
      repeatedTopicsDropped,
      carryoverResurfaced: finalizedSelected
        .filter((s) => s.origin === "CARRYOVER")
        .map((s) => s.item.agendaId),
    },
    observability: {
      roleKey: MARKETING_AGENDA_TRANSFORMER_ROLE_KEY,
      routeSource: lastRoute,
      selectedProviderId: lastProvider,
      selectedModelId: lastModel,
      configuredRoute: params.routeVisibility.configuredRoute,
      availableRoute: params.routeVisibility.availableRoute,
      reservoirBackend: readiness.backend,
      productionLiveShadowReady: readiness.productionLiveShadowReady,
    },
    humanReview: null,
    humanReviewPreference: null,
  };

  const artifactPaths =
    params.deps?.writeArtifacts === false
      ? null
      : await writeLiveShadowArtifacts({ snapshot, cwd: params.deps?.cwd });

  return { attempted: true, v1Unaffected: true, snapshot, artifactPaths };
}
