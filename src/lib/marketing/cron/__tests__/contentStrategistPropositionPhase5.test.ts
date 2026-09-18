/**
 * CS Proposition Phase5 — archetype-aware PROPOSITION_RULES + STORY_LOCK editorialArchetype.
 */
import { describe, expect, it } from "vitest";

import {
  buildContentDraftPrompt,
  buildContentDraftSchemaRepairPrompt,
  buildContentDraftTopicIdentityRepairPrompt,
  PROPOSITION_RULES,
} from "@/lib/marketing/cron/marketingPlanSpecialists";
import type { ContentDraftRequest } from "@/lib/marketing/bot/organization/handoffs";
import {
  EVIDENCE_BACKED_STORY_BRIEF_CONTRACT,
  STORY_CONTENT_POINT_CONTRACT,
  type EvidenceBackedStoryBrief,
  type StoryContentPoint,
} from "@/lib/marketing/storyPoint/contracts";
import { createStoryPointHash } from "@/lib/marketing/storyPoint/hash";
import type { AudienceContentResearchBrief } from "@/lib/marketing/audienceResearch/contracts";
import { AUDIENCE_CONTENT_RESEARCH_BRIEF_CONTRACT } from "@/lib/marketing/audienceResearch/contracts";

function contrastStory(overrides: Partial<StoryContentPoint> = {}): StoryContentPoint {
  return {
    contract: STORY_CONTENT_POINT_CONTRACT,
    pointId: "sp_ext_contrast_phase5",
    storyQuestion:
      "다낭·푸꾸옥·호치민으로 익숙한 베트남과 북부 국경지대 Dao족 마을의 여행 경험은 무엇이 다를까",
    storyClaim: "북부 국경지대 Dao족·흙다짐 주택은 익숙한 해변·대도시 베트남과 다른 시각 리듬을 준다",
    whyInteresting: "관광청 원문에 Dao족과 nhà trình tường이 등장한다. 해변/도시 이미지와 다른 구체 장면이다.",
    audienceTension: "익숙한 휴양 이미지 vs 북부 산악 생활문화 디테일",
    curiosityGap: "같은 베트남이라도 북부 국경 흙담 풍경이 왜 다르게 읽히는지",
    readerPayoff: "다낭·푸꾸옥 프레임 밖에서 Dao족·흙다짐 주택을 찾는 시선",
    mechanisms: ["curiosity_gap", "counter_intuition"],
    researchNeeded: ["공식 안내에서 흙담/Dao족 언급"],
    researchQuestions: ["북부 국경지대 Dao족·흙다짐 주택이 공식·보도에 반복 등장하는가?"],
    genericRisk: "문화 일반론",
    genericRiskMitigation: "구체 건축·민족 디테일 고정",
    channelPotential: {
      conversation: "high",
      visualExplainability: "high",
      searchDepth: "medium",
      shortformHookability: "high",
    },
    nonGoals: ["베트남 종합 가이드", "예약 추천"],
    agendaFitNotes: "title:흙담 | archetype:contrast | source:external_editorial_director",
    editorialArchetype: "contrast",
    ...overrides,
  };
}

function decisionStory(): StoryContentPoint {
  return {
    ...contrastStory({
      pointId: "sp_bangkok_decision",
      storyQuestion: "부모님과 방콕을 갈 때 호텔 등급보다 위치를 먼저 봐야 할까?",
      storyClaim: "방콕 가족여행에서 숙소 위치가 호텔 등급만큼 중요할 수 있다",
      whyInteresting: "등급만 올리면 편할 것 같지만 이동이 길면 하루가 망가진다",
      audienceTension: "등급 vs 위치/이동 피로",
      curiosityGap: "높은 등급이 항상 더 좋다는 직관과 이동 편의가 충돌한다",
      readerPayoff: "부모님 동반 숙소 우선 비교 기준",
      mechanisms: ["decision_relief", "counter_intuition"],
      researchQuestions: ["방콕 주요 숙박지역별 BTS 접근성 차이가 큰가?"],
      editorialArchetype: "worth_it_or_not",
      agendaFitNotes: null,
      nonGoals: ["방콕 호텔 종합 가이드"],
    }),
  };
}

function briefFor(story: StoryContentPoint): AudienceContentResearchBrief {
  const hash = createStoryPointHash(story);
  const evidence: EvidenceBackedStoryBrief = {
    contract: EVIDENCE_BACKED_STORY_BRIEF_CONTRACT,
    storyPointId: story.pointId,
    storyPointHash: hash,
    storySupportVerdict: "PARTIALLY_SUPPORTED",
    supportedClaimBoundary: story.storyClaim
      ? `${story.storyClaim} — 증거 범위 안에서만 말함`
      : "증거 범위 안에서만 말함",
    researchQuestionFindings: [
      {
        question: story.researchQuestions[0] ?? "q",
        status: "partial",
        finding: "공식·보도에서 관련 디테일이 부분적으로 관측된다",
        evidenceRefs: ["ev1"],
      },
    ],
    contradictedClaims: [],
    unresolvedQuestions: ["현장 체감 강도는 미확인"],
    researchSupportedFraming: ["Story 디테일을 탐색 포인트로 볼 단서가 있다"],
    limitations: ["실제 방문 경험은 추가 확인 필요"],
    adjudicationNotes: "phase5-cs",
    usableFactIds: ["ev1"],
  };
  return {
    contract: AUDIENCE_CONTENT_RESEARCH_BRIEF_CONTRACT,
    version: 1,
    id: "acrb_phase5_cs",
    logicalIdentity: "acrb_phase5_cs",
    generatedAt: "2026-09-18T00:00:00.000Z",
    selectedAgendaId: "ag_phase5",
    assignmentId: "asg_phase5",
    researchStatus: "complete",
    sourceCoverage: {
      internalMemory: false,
      productFacts: false,
      externalWebSearch: true,
      notes: [],
    },
    audience: {
      primary: [{ text: "베트남 재방문 관심 한국 여행자", confidence: "medium" }],
      motivations: [{ text: "익숙한 휴양 외 새로운 장면", confidence: "medium" }],
      anxieties: [{ text: "일정이 막연할까", confidence: "low" }],
      objections: [],
      decisionTriggers: [{ text: "다음 일정에 어디를 넣을지", confidence: "low" }],
    },
    searchIntent: {
      primaryIntent: "explore",
      questions: [{ text: story.storyQuestion ?? "q", confidence: "medium" }],
    },
    marketSignals: {
      contentGaps: [{ text: "해변 프레임 밖 북부 디테일 부족", confidence: "medium" }],
      saturatedAngles: [],
    },
    researchFindings: [],
    contentAngles: [
      {
        angleId: "ang1",
        angle: story.storyClaim ?? "angle",
        audienceTension: story.audienceTension,
        evidenceStrength: "medium",
        channelFit: { threads: "high", shortform: "high", naver_blog: "medium" },
      },
    ],
    recommendedAngleId: "ang1",
    recommendedAngleReason: "story lock",
    researchVerdict: "usable",
    verdictReasons: [],
    limitations: evidence.limitations,
    provenance: { agendaCandidateId: "ag_phase5", sources: [] },
    topicIdentity: null,
    identityDiagnostics: [],
    storyPointRef: {
      storyPointId: story.pointId,
      storyPointHash: hash,
      researchContractVersion: "story-research-v1",
    },
    storyPointHash: hash,
    storySupportVerdict: "PARTIALLY_SUPPORTED",
    supportedClaimBoundary: evidence.supportedClaimBoundary,
    researchQuestionFindings: evidence.researchQuestionFindings,
    contradictedClaims: [],
    unresolvedQuestions: evidence.unresolvedQuestions,
    evidenceBackedStoryBrief: evidence,
  } as AudienceContentResearchBrief;
}

function draftPayload(story: StoryContentPoint): ContentDraftRequest {
  const acrb = briefFor(story);
  return {
    productId: "theall_travel",
    channel: "threads",
    goal: "draft",
    agenda: "베트남 북부",
    brief: acrb,
    audienceContentResearchBrief: acrb,
    agendaTopicIdentity: null,
    constraints: [],
    memoryReferences: [],
    authoritativeStoryPoint: story,
  };
}

describe("CS Proposition Phase5 archetype alignment", () => {
  it("STORY_LOCK includes editorialArchetype from StoryPoint", () => {
    const prompt = buildContentDraftPrompt(draftPayload(contrastStory()));
    expect(prompt).toContain("AUTHORITATIVE_STORY_LOCK");
    expect(prompt).toContain('"editorialArchetype":"contrast"');
  });

  it("recovers archetype from agendaFitNotes when field null", () => {
    const story = contrastStory({
      editorialArchetype: null,
      agendaFitNotes: "title:x | archetype:cultural_curiosity | source:external_editorial_director",
    });
    const prompt = buildContentDraftPrompt(draftPayload(story));
    expect(prompt).toContain('"editorialArchetype":"cultural_curiosity"');
  });

  it("discovery-like rules forbid inventing decision/trade-off; allow knowledge-gap semantics", () => {
    expect(PROPOSITION_RULES).toContain("ARCHETYPE-AWARE PROPOSITION SEMANTICS");
    expect(PROPOSITION_RULES).toContain("DISCOVERY-LIKE archetypes");
    expect(PROPOSITION_RULES).toContain("Do NOT invent a purchase/selection/decision problem");
    expect(PROPOSITION_RULES).toContain("Do NOT force A-vs-B comparison");
    expect(PROPOSITION_RULES).toContain("knowledge gap");
    expect(PROPOSITION_RULES).toContain("Prefer curiosityGap / audienceTension");
    expect(PROPOSITION_RULES).toContain("do not force decision criteria");
    expect(PROPOSITION_RULES).toContain("do NOT force decision aid for discovery-like Stories");
    // Universal decision forcing must be gone as a global (non-branched) rule.
    expect(PROPOSITION_RULES).not.toMatch(
      /^audienceProblem: one concrete decision problem/m,
    );
    const prompt = buildContentDraftPrompt(draftPayload(contrastStory()));
    expect(prompt).toContain("DISCOVERY-LIKE archetypes");
    expect(prompt).toContain("Do not invent stakes merely to make the proposition feel actionable");
  });

  it("decision/practical rules still allow concrete decision problem + tradeoff", () => {
    expect(PROPOSITION_RULES).toContain("DECISION / PRACTICAL-LIKE archetypes");
    expect(PROPOSITION_RULES).toContain(
      "audienceProblem: one concrete decision problem (not '여행 준비가 어렵다').",
    );
    expect(PROPOSITION_RULES).toContain("decision-relevant tradeoff");
    expect(PROPOSITION_RULES).toContain("anxieties/decisionTriggers from ACRB may be used");
    const prompt = buildContentDraftPrompt(draftPayload(decisionStory()));
    expect(prompt).toContain('"editorialArchetype":"worth_it_or_not"');
    expect(prompt).toContain("DECISION / PRACTICAL-LIKE archetypes");
  });

  it("schema + topic-identity repair prompts reuse archetype-aware PROPOSITION_RULES", () => {
    const payload = draftPayload(contrastStory());
    const schema = buildContentDraftSchemaRepairPrompt(payload, "wrong_primitive_type", "proposition");
    const identity = buildContentDraftTopicIdentityRepairPrompt(payload, [
      "proposition.contentPromise:generic",
    ]);
    for (const repair of [schema, identity]) {
      expect(repair).toContain("ARCHETYPE-AWARE PROPOSITION SEMANTICS");
      expect(repair).toContain("DISCOVERY-LIKE archetypes");
      expect(repair).toContain('"editorialArchetype":"contrast"');
      expect(repair).toContain("Do NOT invent a purchase/selection/decision problem");
    }
  });

  it("readerGain / engagementMechanism wording is archetype-matched, not decision-only", () => {
    expect(PROPOSITION_RULES).toMatch(/understanding, distinctions, questions/);
    expect(PROPOSITION_RULES).toMatch(/insight worth remembering/);
    expect(PROPOSITION_RULES).toMatch(/Match the Story archetype/);
  });
});
