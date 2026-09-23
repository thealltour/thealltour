import { describe, expect, it } from "vitest";

import {
  applyAngleQualityGate,
  isSeedWrapperAngle,
  pickRecommendedAngle,
} from "@/lib/marketing/audienceResearch/angleQuality";
import type {
  AcrbContentAngle,
  AcrbResearchFinding,
  AcrbTypedInsight,
  AudienceContentResearchBrief,
} from "@/lib/marketing/audienceResearch/contracts";
import { buildDeterministicAcrb } from "@/lib/marketing/audienceResearch/deterministicSkeleton";
import { ensureAudienceContentResearch } from "@/lib/marketing/audienceResearch/ensureAudienceContentResearch";
import {
  hasUsefulAcrbCore,
  mergeResearchFindings,
  mergeTypedInsightLists,
} from "@/lib/marketing/audienceResearch/mergeInsights";
import { mergeLlmIntoSkeleton } from "@/lib/marketing/audienceResearch/synthesize";
import { prepareManagerToContentHandoff } from "@/lib/marketing/content/prepareManagerToContentHandoff";
import { createInMemoryContentAssignmentStore } from "@/lib/marketing/content/store/contentAssignmentStore";
import {
  MARKETING_PRODUCTION_REQUEST_CONTRACT,
  createInMemoryMarketingProductionRequestRepository,
} from "@/lib/marketing/cron/daily/repository/createMarketingProductionRequestRepository";
import type { MarketingProductionRequest } from "@/lib/marketing/cron/daily/agendaSlate/productionRequestTypes";
import type { ResearchBriefEditorialIntelligence } from "@/lib/marketing/research/types/editorialIntelligence";
import type { ResearchBrief } from "@/lib/marketing/research/types/researchBrief";
import type { ResearchSearchProvider } from "@/lib/marketing/audienceResearch/external/searchProvider";
import { PRODUCTION_REQUEST_ACRB_METADATA_KEY } from "@/lib/marketing/audienceResearch/contracts";

function insight(
  text: string,
  type: AcrbTypedInsight["type"] = "observed_signal",
  confidence = 0.55,
): AcrbTypedInsight {
  return { text, type, confidence, evidenceRefs: ["ev1"] };
}

function angle(partial: Partial<AcrbContentAngle> & Pick<AcrbContentAngle, "angleId" | "angle">): AcrbContentAngle {
  return {
    hook: partial.hook ?? "hook",
    audienceTension: partial.audienceTension ?? "tension",
    interestScore: partial.interestScore ?? 0.7,
    noveltyScore: partial.noveltyScore ?? 0.6,
    evidenceStrength: partial.evidenceStrength ?? 0.5,
    channelFit: partial.channelFit ?? {
      threads: 0.7,
      shortform: 0.6,
      naver_blog: 0.5,
      naver_band: 0.4,
      kakao_channel: 0.4,
      cardnews: 0.4,
    },
    rationale: partial.rationale ?? "rationale for recommendation",
    supportingFindingRefs: partial.supportingFindingRefs ?? ["f1"],
    limitations: partial.limitations ?? [],
    ...partial,
  };
}

function busanSelection() {
  return {
    title: "부산 출발 크루즈 추석 탑승 가이드 콘텐츠 관측",
    summary:
      "공개 인스타그램에서 부산 출발 MSC 벨리시마 크루즈의 탑승 동선과 가족 동반 체험을 소개하는 콘텐츠가 관측됨",
    contentObjective: "inform_travelers" as const,
    commercialIntent: "informational" as const,
    destinations: ["부산"],
    topics: ["크루즈", "추석", "탑승"],
    entities: ["MSC 벨리시마"],
    researchBriefId: "rb_busan_cruise_ra1c5",
    agendaCandidateId: "ac_busan_cruise_ra1c5",
    evidenceRefs: [
      {
        evidenceId: "f4e6f641-d2cd-4704-8d01-2fbc890a516b",
        sourceId: "a1000000-0000-4000-8000-000000000001",
        sourceType: "social",
        sourceName: "Meta AI Trend Discovery",
        isOfficial: false,
        evidenceType: "derived_signal",
        url: "https://www.instagram.com/reel/DdEgr-UyM2S/",
        reference: "meta_ai:obs_ra1c5",
        excerpt: "공개 인스타그램에서 부산 출발 MSC 벨리시마 크루즈의 탑승 동선이 관측됨",
        publishedAt: null,
        observedAt: "2026-09-09T15:10:00.000Z",
        credibilityHint: 0.35,
      },
    ],
  };
}

function editorial(): ResearchBriefEditorialIntelligence {
  return {
    hookSignals: ["첫 크루즈 탑승 전 동선", "가족과 함께"],
    formatSignals: ["checklist"],
    audiencePainPoints: ["공항 이동 부담", "탑승 절차 막막함"],
    audienceQuestions: ["부산항 탑승 동선은?", "아이와 함께 타도 될까?"],
    personaHints: ["부산·경남 거주 다세대 가족", "첫 크루즈 초보"],
    contentAngles: ["가족 해상 휴가", "부산 출발 접근성"],
  };
}

function skeletonBrief(): AudienceContentResearchBrief {
  const handoff = prepareManagerToContentHandoff(busanSelection(), {
    store: createInMemoryContentAssignmentStore(),
  });
  return buildDeterministicAcrb({
    gathered: {
      selectedAgenda: handoff.selectedAgenda,
      assignment: handoff.contentAssignment,
      evidencePack: handoff.evidencePack,
      compactBrief: null,
      compactCandidate: null,
      fullResearchBrief: {
        id: "rb_busan_cruise_ra1c5",
        title: busanSelection().title,
        summary: busanSelection().summary,
        signalIds: [],
        claims: [],
        evidence: [],
        topics: ["크루즈"],
        destinations: ["부산"],
        entities: ["MSC 벨리시마"],
        freshness: { publishedAt: null, observedAt: "2026-09-09T15:10:00.000Z", freshnessScore: 0.7 },
        credibility: { score: 0.35, level: "low", reasons: ["social"] },
        travelRelevance: { score: 0.8, reasons: [] },
        publicInterest: 0.6,
        risks: [],
        openQuestions: [],
        generatedAt: "2026-09-09T15:10:00.000Z",
        status: "active",
        editorialIntelligence: editorial(),
      } as ResearchBrief,
      editorial: editorial(),
      historicalMatches: [],
      semanticAvailable: false,
      nearDuplicate: false,
      cooledIdentity: false,
      externalResearch: {
        available: true,
        providerId: "fixture",
        queryCount: 2,
        resultCount: 2,
        fetchedDocumentCount: 1,
        failedFetchCount: 0,
        totalFetchedBytes: 1200,
        officialSourceCount: 0,
        socialCommunitySourceCount: 1,
        runtimeMs: 10,
        queries: ["부산 크루즈 탑승"],
        evidence: [
          {
            evidenceId: "ext_social_fixture",
            url: "https://example.com/community/boarding",
            title: "첫 크루즈 탑승 준비",
            excerpt: "터미널 입구와 수하물 라벨을 미리 확인하라는 후기가 반복됨",
            sourceClass: "community",
            fromSnippetOnly: false,
            query: "부산 크루즈 탑승",
            purpose: "audience_questions",
          },
        ],
        observedAudienceQuestions: ["터미널 입구는 어디인가요", "수하물은 언제 부치나요"],
        observedCompetitorHooks: ["선내 시설 투어"],
        limitations: ["no_official_sources_in_inspected_sample"],
      },
    },
  });
}

function makeMpr(logicalRunKey: string, brief?: AudienceContentResearchBrief): MarketingProductionRequest {
  const iso = "2026-09-12T12:00:00.000Z";
  return {
    contract: MARKETING_PRODUCTION_REQUEST_CONTRACT,
    requestId: `mpr_${logicalRunKey.slice(-12)}`,
    logicalRunKey,
    slateId: "slate_test",
    slateItemId: "item_1",
    businessDateKst: "2026-09-12",
    status: "QUEUED",
    createdAt: iso,
    updatedAt: iso,
    claimedAt: null,
    startedAt: null,
    completedAt: null,
    failedAt: null,
    attemptCount: 0,
    claimToken: null,
    lastError: null,
    workerId: null,
    selection: {
      title: busanSelection().title,
      summary: busanSelection().summary,
      agendaCandidateId: "ac_busan_cruise_ra1c5",
      researchBriefId: "rb_busan_cruise_ra1c5",
      rationale: [],
      recommendedChannel: "threads",
      recommendedFormats: [],
    },
    errorMessage: null,
    completedCandidateId: null,
    metadata: {
      productId: "prod_test",
      ...(brief ? { [PRODUCTION_REQUEST_ACRB_METADATA_KEY]: brief } : {}),
    },
  };
}

describe("RA-1C5 synthesis merge preservation", () => {
  it("empty LLM audience does not erase skeleton audience", () => {
    const skeleton = skeletonBrief();
    const merged = mergeLlmIntoSkeleton(skeleton, {
      audience: {
        primary: [],
        secondary: [],
        motivations: [],
        anxieties: [],
        objections: [],
        decisionTriggers: [],
      },
      researchVerdict: "PROCEED_WITH_CAUTION",
      researchStatus: "complete",
    });
    expect(merged.audience.primary.length).toBeGreaterThan(0);
    expect(merged.audience.primary[0]?.text).toMatch(/부산|가족|크루즈/);
    expect(merged.audience.anxieties.length).toBeGreaterThan(0);
  });

  it("empty LLM questions do not erase research questions", () => {
    const skeleton = skeletonBrief();
    expect(skeleton.searchIntent.questions.length).toBeGreaterThan(0);
    const merged = mergeLlmIntoSkeleton(skeleton, {
      searchIntent: {
        primaryIntent: skeleton.searchIntent.primaryIntent,
        secondaryIntents: [],
        queries: [],
        questions: [],
      },
    });
    expect(merged.searchIntent.questions.length).toBeGreaterThan(0);
    expect(merged.searchIntent.questions.some((q) => /탑승|동선|수하물|아이/.test(q.text))).toBe(true);
  });

  it("partial section merge preserves valid upstream values and content gaps", () => {
    const skeleton = skeletonBrief();
    const merged = mergeLlmIntoSkeleton(skeleton, {
      audience: {
        primary: [insight("부산·경남 출발 첫 크루즈 가족 — LLM 정제", "inference", 0.7)],
        secondary: [],
        motivations: [],
        anxieties: [],
        objections: [insight("가격 대비 일정 부담", "hypothesis", 0.4)],
        decisionTriggers: [],
      },
      marketSignals: {
        observedPatterns: [],
        competitorHooks: [],
        saturatedAngles: [],
        contentGaps: [],
      },
    });
    expect(merged.audience.primary.some((p) => /LLM 정제/.test(p.text))).toBe(true);
    expect(merged.audience.motivations.length).toBeGreaterThan(0);
    expect(merged.audience.anxieties.length).toBeGreaterThan(0);
    expect(merged.audience.objections.some((o) => /가격/.test(o.text))).toBe(true);
    expect(merged.marketSignals.contentGaps.length).toBeGreaterThan(0);
  });

  it("duplicate values are deduplicated preferring more specific text", () => {
    const upstream = [insight("부산항 탑승 동선", "observed_signal", 0.5)];
    const llm = [
      insight("부산항 탑승 동선과 수속 순서", "observed_signal", 0.6),
      insight("부산항 탑승 동선", "observed_signal", 0.55),
    ];
    const merged = mergeTypedInsightLists(upstream, llm);
    expect(merged.length).toBe(1);
    expect(merged[0]?.text).toBe("부산항 탑승 동선과 수속 순서");
    expect(merged[0]?.confidence).toBe(0.6);
  });

  it("finding type/confidence preserved and hypothesis not upgraded", () => {
    const upstream: AcrbResearchFinding[] = [
      {
        findingId: "f_hyp",
        text: "연휴 수요 가설",
        type: "hypothesis",
        confidence: 0.4,
        evidenceRefs: ["ev1"],
        sourceClass: "model_inference",
        provenanceNote: "upstream",
      },
    ];
    const llm: AcrbResearchFinding[] = [
      {
        findingId: "f_hyp",
        text: "연휴 수요 가설 — 더 구체적 문장",
        type: "verified_fact",
        confidence: 0.9,
        evidenceRefs: ["ev2"],
        sourceClass: "official",
        provenanceNote: "llm_attempted_upgrade",
      },
    ];
    const merged = mergeResearchFindings(upstream, llm);
    expect(merged).toHaveLength(1);
    expect(merged[0]?.type).toBe("hypothesis");
    expect(merged[0]?.confidence).toBe(0.9);
    expect(merged[0]?.text).toContain("더 구체적");
    expect(merged[0]?.evidenceRefs).toEqual(expect.arrayContaining(["ev1", "ev2"]));
  });

  it("rejects generic seed-wrapper angles and still yields 3–5 when source material exists", () => {
    expect(isSeedWrapperAngle("시드 재평가: 가족 해상 휴가")).toBe(true);
    const gated = applyAngleQualityGate([
      angle({
        angleId: "seed1",
        angle: "시드 재평가: 가족 해상 휴가",
        hook: "시드 재평가: 가족 해상 휴가",
        audienceTension: "트렌드 시드 관심 vs 자사 증거 부족",
        interestScore: 0.9,
        noveltyScore: 0.9,
        rationale: "should be rejected",
      }),
      angle({
        angleId: "seed2",
        angle: "시드 재평가: 부산 출발 접근성",
        hook: "placeholder",
        audienceTension: "접근성",
        interestScore: 0.9,
        rationale: "should be rejected",
      }),
      angle({
        angleId: "a1",
        angle: "첫 크루즈에서 배 안보다 출항 전 동선이 더 막막한 이유",
        hook: "터미널·수하물 질문이 반복되는 표본",
        audienceTension: "초보 탑승객의 출항 직전 동선 불안",
        rationale: "실무 준비 긴장",
      }),
      angle({
        angleId: "a2",
        angle: "부모님과 부산 크루즈 탈 때 먼저 확인할 탑승 동선",
        hook: "여행상품보다 동선 확인",
        audienceTension: "가족 동반 첫 탑승 준비 부담",
        rationale: "가족 의사결정",
      }),
      angle({
        angleId: "a3",
        angle: "추석 연휴 부산 출항 전 체크리스트 긴장",
        hook: "연휴 타이밍 준비 실수",
        audienceTension: "연휴 일정 확정 불안",
        rationale: "시즌 트리거",
      }),
      angle({
        angleId: "a4",
        angle: "공항 대신 부산항 — 이동 부담을 줄이려는 가족의 선택 기준",
        hook: "접근성 매력 vs 정보 공백",
        audienceTension: "접근성 매력 vs 크루즈 초보 정보 공백",
        rationale: "비교 긴장",
      }),
    ]);
    expect(gated.every((a) => !isSeedWrapperAngle(a.angle))).toBe(true);
    expect(gated.length).toBeGreaterThanOrEqual(3);
    expect(gated.length).toBeLessThanOrEqual(5);
    const recommended = pickRecommendedAngle(gated);
    expect(recommended).not.toBeNull();
    expect(gated.some((a) => a.angleId === recommended!.angleId)).toBe(true);
  });

  it("marks partial when LLM empties core despite upstream skeleton", () => {
    const skeleton = skeletonBrief();
    expect(
      hasUsefulAcrbCore({
        primary: skeleton.audience.primary,
        motivations: skeleton.audience.motivations,
        decisionTriggers: skeleton.audience.decisionTriggers,
        questions: skeleton.searchIntent.questions,
        contentGaps: skeleton.marketSignals.contentGaps,
        angles: skeleton.contentAngles,
      }),
    ).toBe(true);

    // Simulate LLM wiping angles with only seed wrappers (gate removes them).
    const merged = mergeLlmIntoSkeleton(skeleton, {
      contentAngles: [
        {
          angleId: "bad",
          angle: "시드 재평가: 가족 해상 휴가",
          hook: "시드 재평가: 가족 해상 휴가",
          audienceTension: "",
          interestScore: 0.9,
          noveltyScore: 0.9,
          evidenceStrength: 0.9,
          channelFit: skeleton.contentAngles[0]!.channelFit,
          rationale: "",
          supportingFindingRefs: [],
          limitations: [],
        },
      ],
      researchVerdict: "PROCEED_WITH_CAUTION",
      researchStatus: "complete",
    });
    // Skeleton angles should still fill via mergeAngles when LLM list is thin/rejected.
    expect(merged.contentAngles.every((a) => !isSeedWrapperAngle(a.angle))).toBe(true);
    expect(merged.contentAngles.length).toBeGreaterThanOrEqual(3);
    expect(merged.recommendedAngleId).toBeTruthy();
    expect(merged.contentAngles.some((a) => a.angleId === merged.recommendedAngleId)).toBe(true);
  });

  it("synthesis-only reuse path does not call external search", async () => {
    const skeleton = skeletonBrief();
    const logicalRunKey = "daily-marketing-production:2026-09-12:ra1c5reuse00000001";
    const repo = createInMemoryMarketingProductionRequestRepository();
    await repo.enqueue(makeMpr(logicalRunKey));
    const existing = await repo.findByLogicalKey(logicalRunKey);
    await repo.update({
      ...existing!,
      metadata: {
        ...existing!.metadata,
        [PRODUCTION_REQUEST_ACRB_METADATA_KEY]: skeleton,
      },
    });
    let searchCalls = 0;
    const provider: ResearchSearchProvider = {
      id: "must_not_run",
      enabled: true,
      async search() {
        searchCalls += 1;
        throw new Error("search_must_not_run");
      },
    };
    const handoff = prepareManagerToContentHandoff(busanSelection(), {
      store: createInMemoryContentAssignmentStore(),
    });
    const result = await ensureAudienceContentResearch({
      handoff,
      logicalRunKey,
      productionRequestRepo: repo,
      forceRegenerate: true,
      skipExternalResearch: true,
      searchProvider: provider,
      invoke: null,
      loadFullResearchBrief: async () =>
        ({
          id: "rb_busan_cruise_ra1c5",
          title: busanSelection().title,
          summary: busanSelection().summary,
          signalIds: [],
          claims: [],
          evidence: [],
          topics: ["크루즈"],
          destinations: ["부산"],
          entities: [],
          freshness: { publishedAt: null, observedAt: "2026-09-09T15:10:00.000Z", freshnessScore: 0.7 },
          credibility: { score: 0.35, level: "low", reasons: [] },
          travelRelevance: { score: 0.8, reasons: [] },
          publicInterest: 0.6,
          risks: [],
          openQuestions: [],
          generatedAt: "2026-09-09T15:10:00.000Z",
          status: "active",
          editorialIntelligence: editorial(),
        }) as ResearchBrief,
      listRecentCandidateTitles: async () => [],
    });
    expect(searchCalls).toBe(0);
    expect(result.externalResearchReused).toBe(true);
    expect(result.brief.audience.primary.length).toBeGreaterThan(0);
    expect(result.brief.provenance.externalResearchUsed).toBe(true);
  });
});
