/**
 * PR1 — External Story normalization keeps structured Story semantics distinct.
 * Discovery Stories must not gain a decision frame from normalization.
 */
import { describe, expect, it } from "vitest";

import type { AgendaSlateCandidate, DailyAgendaSlate } from "@/lib/marketing/cron/daily/agendaSlate/types";
import {
  AGENDA_SLATE_CANDIDATE_CONTRACT,
  DAILY_AGENDA_SLATE_CONTRACT,
} from "@/lib/marketing/cron/daily/agendaSlate/types";
import { createInMemoryMarketingProductionRequestRepository } from "@/lib/marketing/cron/daily/repository/createMarketingProductionRequestRepository";
import { buildContentDraftPrompt } from "@/lib/marketing/cron/marketingPlanSpecialists";
import {
  EXTERNAL_EDITORIAL_DIRECTOR_CONTRACT,
  type ExternalStoryCandidate,
} from "@/lib/marketing/editorialDirector/contracts";
import { importExternalEditorialDirector } from "@/lib/marketing/editorialDirector/importExternalStories";
import { normalizeExternalStoryToPoint } from "@/lib/marketing/editorialDirector/normalizeExternalStory";
import { parseExternalEditorialDirectorPayload } from "@/lib/marketing/editorialDirector/parseExternalPayload";
import { resolveStoryEditorialArchetype } from "@/lib/marketing/canonicalAsset/revisions";
import {
  PRODUCTION_REQUEST_STORY_POINT_METADATA_KEY,
  STORY_CONTENT_POINT_CONTRACT,
  STORY_POINT_CANDIDATE_SET_CONTRACT,
  type StoryContentPoint,
} from "@/lib/marketing/storyPoint/contracts";
import { evaluateStoryPointQuality } from "@/lib/marketing/storyPoint/evaluateStoryPointQuality";
import { createStoryPointHash } from "@/lib/marketing/storyPoint/hash";
import { listPassStoryCandidates } from "@/lib/marketing/storyPoint/humanStorySelection";
import { parseDurableStoryPointCandidateSet } from "@/lib/marketing/storyPoint/persistence";
import { projectStoryPointForPrompt } from "@/lib/marketing/storyPoint/promptProjection";

const AGENDA_ID = "asc_pr1_discovery_agenda";

function discoveryCandidate(overrides: Partial<ExternalStoryCandidate> = {}): ExternalStoryCandidate {
  return {
    externalStoryId: "ext_pr1_discovery",
    storyTitleKo: "닌빈 석회암 사이의 수상 사원",
    storyQuestionKo: "닌빈 석회암 봉우리 사이 수상 사원은 하롱베이 풍경과 무엇이 다를까?",
    storyClaimKo: null,
    audienceProblemKo: null,
    decisionAtStakeKo: null,
    stakes: [],
    whyKoreanTravelerCaresKo: null,
    whyInterestingKo: "관광청 자료에 닌빈 수상 사원과 석회암 동굴 뱃길이 함께 소개된다.",
    audienceTensionKo: "익숙한 하롱베이 크루즈 이미지와 닌빈 내륙 뱃길 풍경의 차이",
    curiosityGapKo: "같은 석회암 지형인데 닌빈 뱃길은 왜 전혀 다른 장면으로 읽히는지",
    readerPayoffKo: "닌빈 뱃길과 수상 사원을 새로운 베트남 풍경으로 볼 구체 단서",
    editorialArchetype: "discovery",
    researchNeededKo: ["닌빈 뱃길 공식 안내"],
    researchQuestionsKo: ["닌빈 수상 사원과 뱃길이 공식 관광 자료에 반복 소개되는가?"],
    recommendedChannels: ["threads", "instagram"],
    channelReasonKo: "사진 중심 풍경 소개에 적합",
    riskKo: "풍경 일반론으로 흐를 위험",
    nonGoalsKo: ["베트남 전역 가이드"],
    ...overrides,
  };
}

function decisionCandidate(): ExternalStoryCandidate {
  return discoveryCandidate({
    externalStoryId: "ext_pr1_decision",
    storyTitleKo: "부모님과 닌빈, 당일치기 vs 1박",
    storyQuestionKo: "부모님과 닌빈을 갈 때 하노이 당일치기보다 1박이 나을까?",
    audienceProblemKo: "부모님 체력과 이동 시간 부담",
    decisionAtStakeKo: "닌빈 당일치기 vs 1박 일정",
    stakes: ["이동 피로", "일정 비용"],
    whyKoreanTravelerCaresKo: "짧은 휴가에서 이동으로 하루를 잃으면 손해가 크다",
    whyInterestingKo: "하노이 출발 당일치기 상품이 많지만 이동 시간이 길다는 후기도 있다.",
    audienceTensionKo: "당일치기 편의 vs 1박으로 얻는 이동 여유와 체력 부담 사이 갈등",
    curiosityGapKo: "당일치기가 더 효율적이라는 직관과 실제 이동 피로가 충돌하는지",
    readerPayoffKo: "부모님 동반 닌빈 일정 길이를 판단할 기준을 얻는다",
    editorialArchetype: "worth_it_or_not",
    researchQuestionsKo: ["하노이-닌빈 당일치기 후기에서 이동 피로가 반복 언급되는가?"],
    channelReasonKo: "가족 상담형 채널",
  });
}

function slateItem(): AgendaSlateCandidate {
  return {
    contract: AGENDA_SLATE_CANDIDATE_CONTRACT,
    slateItemId: AGENDA_ID,
    state: "AVAILABLE",
    origin: "organic_research",
    deferredFromBusinessDateKst: null,
    deferredFromSlateItemId: null,
    agendaCandidateId: "ac_pr1",
    researchBriefId: "rb_pr1",
    canonicalArticleIds: [],
    title: "베트남 닌빈 석회암 뱃길",
    summary: "닌빈 수상 사원과 석회암 뱃길 풍경",
    score: 0.72,
    scoreReasons: ["fresh"],
    destinations: ["베트남", "닌빈"],
    topics: ["풍경", "문화"],
    entities: ["닌빈"],
    audienceHint: "한국 여행자",
    rationale: ["MM 추천"],
    recommendedFormats: ["threads_text"],
    recommendedChannel: "threads",
    evidenceSummary: [
      {
        evidenceId: "ev_pr1",
        sourceId: "src_pr1",
        sourceName: "Vietnam Tourism RSS",
        sourceType: "rss",
        isOfficial: true,
        url: "https://example.com/ninh-binh",
        excerpt: "Ninh Binh boat routes and floating pagoda",
      },
    ],
    matchedProductIds: [],
    riskFlags: [],
    editorial: {
      freshnessWhyNow: "최근 관측",
      koreanTravelerRelevance: "새로운 풍경",
      practicalTravelValue: null,
      theAllTourBusinessRelevance: null,
      contentPotential: "story 확장 가능",
    },
    researchSnapshot: {
      freshnessScore: 0.8,
      credibilityScore: 0.7,
      travelRelevanceScore: 0.75,
      totalResearchScore: 0.78,
    },
  };
}

function makeSlate(): DailyAgendaSlate {
  return {
    contract: DAILY_AGENDA_SLATE_CONTRACT,
    slateId: "das_pr1",
    logicalRunKey: "daily-agenda:2026-09-28",
    businessDateKst: "2026-09-28",
    routineId: "daily-marketing",
    runId: "run_pr1",
    correlationId: "corr_pr1",
    createdAt: "2026-09-28T00:00:00.000Z",
    updatedAt: "2026-09-28T00:00:00.000Z",
    status: "ready_for_human_selection",
    targetSize: 1,
    researchStatus: "complete",
    degraded: false,
    candidates: [slateItem()],
    cooldown: { days: 7, excludedAgendaCandidateIds: [], excludedBriefIds: [] },
    curation: { mode: "manager_curated", managerMessage: "test" },
    observability: {
      organicCount: 1,
      deferredCarryoverCount: 0,
      availableCount: 1,
      selectedTodayCount: 0,
    },
    metadata: {},
  };
}

function rawPayload(stories: ExternalStoryCandidate[], channelPotential?: Record<string, number>) {
  return JSON.stringify({
    contract: EXTERNAL_EDITORIAL_DIRECTOR_CONTRACT,
    agendaEvaluation: [
      {
        agendaId: AGENDA_ID,
        overallRank: 1,
        channelPotential: channelPotential ?? {
          threads: 70,
          naverBlog: 60,
          naverBand: 40,
          kakaoChannel: 40,
          shortform: 65,
        },
        reasonKo: "풍경 디테일이 분명함",
        weaknessKo: null,
      },
    ],
    selectedAgenda: { agendaId: AGENDA_ID, rank: 1, reasonKo: "구체 장면", noneStrongEnough: false },
    storyCandidates: stories,
  });
}

function csPromptFor(point: StoryContentPoint): string {
  return buildContentDraftPrompt({
    productId: "theall_travel",
    channel: "threads",
    goal: "draft",
    agenda: "베트남 닌빈",
    brief: null,
    audienceContentResearchBrief: null,
    agendaTopicIdentity: null,
    constraints: [],
    memoryReferences: [],
    authoritativeStoryPoint: point,
  });
}

describe("External Story normalization — discovery semantics (PR1)", () => {
  it("1. discovery Story with null decisionAtStake / empty stakes gains no decision frame", () => {
    const point = normalizeExternalStoryToPoint(discoveryCandidate(), AGENDA_ID);
    expect(point.whyInteresting).toBe(discoveryCandidate().whyInterestingKo);
    expect(point.whyInteresting).not.toContain("선택:");
    expect(point.decisionAtStake).toBeNull();
    expect(point.stakes).toEqual([]);
    expect(point.mechanisms).not.toContain("decision_relief");

    const prompt = csPromptFor(point);
    expect(prompt).toContain("AUTHORITATIVE_STORY_LOCK");
    expect(prompt).not.toContain("선택:");
    expect(prompt).not.toContain("스테이크:");
    expect(prompt).not.toContain("decision_relief");
  });

  it("2. discovery Story with advisory decisionAtStake keeps it separate, not merged into prose", () => {
    const candidate = discoveryCandidate({ decisionAtStakeKo: "다음 베트남 일정 후보에 넣을지" });
    const point = normalizeExternalStoryToPoint(candidate, AGENDA_ID);
    expect(point.whyInteresting).toBe(candidate.whyInterestingKo);
    expect(point.decisionAtStake).toBe("다음 베트남 일정 후보에 넣을지");
    expect(csPromptFor(point)).not.toContain("다음 베트남 일정 후보에 넣을지");
  });

  it("3. decision/practical Story preserves genuine decisionAtStake + stakes structurally", () => {
    const candidate = decisionCandidate();
    const point = normalizeExternalStoryToPoint(candidate, AGENDA_ID);
    expect(point.decisionAtStake).toBe("닌빈 당일치기 vs 1박 일정");
    expect(point.stakes).toEqual(["이동 피로", "일정 비용"]);
    expect(point.whyInteresting).toBe(candidate.whyInterestingKo);
    expect(point.mechanisms).toContain("decision_relief");
    const prompt = csPromptFor(point);
    expect(prompt).toContain("닌빈 당일치기 vs 1박 일정");
    expect(prompt).toContain("이동 피로");
  });

  it("discovery projection strips decision context even when archetype only lives in agendaFitNotes", () => {
    const point = normalizeExternalStoryToPoint(
      discoveryCandidate({ editorialArchetype: "hidden_detail", decisionAtStakeKo: "갈지 말지", stakes: ["시간"] }),
      AGENDA_ID,
    );
    const legacyStyle: StoryContentPoint = { ...point };
    delete legacyStyle.editorialArchetype;
    expect(resolveStoryEditorialArchetype(legacyStyle)).toBe("hidden_detail");
    const projected = projectStoryPointForPrompt(legacyStyle);
    expect(projected).not.toHaveProperty("decisionAtStake");
    expect(projected).not.toHaveProperty("stakes");
    expect(projected.whyInteresting).toBe(point.whyInteresting);
    expect(csPromptFor(legacyStyle)).not.toContain("갈지 말지");
  });

  it("4. audienceProblem and whyKoreanTravelerCares are preserved separately, not duplicated", () => {
    const candidate = decisionCandidate();
    const point = normalizeExternalStoryToPoint(candidate, AGENDA_ID);
    expect(point.audienceProblem).toBe("부모님 체력과 이동 시간 부담");
    expect(point.whyKoreanTravelerCares).toBe("짧은 휴가에서 이동으로 하루를 잃으면 손해가 크다");
    expect(point.whyInteresting).not.toContain("문제:");
    expect(point.whyInteresting).not.toContain("한국 여행자:");
    expect(point.whyInteresting).not.toContain("부모님 체력과 이동 시간 부담");
  });

  it("5. channelReasonKo never populates genericRiskMitigation", () => {
    for (const candidate of [discoveryCandidate(), decisionCandidate()]) {
      const point = normalizeExternalStoryToPoint(candidate, AGENDA_ID);
      expect(point.genericRiskMitigation).toBeNull();
      expect(point.channelReason).toBe(candidate.channelReasonKo);
      expect(point.genericRisk).toBe(candidate.riskKo);
    }
  });

  it("6. instagram accepted in recommendedChannels and channelPotential; five legacy channels still pass", () => {
    const parsed = parseExternalEditorialDirectorPayload(
      rawPayload(
        [
          discoveryCandidate({
            recommendedChannels: [
              "threads",
              "shortform",
              "naver_blog",
              "naver_band",
              "kakao_channel",
              "instagram",
            ],
          }),
        ],
        { threads: 70, naverBlog: 60, naverBand: 40, kakaoChannel: 40, shortform: 65, instagram: 88 },
      ),
    );
    expect(parsed.ok).toBe(true);
    if (!parsed.ok) return;
    expect(parsed.payload.storyCandidates[0]!.recommendedChannels).toEqual([
      "threads",
      "shortform",
      "naver_blog",
      "naver_band",
      "kakao_channel",
      "instagram",
    ]);
    expect(parsed.payload.agendaEvaluation[0]!.channelPotential).toEqual({
      threads: 70,
      naverBlog: 60,
      naverBand: 40,
      kakaoChannel: 40,
      shortform: 65,
      instagram: 88,
    });

    const legacy = parseExternalEditorialDirectorPayload(rawPayload([discoveryCandidate({ recommendedChannels: ["threads"] })]));
    expect(legacy.ok).toBe(true);
    if (!legacy.ok) return;
    expect(legacy.payload.agendaEvaluation[0]!.channelPotential.instagram).toBeNull();
  });

  it("import persists structured fields and discovery whyInteresting without decision prose", async () => {
    const repo = createInMemoryMarketingProductionRequestRepository();
    const parsed = parseExternalEditorialDirectorPayload(rawPayload([discoveryCandidate(), decisionCandidate()]));
    expect(parsed.ok).toBe(true);
    if (!parsed.ok) return;
    const result = await importExternalEditorialDirector({
      slate: makeSlate(),
      payload: parsed.payload,
      productionRequestRepo: repo,
    });
    const set = parseDurableStoryPointCandidateSet(
      result.request.metadata[PRODUCTION_REQUEST_STORY_POINT_METADATA_KEY],
    );
    expect(set).not.toBeNull();
    const pass = listPassStoryCandidates(set!).map((p) => p.point);
    expect(pass).toHaveLength(2);
    const discovery = pass.find((p) => p.editorialArchetype === "discovery")!;
    const decision = pass.find((p) => p.editorialArchetype === "worth_it_or_not")!;
    expect(discovery.whyInteresting).not.toContain("선택:");
    expect(discovery.decisionAtStake).toBeNull();
    expect(discovery.stakes).toEqual([]);
    expect(decision.decisionAtStake).toBe("닌빈 당일치기 vs 1박 일정");
    expect(decision.stakes).toEqual(["이동 피로", "일정 비용"]);
    expect(decision.genericRiskMitigation).toBeNull();
  });
});

describe("External Story normalization — legacy StoryContentPoint compatibility (PR1)", () => {
  const legacyPoint = {
    contract: STORY_CONTENT_POINT_CONTRACT,
    pointId: "sp_ext_legacy_shape_0001",
    storyQuestion: "부모님과 닌빈을 갈 때 하노이 당일치기보다 1박이 나을까?",
    storyClaim: null,
    whyInteresting:
      "하노이 출발 당일치기 상품이 많다. (문제: 부모님 체력 · 선택: 당일치기 vs 1박 · 스테이크: 이동 피로)",
    audienceTension: "당일치기 편의 vs 1박으로 얻는 이동 여유와 체력 부담 사이 갈등",
    curiosityGap: "당일치기가 더 효율적이라는 직관과 실제 이동 피로가 충돌하는지",
    readerPayoff: "부모님 동반 닌빈 일정 길이를 판단할 기준을 얻는다",
    mechanisms: ["decision_relief"],
    researchNeeded: ["당일치기 후기"],
    researchQuestions: ["하노이-닌빈 당일치기 후기에서 이동 피로가 반복 언급되는가?"],
    genericRisk: "일반론",
    genericRiskMitigation: "가족 상담형 채널",
    channelPotential: {
      conversation: "high",
      visualExplainability: "medium",
      searchDepth: "medium",
      shortformHookability: "medium",
    },
    nonGoals: [],
    agendaFitNotes: "title:닌빈 | archetype:worth_it_or_not | source:external_editorial_director",
  } satisfies StoryContentPoint;

  it("7. persisted legacy shape (no structured fields) still reads, gates, and hashes", () => {
    const set = parseDurableStoryPointCandidateSet({
      contract: STORY_POINT_CANDIDATE_SET_CONTRACT,
      minerVersion: EXTERNAL_EDITORIAL_DIRECTOR_CONTRACT,
      agendaId: "ag_legacy",
      assignmentId: "asg_legacy",
      inputRevision: "rev_legacy",
      outcome: "pass",
      candidates: [legacyPoint],
      gateResults: [evaluateStoryPointQuality(legacyPoint)],
      selectedPointIds: [legacyPoint.pointId],
      primaryStoryPointId: legacyPoint.pointId,
    });
    expect(set).not.toBeNull();
    const [row] = listPassStoryCandidates(set!);
    expect(row?.point.pointId).toBe(legacyPoint.pointId);
    expect(row?.point.decisionAtStake).toBeUndefined();
    expect(row?.point.whyInteresting).toBe(legacyPoint.whyInteresting);
    expect(createStoryPointHash(row!.point)).toBe(createStoryPointHash(legacyPoint));
    expect(resolveStoryEditorialArchetype(row!.point)).toBe("worth_it_or_not");
    expect(csPromptFor(row!.point)).toContain("AUTHORITATIVE_STORY_LOCK");
    expect(projectStoryPointForPrompt(row!.point)).toBe(row!.point);
  });
});
