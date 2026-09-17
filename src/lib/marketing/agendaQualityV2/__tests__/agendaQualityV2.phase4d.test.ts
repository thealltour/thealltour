/**
 * Phase 4D — validation observability freeze (artifacts / manifest / drift / rollup).
 * Does not change scoring or transformer semantics.
 */

import { describe, expect, it } from "vitest";
import { promises as fs } from "node:fs";
import os from "node:os";
import path from "node:path";
import {
  buildObservationFromReservoirScore,
  buildSourceObservationFromCompact,
  buildTransformFailureObservation,
  mapExclusionReason,
} from "@/lib/marketing/agendaQualityV2/shadow/candidateObservation";
import {
  formatLiveShadowMarkdown,
  writeLiveShadowArtifacts,
  readLiveShadowCanonicalSnapshot,
  type LiveShadowDailySnapshot,
} from "@/lib/marketing/agendaQualityV2/shadow/liveShadowArtifacts";
import {
  assertFormalValidationConfigMatchesKnownFreeze,
  evaluateValidationConfigStatus,
  fingerprintAgendaQualityV2ValidationConfig,
  snapshotAgendaQualityV2ValidationSensitiveConfig,
  writeValidationManifestIfAbsent,
  AGENDA_QUALITY_V2_VALIDATION_ID,
  AGENDA_QUALITY_V2_VALIDATION_START,
  AGENDA_QUALITY_V2_VALIDATION_END,
} from "@/lib/marketing/agendaQualityV2/shadow/validationManifest";
import {
  buildFiveDayLiveShadowRollup,
  loadFiveDayLiveShadowObservations,
} from "@/lib/marketing/agendaQualityV2/shadow/fiveDayReview";
import {
  createReservoirItemFromQualified,
} from "@/lib/marketing/agendaQualityV2/reservoir/types";
import { assembleMarketingAgendaCandidateV2 } from "@/lib/marketing/agendaQualityV2/transformer/transform";
import { scoreMarketingAgendaV2 } from "@/lib/marketing/agendaQualityV2/scoring/storyabilityScore";
import { assessAgendaReuse } from "@/lib/marketing/agendaQualityV2/memory/reuseDetection";
import type { CompactManagerAgendaCandidate } from "@/lib/marketing/research/manager/types";
import type { MarketingAgendaTransformerLlmOutput } from "@/lib/marketing/agendaQualityV2/contracts";
import { goodLlmEditorial } from "@/lib/marketing/agendaQualityV2/__tests__/testHelpers";

const NOW = "2026-09-17T00:05:00.000Z";

function baseLlm(
  over: Partial<MarketingAgendaTransformerLlmOutput> = {},
): MarketingAgendaTransformerLlmOutput {
  return goodLlmEditorial({
    targetTravelerKo: "자유여행자",
    travelerProblemKo: "환불 규정 변화 때 예약을 지금 확정할지 어떻게 판단할까?",
    decisionAtStakeKo: "지금 예약할지 기다릴지 선택",
    audienceTensionKo: "가격 vs 유연성",
    readerPayoffKo: "결정 기준 체크리스트",
    marketingStorySeedKo: "환불 정책 변화 속 예약 타이밍 결정",
    whyNowKo: "성수기 직전 규정 변경 관측",
    researchQuestionsKo: ["어느 항공사가 적용되나?"],
    nonGoalsKo: ["특정 항공사 홍보"],
    genericRiskKo: "low",
    storyArchetypeHint: "before_you_book",
    signalSummaryKo: "환불 정책 변경 보도",
    limitations: [],
    ...over,
  });
}

function compactCand(
  overrides: Partial<CompactManagerAgendaCandidate> = {},
): CompactManagerAgendaCandidate {
  return {
    agendaCandidateId: "cand-1",
    researchBriefId: "brief-1",
    title: "원본 소스 제목",
    summary: "원본 요약 — 환불 정책이 바뀌었다는 사실만 있음",
    destinations: [],
    topics: [],
    entities: [],
    signalTypes: ["news"],
    publishedAt: "2026-09-16T09:00:00.000Z",
    observedAt: "2026-09-16T10:00:00.000Z",
    freshnessScore: 0.7,
    credibilityScore: 0.7,
    travelRelevanceScore: 0.7,
    publicInterestScore: 0.6,
    commercialRelevanceScore: 0.6,
    seasonalityScore: 0.5,
    corroborationScore: 0.5,
    noveltyScore: 0.5,
    koreanOutboundRelevanceScore: 0.7,
    totalResearchScore: 0.8,
    researchScoreComponents: null,
    scoreReasons: [],
    riskFlags: [],
    matchedProductIds: [],
    evidence: [
      {
        evidenceId: "e1",
        sourceId: "s1",
        sourceType: "news",
        sourceName: "example",
        isOfficial: false,
        evidenceType: "article",
        url: "https://example.com/a",
        reference: null,
        excerpt: null,
        publishedAt: null,
        observedAt: "2026-09-16T10:00:00.000Z",
      },
    ],
    candidateStatus: "ready",
    ...overrides,
  };
}

function makeQualifiedItem() {
  const candidate = assembleMarketingAgendaCandidateV2({
    input: {
      originalTitle: "원본 소스 제목",
      originalSummary: "원본 요약 — 환불 정책이 바뀌었다는 사실만 있음",
      sourceTypes: ["news"],
      sourceFingerprint: "src-fp-1",
      sourceCredibility: 0.7,
      sourceFreshness: 0.7,
      koreanTravelerRelevance: 0.7,
      observedAt: "2026-09-16T10:00:00.000Z",
      sourceCandidateIds: ["cand-1"],
      sourceBriefIds: ["brief-1"],
    },
    llm: baseLlm(),
    transformModel: "test-model",
    nowIso: NOW,
  });
  return createReservoirItemFromQualified(candidate, NOW);
}

function makeSnapshot(
  partial: Partial<LiveShadowDailySnapshot> & {
    businessDateKst: string;
    runType: LiveShadowDailySnapshot["runType"];
  },
): LiveShadowDailySnapshot {
  return {
    contract: "agenda-quality-v2-live-shadow-snapshot",
    qualityVersion: "v2",
    shadow: true,
    generatedAt: NOW,
    runId: "run-1",
    status: "ok",
    blockerReason: null,
    failureReason: null,
    durationMs: 1,
    validation: {
      validationId: AGENDA_QUALITY_V2_VALIDATION_ID,
      validationConfigFingerprint: "fp-test",
      validationConfigStatus: "MATCH",
      configDriftFields: [],
      runType: partial.runType,
      businessDate: partial.businessDateKst,
      createdAt: NOW,
      codeRevision: null,
    },
    source: {
      rawCandidateCount: 2,
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
      rejectCount: 1,
      slateCount: 1,
      newCount: 1,
      carryoverCount: 0,
    },
    allCandidates: [],
    slate: [],
    rejectedOrExcluded: [],
    rejected: [],
    comparison: {
      v1Count: 4,
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
    ...partial,
  };
}

describe("AGENDA_QUALITY_V2 Phase4D artifact completeness", () => {
  it("selected row includes source + transform + provenance; missing fields null not fabricated", () => {
    const cand = compactCand({ summary: "" });
    const source = buildSourceObservationFromCompact(cand);
    expect(source.sourceTitle).toBe("원본 소스 제목");
    expect(source.sourceSummary).toBeNull();
    expect(source.transformInputExcerpt).toContain("원본 소스 제목");
    expect(source.sourceUrl).toBe("https://example.com/a");

    const item = makeQualifiedItem();
    const reuse = assessAgendaReuse({
      candidate: {
        agendaId: item.agendaId,
        sourceFingerprint: item.sourceFingerprint,
        topicFingerprint: item.topicFingerprint,
        decisionAxisFingerprint: item.decisionAxisFingerprint,
        storySeedFingerprint: item.storySeedFingerprint,
        signalSummaryKo: item.candidate.signalContext.signalSummaryKo,
        whyNowKo: item.candidate.editorial.whyNowKo,
      },
      history: [],
      nowIso: NOW,
    });
    const score = scoreMarketingAgendaV2({
      candidate: item.candidate,
      reuse,
      presentedCount: 0,
      lastPresentedAt: null,
      nowIso: NOW,
    });
    const obs = buildObservationFromReservoirScore({
      item,
      score,
      origin: "NEW",
      carriedFromDate: null,
      selectedIntoSlate: true,
      finalRank: 1,
      inclusionReason: "strong",
      exclusionReason: null,
      sourceFallback: source,
      provider: "gemini",
      model: "test-model",
      routeSource: "role_override",
      transformCacheHit: false,
    });
    expect(obs.source.sourceTitle).toBe("원본 소스 제목");
    expect(obs.transform?.whyNowKo).toBe("성수기 직전 규정 변경 관측");
    expect(obs.transform?.researchQuestionsKo).toEqual(["어느 항공사가 적용되나?"]);
    expect(obs.provenance.storySeedFingerprint).toBeTruthy();
    expect(obs.scoring?.totalScore).toBeTypeOf("number");
    expect(obs.penalties).not.toBeNull();
    expect(obs.reservoir?.origin).toBe("NEW");
    expect(obs.selection.selectedIntoSlate).toBe(true);
  });

  it("rejected/excluded preserves transform + reason; full pool stored; slate derivable", () => {
    const source = buildSourceObservationFromCompact(compactCand());
    const item = makeQualifiedItem();
    const reuse = assessAgendaReuse({
      candidate: {
        agendaId: item.agendaId,
        sourceFingerprint: item.sourceFingerprint,
        topicFingerprint: item.topicFingerprint,
        decisionAxisFingerprint: item.decisionAxisFingerprint,
        storySeedFingerprint: item.storySeedFingerprint,
      },
      history: [],
      nowIso: NOW,
    });
    const score = scoreMarketingAgendaV2({
      candidate: item.candidate,
      reuse,
      presentedCount: 0,
      lastPresentedAt: null,
      nowIso: NOW,
    });
    const selected = buildObservationFromReservoirScore({
      item,
      score,
      origin: "NEW",
      carriedFromDate: null,
      selectedIntoSlate: true,
      finalRank: 1,
      inclusionReason: "strong",
      exclusionReason: null,
      sourceFallback: source,
    });
    const capped = buildObservationFromReservoirScore({
      item: { ...item, agendaId: "cap-2" },
      score: { ...score, totalScore: score.totalScore - 0.01 },
      origin: "NEW",
      carriedFromDate: null,
      selectedIntoSlate: false,
      finalRank: null,
      inclusionReason: null,
      exclusionReason: "slate_max_cap",
      sourceFallback: source,
    });
    const failed = buildTransformFailureObservation({
      cand: compactCand({ agendaCandidateId: "fail-1", title: "실패 소스" }),
      sourceFingerprint: "fp-fail",
      failureReason: "unsupported_sensitive_claim",
    });
    expect(mapExclusionReason("slate_max_cap")).toBe("slate_max_cap");
    expect(failed.selection.exclusionReason).toBe("unsupported_sensitive_claim");
    expect(failed.transform).toBeNull();
    expect(capped.transform?.marketingStorySeedKo).toBeTruthy();

    const allCandidates = [selected, capped, failed];
    const slate = allCandidates.filter((c) => c.selection.selectedIntoSlate);
    expect(slate).toHaveLength(1);
    expect(allCandidates).toHaveLength(3);
    expect(capped.selection.exclusionReason).toBe("slate_max_cap");

    const md = formatLiveShadowMarkdown(
      makeSnapshot({
        businessDateKst: "2026-09-17",
        runType: "SCHEDULED",
        allCandidates,
        slate,
        rejectedOrExcluded: allCandidates.filter((c) => !c.selection.selectedIntoSlate),
      }),
    );
    expect(md).toContain("## V2 Slate");
    expect(md).toContain("## Excluded / Rejected");
    expect(md).toContain("validationId:");
    expect(md).not.toContain("decisionAxisFingerprint");
  });
});

describe("AGENDA_QUALITY_V2 Phase4D manifest + fingerprint + drift", () => {
  it("freeze matches known Phase 4C calibrated values", () => {
    const check = assertFormalValidationConfigMatchesKnownFreeze();
    expect(check).toEqual({ ok: true });
  });

  it("fingerprint stable for same config; threshold/prompt change fingerprint; timestamps ignored", () => {
    const a = snapshotAgendaQualityV2ValidationSensitiveConfig();
    const b = snapshotAgendaQualityV2ValidationSensitiveConfig();
    expect(fingerprintAgendaQualityV2ValidationConfig(a)).toBe(
      fingerprintAgendaQualityV2ValidationConfig(b),
    );
    const changedThreshold = {
      ...a,
      thresholds: { ...a.thresholds, strong: 0.99 },
    };
    expect(fingerprintAgendaQualityV2ValidationConfig(changedThreshold)).not.toBe(
      fingerprintAgendaQualityV2ValidationConfig(a),
    );
    const changedPrompt = {
      ...a,
      promptVersion: "agenda-transform-prompt-v9" as typeof a.promptVersion,
    };
    expect(fingerprintAgendaQualityV2ValidationConfig(changedPrompt)).not.toBe(
      fingerprintAgendaQualityV2ValidationConfig(a),
    );
  });

  it("manifest create-once; mismatch does not overwrite; MATCH vs DRIFT", async () => {
    const tmp = await fs.mkdtemp(path.join(os.tmpdir(), "aqv2-4d-manifest-"));
    const first = await writeValidationManifestIfAbsent({
      cwd: tmp,
      createdAt: NOW,
      gitHead: "abc",
      workingTreeDirty: true,
      env: { AGENDA_QUALITY_V2_SHADOW_ENABLED: "on" },
    });
    expect(first.status).toBe("created");
    expect(first.manifest.validationId).toBe(AGENDA_QUALITY_V2_VALIDATION_ID);
    expect(first.manifest.formalStartDate).toBe(AGENDA_QUALITY_V2_VALIDATION_START);
    expect(first.manifest.formalEndDate).toBe(AGENDA_QUALITY_V2_VALIDATION_END);
    expect(first.manifest.day0Excluded).toBe("2026-09-16");
    expect(first.manifest.config.thresholds.strong).toBe(0.72);

    const second = await writeValidationManifestIfAbsent({
      cwd: tmp,
      createdAt: "2099-01-01T00:00:00.000Z",
      env: { AGENDA_QUALITY_V2_SHADOW_ENABLED: "on" },
    });
    expect(second.status).toBe("unchanged");
    if (second.status === "unchanged") {
      expect(second.manifest.createdAt).toBe(NOW);
    }

    const match = evaluateValidationConfigStatus({
      manifest: first.manifest,
      env: {},
    });
    expect(match.validationConfigStatus).toBe("MATCH");
    expect(match.configDriftFields).toEqual([]);

    const driftedManifest = {
      ...first.manifest,
      validationConfigFingerprint: "wrong",
      config: {
        ...first.manifest.config,
        thresholds: { ...first.manifest.config.thresholds, strong: 0.99 },
      },
    };
    const drift = evaluateValidationConfigStatus({
      manifest: driftedManifest,
      env: {},
    });
    expect(drift.validationConfigStatus).toBe("DRIFT");
    expect(drift.configDriftFields).toContain("thresholds.strong");

    const planted = {
      ...first.manifest,
      validationConfigFingerprint: "planted-different",
      config: {
        ...first.manifest.config,
        thresholds: { ...first.manifest.config.thresholds, publishable: 0.99 },
      },
    };
    await fs.writeFile(
      path.join(tmp, "artifacts/agenda-quality-v2/live-shadow/validation-editorial-v2a-2026-09-18_2026-09-22.json"),
      JSON.stringify(planted, null, 2),
      "utf8",
    );
    const mismatch = await writeValidationManifestIfAbsent({
      cwd: tmp,
      env: { AGENDA_QUALITY_V2_SHADOW_ENABLED: "on" },
    });
    expect(mismatch.status).toBe("mismatch");
    const onDisk = JSON.parse(
      await fs.readFile(
        path.join(tmp, "artifacts/agenda-quality-v2/live-shadow/validation-editorial-v2a-2026-09-18_2026-09-22.json"),
        "utf8",
      ),
    );
    expect(onDisk.validationConfigFingerprint).toBe("planted-different");
  });
});

describe("AGENDA_QUALITY_V2 Phase4D rerun + rollup", () => {
  it("scheduled canonical preserved; manual rerun separate; drift day marked", async () => {
    const tmp = await fs.mkdtemp(path.join(os.tmpdir(), "aqv2-4d-rollup-"));
    const selected = {
      agendaId: "a1",
      source: buildSourceObservationFromCompact(compactCand()),
      transform: {
        targetTravelerKo: "t",
        travelerProblemKo: "p",
        decisionAtStakeKo: "d",
        audienceTensionKo: "x",
        readerPayoffKo: "y",
        marketingStorySeedKo: "seed",
        whyNowKo: "now",
        researchQuestionsKo: ["q"],
        nonGoalsKo: [],
        genericRiskKo: "low",
        storyArchetypeHint: "other",
        editorialArchetype: "DECISION",
        whyInterestingKo: "why",
        curiosityHookKo: "hook",
        hiddenDetailKo: "detail",
        whyKoreanTravelerCaresKo: "kr",
        familiarReferenceKo: null,
        alternativeAppealKo: null,
        explorationPayoffKo: "explore",
        contentImaginabilityKo: "imagine",
        limitations: [],
        signalSummaryKo: "s",
        freshnessClass: "timely",
      },
      provenance: {
        sourceFingerprint: "sf",
        topicFingerprint: "tf",
        decisionAxisFingerprint: "da",
        storySeedFingerprint: "ss",
        transformRevision: "agenda-transform-v2",
        transformerContractVersion: "marketing-agenda-candidate-v2",
        promptVersion: "agenda-transform-prompt-v2",
        roleKey: "marketing_agenda_transformer",
        provider: null,
        model: null,
        routeSource: null,
        transformStatus: "valid" as const,
        transformFailureReason: null,
        transformCacheHit: false,
      },
      scoring: {
        signalQualityScore: 0.8,
        marketingQualityScore: 0.8,
        totalScore: 0.8,
        qualityTier: "STRONG",
      },
      penalties: {
        reusePenalty: 0,
        fatiguePenalty: 0,
        genericRiskPenalty: 0,
        staleTrendPenalty: 0,
        decisionRepeatPenalty: 0,
      },
      reservoir: {
        lifecycleStatus: "DEFERRED",
        origin: "NEW" as const,
        firstQualifiedAt: NOW,
        lastPresentedAt: NOW,
        presentedCount: 1,
        deferredAt: NOW,
        expiresAt: null,
        carriedFromDate: null,
      },
      selection: {
        eligible: true,
        selectedIntoSlate: true,
        finalRank: 1,
        inclusionReason: "strong",
        exclusionReason: null,
      },
    };

    const scheduled = makeSnapshot({
      businessDateKst: "2026-09-17",
      runType: "SCHEDULED",
      allCandidates: [selected],
      slate: [selected],
      rejectedOrExcluded: [],
    });
    const w1 = await writeLiveShadowArtifacts({ snapshot: scheduled, cwd: tmp });
    expect(w1.wroteCanonical).toBe(true);

    const manual = await writeLiveShadowArtifacts({
      snapshot: makeSnapshot({
        businessDateKst: "2026-09-17",
        runType: "MANUAL_RERUN",
        generatedAt: "2026-09-17T05:00:00.000Z",
        runId: "manual",
        allCandidates: [selected],
        slate: [selected],
      }),
      cwd: tmp,
    });
    expect(manual.wroteRerun).toBe(true);
    const canonical = await readLiveShadowCanonicalSnapshot({
      businessDateKst: "2026-09-17",
      cwd: tmp,
    });
    expect(canonical?.runId).toBe("run-1");

    await writeLiveShadowArtifacts({
      snapshot: makeSnapshot({
        businessDateKst: "2026-09-18",
        runType: "SCHEDULED",
        validation: {
          validationId: AGENDA_QUALITY_V2_VALIDATION_ID,
          validationConfigFingerprint: "fp-drift",
          validationConfigStatus: "DRIFT",
          configDriftFields: ["thresholds.strong"],
          runType: "SCHEDULED",
          businessDate: "2026-09-18",
          createdAt: NOW,
          codeRevision: null,
        },
        v2: {
          strongCount: 0,
          publishableCount: 0,
          weakCount: 0,
          rejectCount: 0,
          slateCount: 0,
          newCount: 0,
          carryoverCount: 0,
        },
        allCandidates: [],
        slate: [],
      }),
      cwd: tmp,
    });

    const loaded = await loadFiveDayLiveShadowObservations({
      dates: ["2026-09-17", "2026-09-18", "2026-09-19"],
      cwd: tmp,
    });
    expect(loaded.rollup.dayStatuses[0]?.status).toBe("SCHEDULED");
    expect(loaded.rollup.dayStatuses[0]?.formalSampleStatus).toBe("COMPARABLE");
    expect(loaded.rollup.dayStatuses[1]?.status).toBe("CONFIG_DRIFT");
    expect(loaded.rollup.dayStatuses[1]?.formalSampleStatus).toBe("CONFIG_DRIFT");
    expect(loaded.rollup.dayStatuses[2]?.status).toBe("MISSING");
    expect(loaded.rollup.configDriftDates).toContain("2026-09-18");
    expect(loaded.rollup.missingDates).toContain("2026-09-19");
    expect(loaded.rollup.validationId).toBe(AGENDA_QUALITY_V2_VALIDATION_ID);
    expect(
      buildFiveDayLiveShadowRollup(loaded.snapshots).metrics.avgV2SlateSize,
    ).toBeGreaterThanOrEqual(0);
  });
});
