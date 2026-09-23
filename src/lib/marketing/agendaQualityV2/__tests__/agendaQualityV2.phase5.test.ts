/**
 * Phase 5 — Marketing Editorial Reframe
 */
import { describe, expect, it } from "vitest";
import { promises as fs } from "node:fs";
import os from "node:os";
import path from "node:path";

import {
  AGENDA_QUALITY_V2_EDITORIAL_OBJECTIVE_VERSION,
  AGENDA_QUALITY_V2_PROMPT_VERSION,
  AGENDA_QUALITY_V2_PROMPT_VERSION_V1,
  AGENDA_QUALITY_V2_TRANSFORM_REVISION,
  AGENDA_QUALITY_V2_TRANSFORM_REVISION_V1,
} from "@/lib/marketing/agendaQualityV2/shadow/config";
import {
  transformMarketingAgendaFromLlmOutput,
  assembleMarketingAgendaCandidateV2,
} from "@/lib/marketing/agendaQualityV2/transformer/transform";
import { validateMarketingAgendaCandidateV2 } from "@/lib/marketing/agendaQualityV2/validate";
import { detectGenericAgendaRisk } from "@/lib/marketing/agendaQualityV2/genericRisk";
import { scoreMarketingAgendaV2 } from "@/lib/marketing/agendaQualityV2/scoring/storyabilityScore";
import { assessAgendaReuse } from "@/lib/marketing/agendaQualityV2/memory/reuseDetection";
import {
  buildAgendaTransformCacheKey,
  createInMemoryAgendaTransformCache,
} from "@/lib/marketing/agendaQualityV2/transformer/cache";
import {
  createReservoirItemFromQualified,
  isAgendaReservoirVersionCompatible,
  RESERVOIR_VERSION_INCOMPATIBLE_REASON,
} from "@/lib/marketing/agendaQualityV2/reservoir/types";
import { selectDailyAgendaSlateV2 } from "@/lib/marketing/agendaQualityV2/slate/selectDailySlateV2";
import {
  AGENDA_QUALITY_V2_VALIDATION_ID,
  AGENDA_QUALITY_V2_VALIDATION_ID_SUPERSEDED,
  AGENDA_QUALITY_V2_VALIDATION_ID_SUPERSEDED_DECISION,
  AGENDA_QUALITY_V2_VALIDATION_DATES,
  AGENDA_QUALITY_V2_SUPERSEDED_STATUS,
  fingerprintAgendaQualityV2ValidationConfig,
  markPriorValidationManifestSuperseded,
  snapshotAgendaQualityV2ValidationSensitiveConfig,
  writeValidationManifestIfAbsent,
  resolveValidationManifestPath,
  resolveSupersededValidationManifestPath,
} from "@/lib/marketing/agendaQualityV2/shadow/validationManifest";
import { MARKETING_AGENDA_TRANSFORMER_SYSTEM_PROMPT } from "@/lib/marketing/agendaQualityV2/transformer/prompt";
import { goodDiscoveryLlm, goodLlmEditorial } from "@/lib/marketing/agendaQualityV2/__tests__/testHelpers";
import { enforceEvidenceSensitiveClaimPolicy } from "@/lib/marketing/agendaQualityV2/transformer/evidenceSensitiveClaims";

const NOW = "2026-09-18T01:00:00.000Z";

describe("AGENDA_QUALITY_V2 Phase5 schema", () => {
  it("discovery Agenda valid without forced decisionAtStake", () => {
    const result = transformMarketingAgendaFromLlmOutput({
      input: {
        originalTitle: "a journey into living heritage and ethnic traditions",
        originalSummary: "Lang Son minority traditions and earth-wall houses",
        sourceTypes: ["tourism_board"],
        destinations: ["vietnam", "lang_son"],
      },
      llm: goodDiscoveryLlm(),
      nowIso: NOW,
    });
    expect(result.transformStatus).toBe("valid");
    expect(result.candidate?.editorial.editorialArchetype).toMatch(/DISCOVERY|CULTURAL|ALTERNATIVE/);
    expect(result.candidate?.traveler.decisionAtStakeKo.trim()).toBe("");
    expect(result.candidate?.editorial.curiosityHookKo.length).toBeGreaterThan(8);
  });

  it("decision Agenda still supports decision fields", () => {
    const result = transformMarketingAgendaFromLlmOutput({
      input: {
        originalTitle: "푸꾸옥 호텔 공급 증가",
        originalSummary: "호텔 공급 확대",
        sourceTypes: ["news"],
      },
      llm: goodLlmEditorial(),
      nowIso: NOW,
    });
    expect(result.transformStatus).toBe("valid");
    expect(result.candidate?.traveler.decisionAtStakeKo).toMatch(/숙소|위치|판단|선택/);
  });

  it("practical Agenda still evidence-guarded", () => {
    const guarded = enforceEvidenceSensitiveClaimPolicy({
      input: {
        originalTitle: "Bangladesh",
        originalSummary: "Official travel advice page updated",
        sourceTypes: ["fcdo"],
      },
      llm: goodLlmEditorial({
        editorialArchetype: "PRACTICAL",
        travelerProblemKo: "전자 입출국 카드가 필수로 바뀌었다",
        decisionAtStakeKo: "비자 신청 방식을 변경해야 한다",
        audienceTensionKo: "기존 절차 vs 새 요건",
        readerPayoffKo: "입국 준비 기준을 판단한다",
        marketingStorySeedKo: "방글라데시 입국 규정이 바뀌었다",
        whyInterestingKo: "입국 요건 변경 가능성",
        curiosityHookKo: "전자 입출국 카드가 필요할 수 있다",
        hiddenDetailKo: "비자/입국 카드 요건 변경 여부",
        whyKoreanTravelerCaresKo: "출발 전 확인이 필요한 실무 이슈",
        explorationPayoffKo: "공식 요건을 더 확인할 수 있다",
        contentImaginabilityKo: "체크리스트형 실무 콘텐츠",
      }),
    });
    // Assertive sensitive claims without source support must fail or reframe
    if (guarded.ok) {
      expect(guarded.reframed || /확인|가설|인가/.test(guarded.llm.marketingStorySeedKo)).toBe(true);
    } else {
      expect(guarded.reason).toBe("unsupported_sensitive_claim");
    }
  });
});

describe("AGENDA_QUALITY_V2 Phase5 transformer", () => {
  it("Lang Son fixture becomes discovery/curiosity, not ethics dilemma", () => {
    const result = transformMarketingAgendaFromLlmOutput({
      input: {
        originalTitle: "a journey into living heritage and ethnic traditions",
        originalSummary: "northern border minority traditions earth-wall houses",
        sourceTypes: ["tourism"],
      },
      llm: goodDiscoveryLlm(),
      nowIso: NOW,
    });
    expect(result.transformStatus).toBe("valid");
    const seed = result.candidate!.editorial.marketingStorySeedKo;
    expect(seed).toMatch(/랑선|흙담|소수민족|다낭|나트랑|베트남/);
    expect(seed).not.toMatch(/보존.*윤리|현지.*부담|사회적\s*책임/);
    expect(result.candidate!.traveler.decisionAtStakeKo.trim().length).toBe(0);
  });

  it("academic/moral default framing is rejected", () => {
    const findings = detectGenericAgendaRisk({
      originalTitle: "living heritage",
      travelerProblemKo: "보존과 관광 사이의 윤리를 어떻게 판단할까?",
      decisionAtStakeKo: "접근성과 보존 사이의 탐방 기준",
      audienceTensionKo: "현지 공동체에 미치는 부담",
      readerPayoffKo: "사회적 책임을 이해한다",
      marketingStorySeedKo: "문화 보존과 관광객 접근 사이의 균형",
      editorialArchetype: "DISCOVERY",
      whyInterestingKo: "진정성의 정의",
      curiosityHookKo: "지속가능성의 가치판단",
      hiddenDetailKo: "접근성·보존·현지 부담",
      contentImaginabilityKo: "학술 칼럼",
    });
    expect(findings.some((f) => f.code === "academic_moral_default")).toBe(true);
  });

  it("generic promotional rewrite fails", () => {
    const bad = transformMarketingAgendaFromLlmOutput({
      input: {
        originalTitle: "Best Tourism Villages",
        originalSummary: "UN Tourism best villages list",
        sourceTypes: ["tourism_board"],
      },
      llm: goodDiscoveryLlm({
        marketingStorySeedKo: "꼭 가봐야 할 숨은 명소",
        whyInterestingKo: "새롭고 특별하다",
        curiosityHookKo: "매력적이다",
        hiddenDetailKo: "특별하다",
        contentImaginabilityKo: "짧음",
        whyKoreanTravelerCaresKo: "흥미롭다",
        explorationPayoffKo: "가보고 싶다",
      }),
      nowIso: NOW,
    });
    expect(bad.transformStatus).toBe("invalid");
  });

  it("prompt role is travel marketing editorial agenda editor", () => {
    expect(MARKETING_AGENDA_TRANSFORMER_SYSTEM_PROMPT).toMatch(
      /TRAVEL MARKETING EDITORIAL AGENDA EDITOR/,
    );
    expect(MARKETING_AGENDA_TRANSFORMER_SYSTEM_PROMPT).toMatch(/ANTI-ACADEMIC|ANTI-MORALIZING/);
    expect(MARKETING_AGENDA_TRANSFORMER_SYSTEM_PROMPT).toMatch(/Decision framing is NOT universal/);
    expect(AGENDA_QUALITY_V2_PROMPT_VERSION).toBe("agenda-transform-prompt-v2.1");
  });
});

describe("AGENDA_QUALITY_V2 Phase5 scoring", () => {
  it("strong DISCOVERY can pass with low decision utility", () => {
    const candidate = assembleMarketingAgendaCandidateV2({
      input: {
        originalTitle: "lang son heritage",
        originalSummary: "earth-wall houses",
        sourceTypes: ["tourism"],
        sourceCredibility: 0.8,
        sourceFreshness: 0.8,
        koreanTravelerRelevance: 0.75,
      },
      llm: goodDiscoveryLlm(),
      nowIso: NOW,
    });
    const score = scoreMarketingAgendaV2({
      candidate,
      reuse: assessAgendaReuse({
        candidate: {
          agendaId: candidate.agendaId,
          sourceFingerprint: candidate.provenance.sourceFingerprint,
          topicFingerprint: candidate.provenance.topicFingerprint,
          decisionAxisFingerprint: candidate.provenance.decisionAxisFingerprint,
          storySeedFingerprint: null,
          signalSummaryKo: candidate.signalContext.signalSummaryKo,
          whyNowKo: candidate.editorial.whyNowKo,
        },
        history: [],
        nowIso: NOW,
      }),
      nowIso: NOW,
    });
    expect(score.dimensions.decisionUtility).toBeLessThan(0.55);
    expect(score.dimensions.curiosityStrength).toBeGreaterThan(0.4);
    expect(["STRONG", "PUBLISHABLE"]).toContain(score.qualityTier);
  });

  it("strong DECISION still passes for genuine decisions", () => {
    const candidate = assembleMarketingAgendaCandidateV2({
      input: {
        originalTitle: "푸꾸옥 호텔 공급",
        originalSummary: "공급 증가",
        sourceTypes: ["news"],
        sourceCredibility: 0.85,
        sourceFreshness: 0.8,
        koreanTravelerRelevance: 0.8,
      },
      llm: goodLlmEditorial(),
      nowIso: NOW,
    });
    const score = scoreMarketingAgendaV2({
      candidate,
      reuse: assessAgendaReuse({
        candidate: {
          agendaId: candidate.agendaId,
          sourceFingerprint: candidate.provenance.sourceFingerprint,
          topicFingerprint: candidate.provenance.topicFingerprint,
          decisionAxisFingerprint: candidate.provenance.decisionAxisFingerprint,
          storySeedFingerprint: null,
          signalSummaryKo: candidate.signalContext.signalSummaryKo,
          whyNowKo: candidate.editorial.whyNowKo,
        },
        history: [],
        nowIso: NOW,
      }),
      nowIso: NOW,
    });
    expect(score.dimensions.decisionUtility).toBeGreaterThan(0.5);
    expect(["STRONG", "PUBLISHABLE"]).toContain(score.qualityTier);
  });

  it("generic inspiration cannot pass via curiosity words alone", () => {
    const v = validateMarketingAgendaCandidateV2(
      assembleMarketingAgendaCandidateV2({
        input: {
          originalTitle: "Best Tourism Villages",
          originalSummary: "list",
          sourceTypes: ["tourism"],
        },
        llm: goodDiscoveryLlm({
          marketingStorySeedKo: "새로운 매력",
          whyInterestingKo: "특별하다",
          curiosityHookKo: "흥미롭다",
          hiddenDetailKo: "매력적",
          contentImaginabilityKo: "짧",
          explorationPayoffKo: "가보자",
          whyKoreanTravelerCaresKo: "좋다",
        }),
        nowIso: NOW,
      }),
      { originalTitle: "Best Tourism Villages", enforceGenericRisk: true },
    );
    expect(v.ok).toBe(false);
  });
});

describe("AGENDA_QUALITY_V2 Phase5 versioning", () => {
  it("prompt-v1 cache key differs from prompt-v2", () => {
    const k1 = buildAgendaTransformCacheKey({
      sourceFingerprint: "fp1",
      sourceCandidateId: "c1",
      transformRevision: AGENDA_QUALITY_V2_TRANSFORM_REVISION_V1,
      promptVersion: AGENDA_QUALITY_V2_PROMPT_VERSION_V1,
    });
    const k2 = buildAgendaTransformCacheKey({
      sourceFingerprint: "fp1",
      sourceCandidateId: "c1",
      transformRevision: AGENDA_QUALITY_V2_TRANSFORM_REVISION,
      promptVersion: AGENDA_QUALITY_V2_PROMPT_VERSION,
    });
    expect(k1).not.toBe(k2);
  });

  it("old reservoir rows not eligible as carryover; historical preserved", () => {
    const oldCandidate = assembleMarketingAgendaCandidateV2({
      input: {
        originalTitle: "old",
        originalSummary: "old",
        sourceTypes: ["news"],
      },
      llm: goodLlmEditorial(),
      nowIso: NOW,
    });
    oldCandidate.provenance.transformRevision = AGENDA_QUALITY_V2_TRANSFORM_REVISION_V1;
    oldCandidate.provenance.promptVersion = AGENDA_QUALITY_V2_PROMPT_VERSION_V1;
    oldCandidate.provenance.editorialObjectiveVersion = "travel-decision-intelligence-v1";

    expect(
      isAgendaReservoirVersionCompatible(oldCandidate, {
        transformRevision: AGENDA_QUALITY_V2_TRANSFORM_REVISION,
        promptVersion: AGENDA_QUALITY_V2_PROMPT_VERSION,
        editorialObjectiveVersion: AGENDA_QUALITY_V2_EDITORIAL_OBJECTIVE_VERSION,
      }),
    ).toBe(false);

    const oldItem = createReservoirItemFromQualified(oldCandidate, NOW);
    oldItem.status = "DEFERRED";
    oldItem.deferredAt = NOW;
    oldItem.presentedCount = 1;

    const newCandidate = assembleMarketingAgendaCandidateV2({
      input: {
        originalTitle: "푸꾸옥 호텔 공급 증가",
        originalSummary: "공급",
        sourceTypes: ["news"],
        sourceCredibility: 0.8,
        sourceFreshness: 0.8,
        koreanTravelerRelevance: 0.75,
      },
      llm: goodLlmEditorial(),
      nowIso: NOW,
    });
    const newItem = createReservoirItemFromQualified(newCandidate, NOW);

    const slate = selectDailyAgendaSlateV2({
      businessDateKst: "2026-09-18",
      nowIso: NOW,
      newlyQualified: [newItem],
      reservoirItems: [oldItem],
    });
    expect(slate.selected.every((s) => s.item.agendaId !== oldItem.agendaId)).toBe(true);
    expect(
      slate.rejected.some(
        (r) =>
          r.agendaId === oldItem.agendaId && r.reason === RESERVOIR_VERSION_INCOMPATIBLE_REASON,
      ),
    ).toBe(true);
    expect(oldItem.status).toBe("DEFERRED");
  });

  it("in-memory cache with v1 key is not reused by v2 key", async () => {
    const cache = createInMemoryAgendaTransformCache();
    const v1Key = buildAgendaTransformCacheKey({
      sourceFingerprint: "same",
      promptVersion: AGENDA_QUALITY_V2_PROMPT_VERSION_V1,
      transformRevision: AGENDA_QUALITY_V2_TRANSFORM_REVISION_V1,
    });
    await cache.set({
      cacheKey: v1Key,
      sourceFingerprint: "same",
      transformRevision: AGENDA_QUALITY_V2_TRANSFORM_REVISION_V1,
      promptVersion: AGENDA_QUALITY_V2_PROMPT_VERSION_V1,
      llm: goodLlmEditorial(),
      transformModel: "test",
      transformProvider: "test",
      transformRouteSource: "test",
      cachedAt: NOW,
    });
    const v2Key = buildAgendaTransformCacheKey({
      sourceFingerprint: "same",
      promptVersion: AGENDA_QUALITY_V2_PROMPT_VERSION,
      transformRevision: AGENDA_QUALITY_V2_TRANSFORM_REVISION,
    });
    expect(await cache.get(v2Key)).toBeNull();
  });
});

describe("AGENDA_QUALITY_V2 Phase5 validation", () => {
  it("old manifest retained/superseded; new 09/18–09/22 manifest created", async () => {
    const tmp = await fs.mkdtemp(path.join(os.tmpdir(), "aqv2-p5-val-"));
    const oldPath = resolveSupersededValidationManifestPath(tmp);
    await fs.mkdir(path.dirname(oldPath), { recursive: true });
    await fs.writeFile(
      oldPath,
      JSON.stringify(
        {
          contract: "agenda-quality-v2-validation-manifest",
          validationId: AGENDA_QUALITY_V2_VALIDATION_ID_SUPERSEDED_DECISION,
          createdAt: NOW,
          formalStartDate: "2026-09-17",
          formalEndDate: "2026-09-21",
          formalDates: ["2026-09-17", "2026-09-18", "2026-09-19", "2026-09-20", "2026-09-21"],
          day0Excluded: "2026-09-16",
          validationConfigFingerprint: "old-fp",
          config: snapshotAgendaQualityV2ValidationSensitiveConfig({}),
          configuredRoute: [],
          availableRouteAtManifestCreation: [],
          featureFlags: { AGENDA_QUALITY_V2_SHADOW_ENABLED: true },
          code: { gitHead: null, workingTreeDirty: null },
          artifactPolicy: {
            scheduledCanonicalPath: "x",
            manualRerunPath: "y",
            rollupSourcePolicy: "scheduled_canonical_preferred",
          },
        },
        null,
        2,
      ),
      "utf8",
    );

    const marked = await markPriorValidationManifestSuperseded({ cwd: tmp });
    expect(marked.decisionEra.status).toBe("updated");
    const old = JSON.parse(await fs.readFile(oldPath, "utf8"));
    expect(old.lifecycleStatus).toBe(AGENDA_QUALITY_V2_SUPERSEDED_STATUS);
    expect(old.validationId).toBe(AGENDA_QUALITY_V2_VALIDATION_ID_SUPERSEDED_DECISION);

    const created = await writeValidationManifestIfAbsent({
      cwd: tmp,
      createdAt: NOW,
      env: { AGENDA_QUALITY_V2_SHADOW_ENABLED: "true" },
    });
    expect(created.status).toBe("created");
    if (created.status !== "created") {
      throw new Error(`expected created manifest, got ${created.status}`);
    }
    expect(created.manifest.validationId).toBe(AGENDA_QUALITY_V2_VALIDATION_ID);
    expect([...created.manifest.formalDates]).toEqual([...AGENDA_QUALITY_V2_VALIDATION_DATES]);
    expect(created.manifest.config.promptVersion).toBe(AGENDA_QUALITY_V2_PROMPT_VERSION);
    expect(created.manifest.config.editorialObjectiveVersion).toBe(
      AGENDA_QUALITY_V2_EDITORIAL_OBJECTIVE_VERSION,
    );
    const fp = fingerprintAgendaQualityV2ValidationConfig(created.manifest.config);
    expect(created.manifest.validationConfigFingerprint).toBe(fp);
    expect(resolveValidationManifestPath(tmp)).toContain(
      "validation-editorial-v2a-2026-09-18_2026-09-22.json",
    );
  });
});
