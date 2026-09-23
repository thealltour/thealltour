import { describe, expect, it, beforeEach } from "vitest";
import { promises as fs } from "node:fs";
import os from "node:os";
import path from "node:path";

import {
  isAgendaQualityV2ShadowEnabled,
  resolveAgendaQualityV2MaxTransforms,
  resolveAgendaQualityV2LiveShadowDir,
  AGENDA_QUALITY_V2_MAX_TRANSFORMS_DEFAULT,
} from "@/lib/marketing/agendaQualityV2/shadow/config";
import {
  buildAgendaTransformCacheKey,
  createInMemoryAgendaTransformCache,
} from "@/lib/marketing/agendaQualityV2/transformer/cache";
import {
  createInjectableAgendaTransformerInvoke,
  getMarketingAgendaTransformerRouteMeta,
} from "@/lib/marketing/agendaQualityV2/transformer/createInvoke";
import { MARKETING_AGENDA_TRANSFORMER_ROLE_KEY } from "@/lib/marketing/agendaQualityV2/transformer/prompt";
import { runAgendaQualityV2LiveShadowSafe } from "@/lib/marketing/agendaQualityV2/shadow/liveShadowRunner";
import { createInMemoryDurableAgendaReservoir } from "@/lib/marketing/agendaQualityV2/reservoir/types";
import { buildFiveDayLiveShadowRollup } from "@/lib/marketing/agendaQualityV2/shadow/fiveDayReview";
import { ROLE_MODEL_ROUTES } from "@/ai-runtime/router/role-routes";
import type { CompactManagerAgendaCandidate } from "@/lib/marketing/research/manager/types";
import type { DailyAgendaSlate } from "@/lib/marketing/cron/daily/agendaSlate/types";
import {
  createInMemoryDailyMarketingRunRepository,
  resetDefaultDailyMarketingRunRepository,
} from "@/lib/marketing/cron/daily/repository/createDailyMarketingRunRepository";
import {
  createInMemoryDailyAgendaSlateRepository,
  resetDefaultDailyAgendaSlateRepository,
} from "@/lib/marketing/cron/daily/repository/createDailyAgendaSlateRepository";
import { runDailyMarketingAgendaSlate } from "@/lib/marketing/cron/daily/runDailyMarketingAgendaSlate";
import {
  agendaCandidate as fixtureAgenda,
  buildResearchContext,
  NOW as FIX_NOW,
  PRODUCT,
  researchBrief,
  officialEvidence,
} from "@/lib/marketing/cron/daily/__tests__/fixtures";

const NOW = "2026-09-16T01:00:00.000Z";

function llmJson(): string {
  return JSON.stringify({
    targetTravelerKo: "푸꾸옥 외부관광형 여행자",
    travelerProblemKo: "리조트 선택지가 늘 때 숙소 위치를 어떻게 판단해야 하는가?",
    decisionAtStakeKo: "리조트 클러스터 vs 관광 접근성 구역 선택",
    audienceTensionKo: "편의 집중 vs 동선 효율",
    readerPayoffKo: "숙소 위치 판단 기준을 세운다",
    marketingStorySeedKo: "호텔 공급이 늘 때 숙소 위치는 무엇으로 고를까?",
    whyNowKo: "공급 확대 신호",
    researchQuestionsKo: ["신규 공급 구역?", "이동 수단?"],
    nonGoalsKo: ["특정 호텔 추천"],
    genericRiskKo: "가설 유지",
    storyArchetypeHint: "convenience_vs_experience",
    freshnessClass: "timely",
    signalSummaryKo: "호텔 공급 신호",
    limitations: ["요금 미확인"],
    editorialArchetype: "DECISION",
    whyInterestingKo: "호텔이 늘수록 숙소 위치가 여행 체감을 가를 수 있다",
    curiosityHookKo: "리조트가 늘면 어디에 묵을지가 더 중요해진다",
    hiddenDetailKo: "공급 증가 뒤 구역별 접근성·프라이빗함 차이가 놓치기 쉬운 포인트",
    whyKoreanTravelerCaresKo: "한국 여행자가 푸꾸옥 리조트를 고를 때 위치가 일정 효율을 좌우한다",
    familiarReferenceKo: "올인클루시브 리조트 이미지",
    alternativeAppealKo: "밀집 구역 대신 이동 쉬운 위치",
    explorationPayoffKo: "구역별 숙소 위치를 더 비교해볼 수 있다",
    contentImaginabilityKo: "헤드라인+위치 대비 섹션+체크리스트 구성",
  });
}

function compactCand(id: string, score = 0.8): CompactManagerAgendaCandidate {
  return {
    ...fixtureAgenda,
    agendaCandidateId: id,
    researchBriefId: `rb_${id}`,
    title: `title-${id}`,
    summary: `summary for ${id} with enough detail`,
    totalResearchScore: score,
    observedAt: NOW,
  };
}

function v1Slate(date: string): DailyAgendaSlate {
  return {
    contract: "daily-agenda-slate-v1",
    slateId: `slate_${date}`,
    logicalRunKey: `lrk_${date}`,
    businessDateKst: date,
    routineId: "r",
    runId: "run",
    correlationId: "c",
    createdAt: NOW,
    updatedAt: NOW,
    status: "ready_for_human_selection",
    targetSize: 6,
    researchStatus: null,
    degraded: false,
    candidates: [
      {
        contract: "agenda-slate-candidate-v1",
        slateItemId: "si1",
        state: "AVAILABLE",
        origin: "organic_research",
        deferredFromBusinessDateKst: null,
        deferredFromSlateItemId: null,
        agendaCandidateId: "ac1",
        researchBriefId: "rb1",
        canonicalArticleIds: [],
        title: "vietnam september escapes",
        summary: "travel inspiration",
        score: 0.8,
        scoreReasons: [],
        destinations: ["vietnam"],
        topics: ["travel"],
        entities: [],
        audienceHint: null,
        rationale: [],
        recommendedFormats: [],
        recommendedChannel: null,
        evidenceSummary: [],
        matchedProductIds: [],
        riskFlags: [],
        editorial: {
          freshnessWhyNow: null,
          koreanTravelerRelevance: null,
          practicalTravelValue: null,
          theAllTourBusinessRelevance: null,
          contentPotential: null,
        },
        researchSnapshot: {
          freshnessScore: 0.8,
          credibilityScore: 0.7,
          travelRelevanceScore: 0.7,
          totalResearchScore: 0.8,
        },
      },
    ],
    cooldown: { days: 3, excludedAgendaCandidateIds: [], excludedBriefIds: [] },
    curation: { mode: "manager_curated", managerMessage: null },
    observability: {
      organicCount: 1,
      deferredCarryoverCount: 0,
      availableCount: 1,
      selectedTodayCount: 0,
    },
    metadata: {},
  };
}

function multiCandidateContext(count = 6) {
  const agendaCandidates = Array.from({ length: count }, (_, i) => ({
    ...fixtureAgenda,
    agendaCandidateId: `ac-item-${i + 1}`,
    researchBriefId: `rb-item-${i + 1}`,
    title: `Travel topic ${i + 1}`,
    summary: `Summary for topic ${i + 1} with enough detail.`,
    totalResearchScore: 0.9 - i * 0.05,
    evidence: [
      {
        ...officialEvidence,
        evidenceId: `ev-item-${i + 1}`,
        url: `https://example.com/articles/topic-${i + 1}`,
        excerpt: `Summary for topic ${i + 1} with enough detail.`,
      },
    ],
  }));
  return buildResearchContext({
    agendaCandidates,
    briefs: agendaCandidates.map((c) => ({
      ...researchBrief,
      researchBriefId: c.researchBriefId,
      title: c.title,
      summary: c.summary,
      evidence: c.evidence,
    })),
  });
}

describe("AGENDA_QUALITY_V2 Phase4 live shadow wiring", () => {
  beforeEach(() => {
    resetDefaultDailyMarketingRunRepository();
    resetDefaultDailyAgendaSlateRepository();
  });

  it("flag default OFF", () => {
    expect(isAgendaQualityV2ShadowEnabled({})).toBe(false);
    expect(resolveAgendaQualityV2MaxTransforms({})).toBe(AGENDA_QUALITY_V2_MAX_TRANSFORMS_DEFAULT);
  });

  it("transformer role route is marketing_agenda_transformer (not CS/MM)", () => {
    const meta = getMarketingAgendaTransformerRouteMeta();
    expect(meta.roleKey).toBe(MARKETING_AGENDA_TRANSFORMER_ROLE_KEY);
    expect(meta.routeSource).toBe("role_override");
    expect(meta.modelIds).toEqual(ROLE_MODEL_ROUTES.marketing_agenda_transformer);
  });

  it("transform cache key is deterministic", () => {
    const a = buildAgendaTransformCacheKey({ sourceFingerprint: "fp1", sourceCandidateId: "c1" });
    const b = buildAgendaTransformCacheKey({ sourceFingerprint: "fp1", sourceCandidateId: "c1" });
    expect(a).toBe(b);
    expect(a).not.toBe(
      buildAgendaTransformCacheKey({ sourceFingerprint: "fp2", sourceCandidateId: "c1" }),
    );
  });

  it("flag OFF → no V2 attempt", async () => {
    const result = await runAgendaQualityV2LiveShadowSafe({
      businessDateKst: "2026-09-16",
      v1Slate: v1Slate("2026-09-16"),
      agendaCandidates: [compactCand("a1")],
      deps: {
        env: {},
        writeArtifacts: false,
        forceMemory: true,
        invoke: createInjectableAgendaTransformerInvoke(async () => llmJson()),
      },
    });
    expect(result.attempted).toBe(false);
    expect(result.snapshot.status).toBe("disabled");
    expect(result.v1Unaffected).toBe(true);
  });

  it("flag ON + memory → V2 runs; cache hits on second call; artifacts under thealltour", async () => {
    const tmp = await fs.mkdtemp(path.join(os.tmpdir(), "aqv2-"));
    const cache = createInMemoryAgendaTransformCache();
    const reservoir = createInMemoryDurableAgendaReservoir();
    let calls = 0;
    const invoke = createInjectableAgendaTransformerInvoke(async () => {
      calls += 1;
      return llmJson();
    });

    const first = await runAgendaQualityV2LiveShadowSafe({
      businessDateKst: "2026-09-16",
      v1Slate: v1Slate("2026-09-16"),
      agendaCandidates: [compactCand("a1", 0.9)],
      deps: {
        env: { AGENDA_QUALITY_V2_SHADOW_ENABLED: "true" },
        invoke,
        reservoir,
        transformCache: cache,
        forceMemory: true,
        writeArtifacts: true,
        cwd: tmp,
        nowIso: NOW,
      },
    });
    expect(first.attempted).toBe(true);
    expect(first.snapshot.status).toBe("ok");
    expect(first.snapshot.observability.roleKey).toBe("marketing_agenda_transformer");
    expect(first.snapshot.v2.slateCount).toBeLessThanOrEqual(6);
    expect(first.artifactPaths?.jsonPath).toContain("artifacts/agenda-quality-v2/live-shadow");
    expect(first.artifactPaths?.jsonPath).not.toContain("theallcloud");
    expect(calls).toBe(1);

    const second = await runAgendaQualityV2LiveShadowSafe({
      businessDateKst: "2026-09-16",
      v1Slate: v1Slate("2026-09-16"),
      agendaCandidates: [compactCand("a1", 0.9)],
      deps: {
        env: { AGENDA_QUALITY_V2_SHADOW_ENABLED: "true" },
        invoke,
        reservoir,
        transformCache: cache,
        forceMemory: true,
        writeArtifacts: false,
        cwd: tmp,
        nowIso: NOW,
      },
    });
    expect(second.snapshot.source.transformCacheHits).toBeGreaterThanOrEqual(1);
    expect(calls).toBe(1);
  });

  it("V2 invoke failure cannot fail V1 pipeline result", async () => {
    const repo = createInMemoryDailyMarketingRunRepository();
    const slateRepo = createInMemoryDailyAgendaSlateRepository();

    const result = await runDailyMarketingAgendaSlate(
      {
        productId: PRODUCT,
        channel: "threads",
        businessDateKst: "2026-09-20",
        correlationId: "corr-p4",
      },
      {
        repo,
        slateRepo,
        now: FIX_NOW,
        getResearchContext: async () => multiCandidateContext(6),
        trendPreflight: null,
        agendaQualityV2Shadow: {
          env: { AGENDA_QUALITY_V2_SHADOW_ENABLED: "true" },
          forceMemory: true,
          writeArtifacts: false,
          invoke: createInjectableAgendaTransformerInvoke(async () => {
            throw new Error("boom_transformer");
          }),
        },
      },
    );

    expect(result.slate).toBeTruthy();
    expect(result.run.status).toBe("slate_ready");
    expect(result.slate?.candidates.length).toBeGreaterThan(0);
    const meta = result.run.metadata.agendaQualityV2Shadow as {
      status?: string;
      v1Unaffected?: boolean;
    };
    expect(meta?.v1Unaffected).toBe(true);
  });

  it("canonical live-shadow artifact path uses thealltour", () => {
    const dir = resolveAgendaQualityV2LiveShadowDir("/home/ysh/thealltour");
    expect(dir).toBe("/home/ysh/thealltour/artifacts/agenda-quality-v2/live-shadow");
    expect(dir).not.toContain("theallcloud");
    expect(dir).not.toContain("theallview");
  });

  it("payload markers qualityVersion=v2 + shadow=true are required on reservoir writes", async () => {
    const {
      createInMemoryDurableAgendaReservoir,
      createReservoirItemFromQualified,
      assertAgendaReservoirShadowPayload,
    } = await import("@/lib/marketing/agendaQualityV2/reservoir/types");
    const { assembleMarketingAgendaCandidateV2 } = await import(
      "@/lib/marketing/agendaQualityV2/transformer/transform"
    );
    const candidate = assembleMarketingAgendaCandidateV2({
      input: {
        originalTitle: "t",
        originalSummary: "s",
        sourceTypes: ["probe"],
        sourceFingerprint: "fp",
        sourceCredibility: 0.7,
        sourceFreshness: 0.7,
        koreanTravelerRelevance: 0.7,
        observedAt: NOW,
      },
      llm: {
        targetTravelerKo: "여행자",
        travelerProblemKo: "문제를 어떻게 판단할까?",
        decisionAtStakeKo: "A vs B",
        audienceTensionKo: "긴장",
        readerPayoffKo: "보상",
        marketingStorySeedKo: "시드",
        whyNowKo: "지금",
        researchQuestionsKo: ["q"],
        nonGoalsKo: ["n"],
        genericRiskKo: "low",
        storyArchetypeHint: "other",
        freshnessClass: "timely",
        signalSummaryKo: "t",
        limitations: [],
        editorialArchetype: "DISCOVERY",
        whyInterestingKo: "흥미로운 디테일",
        curiosityHookKo: "클릭을 유도하는 훅",
        hiddenDetailKo: "놓치기 쉬운 숨은 포인트",
        whyKoreanTravelerCaresKo: "한국 여행자에게 왜 중요한지",
        explorationPayoffKo: "더 알아보고 싶은 보상",
        contentImaginabilityKo: "콘텐츠로 바로 그려지는 구성",
      },
      transformModel: "test",
      nowIso: NOW,
    });
    const good = createReservoirItemFromQualified(candidate, NOW);
    expect(good.qualityVersion).toBe("v2");
    expect(good.shadow).toBe(true);
    expect(() => assertAgendaReservoirShadowPayload(good)).not.toThrow();

    const repo = createInMemoryDurableAgendaReservoir();
    await repo.upsert(good);

    const bad = { ...good, qualityVersion: "v1" as "v2", shadow: false as true };
    await expect(repo.upsert(bad)).rejects.toThrow(/payload_markers_missing/);
  });

  it("five-day rollup helper ready", () => {
    const rollup = buildFiveDayLiveShadowRollup([
      {
        contract: "agenda-quality-v2-live-shadow-snapshot",
        qualityVersion: "v2",
        shadow: true,
        businessDateKst: "2026-09-16",
        generatedAt: NOW,
        runId: "test-run",
        runType: "SCHEDULED",
        status: "ok",
        blockerReason: null,
        failureReason: null,
        durationMs: 10,
        validation: {
          validationId: "aqv2-live-20260917-20260921",
          validationConfigFingerprint: "test-fp",
          validationConfigStatus: "MATCH",
          configDriftFields: [],
          runType: "SCHEDULED",
          businessDate: "2026-09-16",
          createdAt: NOW,
          codeRevision: null,
        },
        source: {
          rawCandidateCount: 6,
          transformedCount: 4,
          transformCacheHits: 1,
          transformFailures: 0,
          llmCallCount: 3,
          maxTransforms: 12,
        },
        v2: {
          strongCount: 2,
          publishableCount: 1,
          weakCount: 0,
          rejectCount: 1,
          slateCount: 3,
          newCount: 2,
          carryoverCount: 1,
        },
        allCandidates: [],
        slate: [],
        rejectedOrExcluded: [],
        rejected: [],
        comparison: {
          v1Count: 6,
          v2Count: 3,
          v1NewsLikeDropped: ["a"],
          repeatedTopicsDropped: [],
          carryoverResurfaced: ["x"],
        },
        observability: {
          roleKey: "marketing_agenda_transformer",
          routeSource: "role_override",
          selectedProviderId: null,
          selectedModelId: null,
          configuredRoute: ["gemini-flash-lite-primary"],
          availableRoute: ["gemini-flash-lite-primary"],
          reservoirBackend: "memory_test",
          productionLiveShadowReady: false,
        },
        humanReview: null,
        humanReviewPreference: null,
      },
    ]);
    expect(rollup.humanReviewPreferenceSlots[0]?.preference).toBeNull();
    expect(rollup.metrics.avgSlateSize).toBe(3);
    expect(rollup.humanReview.unset).toBe(1);
  });
});
