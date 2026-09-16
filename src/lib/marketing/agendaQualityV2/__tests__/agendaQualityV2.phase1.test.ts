import { describe, expect, it } from "vitest";

import {
  MARKETING_AGENDA_CANDIDATE_V2_CONTRACT,
  type MarketingAgendaCandidateV2,
  type MarketingAgendaTransformerLlmOutput,
} from "@/lib/marketing/agendaQualityV2/contracts";
import {
  AGENDA_FRESHNESS_TTL_HOURS_DEFAULTS,
  computeAgendaExpiresAt,
  resolveAgendaFreshnessTtlHours,
} from "@/lib/marketing/agendaQualityV2/freshness";
import { detectGenericAgendaRisk, isHeadlineEcho } from "@/lib/marketing/agendaQualityV2/genericRisk";
import { validateMarketingAgendaCandidateV2 } from "@/lib/marketing/agendaQualityV2/validate";
import {
  assembleMarketingAgendaCandidateV2,
  transformMarketingAgendaFromLlmOutput,
} from "@/lib/marketing/agendaQualityV2/transformer/transform";
import { MARKETING_AGENDA_TRANSFORMER_ROLE_KEY } from "@/lib/marketing/agendaQualityV2/transformer/prompt";
import {
  createInMemoryAgendaReservoir,
  createReservoirItemFromQualified,
  isReservoirEligibleForFutureSlate,
} from "@/lib/marketing/agendaQualityV2/reservoir/types";
import {
  markReservoirDeferred,
  markReservoirExpired,
  markReservoirPresented,
  markReservoirRejected,
  markReservoirSelected,
  markReservoirSuperseded,
  applyReservoirExpiryIfNeeded,
} from "@/lib/marketing/agendaQualityV2/reservoir/transitions";
import { isAgendaQualityV2ShadowEnabled } from "@/lib/marketing/agendaQualityV2/shadow/config";
import { runAgendaQualityV2Shadow } from "@/lib/marketing/agendaQualityV2/shadow/runShadow";
import { maybeRunAgendaQualityV2ShadowAfterV1 } from "@/lib/marketing/agendaQualityV2/shadow/afterV1Slate";
import { resolveModelRoute } from "@/ai-runtime/router/role-routes";
import { ROLE_MODEL_ROUTES } from "@/ai-runtime/router/role-routes";
import { AI_MODEL_IDS } from "@/ai-runtime/registry/models";
import type { AgendaCandidate } from "@/lib/marketing/research/types/researchBrief";

const NOW = "2026-09-16T01:00:00.000Z";

function goodLlm(overrides?: Partial<MarketingAgendaTransformerLlmOutput>): MarketingAgendaTransformerLlmOutput {
  return {
    targetTravelerKo: "푸꾸옥에서 리조트 체류와 외부 관광을 병행하려는 한국인 여행자",
    travelerProblemKo:
      "리조트 선택지가 늘어날수록 외부 관광이 많은 여행자는 숙소 위치를 어떻게 판단해야 하는가?",
    decisionAtStakeKo: "숙소를 리조트 클러스터에 둘지, 관광 접근성이 좋은 구역에 둘지",
    audienceTensionKo: "편의·부대시설 집중 vs 이동시간·현지 동선 효율",
    readerPayoffKo: "본인 여행 스타일에 맞는 숙소 위치 판단 기준을 세울 수 있다",
    marketingStorySeedKo:
      "호텔 공급이 늘어난 지금, 외부 관광형 여행자는 숙소 위치를 무엇으로 고를까?",
    whyNowKo: "공급 확대 신호가 관측되어 위치 선택의 기준이 더 중요해질 수 있다",
    researchQuestionsKo: ["신규 공급이 어느 구역에 집중되는가?", "이동 수단 옵션은?"],
    nonGoalsKo: ["특정 호텔 추천", "가격 단정"],
    genericRiskKo: "공급 증가를 사실처럼 단정하지 않고 가설로 유지",
    storyArchetypeHint: "convenience_vs_experience",
    freshnessClass: "timely",
    signalSummaryKo: "푸꾸옥 호텔 공급 증가 관련 신호",
    limitations: ["정확한 객실 수·요금은 미확인"],
    ...overrides,
  };
}

function validCandidate(
  overrides?: Partial<MarketingAgendaCandidateV2>,
): MarketingAgendaCandidateV2 {
  const base = assembleMarketingAgendaCandidateV2({
    input: {
      originalTitle: "푸꾸옥 호텔 공급 증가",
      originalSummary: "현지 호텔·리조트 공급이 늘어났다는 보도/신호",
      sourceTypes: ["news"],
      destinations: ["phu_quoc"],
      topics: ["hotel_supply"],
      sourceSignalIds: ["sig_1"],
    },
    llm: goodLlm(),
    nowIso: NOW,
  });
  return { ...base, ...overrides };
}

describe("AGENDA_QUALITY_V2 schema", () => {
  it("valid V2 candidate passes", () => {
    const result = validateMarketingAgendaCandidateV2(validCandidate(), {
      originalTitle: "푸꾸옥 호텔 공급 증가",
      originalSummary: "현지 호텔·리조트 공급이 늘어났다는 보도/신호",
    });
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.candidate.contract).toBe(MARKETING_AGENDA_CANDIDATE_V2_CONTRACT);
      expect(result.candidate.editorial.marketingStorySeedKo).not.toBe("푸꾸옥 호텔 공급 증가");
    }
  });

  it("missing decisionAtStake fails", () => {
    const c = validCandidate();
    c.traveler.decisionAtStakeKo = "";
    const result = validateMarketingAgendaCandidateV2(c, { enforceGenericRisk: false });
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.reasons).toContain("missing_decisionAtStakeKo");
  });

  it("missing tension fails", () => {
    const c = validCandidate();
    c.traveler.audienceTensionKo = "짧음";
    const result = validateMarketingAgendaCandidateV2(c, { enforceGenericRisk: false });
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.reasons).toContain("missing_audienceTensionKo");
  });

  it("missing payoff fails", () => {
    const c = validCandidate();
    c.traveler.readerPayoffKo = "";
    const result = validateMarketingAgendaCandidateV2(c, { enforceGenericRisk: false });
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.reasons).toContain("missing_readerPayoffKo");
  });

  it("missing Story seed fails", () => {
    const c = validCandidate();
    c.editorial.marketingStorySeedKo = "";
    const result = validateMarketingAgendaCandidateV2(c, { enforceGenericRisk: false });
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.reasons).toContain("missing_marketingStorySeedKo");
  });
});

describe("AGENDA_QUALITY_V2 transformer contract", () => {
  it("role key is marketing_agenda_transformer and routes Gemini→OR→NVIDIA→Gemini2", () => {
    expect(MARKETING_AGENDA_TRANSFORMER_ROLE_KEY).toBe("marketing_agenda_transformer");
    const resolved = resolveModelRoute({
      role: "marketing_agenda_transformer",
      workload: "reasoning",
    });
    expect(resolved.routeSource).toBe("role_override");
    expect(resolved.modelIds).toEqual(ROLE_MODEL_ROUTES.marketing_agenda_transformer);
    expect(resolved.modelIds).toEqual([
      AI_MODEL_IDS.GEMINI_FLASH_LITE_PRIMARY,
      AI_MODEL_IDS.OPENROUTER_FREE,
      AI_MODEL_IDS.NVIDIA_NEMOTRON_3_ULTRA,
      AI_MODEL_IDS.GEMINI_FLASH_LITE_SECONDARY,
    ]);
  });

  it("plain news headline cannot remain unchanged as Agenda", () => {
    expect(
      isHeadlineEcho({
        originalTitle: "푸꾸옥 호텔 공급 증가",
        marketingStorySeedKo: "푸꾸옥 호텔 공급 증가",
      }),
    ).toBe(true);

    const bad = transformMarketingAgendaFromLlmOutput({
      input: {
        originalTitle: "푸꾸옥 호텔 공급 증가",
        originalSummary: "호텔이 늘어난다",
        sourceTypes: ["news"],
      },
      llm: goodLlm({
        travelerProblemKo: "푸꾸옥 호텔 공급 증가",
        decisionAtStakeKo: "푸꾸옥 호텔 공급 증가",
        audienceTensionKo: "푸꾸옥 호텔 공급 증가",
        readerPayoffKo: "푸꾸옥 호텔 공급 증가",
        marketingStorySeedKo: "푸꾸옥 호텔 공급 증가",
      }),
      nowIso: NOW,
    });
    expect(bad.transformStatus).toBe("invalid");
    expect(bad.transformFailureReason).toMatch(/generic_risk|headline/);
  });

  it("news case: traveler decision framing required (not title echo)", () => {
    const result = transformMarketingAgendaFromLlmOutput({
      input: {
        originalTitle: "푸꾸옥 호텔 공급 증가",
        originalSummary: "현지 호텔 공급 증가 보도",
        sourceTypes: ["news"],
        destinations: ["phu_quoc"],
      },
      llm: goodLlm(),
      nowIso: NOW,
    });
    expect(result.transformStatus).toBe("valid");
    expect(result.candidate?.editorial.marketingStorySeedKo).not.toBe("푸꾸옥 호텔 공급 증가");
    expect(result.candidate?.traveler.decisionAtStakeKo).toMatch(/숙소|위치|판단|선택/);
    // Story seed is seed only — contract marks it as such via field name + limitations
    expect(result.candidate?.provenance.transformRevision).toContain("agenda-transform");
  });

  it("meta trend case: popularity statement invalid; decision seed valid", () => {
    const popularity = transformMarketingAgendaFromLlmOutput({
      input: {
        originalTitle: "부산 출발 가족 크루즈 활동 콘텐츠 관측",
        originalSummary: "메타에서 가족 크루즈 콘텐츠 활동이 관측됨",
        sourceTypes: ["meta_trend"],
      },
      llm: goodLlm({
        targetTravelerKo: "가족 여행자",
        travelerProblemKo: "부산 가족 크루즈가 인기",
        decisionAtStakeKo: "부산 가족 크루즈가 인기",
        audienceTensionKo: "관심 증가",
        readerPayoffKo: "여행자들의 관심이 높다",
        marketingStorySeedKo: "부산 가족 크루즈가 인기",
        freshnessClass: "timely",
      }),
      nowIso: NOW,
    });
    expect(popularity.transformStatus).toBe("invalid");

    const framed = transformMarketingAgendaFromLlmOutput({
      input: {
        originalTitle: "부산 출발 가족 크루즈 활동 콘텐츠 관측",
        originalSummary: "메타에서 가족 크루즈 콘텐츠 활동이 관측됨",
        sourceTypes: ["meta_trend"],
        topics: ["family_cruise", "busan"],
      },
      llm: goodLlm({
        targetTravelerKo: "부산 출발을 고려하는 가족 여행 기획자",
        travelerProblemKo:
          "가족 일정·예산·멀미/이동 부담을 감안할 때 크루즈가 우리 가족 형태에 맞는지 어떻게 판단할까?",
        decisionAtStakeKo: "크루즈 vs 육상 패키지/개별여행 중 무엇을 우선 검토할지",
        audienceTensionKo: "한 번에 움직이는 편의 vs 일정 유연성·아이 체력",
        readerPayoffKo: "우리 가족에게 크루즈가 '맞는지' 걸러내는 체크포인트를 얻는다",
        marketingStorySeedKo:
          "부산 출발 가족 크루즈 콘텐츠가 늘어난 지금, 우리 가족은 무엇을 먼저 확인해야 할까?",
        whyNowKo: "활동 콘텐츠 관측은 관심 신호일 뿐, 적합 여부는 가족 조건으로 검증해야 한다",
        limitations: ["인기를 사실로 단정하지 않음", "요금·스케줄 미확인"],
      }),
      nowIso: NOW,
    });
    expect(framed.transformStatus).toBe("valid");
    expect(framed.candidate?.editorial.marketingStorySeedKo).not.toMatch(/인기$/);
  });

  it("unsupported facts are not asserted in good fixture (hypothesis/limitations)", () => {
    const result = transformMarketingAgendaFromLlmOutput({
      input: {
        originalTitle: "푸꾸옥 호텔 공급 증가",
        originalSummary: "공급 증가 신호",
        sourceTypes: ["news"],
      },
      llm: goodLlm(),
      nowIso: NOW,
    });
    expect(result.transformStatus).toBe("valid");
    expect(result.candidate?.provenance.limitations?.length).toBeGreaterThan(0);
    expect(result.candidate?.editorial.nonGoalsKo.join(" ")).toMatch(/가격|추천/);
  });
});

describe("AGENDA_QUALITY_V2 generic risk", () => {
  it("flags placeholder and popularity families", () => {
    const findings = detectGenericAgendaRisk({
      originalTitle: "관광 성장",
      travelerProblemKo: "여행자들의 관심이 높다",
      decisionAtStakeKo: "최신 정보를 확인",
      audienceTensionKo: "관광객에게 유용",
      readerPayoffKo: "여행 계획에 참고",
      marketingStorySeedKo: "관광 산업 성장",
    });
    expect(findings.some((f) => f.code === "placeholder_phrase" || f.code === "popularity_statement")).toBe(
      true,
    );
  });
});

describe("AGENDA_QUALITY_V2 reservoir", () => {
  it("QUALIFIED → PRESENTED → DEFERRED remains eligible", () => {
    const repo = createInMemoryAgendaReservoir();
    let item = createReservoirItemFromQualified(validCandidate(), NOW);
    repo.upsert(item);
    item = markReservoirPresented(item, NOW);
    expect(item.status).toBe("PRESENTED");
    item = markReservoirDeferred(item, NOW);
    expect(item.status).toBe("DEFERRED");
    expect(isReservoirEligibleForFutureSlate(item, NOW)).toBe(true);
    repo.upsert(item);
    expect(repo.list({ status: "DEFERRED" })).toHaveLength(1);
  });

  it("PRESENTED → SELECTED", () => {
    let item = createReservoirItemFromQualified(validCandidate(), NOW);
    item = markReservoirPresented(item, NOW);
    item = markReservoirSelected(item, NOW);
    expect(item.status).toBe("SELECTED");
    expect(item.selectedAt).toBe(NOW);
    expect(isReservoirEligibleForFutureSlate(item, NOW)).toBe(false);
  });

  it("explicit reject → REJECTED", () => {
    let item = createReservoirItemFromQualified(validCandidate(), NOW);
    item = markReservoirRejected(item, NOW);
    expect(item.status).toBe("REJECTED");
    expect(isReservoirEligibleForFutureSlate(item, NOW)).toBe(false);
  });

  it("expiry → EXPIRED", () => {
    let item = createReservoirItemFromQualified(
      validCandidate({
        expiresAt: "2026-09-15T00:00:00.000Z",
        signalContext: {
          ...validCandidate().signalContext,
          freshnessClass: "breaking",
        },
      }),
      NOW,
    );
    item = applyReservoirExpiryIfNeeded(item, NOW);
    expect(item.status).toBe("EXPIRED");
  });

  it("supersede → SUPERSEDED", () => {
    let item = createReservoirItemFromQualified(validCandidate(), NOW);
    item = markReservoirSuperseded(item, "magv2_newer", NOW);
    expect(item.status).toBe("SUPERSEDED");
    expect(item.supersededByAgendaId).toBe("magv2_newer");
  });

  it("markReservoirExpired from PRESENTED", () => {
    let item = createReservoirItemFromQualified(validCandidate(), NOW);
    item = markReservoirPresented(item, NOW);
    item = markReservoirExpired(item, NOW);
    expect(item.status).toBe("EXPIRED");
  });
});

describe("AGENDA_QUALITY_V2 TTL", () => {
  it("freshnessClass creates expected expiry defaults", () => {
    expect(resolveAgendaFreshnessTtlHours("breaking")).toBe(48);
    expect(resolveAgendaFreshnessTtlHours("timely")).toBe(AGENDA_FRESHNESS_TTL_HOURS_DEFAULTS.timely);
    expect(resolveAgendaFreshnessTtlHours("seasonal")).toBe(21 * 24);
    expect(resolveAgendaFreshnessTtlHours("evergreen")).toBe(60 * 24);

    const expires = computeAgendaExpiresAt({
      freshnessClass: "breaking",
      fromIso: NOW,
    });
    expect(new Date(expires).getTime() - new Date(NOW).getTime()).toBe(48 * 60 * 60 * 1000);
  });

  it("TTL overrides are respected", () => {
    expect(resolveAgendaFreshnessTtlHours("timely", { timely: 12 })).toBe(12);
  });
});

describe("AGENDA_QUALITY_V2 shadow / parallel mode", () => {
  it("flag default OFF", () => {
    expect(isAgendaQualityV2ShadowEnabled({})).toBe(false);
    expect(isAgendaQualityV2ShadowEnabled({ AGENDA_QUALITY_V2_SHADOW_ENABLED: "false" })).toBe(false);
  });

  it("V2 shadow disabled → zero production change / no report", async () => {
    const result = await runAgendaQualityV2Shadow({
      sources: [
        {
          originalTitle: "x",
          originalSummary: "y",
          sourceType: "news",
          input: { originalTitle: "x", originalSummary: "y", sourceTypes: ["news"] },
          fixtureLlm: goodLlm(),
        },
      ],
      env: {},
    });
    expect(result.enabled).toBe(false);
    expect(result.productionSlateUnchanged).toBe(true);
    expect(result.report).toBeNull();
  });

  it("V2 shadow enabled → shadow artifacts only", async () => {
    const result = await runAgendaQualityV2Shadow({
      sources: [
        {
          originalTitle: "푸꾸옥 호텔 공급 증가",
          originalSummary: "공급 증가 신호",
          sourceType: "news",
          input: {
            originalTitle: "푸꾸옥 호텔 공급 증가",
            originalSummary: "공급 증가 신호",
            sourceTypes: ["news"],
          },
          fixtureLlm: goodLlm(),
        },
      ],
      env: { AGENDA_QUALITY_V2_SHADOW_ENABLED: "true" },
      nowIso: NOW,
    });
    expect(result.enabled).toBe(true);
    if (!result.enabled) return;
    expect(result.productionSlateUnchanged).toBe(true);
    expect(result.report.rows).toHaveLength(1);
    expect(result.report.rows[0]?.valid).toBe(true);
    expect(result.reportMarkdown).toContain("travelerProblem");
    expect(result.report.contract).toBe("agenda-quality-v2-shadow-report");
  });

  it("afterV1 hook disabled does not require invoke", async () => {
    const candidates: AgendaCandidate[] = [
      {
        id: "ac1",
        researchBriefId: "rb1",
        title: "t",
        rationale: "r",
        freshnessScore: 0.5,
        publicInterestScore: 0.5,
        travelRelevanceScore: 0.5,
        credibilityScore: 0.5,
        compositeResearchScore: 0.5,
        riskFlags: [],
        supportingEvidenceIds: [],
        status: "candidate",
        createdAt: NOW,
        updatedAt: NOW,
      },
    ];
    const result = await maybeRunAgendaQualityV2ShadowAfterV1({
      agendaCandidates: candidates,
      env: {},
    });
    expect(result.enabled).toBe(false);
    expect(result.productionSlateUnchanged).toBe(true);
  });
});
