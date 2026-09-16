import { describe, expect, it } from "vitest";
import { promises as fs } from "node:fs";
import os from "node:os";
import path from "node:path";

import {
  enforceEvidenceSensitiveClaimPolicy,
  textContainsSensitiveAssertion,
  validateSensitiveClaimsForCandidate,
} from "@/lib/marketing/agendaQualityV2/transformer/evidenceSensitiveClaims";
import {
  assembleMarketingAgendaCandidateV2,
  transformMarketingAgendaFromLlmOutput,
} from "@/lib/marketing/agendaQualityV2/transformer/transform";
import {
  createInjectableAgendaTransformerInvoke,
} from "@/lib/marketing/agendaQualityV2/transformer/createInvoke";
import { runAgendaQualityV2LiveShadowSafe } from "@/lib/marketing/agendaQualityV2/shadow/liveShadowRunner";
import {
  createInMemoryDurableAgendaReservoir,
} from "@/lib/marketing/agendaQualityV2/reservoir/types";
import { createInMemoryAgendaTransformCache } from "@/lib/marketing/agendaQualityV2/transformer/cache";
import {
  readLiveShadowCanonicalSnapshot,
  writeLiveShadowArtifacts,
  type LiveShadowDailySnapshot,
} from "@/lib/marketing/agendaQualityV2/shadow/liveShadowArtifacts";
import {
  buildFiveDayLiveShadowRollup,
  loadFiveDayLiveShadowObservations,
} from "@/lib/marketing/agendaQualityV2/shadow/fiveDayReview";
import { resolveAgendaTransformerRouteVisibility } from "@/lib/marketing/agendaQualityV2/shadow/routeVisibility";
import type { CompactManagerAgendaCandidate } from "@/lib/marketing/research/manager/types";
import type { DailyAgendaSlate } from "@/lib/marketing/cron/daily/agendaSlate/types";
import type { MarketingAgendaTransformerLlmOutput } from "@/lib/marketing/agendaQualityV2/contracts";

const NOW = "2026-09-17T01:00:00.000Z";

function baseLlm(over: Partial<MarketingAgendaTransformerLlmOutput> = {}): MarketingAgendaTransformerLlmOutput {
  return {
    targetTravelerKo: "푸꾸옥 외부관광형 여행자",
    travelerProblemKo: "리조트 선택지가 늘 때 숙소 위치를 어떻게 판단해야 하는가?",
    decisionAtStakeKo: "시내 접근성 우선 vs 프라이빗 휴양 우선",
    audienceTensionKo: "편의 vs 한적함",
    readerPayoffKo: "입지 기준을 스스로 판별한다",
    marketingStorySeedKo: "공급 증가 국면에서 리조트 입지 판단 시드",
    whyNowKo: "호텔 공급 확대 관측",
    researchQuestionsKo: ["입지 기준은?"],
    nonGoalsKo: ["특정 호텔 홍보"],
    genericRiskKo: "low",
    storyArchetypeHint: "decision_rule",
    freshnessClass: "timely",
    signalSummaryKo: "푸꾸옥 호텔 공급 증가",
    limitations: [],
    ...over,
  };
}

function compactCand(id: string, score = 0.8): CompactManagerAgendaCandidate {
  return {
    agendaCandidateId: id,
    researchBriefId: `brief_${id}`,
    title: "호텔 쏟아지는 푸꾸옥",
    summary: "남부 중심으로 호텔과 인프라 개발이 이어진다",
    destinations: ["푸꾸옥"],
    topics: ["resort"],
    entities: [],
    signalTypes: ["news"],
    publishedAt: null,
    observedAt: NOW,
    freshnessScore: 0.7,
    credibilityScore: 0.7,
    travelRelevanceScore: 0.7,
    publicInterestScore: 0.6,
    commercialRelevanceScore: 0.6,
    seasonalityScore: 0.5,
    corroborationScore: 0.5,
    noveltyScore: 0.5,
    koreanOutboundRelevanceScore: 0.7,
    totalResearchScore: score,
    researchScoreComponents: null,
    scoreReasons: [],
    riskFlags: [],
    matchedProductIds: [],
    evidence: [],
    candidateStatus: "ready",
  };
}

function v1Slate(date: string): DailyAgendaSlate {
  return {
    contract: "daily-agenda-slate",
    slateId: `das_${date}`,
    runId: `run_${date}`,
    logicalRunKey: `key_${date}`,
    routineId: "daily_marketing",
    businessDateKst: date,
    correlationId: "corr",
    status: "ready_for_human_selection",
    targetSize: 6,
    candidates: [
      {
        contract: "daily-agenda-slate-item",
        slateItemId: "si1",
        agendaCandidateId: "a1",
        researchBriefId: "b1",
        state: "ready",
        origin: "organic_research",
        title: "호텔 쏟아지는 푸꾸옥",
        summary: "남부 중심으로 호텔과 인프라 개발이 이어진다",
        score: 0.8,
        scoreReasons: [],
        riskFlags: [],
        destinations: ["푸꾸옥"],
        topics: ["resort"],
        entities: [],
        evidenceSummary: "",
        audienceHint: null,
        recommendedChannel: null,
        recommendedFormats: [],
        matchedProductIds: [],
        canonicalArticleIds: [],
        editorial: null,
        researchSnapshot: null,
        deferredFromSlateItemId: null,
        deferredFromBusinessDateKst: null,
        rationale: null,
      },
    ],
    curation: { mode: "hybrid", notes: [] },
    cooldown: { applied: false, reasons: [] },
    researchStatus: "ok",
    degraded: false,
    observability: {},
    metadata: {},
    createdAt: NOW,
    updatedAt: NOW,
  } as unknown as DailyAgendaSlate;
}

describe("AGENDA_QUALITY_V2 Phase4C evidence guard", () => {
  it("regulatory assertion without explicit evidence cannot pass", () => {
    const result = transformMarketingAgendaFromLlmOutput({
      input: {
        originalTitle: "영국-아일랜드 여행 팁",
        originalSummary: "공동여행구역을 이용하는 여행자가 늘고 있다",
        sourceTypes: ["news"],
      },
      llm: baseLlm({
        travelerProblemKo: "영국과 아일랜드 이동 시 신분증 규정이 바뀌었다",
        decisionAtStakeKo: "어떤 공식 신분증을 필수로 지참해야 하는지 결정",
        marketingStorySeedKo: "신분증 규정 변경점을 확인해야 한다",
        whyNowKo: "요건이 변경되었다",
        signalSummaryKo: "신분증 규정이 바뀌었다",
      }),
      nowIso: NOW,
    });
    // Either reframed to research question (valid) or rejected.
    if (result.transformStatus === "invalid") {
      expect(result.transformFailureReason).toBe("unsupported_sensitive_claim");
    } else {
      expect(result.candidate?.traveler.travelerProblemKo).toMatch(/\?|확인|검증|가설|ED-2/);
      expect(textContainsSensitiveAssertion(result.candidate!.traveler.travelerProblemKo)).toBe(
        false,
      );
    }
  });

  it("research-question framing can pass", () => {
    const result = transformMarketingAgendaFromLlmOutput({
      input: {
        originalTitle: "영국-아일랜드 여행 팁",
        originalSummary: "공동여행구역을 이용하는 여행자가 늘고 있다",
        sourceTypes: ["news"],
      },
      llm: baseLlm({
        targetTravelerKo: "영국-아일랜드를 잇달아 방문하는 한국인 여행자",
        travelerProblemKo:
          "영국-아일랜드 이동을 계획한다면, 현재 신분증 요건을 출발 전 다시 확인해야 하는 상황인가?",
        decisionAtStakeKo:
          "출발 전 공식 신분증 재확인을 일정에 고정할지 선택할지, 현지 도착 후 유연하게 대응할지 결정",
        audienceTensionKo: "자유로운 이동 인식 vs 현장 서류 누락 리스크",
        readerPayoffKo: "출국 전 확인 체크리스트를 스스로 구성할 수 있다",
        marketingStorySeedKo:
          "CTA 구간 이동 전, 신분증 요건을 사실로 단정하지 않고 재확인하는 의사결정 시드",
        whyNowKo: "공동여행구역 이용 증가 관측 — 구체 요건은 ED-2 사실 확인",
        signalSummaryKo: "영국-아일랜드 이동 수요 관측",
        researchQuestionsKo: ["현재 공식 신분증 요건은 무엇인가?"],
      }),
      nowIso: NOW,
    });
    expect(result.transformStatus).toBe("valid");
    expect(result.transformFailureReason).toBeNull();
  });

  it("ordinary non-sensitive decision framing unaffected", () => {
    const result = transformMarketingAgendaFromLlmOutput({
      input: {
        originalTitle: "호텔 쏟아지는 푸꾸옥",
        originalSummary: "남부 중심으로 호텔과 인프라 개발이 이어진다",
        sourceTypes: ["news"],
      },
      llm: baseLlm(),
      nowIso: NOW,
    });
    expect(result.transformStatus).toBe("valid");
  });

  it("enforce policy reframes or rejects without external research", () => {
    const enforced = enforceEvidenceSensitiveClaimPolicy({
      input: {
        originalTitle: "팁",
        originalSummary: "여행 수요 증가",
        sourceTypes: ["news"],
      },
      llm: baseLlm({
        travelerProblemKo: "비자 규정이 바뀌었다",
        decisionAtStakeKo: "비자가 필수이다",
      }),
    });
    if (enforced.ok) {
      expect(enforced.reframed).toBe(true);
      expect(enforced.llm.limitations.some((l) => l.includes("sensitive_claim_reframed"))).toBe(
        true,
      );
    } else {
      expect(enforced.reason).toBe("unsupported_sensitive_claim");
    }
  });
});

describe("AGENDA_QUALITY_V2 Phase4C artifact lifecycle + rerun", () => {
  it("persisted DEFERRED appears in artifact with presentedCount", async () => {
    const tmp = await fs.mkdtemp(path.join(os.tmpdir(), "aqv2-4c-"));
    const reservoir = createInMemoryDurableAgendaReservoir();
    const result = await runAgendaQualityV2LiveShadowSafe({
      businessDateKst: "2026-09-17",
      v1Slate: v1Slate("2026-09-17"),
      agendaCandidates: [compactCand("a1", 0.9)],
      deps: {
        env: { AGENDA_QUALITY_V2_SHADOW_ENABLED: "true" },
        invoke: createInjectableAgendaTransformerInvoke(async () => JSON.stringify(baseLlm())),
        reservoir,
        transformCache: createInMemoryAgendaTransformCache(),
        forceMemory: true,
        writeArtifacts: true,
        cwd: tmp,
        nowIso: NOW,
        runType: "SCHEDULED",
        runId: "sched-1",
      },
    });
    expect(result.snapshot.status).toBe("ok");
    expect(result.snapshot.slate[0]?.reservoir?.lifecycleStatus).toBe("DEFERRED");
    expect(result.snapshot.slate[0]?.reservoir?.presentedCount).toBeGreaterThanOrEqual(1);
    expect(result.snapshot.slate[0]?.reservoir?.deferredAt).toBeTruthy();
    const stored = await reservoir.get(String(result.snapshot.slate[0]?.agendaId));
    expect(stored?.status).toBe("DEFERRED");
    expect(stored?.presentedCount).toBe(result.snapshot.slate[0]?.reservoir?.presentedCount);
  });

  it("manual same-date rerun does not silently overwrite scheduled canonical", async () => {
    const tmp = await fs.mkdtemp(path.join(os.tmpdir(), "aqv2-4c-rerun-"));
    const obsX = {
      agendaId: "x",
      source: {
        sourceTitle: "x",
        sourceSummary: null,
        sourceType: null,
        sourceUrl: null,
        sourceId: "x",
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
        transformRevision: "agenda-transform-v1",
        transformerContractVersion: "marketing-agenda-candidate-v2",
        promptVersion: "agenda-transform-prompt-v1",
        roleKey: "marketing_agenda_transformer",
        provider: null,
        model: null,
        routeSource: null,
        transformStatus: null,
        transformFailureReason: null,
        transformCacheHit: false,
      },
      scoring: { signalQualityScore: 1, marketingQualityScore: 1, totalScore: 1, qualityTier: "STRONG" },
      penalties: null,
      reservoir: {
        lifecycleStatus: "DEFERRED",
        origin: "NEW" as const,
        firstQualifiedAt: null,
        lastPresentedAt: null,
        presentedCount: 1,
        deferredAt: NOW,
        expiresAt: null,
        carriedFromDate: null,
      },
      selection: {
        eligible: true,
        selectedIntoSlate: true,
        finalRank: 1,
        inclusionReason: "test",
        exclusionReason: null,
      },
    };
    const base: LiveShadowDailySnapshot = {
      contract: "agenda-quality-v2-live-shadow-snapshot",
      qualityVersion: "v2",
      shadow: true,
      businessDateKst: "2026-09-17",
      generatedAt: NOW,
      runId: "sched-1",
      runType: "SCHEDULED",
      status: "ok",
      blockerReason: null,
      failureReason: null,
      durationMs: 1,
      validation: {
        validationId: "aqv2-live-20260917-20260921",
        validationConfigFingerprint: "test-fp",
        validationConfigStatus: "MATCH",
        configDriftFields: [],
        runType: "SCHEDULED",
        businessDate: "2026-09-17",
        createdAt: NOW,
        codeRevision: null,
      },
      source: {
        rawCandidateCount: 1,
        transformedCount: 1,
        transformCacheHits: 0,
        transformFailures: 0,
        llmCallCount: 1,
        maxTransforms: 12,
      },
      v2: {
        strongCount: 1,
        publishableCount: 0,
        weakCount: 0,
        rejectCount: 0,
        slateCount: 1,
        newCount: 1,
        carryoverCount: 0,
      },
      allCandidates: [obsX],
      slate: [obsX],
      rejectedOrExcluded: [],
      rejected: [],
      comparison: {
        v1Count: 1,
        v2Count: 1,
        v1NewsLikeDropped: [],
        repeatedTopicsDropped: [],
        carryoverResurfaced: [],
      },
      observability: {
        roleKey: "marketing_agenda_transformer",
        routeSource: null,
        selectedProviderId: null,
        selectedModelId: null,
        configuredRoute: [],
        availableRoute: [],
        reservoirBackend: "memory_test",
        productionLiveShadowReady: true,
      },
      humanReview: null,
      humanReviewPreference: null,
    };

    const first = await writeLiveShadowArtifacts({ snapshot: base, cwd: tmp });
    expect(first.wroteCanonical).toBe(true);

    const obsY = {
      ...obsX,
      agendaId: "y",
      reservoir: { ...obsX.reservoir, origin: "CARRYOVER" as const },
    };
    const manual = await writeLiveShadowArtifacts({
      snapshot: {
        ...base,
        runId: "manual-2",
        runType: "MANUAL_RERUN",
        generatedAt: "2026-09-17T02:00:00.000Z",
        allCandidates: [obsY],
        slate: [obsY],
      },
      cwd: tmp,
    });
    expect(manual.wroteCanonical).toBe(false);
    expect(manual.wroteRerun).toBe(true);
    expect(manual.jsonPath).toContain(`${path.sep}reruns${path.sep}2026-09-17${path.sep}`);

    const canonical = await readLiveShadowCanonicalSnapshot({
      businessDateKst: "2026-09-17",
      cwd: tmp,
    });
    expect(canonical?.runId).toBe("sched-1");
    expect(canonical?.slate[0]?.agendaId).toBe("x");
  });

  it("rollup uses scheduled canonical and marks manual recovery", async () => {
    const tmp = await fs.mkdtemp(path.join(os.tmpdir(), "aqv2-4c-rollup-"));
    const scheduled: LiveShadowDailySnapshot = {
      contract: "agenda-quality-v2-live-shadow-snapshot",
      qualityVersion: "v2",
      shadow: true,
      businessDateKst: "2026-09-17",
      generatedAt: NOW,
      runId: "sched-1",
      runType: "SCHEDULED",
      status: "ok",
      blockerReason: null,
      failureReason: null,
      durationMs: 1,
      validation: {
        validationId: "aqv2-live-20260917-20260921",
        validationConfigFingerprint: "test-fp",
        validationConfigStatus: "MATCH",
        configDriftFields: [],
        runType: "SCHEDULED",
        businessDate: "2026-09-17",
        createdAt: NOW,
        codeRevision: null,
      },
      source: {
        rawCandidateCount: 1,
        transformedCount: 1,
        transformCacheHits: 0,
        transformFailures: 0,
        llmCallCount: 1,
        maxTransforms: 12,
      },
      v2: {
        strongCount: 1,
        publishableCount: 0,
        weakCount: 0,
        rejectCount: 0,
        slateCount: 2,
        newCount: 2,
        carryoverCount: 0,
      },
      allCandidates: [],
      slate: [],
      rejectedOrExcluded: [],
      rejected: [],
      comparison: {
        v1Count: 6,
        v2Count: 2,
        v1NewsLikeDropped: [],
        repeatedTopicsDropped: [],
        carryoverResurfaced: [],
      },
      observability: {
        roleKey: "marketing_agenda_transformer",
        routeSource: null,
        selectedProviderId: null,
        selectedModelId: null,
        configuredRoute: [],
        availableRoute: [],
        reservoirBackend: "memory_test",
        productionLiveShadowReady: true,
      },
      humanReview: null,
      humanReviewPreference: null,
    };
    await writeLiveShadowArtifacts({ snapshot: scheduled, cwd: tmp });
    await writeLiveShadowArtifacts({
      snapshot: {
        ...scheduled,
        businessDateKst: "2026-09-18",
        runType: "MANUAL_RERUN",
        runId: "manual-only",
        generatedAt: "2026-09-18T03:00:00.000Z",
        validation: {
          ...scheduled.validation,
          runType: "MANUAL_RERUN",
          businessDate: "2026-09-18",
          createdAt: "2026-09-18T03:00:00.000Z",
        },
      },
      cwd: tmp,
    });

    const loaded = await loadFiveDayLiveShadowObservations({
      dates: ["2026-09-17", "2026-09-18", "2026-09-19"],
      cwd: tmp,
    });
    expect(loaded.rollup.dayStatuses[0]?.status).toBe("SCHEDULED");
    expect(loaded.rollup.dayStatuses[1]?.status).toBe("RECOVERED_MANUALLY");
    expect(loaded.rollup.dayStatuses[2]?.status).toBe("MISSING");
    expect(buildFiveDayLiveShadowRollup(loaded.snapshots).metrics.avgSlateSize).toBeGreaterThan(0);
  });
});

describe("AGENDA_QUALITY_V2 Phase4C provider env visibility", () => {
  it("available route derived from credential presence without logging secrets", () => {
    const full = resolveAgendaTransformerRouteVisibility({
      GOOGLE_GENERATIVE_AI_API_KEY: "secret-gemini-value-aaa",
      OPENROUTER_API_KEY: "secret-openrouter-value-bbb",
      NVIDIA_API_KEY: "secret-nvidia-value-ccc",
    });
    expect(full.configuredRoute.length).toBe(4);
    expect(full.availableRoute).toEqual(full.configuredRoute);
    expect(full.providers.every((p) => p.routeUsable)).toBe(true);

    const geminiOnly = resolveAgendaTransformerRouteVisibility({
      GOOGLE_GENERATIVE_AI_API_KEY: "secret-gemini-value-aaa",
    });
    expect(geminiOnly.availableRoute).toEqual([
      "gemini-flash-lite-primary",
      "gemini-flash-lite-secondary",
    ]);
    expect(geminiOnly.providers.find((p) => p.provider === "openrouter")?.routeUsable).toBe(false);
    expect(geminiOnly.providers.find((p) => p.provider === "nvidia")?.routeUsable).toBe(false);
    expect(geminiOnly.providers.find((p) => p.provider === "gemini-secondary")?.routeUsable).toBe(
      true,
    );

    const serialized = JSON.stringify(full);
    expect(serialized).not.toMatch(/OPENROUTER_API_KEY=|NVIDIA_API_KEY=|GOOGLE_GENERATIVE/);
    expect(serialized).not.toContain("secret-gemini-value-aaa");
    expect(serialized).not.toContain("secret-openrouter-value-bbb");
    expect(serialized).not.toContain("secret-nvidia-value-ccc");
  });
});

describe("AGENDA_QUALITY_V2 Phase4C candidate validator helpers", () => {
  it("validateSensitiveClaimsForCandidate flags unsupported assertion", () => {
    const candidate = assembleMarketingAgendaCandidateV2({
      input: {
        originalTitle: "여행 팁",
        originalSummary: "수요 증가",
        sourceTypes: ["news"],
      },
      llm: baseLlm({
        travelerProblemKo: "입국 규정이 바뀌었다",
        decisionAtStakeKo: "비자가 필수이다",
      }),
      nowIso: NOW,
    });
    const result = validateSensitiveClaimsForCandidate({
      input: {
        originalTitle: "여행 팁",
        originalSummary: "수요 증가",
        sourceTypes: ["news"],
      },
      candidate,
    });
    expect(result.status).toBe("EVIDENCE_REQUIRED");
  });
});
