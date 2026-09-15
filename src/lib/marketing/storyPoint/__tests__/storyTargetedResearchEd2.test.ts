import { describe, expect, it, vi } from "vitest";

import {
  AGENDA_TOPIC_IDENTITY_CONTRACT,
  type AgendaTopicIdentity,
} from "@/lib/marketing/audienceResearch/topicIdentity/contracts";
import { buildResearchQueryPlan } from "@/lib/marketing/audienceResearch/external/queryPlan";
import type { ExternalResearchBundle } from "@/lib/marketing/audienceResearch/external/runExternalResearch";
import { ensureAudienceContentResearch } from "@/lib/marketing/audienceResearch/ensureAudienceContentResearch";
import { prepareManagerToContentHandoff } from "@/lib/marketing/content/prepareManagerToContentHandoff";
import { createInMemoryContentAssignmentStore } from "@/lib/marketing/content/store/contentAssignmentStore";
import {
  MARKETING_PRODUCTION_REQUEST_CONTRACT,
  createInMemoryMarketingProductionRequestRepository,
} from "@/lib/marketing/cron/daily/repository/createMarketingProductionRequestRepository";
import type { MarketingProductionRequest } from "@/lib/marketing/cron/daily/agendaSlate/productionRequestTypes";
import {
  STORY_CONTENT_POINT_CONTRACT,
  STORY_POINT_CANDIDATE_SET_CONTRACT,
  STORY_RESEARCH_MAX_QUERIES_PER_STORY,
  STORY_RESEARCH_MAX_STORYPOINTS_PER_AGENDA,
  STORY_RESEARCH_MAX_TOTAL_SEARCH_REQUESTS,
  type DurableStoryPointCandidateSet,
  type StoryContentPoint,
} from "@/lib/marketing/storyPoint/contracts";
import { adjudicateStoryResearch, assertStoryResearchCanProceed } from "@/lib/marketing/storyPoint/adjudicateStoryResearch";
import { ensureStoryTargetedResearch } from "@/lib/marketing/storyPoint/ensureStoryTargetedResearch";
import { createStoryPointHash } from "@/lib/marketing/storyPoint/hash";
import { buildAcrbLogicalIdentity, buildEvidenceFingerprint } from "@/lib/marketing/audienceResearch/validate";
import { STORY_RESEARCH_CONTRACT_VERSION } from "@/lib/marketing/storyPoint/contracts";

const BANGKOK_STRONG: StoryContentPoint = {
  contract: STORY_CONTENT_POINT_CONTRACT,
  pointId: "sp_bangkok_hotel",
  storyQuestion: "부모님과 방콕을 갈 때 호텔 등급보다 위치를 먼저 봐야 할까?",
  storyClaim: "방콕 가족여행에서 숙소 위치가 호텔 등급만큼 중요할 수 있다",
  whyInteresting:
    "가족 여행에서 '좋은 호텔' 직관이 이동 불편으로 자주 깨진다는 현장 경험이 반복된다",
  audienceTension:
    "부모님을 모시고 갈 때 등급을 올리면 편할 것 같지만 이동이 어려우면 하루가 망가진다",
  curiosityGap:
    "높은 등급 호텔이 항상 가족여행에 더 좋은 선택이라는 직관과 실제 이동 편의가 충돌할 수 있음",
  readerPayoff: "부모님 동반 숙소를 고를 때 무엇을 우선 비교할지 판단 기준을 얻음",
  mechanisms: ["counter_intuition", "decision_relief"],
  researchNeeded: ["숙박 지역별 BTS 접근성", "대표 관광지 이동시간"],
  researchQuestions: [
    "방콕 주요 숙박지역별 BTS/MRT 접근성 차이가 실제로 큰가?",
    "부모님 동반 후기에서 숙소 위치/이동거리 불만이 반복적으로 나타나는가?",
  ],
  genericRisk: "체크리스트로 붕괴할 수 있음",
  genericRiskMitigation: "우선순위 판단 기준 1개로 고정",
  channelPotential: {
    conversation: "high",
    visualExplainability: "medium",
    searchDepth: "high",
    shortformHookability: "medium",
  },
  nonGoals: ["방콕 호텔 종합 가이드"],
  agendaFitNotes: null,
};

const BANGKOK_ALTERNATE: StoryContentPoint = {
  ...BANGKOK_STRONG,
  pointId: "sp_bangkok_alt",
  storyQuestion: "방콕 숙소를 고를 때 교통 접근성을 어떻게 비교해야 할까?",
  storyClaim: "BTS 역세권 숙소가 부모님 동반 일정에서 이동 스트레스를 줄일 수 있다",
  researchQuestions: [
    "방콕 BTS 역세권 숙소가 관광지 이동 시간을 줄이는 사례가 있는가?",
    "부모님 동반 여행 후기에서 역세권 숙소 선택이 반복 언급되는가?",
  ],
};

function thailandIdentity(): AgendaTopicIdentity {
  return {
    contract: AGENDA_TOPIC_IDENTITY_CONTRACT,
    destinationEntities: ["태국", "방콕"],
    originEntities: [],
    productTypes: ["hotel"],
    travelModes: ["air"],
    topicEntities: ["태국 여행", "방콕 호텔"],
    commercialSubject: "방콕 가족 호텔",
    campaignSeasonality: [],
    sourceKeywords: ["태국", "방콕", "호텔"],
    confidence: 0.85,
    derivationSources: ["test"],
  };
}

function bangkokSelection() {
  return {
    title: "방콕 가족 호텔 위치 vs 등급 — 부모님 동반 숙소 선택",
    summary:
      "방콕 가족여행에서 숙소 등급보다 BTS 접근성과 이동 편의가 후기에서 반복 언급되는 관측",
    contentObjective: "inform_travelers" as const,
    commercialIntent: "informational" as const,
    destinations: ["방콕", "태국"],
    topics: ["호텔", "가족여행", "숙소"],
    entities: [],
    researchBriefId: "rb_bangkok_hotel_test",
    agendaCandidateId: "ac_bangkok_hotel_test",
    evidenceRefs: [
      {
        evidenceId: "ev_bangkok_hotel_1",
        sourceId: "src_test",
        sourceType: "social",
        sourceName: "Test",
        isOfficial: false,
        evidenceType: "derived_signal",
        url: "https://example.com/bangkok-hotel",
        reference: "test:obs",
        excerpt: "방콕 가족여행 후기에서 숙소 위치와 BTS 접근성이 반복 언급됨",
        publishedAt: null,
        observedAt: "2026-09-09T15:10:00.000Z",
        credibilityHint: 0.4,
      },
    ],
  };
}

function makeMpr(logicalRunKey: string): MarketingProductionRequest {
  const iso = "2026-09-14T12:00:00.000Z";
  return {
    contract: MARKETING_PRODUCTION_REQUEST_CONTRACT,
    requestId: `mpr_${logicalRunKey.slice(-12)}`,
    logicalRunKey,
    slateId: "slate_test",
    slateItemId: "item_1",
    businessDateKst: "2026-09-14",
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
      title: bangkokSelection().title,
      summary: bangkokSelection().summary,
      agendaCandidateId: "ac_bangkok_hotel_test",
      researchBriefId: "rb_bangkok_hotel_test",
      rationale: [],
      recommendedChannel: "threads",
      recommendedFormats: [],
    },
    errorMessage: null,
    completedCandidateId: null,
    metadata: { productId: "prod_test" },
  };
}

function candidateSet(overrides: Partial<DurableStoryPointCandidateSet> = {}): DurableStoryPointCandidateSet {
  const primaryHash = createStoryPointHash(BANGKOK_STRONG);
  const altHash = createStoryPointHash(BANGKOK_ALTERNATE);
  return {
    contract: STORY_POINT_CANDIDATE_SET_CONTRACT,
    minerVersion: "story-miner-v1",
    agendaId: "ag_bangkok",
    assignmentId: "asgn_bangkok",
    inputRevision: "rev_test",
    logicalIdentity: "logical_test",
    createdAt: "2026-09-14T00:00:00.000Z",
    attempts: 1,
    llmCallCount: 1,
    outcome: "pass",
    skipReason: null,
    candidates: [BANGKOK_STRONG, BANGKOK_ALTERNATE],
    gateResults: [],
    selectedPointIds: [BANGKOK_STRONG.pointId, BANGKOK_ALTERNATE.pointId],
    primaryStoryPointId: BANGKOK_STRONG.pointId,
    alternateStoryPointIds: [BANGKOK_ALTERNATE.pointId],
    primaryStoryPointHash: primaryHash,
    diagnostics: {
      candidateCount: 2,
      passCount: 2,
      diversityRejectedCount: 0,
      identityRejectedCount: 0,
      mechanisms: ["counter_intuition"],
      selectedPrimaryTitle: BANGKOK_STRONG.storyQuestion,
      attemptSummaries: [],
    },
    ...overrides,
  };
}

function supportingBundle(): ExternalResearchBundle {
  return {
    available: true,
    providerId: "test",
    queryCount: 2,
    resultCount: 4,
    fetchedDocumentCount: 2,
    failedFetchCount: 0,
    totalFetchedBytes: 1200,
    officialSourceCount: 1,
    socialCommunitySourceCount: 1,
    runtimeMs: 100,
    queries: [
      "방콕 주요 숙박지역별 BTS MRT 접근성 차이",
      "부모님 동반 방콕 후기 숙소 위치 이동거리",
    ],
    evidence: [
      {
        evidenceId: "ext_support_1",
        url: "https://example.com/bts-access",
        title: "방콕 BTS 접근성과 숙소 위치",
        excerpt:
          "방콕 숙박지역별 BTS MRT 접근성 차이가 크며 부모님 동반 일정에서 위치가 호텔 등급만큼 중요하게 작용할 수 있다",
        sourceClass: "official",
        fromSnippetOnly: false,
        query: "방콕 주요 숙박지역별 BTS MRT 접근성 차이",
        purpose: "factual_verification",
      },
      {
        evidenceId: "ext_support_2",
        url: "https://example.com/reviews",
        title: "부모님 방콕 후기 숙소 위치",
        excerpt:
          "부모님 동반 후기에서 숙소 위치와 이동거리 불만이 반복적으로 나타나며 BTS 역세권 선택이 유의됨",
        sourceClass: "community",
        fromSnippetOnly: true,
        query: "부모님 동반 방콕 후기 숙소 위치 이동거리",
        purpose: "factual_verification",
      },
    ],
    observedAudienceQuestions: [],
    observedCompetitorHooks: [],
    limitations: [],
    plannedQueryCount: 2,
    attemptedQueryCount: 2,
    successfulQueryCount: 2,
    failedQueryCount: 0,
    retryCount: 0,
    usableResultCount: 2,
    searchRequestCount: 2,
    externalSearchStatus: "sufficient",
    providerCredentialPresent: true,
    providerSelected: "test",
    searchFailureCategories: [],
  };
}

function refutingBundle(): ExternalResearchBundle {
  return {
    ...supportingBundle(),
    evidence: [
      {
        evidenceId: "ext_refute_1",
        url: "https://example.com/refute",
        title: "호텔 등급이 더 중요",
        excerpt:
          "방콕에서는 호텔 등급이 위치보다 중요하며 숙소 위치는 상관없다는 반론이 우세하다",
        sourceClass: "community",
        fromSnippetOnly: true,
        query: "반론",
        purpose: "counterevidence",
      },
    ],
    externalSearchStatus: "partial",
  };
}

describe("ED-2 query planning", () => {
  it("builds researchQuestions-driven plan without broad travel tips", () => {
    const handoff = prepareManagerToContentHandoff(bangkokSelection(), {
      store: createInMemoryContentAssignmentStore(),
    });

    const plan = buildResearchQueryPlan({
      handoff,
      storyPoint: BANGKOK_STRONG,
      topicIdentity: thailandIdentity(),
      maxQueries: STORY_RESEARCH_MAX_QUERIES_PER_STORY,
    });

    expect(plan.storyPointTargeted).toBe(true);
    expect(plan.queries.length).toBeGreaterThan(0);
    expect(plan.queries.every((q) => !/여행\s*팁|관광지\s*추천|종합\s*가이드/.test(q.query))).toBe(true);
    expect(plan.queries.some((q) => /BTS|MRT|접근성/.test(q.query))).toBe(true);
    expect(plan.queries.some((q) => /부모님|위치|이동/.test(q.query))).toBe(true);
    expect(plan.identityDiagnostics.some((d) => /크루즈/.test(d.rejectedText ?? ""))).toBe(false);
  });

  it("blocks cruise queries for non-cruise identity", () => {
    const handoff = prepareManagerToContentHandoff(bangkokSelection(), {
      store: createInMemoryContentAssignmentStore(),
    });
    const cruiseDrift: StoryContentPoint = {
      ...BANGKOK_STRONG,
      researchQuestions: ["부산 출발 MSC 크루즈 탑승 동선은 어떤가?"],
    };
    const plan = buildResearchQueryPlan({
      handoff,
      storyPoint: cruiseDrift,
      topicIdentity: thailandIdentity(),
    });
    expect(plan.queries.some((q) => /크루즈|MSC/.test(q.query))).toBe(false);
    expect(plan.identityDiagnostics.length).toBeGreaterThan(0);
  });
});

describe("ED-2 adjudication", () => {
  const hash = createStoryPointHash(BANGKOK_STRONG);

  it("returns SUPPORTED with boundary for strong supporting evidence", () => {
    const brief = adjudicateStoryResearch({
      storyPoint: BANGKOK_STRONG,
      storyPointHash: hash,
      agendaLogicalIdentity: "logical_test",
      externalResearch: supportingBundle(),
      verdictOverride: "SUPPORTED",
      supportedClaimBoundaryOverride: BANGKOK_STRONG.storyClaim,
    });
    expect(brief.storySupportVerdict).toBe("SUPPORTED");
    expect(brief.supportedClaimBoundary).toBe(BANGKOK_STRONG.storyClaim);
    expect(assertStoryResearchCanProceed(brief).ok).toBe(true);
  });

  it("returns PARTIALLY_SUPPORTED with narrowed boundary", () => {
    const brief = adjudicateStoryResearch({
      storyPoint: BANGKOK_STRONG,
      storyPointHash: hash,
      agendaLogicalIdentity: "logical_test",
      externalResearch: supportingBundle(),
      verdictOverride: "PARTIALLY_SUPPORTED",
      supportedClaimBoundaryOverride:
        "부모님 동반 일정에서는 위치가 호텔 등급만큼 중요하게 작용할 수 있다",
    });
    expect(brief.storySupportVerdict).toBe("PARTIALLY_SUPPORTED");
    expect(brief.supportedClaimBoundary).toContain("부모님 동반");
    expect(brief.researchSupportedFraming.length).toBeGreaterThan(0);
    expect(assertStoryResearchCanProceed(brief).ok).toBe(true);
  });

  it("returns REFUTED and blocks CS", () => {
    const brief = adjudicateStoryResearch({
      storyPoint: BANGKOK_STRONG,
      storyPointHash: hash,
      agendaLogicalIdentity: "logical_test",
      externalResearch: refutingBundle(),
      verdictOverride: "REFUTED",
    });
    expect(brief.storySupportVerdict).toBe("REFUTED");
    expect(assertStoryResearchCanProceed(brief).ok).toBe(false);
    expect(assertStoryResearchCanProceed(brief).reason).toBe("story_point_refuted");
  });

  it("returns INSUFFICIENT_EVIDENCE when no usable evidence", () => {
    const brief = adjudicateStoryResearch({
      storyPoint: BANGKOK_STRONG,
      storyPointHash: hash,
      agendaLogicalIdentity: "logical_test",
      externalResearch: null,
      verdictOverride: "INSUFFICIENT_EVIDENCE",
    });
    expect(brief.storySupportVerdict).toBe("INSUFFICIENT_EVIDENCE");
    expect(assertStoryResearchCanProceed(brief).ok).toBe(false);
  });
});

describe("ED-2 ensureAudienceContentResearch story overlay", () => {
  it("uses targeted Bangkok queries and maps verdict to ACRB", async () => {
    const logicalRunKey = "daily-marketing-production:2026-09-14:bangkok-ed2";
    const repo = createInMemoryMarketingProductionRequestRepository();
    await repo.enqueue(makeMpr(logicalRunKey));
    const handoff = prepareManagerToContentHandoff(bangkokSelection(), {
      store: createInMemoryContentAssignmentStore(),
    });
    const hash = createStoryPointHash(BANGKOK_STRONG);

    const result = await ensureAudienceContentResearch({
      handoff,
      logicalRunKey,
      productionRequestRepo: repo,
      storyPoint: BANGKOK_STRONG,
      storyPointHash: hash,
      skipExternalResearch: true,
      externalResearch: supportingBundle(),
      verdictOverride: "PARTIALLY_SUPPORTED",
      supportedClaimBoundaryOverride:
        "부모님 동반 일정에서는 위치가 호텔 등급만큼 중요하게 작용할 수 있다",
    });

    expect(result.storyResearchCanProceed).toBe(true);
    expect(result.brief.researchVerdict).toBe("PROCEED_WITH_CAUTION");
    expect(result.brief.storyPointRef?.storyPointHash).toBe(hash);
    expect(result.brief.supportedClaimBoundary).toContain("부모님 동반");
    expect(result.brief.contentAngles[0]?.angle).toContain("부모님 동반");
    expect(result.brief.researchQuestionFindings?.length).toBe(
      BANGKOK_STRONG.researchQuestions.length,
    );
  });

  it("maps REFUTED to SKIP and storyResearchCanProceed false", async () => {
    const logicalRunKey = "daily-marketing-production:2026-09-14:bangkok-refuted";
    const repo = createInMemoryMarketingProductionRequestRepository();
    await repo.enqueue(makeMpr(logicalRunKey));
    const handoff = prepareManagerToContentHandoff(bangkokSelection(), {
      store: createInMemoryContentAssignmentStore(),
    });

    const result = await ensureAudienceContentResearch({
      handoff,
      logicalRunKey,
      productionRequestRepo: repo,
      storyPoint: BANGKOK_STRONG,
      storyPointHash: createStoryPointHash(BANGKOK_STRONG),
      skipExternalResearch: true,
      externalResearch: refutingBundle(),
      verdictOverride: "REFUTED",
    });

    expect(result.brief.researchVerdict).toBe("SKIP");
    expect(result.storyResearchCanProceed).toBe(false);
    expect(result.storyResearchSkipReason).toBe("story_point_refuted");
  });
});

describe("ED-2 ensureStoryTargetedResearch orchestration", () => {
  it("tries alternate when primary is insufficient and alternate is supported", async () => {
    const logicalRunKey = "daily-marketing-production:2026-09-14:alternate-fallback";
    const repo = createInMemoryMarketingProductionRequestRepository();
    await repo.enqueue(makeMpr(logicalRunKey));
    const handoff = prepareManagerToContentHandoff(bangkokSelection(), {
      store: createInMemoryContentAssignmentStore(),
    });

    const acrbModule = await import(
      "@/lib/marketing/audienceResearch/ensureAudienceContentResearch"
    );
    const original = acrbModule.ensureAudienceContentResearch;
    const ensureSpy = vi
      .spyOn(acrbModule, "ensureAudienceContentResearch")
      .mockImplementation(async (input) => {
        const isPrimary = input.storyPoint?.pointId === BANGKOK_STRONG.pointId;
        return original({
          ...input,
          skipExternalResearch: true,
          externalResearch: isPrimary ? refutingBundle() : supportingBundle(),
          verdictOverride: isPrimary ? "INSUFFICIENT_EVIDENCE" : "SUPPORTED",
        });
      });

    const result = await ensureStoryTargetedResearch({
      handoff,
      logicalRunKey,
      productionRequestRepo: repo,
      candidateSet: candidateSet(),
    });

    expect(ensureSpy.mock.calls.length).toBe(2);
    expect(result.alternateFallbackUsed).toBe(true);
    expect(result.storyResearchCanProceed).toBe(true);
    expect(result.selectedStoryPointId).toBe(BANGKOK_ALTERNATE.pointId);
    ensureSpy.mockRestore();
  });

  it("exhausts alternates when all fail", async () => {
    const logicalRunKey = "daily-marketing-production:2026-09-14:all-exhausted";
    const repo = createInMemoryMarketingProductionRequestRepository();
    await repo.enqueue(makeMpr(logicalRunKey));
    const handoff = prepareManagerToContentHandoff(bangkokSelection(), {
      store: createInMemoryContentAssignmentStore(),
    });

    const acrbModule = await import(
      "@/lib/marketing/audienceResearch/ensureAudienceContentResearch"
    );
    const original = acrbModule.ensureAudienceContentResearch;
    const ensureSpy = vi
      .spyOn(acrbModule, "ensureAudienceContentResearch")
      .mockImplementation(async (input) =>
        original({
          ...input,
          skipExternalResearch: true,
          externalResearch: refutingBundle(),
          verdictOverride: "REFUTED",
        }),
      );

    const result = await ensureStoryTargetedResearch({
      handoff,
      logicalRunKey,
      productionRequestRepo: repo,
      candidateSet: candidateSet(),
    });

    expect(ensureSpy.mock.calls.length).toBe(2);
    expect(result.storyResearchCanProceed).toBe(false);
    expect(result.storyResearchSkipReason).toBe("story_point_refuted");
    ensureSpy.mockRestore();
  });
});

describe("ED-2 cache identity", () => {
  it("reuses ACRB for same storyPointHash and misses when hash changes", async () => {
    const logicalRunKey = "daily-marketing-production:2026-09-14:cache-ed2";
    const repo = createInMemoryMarketingProductionRequestRepository();
    await repo.enqueue(makeMpr(logicalRunKey));
    const handoff = prepareManagerToContentHandoff(bangkokSelection(), {
      store: createInMemoryContentAssignmentStore(),
    });
    const hash = createStoryPointHash(BANGKOK_STRONG);
    const fingerprint = buildEvidenceFingerprint(handoff.contentAssignment.evidenceRefs ?? []);
    const identity = buildAcrbLogicalIdentity({
      selectedAgendaId: handoff.selectedAgenda.id,
      assignmentId: handoff.contentAssignment.assignmentId,
      evidenceFingerprint: fingerprint,
      preselectionResearchBriefId: handoff.selectedAgenda.provenance.researchBriefId ?? null,
      storyPointHash: hash,
      researchContractVersion: STORY_RESEARCH_CONTRACT_VERSION,
    });

    const first = await ensureAudienceContentResearch({
      handoff,
      logicalRunKey,
      productionRequestRepo: repo,
      storyPoint: BANGKOK_STRONG,
      storyPointHash: hash,
      skipExternalResearch: true,
      externalResearch: supportingBundle(),
      verdictOverride: "SUPPORTED",
    });
    expect(first.reused).toBe(false);
    expect(first.brief.logicalIdentity).toBe(identity);

    const second = await ensureAudienceContentResearch({
      handoff,
      logicalRunKey,
      productionRequestRepo: repo,
      storyPoint: BANGKOK_STRONG,
      storyPointHash: hash,
      skipExternalResearch: true,
      externalResearch: supportingBundle(),
      verdictOverride: "SUPPORTED",
    });
    expect(second.reused).toBe(true);

    const changedHash = createStoryPointHash(BANGKOK_ALTERNATE);
    const third = await ensureAudienceContentResearch({
      handoff,
      logicalRunKey,
      productionRequestRepo: repo,
      storyPoint: BANGKOK_ALTERNATE,
      storyPointHash: changedHash,
      forceRegenerate: true,
      skipExternalResearch: true,
      externalResearch: supportingBundle(),
      verdictOverride: "SUPPORTED",
    });
    expect(third.reused).toBe(false);
    expect(third.brief.logicalIdentity).not.toBe(identity);
  });
});

describe("ED-2 cost caps", () => {
  it("exports story research budget constants", () => {
    expect(STORY_RESEARCH_MAX_STORYPOINTS_PER_AGENDA).toBe(2);
    expect(STORY_RESEARCH_MAX_QUERIES_PER_STORY).toBe(6);
    expect(STORY_RESEARCH_MAX_TOTAL_SEARCH_REQUESTS).toBe(8);
  });
});
