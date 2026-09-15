import { describe, expect, it } from "vitest";

import {
  STORY_CANDIDATE_MAX,
  STORY_CANDIDATE_MIN,
  STORY_CONTENT_POINT_CONTRACT,
  STORY_SELECTED_TOP_K,
  type StoryContentPoint,
} from "@/lib/marketing/storyPoint/contracts";
import {
  evaluateStoryPointQuality,
  parseStoryContentPoint,
  selectTopStoryPoints,
  storyEvidenceAllowsContentStrategy,
} from "@/lib/marketing/storyPoint/evaluateStoryPointQuality";

function basePoint(overrides: Partial<StoryContentPoint> = {}): StoryContentPoint {
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

/** User-supplied structural FAIL example. */
const GENERIC_FAIL = basePoint({
  pointId: "sp_generic",
  storyQuestion: "태국 여행 시 살펴볼 점은?",
  whyInteresting: "태국 여행이 인기다",
  audienceTension: "여행 준비가 막막하다",
  curiosityGap: "태국 여행에는 여러 주의점이 있음",
  readerPayoff: "여행 준비에 도움이 됨",
  mechanisms: ["curiosity_gap"],
  researchNeeded: ["태국 여행 정보 조사"],
  researchQuestions: ["태국 여행 정보"],
  genericRisk: "리스트 나열",
});

/** User-supplied PASS-capable example (checklist wording OK if structure is concrete). */
const CONCRETE_PASS = basePoint({
  pointId: "sp_concrete",
  storyQuestion: "부모님과 방콕을 갈 때 호텔 등급보다 위치를 먼저 봐야 할까?",
  whyInteresting:
    "가족 여행에서 '좋은 호텔' 직관이 이동 불편으로 자주 깨진다는 현장 경험이 반복된다",
  audienceTension:
    "부모님을 모시고 갈 때 등급을 올리면 편할 것 같지만 이동이 어려우면 하루가 망가진다",
  curiosityGap:
    "높은 등급 호텔이 항상 가족여행에 더 좋은 선택이라는 직관과 실제 이동 편의가 충돌할 수 있음",
  readerPayoff: "부모님 동반 숙소를 고를 때 무엇을 우선 비교할지 판단 기준을 얻음",
  mechanisms: ["counter_intuition", "decision_relief"],
  researchNeeded: [
    "숙박 지역별 BTS 접근성",
    "대표 관광지 이동시간",
    "택시 의존도",
    "고령 동반 이동 부담 후기",
  ],
  researchQuestions: [
    "방콕 주요 숙박지역별 BTS/MRT 접근성 차이가 실제로 큰가?",
    "주요 관광지 이동시간에서 지역별 차이가 얼마나 발생하는가?",
    "부모님 동반 후기에서 숙소 위치/이동거리 불만이 반복적으로 나타나는가?",
    "높은 호텔 등급과 이동 편의 사이에 실제 trade-off 사례가 있는가?",
  ],
  genericRisk: "체크리스트로 붕괴할 수 있음",
  genericRiskMitigation: "우선순위 판단 기준 1개로 고정하고 항목 나열로 끝내지 않음",
  nonGoals: ["방콕 호텔 종합 가이드", "준비 체크리스트 나열"],
  channelPotential: {
    conversation: "high",
    visualExplainability: "medium",
    searchDepth: "high",
    shortformHookability: "high",
  },
});

describe("story point contracts", () => {
  it("keeps candidate batch bounds at 5–8 with top 1–3 selection", () => {
    expect(STORY_CANDIDATE_MIN).toBe(5);
    expect(STORY_CANDIDATE_MAX).toBe(8);
    expect(STORY_SELECTED_TOP_K).toBe(3);
  });
});

describe("evaluateStoryPointQuality — structural gate", () => {
  it("fails the structurally hollow '살펴볼 점' example", () => {
    const result = evaluateStoryPointQuality(GENERIC_FAIL);
    expect(result.verdict).toBe("fail");
    expect(result.hardFailReasons.length).toBeGreaterThan(0);
    expect(
      result.hardFailReasons.some((r) =>
        /curiosity_gap_structurally_generic|reader_payoff_structurally_generic|research_questions_not_falsifiable/.test(
          r,
        ),
      ),
    ).toBe(true);
  });

  it("passes a concrete decision-tension story even if checklist risk is acknowledged", () => {
    const result = evaluateStoryPointQuality(CONCRETE_PASS);
    expect(result.verdict).toBe("pass");
    expect(result.hardFailReasons).toEqual([]);
    expect(result.scores.composite).toBeGreaterThanOrEqual(0.42);
    expect(result.scores.researchability).toBeGreaterThan(0.5);
  });

  it("does not hard-fail solely because the title mentions 체크리스트/가이드", () => {
    const withChecklistWord = basePoint({
      ...CONCRETE_PASS,
      pointId: "sp_checklist_word",
      storyQuestion: "부모님 모시고 방콕 갈 때 숙소 예약 전에 확인할 3가지",
      nonGoals: ["종합 가이드"],
    });
    const result = evaluateStoryPointQuality(withChecklistWord);
    expect(result.verdict).toBe("pass");
    expect(result.hardFailReasons.some((r) => r.startsWith("phrase_"))).toBe(false);
  });

  it("soft-demerits cliché hooks without hard-failing a solid structure", () => {
    const spicyButSolid = basePoint({
      ...CONCRETE_PASS,
      pointId: "sp_spicy",
      storyClaim: "99%가 모르는 방콕 숙소 위치 trade-off",
    });
    const result = evaluateStoryPointQuality(spicyButSolid);
    expect(result.verdict).toBe("pass");
    expect(result.softDemerits.some((d) => d.code === "phrase_must_know")).toBe(true);
  });

  it("fails when researchQuestions are bare topic labels", () => {
    const result = evaluateStoryPointQuality(
      basePoint({
        ...CONCRETE_PASS,
        pointId: "sp_bad_qs",
        researchQuestions: ["방콕 호텔", "교통", "부모님 여행"],
      }),
    );
    expect(result.verdict).toBe("fail");
    expect(result.hardFailReasons).toContain("research_questions_not_falsifiable");
  });

  it("requires at least one mechanism", () => {
    const result = evaluateStoryPointQuality(
      basePoint({
        ...CONCRETE_PASS,
        pointId: "sp_no_mech",
        mechanisms: [],
      }),
    );
    expect(result.verdict).toBe("fail");
    expect(result.hardFailReasons).toContain("mechanism_required");
  });
});

describe("selectTopStoryPoints", () => {
  it("ranks PASS candidates and returns top K only", () => {
    const a = evaluateStoryPointQuality(CONCRETE_PASS, {
      agendaFit: 0.9,
      noveltyAgainstRecentContent: 0.9,
    });
    const b = evaluateStoryPointQuality(
      { ...CONCRETE_PASS, pointId: "sp_b" },
      { agendaFit: 0.4, noveltyAgainstRecentContent: 0.4 },
    );
    const fail = evaluateStoryPointQuality(GENERIC_FAIL);
    expect(a.verdict).toBe("pass");
    expect(b.verdict).toBe("pass");
    expect(fail.verdict).toBe("fail");

    const selected = selectTopStoryPoints([fail, b, a], STORY_SELECTED_TOP_K);
    expect(selected).not.toContain("sp_generic");
    expect(selected[0]).toBe("sp_concrete");
    expect(selected.length).toBeLessThanOrEqual(STORY_SELECTED_TOP_K);
  });
});

describe("parseStoryContentPoint", () => {
  it("accepts snake_case miner payloads", () => {
    const parsed = parseStoryContentPoint({
      id: "sp_snake",
      story_question: "질문인가?",
      curiosity_gap: "직관과 현실이 충돌할 수 있는 구체적인 빈칸이 있다",
      audience_tension: "부모님을 모시고 갈 때 등급과 위치 사이에서 헷갈린다",
      reader_payoff: "숙소 우선순위를 정하는 판단 기준을 얻는다",
      why_interesting: "가족 여행 숙소 후회 후기가 반복된다",
      mechanisms: ["decision_relief"],
      research_needed: ["지역별 이동"],
      research_questions: ["지역별 BTS 접근성 차이가 실제로 큰가?"],
      generic_risk: "리스트 붕괴",
      channel_potential: {
        conversation: "high",
        visual_explainability: "low",
        search_depth: "high",
        shortform_hookability: "medium",
      },
    });
    expect(parsed?.pointId).toBe("sp_snake");
    expect(parsed?.storyQuestion).toContain("질문");
    expect(parsed?.channelPotential.visualExplainability).toBe("low");
    expect(evaluateStoryPointQuality(parsed).verdict).toBe("pass");
  });
});

describe("storyEvidenceAllowsContentStrategy", () => {
  it("blocks REFUTED and INSUFFICIENT_EVIDENCE from reaching CS", () => {
    expect(storyEvidenceAllowsContentStrategy("SUPPORTED")).toBe(true);
    expect(storyEvidenceAllowsContentStrategy("PARTIALLY_SUPPORTED")).toBe(true);
    expect(storyEvidenceAllowsContentStrategy("REFUTED")).toBe(false);
    expect(storyEvidenceAllowsContentStrategy("INSUFFICIENT_EVIDENCE")).toBe(false);
  });
});
