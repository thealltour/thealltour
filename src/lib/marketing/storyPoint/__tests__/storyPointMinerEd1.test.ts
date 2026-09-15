import { describe, expect, it, vi } from "vitest";

import {
  AGENDA_TOPIC_IDENTITY_CONTRACT,
  type AgendaTopicIdentity,
} from "@/lib/marketing/audienceResearch/topicIdentity/contracts";
import {
  STORY_CANDIDATE_MAX,
  STORY_CANDIDATE_MIN,
  STORY_CONTENT_POINT_CONTRACT,
  STORY_MINE_MAX_ATTEMPTS,
  type StoryContentPoint,
} from "@/lib/marketing/storyPoint/contracts";
import {
  areEditorialParaphrases,
  assessCandidateDiversity,
} from "@/lib/marketing/storyPoint/diversity";
import { ensureStoryPointCandidateSet } from "@/lib/marketing/storyPoint/ensureStoryPointCandidateSet";
import { evaluateStoryPointQuality } from "@/lib/marketing/storyPoint/evaluateStoryPointQuality";
import { createStoryPointHash } from "@/lib/marketing/storyPoint/hash";
import { filterCandidatesByTopicIdentity } from "@/lib/marketing/storyPoint/identityGuard";

function point(overrides: Partial<StoryContentPoint> = {}): StoryContentPoint {
  return {
    contract: STORY_CONTENT_POINT_CONTRACT,
    pointId: "sp_base",
    storyQuestion: null,
    storyClaim: null,
    whyInteresting: "",
    audienceTension: "",
    curiosityGap: "",
    readerPayoff: "",
    mechanisms: [],
    researchNeeded: [],
    researchQuestions: [],
    genericRisk: "",
    genericRiskMitigation: null,
    channelPotential: {
      conversation: "medium",
      visualExplainability: "medium",
      searchDepth: "medium",
      shortformHookability: "medium",
    },
    nonGoals: [],
    agendaFitNotes: null,
    ...overrides,
  };
}

const STRONG = point({
  pointId: "sp_strong",
  storyQuestion: "부모님과 방콕을 갈 때 호텔 등급보다 위치를 먼저 봐야 할까?",
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
  nonGoals: ["방콕 호텔 종합 가이드"],
});

function thailandIdentity(): AgendaTopicIdentity {
  return {
    contract: AGENDA_TOPIC_IDENTITY_CONTRACT,
    destinationEntities: ["태국", "방콕"],
    originEntities: [],
    productTypes: ["destination_general"],
    travelModes: ["air"],
    topicEntities: ["태국 여행"],
    commercialSubject: "태국 여행",
    campaignSeasonality: [],
    sourceKeywords: ["태국", "방콕"],
    confidence: 0.8,
    derivationSources: ["test"],
  };
}

function packageIdentity(): AgendaTopicIdentity {
  return {
    contract: AGENDA_TOPIC_IDENTITY_CONTRACT,
    destinationEntities: ["나트랑", "베트남"],
    originEntities: ["부산"],
    productTypes: ["package"],
    travelModes: ["air"],
    topicEntities: ["가족 패키지"],
    commercialSubject: "부산 출발 나트랑 가족 패키지",
    campaignSeasonality: [],
    sourceKeywords: ["나트랑", "패키지", "가족"],
    confidence: 0.85,
    derivationSources: ["test"],
  };
}

describe("ED-1 diversity + gate", () => {
  it("keeps candidate bounds and passes a structurally strong point", () => {
    expect(STORY_CANDIDATE_MIN).toBe(5);
    expect(STORY_CANDIDATE_MAX).toBe(8);
    expect(STORY_MINE_MAX_ATTEMPTS).toBe(3);
    expect(evaluateStoryPointQuality(STRONG).verdict).toBe("pass");
  });

  it("flags checklist paraphrase sets as inadequate diversity", () => {
    const paraphrases = [
      "태국 여행 전에 확인할 3가지",
      "태국 가기 전에 봐야 할 5가지",
      "태국 여행 준비 체크리스트",
      "태국 여행에서 놓치면 안 될 것",
      "태국 여행 주의사항",
      "태국 여행 시 살펴볼 점",
    ].map((q, i) =>
      point({
        ...STRONG,
        pointId: `sp_p${i}`,
        storyQuestion: q,
        mechanisms: ["curiosity_gap"],
      }),
    );
    expect(areEditorialParaphrases(paraphrases[0]!, paraphrases[2]!)).toBe(true);
    const assessment = assessCandidateDiversity(paraphrases);
    expect(assessment.ok).toBe(false);
  });

  it("hashes story points stably without timestamps", () => {
    expect(createStoryPointHash(STRONG)).toBe(createStoryPointHash({ ...STRONG }));
  });
});

describe("ED-1 topic identity lock", () => {
  it("rejects Japan drift on Thailand agenda", () => {
    const drifted = point({
      ...STRONG,
      pointId: "sp_jp",
      storyQuestion: "도쿄만 보는 일정이 태국보다 나을까?",
      storyClaim: "일본 도쿄 중심 일정이 더 낫다",
    });
    const filtered = filterCandidatesByTopicIdentity({
      candidates: [STRONG, drifted],
      identity: thailandIdentity(),
    });
    expect(filtered.kept.map((c) => c.pointId)).toContain("sp_strong");
    expect(filtered.rejected.some((r) => r.pointId === "sp_jp")).toBe(true);
  });

  it("rejects cruise contamination on Nha Trang package agenda", () => {
    const cruise = point({
      ...STRONG,
      pointId: "sp_cruise",
      storyQuestion: "부산항 크루즈 승선이 나트랑 패키지보다 가족에게 편할까?",
      storyClaim: "MSC 벨리시마 승선이 더 편하다",
    });
    const ok = point({
      ...STRONG,
      pointId: "sp_nt",
      storyQuestion: "부산 출발 나트랑 가족 패키지에서 자유일정 비중이 클수록 피로가 커질까?",
      mechanisms: ["decision_relief"],
      curiosityGap: "패키지 포함과 자유일정의 피로 trade-off가 있을 수 있음",
      audienceTension: "가족은 여유를 원하지만 포함 일정이 줄면 이동 부담이 커질 수 있다",
      readerPayoff: "패키지 vs 자유일정 비중을 고르는 기준을 얻는다",
      researchQuestions: ["나트랑 가족 패키지 후기에서 자유일정 과다 불만이 반복되는가?"],
    });
    const filtered = filterCandidatesByTopicIdentity({
      candidates: [ok, cruise],
      identity: packageIdentity(),
    });
    expect(filtered.kept.map((c) => c.pointId)).toContain("sp_nt");
    expect(filtered.rejected.some((r) => r.pointId === "sp_cruise")).toBe(true);
  });
});

describe("ED-1 ensureStoryPointCandidateSet", () => {
  const handoff = {
    selectedAgenda: {
      id: "ag_thailand",
      title: "태국 여행 관심 증가",
      summary: "태국/방콕 관심 증가 시그널",
      rationale: ["검색·관심 증가"],
      destinations: ["태국", "방콕"],
      topics: ["태국 여행"],
      entities: ["태국", "방콕"],
      commercialIntent: "informational",
      evidenceRefs: [],
    },
    contentAssignment: {
      assignmentId: "as_1",
      objective: "태국 관심 증가에 대한 편집 포인트 발굴",
      topic: "태국 여행",
      destinations: ["태국", "방콕"],
      facts: [],
      evidenceRefs: [],
      commercialIntent: "informational",
    },
  } as any;

  function memoryRepo() {
    const store: { metadata: Record<string, unknown> } = { metadata: {} };
    return {
      async findByLogicalKey() {
        return {
          requestId: "req_1",
          logicalRunKey: "lrk_1",
          status: "RUNNING",
          metadata: store.metadata,
          updatedAt: new Date().toISOString(),
        } as any;
      },
      async update(next: any) {
        store.metadata = { ...next.metadata };
        return next;
      },
    };
  }

  function strongPayload() {
    return {
      candidates: Array.from({ length: 5 }, (_, i) => ({
        pointId: `strong_${i}`,
        storyQuestion:
          i === 0
            ? STRONG.storyQuestion
            : i === 1
              ? "일본 대신 태국을 찾는 이유가 실제 총여행비 때문일까?"
              : i === 2
                ? "방콕 숙소는 별점보다 위치가 더 중요한 경우가 있을까?"
                : i === 3
                  ? "부모님과 방콕 여행에서 젊은 여행자 동선을 그대로 쓰면 왜 힘들까?"
                  : "환전·교통 준비가 체감 만족을 좌우하는 구간이 따로 있을까?",
        whyInteresting: STRONG.whyInteresting,
        audienceTension: STRONG.audienceTension,
        curiosityGap: STRONG.curiosityGap,
        readerPayoff: STRONG.readerPayoff,
        mechanisms:
          i % 2 === 0
            ? ["counter_intuition", "decision_relief"]
            : ["curiosity_gap", "loss_avoidance"],
        researchNeeded: STRONG.researchNeeded,
        researchQuestions: STRONG.researchQuestions,
        genericRisk: STRONG.genericRisk,
        genericRiskMitigation: STRONG.genericRiskMitigation,
        nonGoals: STRONG.nonGoals,
        channelPotential: STRONG.channelPotential,
      })),
    };
  }

  function weakPayload() {
    return {
      candidates: Array.from({ length: STORY_CANDIDATE_MIN }, (_, i) => ({
        pointId: `weak_${i}`,
        storyQuestion: `태국 여행 시 살펴볼 점 ${i + 1}`,
        whyInteresting: "태국이 인기다",
        audienceTension: "준비가 막막하다",
        curiosityGap: "태국 여행에는 여러 주의점이 있음",
        readerPayoff: "여행 준비에 도움이 됨",
        mechanisms: ["curiosity_gap"],
        researchNeeded: ["태국 정보"],
        researchQuestions: ["태국 정보"],
        genericRisk: "리스트",
        nonGoals: [],
        channelPotential: STRONG.channelPotential,
      })),
    };
  }

  it("PASS path selects primary and reuses CandidateSet with 0 new LLM calls", async () => {
    const invoke = vi.fn(async () => JSON.stringify(strongPayload()));
    const repo = memoryRepo();
    const first = await ensureStoryPointCandidateSet({
      handoff,
      logicalRunKey: "lrk_1",
      productionRequestRepo: repo as any,
      invoke,
      now: new Date("2026-09-14T00:00:00.000Z"),
    });
    expect(first.reused).toBe(false);
    expect(first.candidateSet.outcome).toBe("pass");
    expect(first.candidateSet.primaryStoryPointId).toBeTruthy();
    expect(first.candidateSet.primaryStoryPointHash).toBeTruthy();
    expect(first.candidateSet.attempts).toBeLessThanOrEqual(STORY_MINE_MAX_ATTEMPTS);

    const calls = invoke.mock.calls.length;
    const second = await ensureStoryPointCandidateSet({
      handoff,
      logicalRunKey: "lrk_1",
      productionRequestRepo: repo as any,
      invoke,
      now: new Date("2026-09-14T01:00:00.000Z"),
    });
    expect(second.reused).toBe(true);
    expect(invoke.mock.calls.length).toBe(calls);
  });

  it("fail-closes to SKIP for persistently generic candidates (no fabricated story)", async () => {
    const invoke = vi.fn(async () => JSON.stringify(weakPayload()));
    const result = await ensureStoryPointCandidateSet({
      handoff,
      logicalRunKey: "lrk_weak",
      productionRequestRepo: memoryRepo() as any,
      invoke,
      now: new Date("2026-09-14T00:00:00.000Z"),
    });
    expect(result.candidateSet.outcome).toBe("skip");
    expect(result.candidateSet.primaryStoryPointId).toBeNull();
    expect(result.candidateSet.skipReason).toBeTruthy();
    expect(invoke.mock.calls.length).toBeGreaterThan(0);
  });
});
