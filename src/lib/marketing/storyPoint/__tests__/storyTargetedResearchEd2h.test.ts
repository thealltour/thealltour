/**
 * ED-2H — ACRB Story overlay round-trip + synthesis StoryPoint injection.
 */

import { describe, expect, it } from "vitest";

import {
  AUDIENCE_CONTENT_RESEARCH_BRIEF_CONTRACT,
  ACRB_CONTRACT_VERSION,
  type AudienceContentResearchBrief,
} from "@/lib/marketing/audienceResearch/contracts";
import { parseAudienceContentResearchBrief } from "@/lib/marketing/audienceResearch/validate";
import { buildSynthesisPrompt } from "@/lib/marketing/audienceResearch/synthesize";
import type { AcrbGatheredInputs } from "@/lib/marketing/audienceResearch/gatherInputs";
import { prepareManagerToContentHandoff } from "@/lib/marketing/content/prepareManagerToContentHandoff";
import { createInMemoryContentAssignmentStore } from "@/lib/marketing/content/store/contentAssignmentStore";
import {
  EVIDENCE_BACKED_STORY_BRIEF_CONTRACT,
  STORY_CONTENT_POINT_CONTRACT,
  STORY_RESEARCH_CONTRACT_VERSION,
  type EvidenceBackedStoryBrief,
  type StoryContentPoint,
} from "@/lib/marketing/storyPoint/contracts";
import { createStoryPointHash } from "@/lib/marketing/storyPoint/hash";
import { validateStoryResearchLock } from "@/lib/marketing/storyPoint/researchLock";
import {
  AGENDA_TOPIC_IDENTITY_CONTRACT,
  type AgendaTopicIdentity,
} from "@/lib/marketing/audienceResearch/topicIdentity/contracts";
import { assertStoryResearchCanProceed } from "@/lib/marketing/storyPoint/adjudicateStoryResearch";

const BANGKOK: StoryContentPoint = {
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
  nonGoals: ["방콕 호텔 종합 가이드", "방콕 여행 준비 팁"],
  agendaFitNotes: null,
};

function bangkokIdentity(): AgendaTopicIdentity {
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
    researchBriefId: "rb_bangkok_hotel_ed2h",
    agendaCandidateId: "ac_bangkok_hotel_ed2h",
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

function emptyChannelFit() {
  return {
    threads: 0.5,
    naver_blog: 0.5,
    naver_band: 0.5,
    kakao_channel: 0.5,
    shortform: 0.5,
    cardnews: 0.5,
  };
}

function baseAcrb(overrides: Partial<AudienceContentResearchBrief> = {}): AudienceContentResearchBrief {
  return {
    contract: AUDIENCE_CONTENT_RESEARCH_BRIEF_CONTRACT,
    version: ACRB_CONTRACT_VERSION,
    id: "acrb_ed2h_test",
    logicalIdentity: "logical_ed2h_test",
    generatedAt: "2026-09-14T12:00:00.000Z",
    selectedAgendaId: "agenda_bangkok",
    assignmentId: "assign_bangkok",
    researchStatus: "partial",
    sourceCoverage: {
      assignmentEvidence: true,
      metaEditorial: false,
      internalResearchSignals: false,
      semanticRetrieval: false,
      historicalContent: false,
      externalWebSearch: true,
      notes: [],
    },
    audience: {
      primary: [],
      secondary: [],
      motivations: [],
      anxieties: [],
      objections: [],
      decisionTriggers: [],
    },
    searchIntent: {
      primaryIntent: "informational",
      secondaryIntents: [],
      queries: [],
      questions: [],
    },
    marketSignals: {
      observedPatterns: [],
      competitorHooks: [],
      saturatedAngles: [],
      contentGaps: [],
    },
    researchFindings: [],
    contentAngles: [
      {
        angleId: "story_framing_1",
        angle: "부모님 동반 일정에서는 위치가 호텔 등급만큼 중요할 수 있다",
        hook: "위치 우선",
        audienceTension: BANGKOK.audienceTension,
        interestScore: 0.7,
        noveltyScore: 0.6,
        evidenceStrength: 0.55,
        channelFit: emptyChannelFit(),
        rationale: "researchSupportedFraming",
        supportingFindingRefs: [],
        limitations: [],
      },
    ],
    recommendedAngleId: "story_framing_1",
    recommendedAngleReason: "story_support:PARTIALLY_SUPPORTED",
    researchVerdict: "PROCEED_WITH_CAUTION",
    verdictReasons: ["useful_audience_tension"],
    limitations: [],
    provenance: {
      preselectionResearchBriefId: null,
      agendaCandidateId: null,
      evidenceFingerprint: "fp_test",
      synthesisMode: "deterministic_fallback",
      documentCount: 0,
      queryCount: 2,
      semanticUsed: false,
      historicalMatchCount: 0,
    },
    ...overrides,
  };
}

function evidenceBrief(hash: string): EvidenceBackedStoryBrief {
  return {
    contract: EVIDENCE_BACKED_STORY_BRIEF_CONTRACT,
    researchContractVersion: STORY_RESEARCH_CONTRACT_VERSION,
    storyPointId: BANGKOK.pointId,
    storyPointHash: hash,
    agendaLogicalIdentity: "logical_ed2h_test",
    researchExecutionStatus: "partial",
    storySupportVerdict: "PARTIALLY_SUPPORTED",
    supportedClaimBoundary:
      "부모님 동반 일정에서는 위치가 호텔 등급만큼 중요하게 작용할 수 있다",
    researchQuestionFindings: [
      {
        question: BANGKOK.researchQuestions[0]!,
        status: "partially_answered",
        finding: "지역별 접근성 차이가 관찰됨",
        evidenceRefs: ["ext_1"],
        sourceClasses: ["community"],
        confidence: 0.45,
        limitations: ["needs_qualification"],
      },
      {
        question: BANGKOK.researchQuestions[1]!,
        status: "answered",
        finding: "후기에서 위치/이동 불편 반복",
        evidenceRefs: ["ext_2"],
        sourceClasses: ["community"],
        confidence: 0.55,
        limitations: [],
      },
    ],
    evidenceAssessment: [
      {
        evidenceId: "ext_1",
        relationship: "partially_supports",
        relevanceToStoryPoint: 0.4,
        epistemicType: "observed_signal",
        sourceClass: "community",
        note: "snippet_only_not_verified_fact",
      },
    ],
    contradictedClaims: [],
    unresolvedQuestions: [],
    usableFactIds: [],
    refutationNotes: null,
    limitations: ["claim_narrowed_to_supported_boundary"],
    alternateFallbackUsed: false,
    researchSupportedFraming: [
      "부모님 동반 일정에서는 위치가 호텔 등급만큼 중요하게 작용할 수 있다",
    ],
    observability: {
      plannedQuestionCount: 2,
      answeredQuestionCount: 1,
      unresolvedQuestionCount: 0,
      contradictingEvidenceCount: 0,
      externalQueriesAttempted: 2,
      externalQueriesSuccessful: 2,
      sourceClasses: ["community"],
    },
  };
}

function bangkokGathered(withStory: boolean): AcrbGatheredInputs {
  const handoff = prepareManagerToContentHandoff(bangkokSelection(), {
    store: createInMemoryContentAssignmentStore(),
  });
  const hash = createStoryPointHash(BANGKOK);
  return {
    selectedAgenda: handoff.selectedAgenda,
    assignment: handoff.contentAssignment,
    evidencePack: handoff.evidencePack,
    compactBrief: null,
    compactCandidate: null,
    fullResearchBrief: null,
    editorial: null,
    historicalMatches: [],
    semanticAvailable: false,
    nearDuplicate: false,
    cooledIdentity: false,
    externalResearch: {
      available: true,
      providerId: "fixture",
      queryCount: 2,
      resultCount: 1,
      fetchedDocumentCount: 0,
      failedFetchCount: 0,
      totalFetchedBytes: 0,
      officialSourceCount: 0,
      socialCommunitySourceCount: 1,
      runtimeMs: 1,
      queries: BANGKOK.researchQuestions,
      evidence: [
        {
          evidenceId: "ext_1",
          url: "https://blog.example.com/bangkok-hotel-location",
          title: "방콕 숙소 위치와 이동",
          excerpt: "부모님과 방콕 가서 호텔 등급보다 위치가 더 중요했다",
          sourceClass: "community",
          fromSnippetOnly: true,
          query: BANGKOK.researchQuestions[0]!,
          purpose: "factual_verification",
        },
      ],
      observedAudienceQuestions: [],
      observedCompetitorHooks: [],
      limitations: [],
      attemptedQueryCount: 2,
      successfulQueryCount: 2,
      externalSearchStatus: "partial",
    },
    storyPoint: withStory ? BANGKOK : null,
    storyPointHash: withStory ? hash : null,
    storyPointGatePass: withStory,
  };
}

describe("ED-2H ACRB Story overlay durability + synthesis injection", () => {
  it("parses legacy ACRB without Story overlay", () => {
    const legacy = baseAcrb();
    const raw = JSON.parse(JSON.stringify(legacy)) as Record<string, unknown>;
    delete raw.storyPointRef;
    delete raw.storyPointHash;
    delete raw.storySupportVerdict;
    delete raw.supportedClaimBoundary;
    delete raw.researchQuestionFindings;
    delete raw.contradictedClaims;
    delete raw.unresolvedQuestions;
    delete raw.evidenceBackedStoryBrief;
    delete raw.researchExecutionStatus;
    delete raw.alternateUsed;

    const parsed = parseAudienceContentResearchBrief(raw);
    expect(parsed).not.toBeNull();
    expect(parsed!.id).toBe(legacy.id);
    expect(parsed!.researchVerdict).toBe("PROCEED_WITH_CAUTION");
    expect(parsed!.storyPointRef ?? null).toBeNull();
    expect(parsed!.storySupportVerdict ?? null).toBeNull();
    expect(parsed!.evidenceBackedStoryBrief ?? null).toBeNull();
  });

  it("parses ED-2 overlay fields", () => {
    const hash = createStoryPointHash(BANGKOK);
    const brief = evidenceBrief(hash);
    const acrb = baseAcrb({
      storyPointRef: {
        storyPointId: BANGKOK.pointId,
        storyPointHash: hash,
        researchContractVersion: STORY_RESEARCH_CONTRACT_VERSION,
      },
      storyPointHash: hash,
      storySupportVerdict: "PARTIALLY_SUPPORTED",
      supportedClaimBoundary: brief.supportedClaimBoundary,
      researchQuestionFindings: brief.researchQuestionFindings,
      contradictedClaims: [],
      unresolvedQuestions: [],
      evidenceBackedStoryBrief: brief,
      researchExecutionStatus: "partial",
      alternateUsed: false,
    });

    const parsed = parseAudienceContentResearchBrief(JSON.parse(JSON.stringify(acrb)));
    expect(parsed?.storyPointRef?.storyPointId).toBe(BANGKOK.pointId);
    expect(parsed?.storyPointHash).toBe(hash);
    expect(parsed?.storySupportVerdict).toBe("PARTIALLY_SUPPORTED");
    expect(parsed?.supportedClaimBoundary).toContain("위치");
    expect(parsed?.researchQuestionFindings?.length).toBe(2);
    expect(parsed?.evidenceBackedStoryBrief?.storyPointId).toBe(BANGKOK.pointId);
    expect(parsed?.researchExecutionStatus).toBe("partial");
    expect(parsed?.alternateUsed).toBe(false);
  });

  it("round-trips Story research fields without semantic loss", () => {
    const hash = createStoryPointHash(BANGKOK);
    const brief = evidenceBrief(hash);
    const original = baseAcrb({
      storyPointRef: {
        storyPointId: BANGKOK.pointId,
        storyPointHash: hash,
        researchContractVersion: STORY_RESEARCH_CONTRACT_VERSION,
      },
      storyPointHash: hash,
      storySupportVerdict: brief.storySupportVerdict,
      supportedClaimBoundary: brief.supportedClaimBoundary,
      researchQuestionFindings: brief.researchQuestionFindings,
      contradictedClaims: brief.contradictedClaims,
      unresolvedQuestions: brief.unresolvedQuestions,
      evidenceBackedStoryBrief: brief,
      researchExecutionStatus: brief.researchExecutionStatus,
      alternateUsed: true,
    });

    const serialized = JSON.stringify(original);
    const parsed = parseAudienceContentResearchBrief(JSON.parse(serialized));
    expect(parsed).not.toBeNull();
    expect(parsed!.storyPointHash).toBe(original.storyPointHash);
    expect(parsed!.storySupportVerdict).toBe(original.storySupportVerdict);
    expect(parsed!.supportedClaimBoundary).toBe(original.supportedClaimBoundary);
    expect(parsed!.researchQuestionFindings).toEqual(original.researchQuestionFindings);
    expect(parsed!.contradictedClaims).toEqual(original.contradictedClaims);
    expect(parsed!.unresolvedQuestions).toEqual(original.unresolvedQuestions);
    expect(parsed!.researchExecutionStatus).toBe(original.researchExecutionStatus);
    expect(parsed!.alternateUsed).toBe(true);
    expect(parsed!.evidenceBackedStoryBrief?.storySupportVerdict).toBe("PARTIALLY_SUPPORTED");
    expect(parsed!.evidenceBackedStoryBrief?.researchSupportedFraming).toEqual(
      brief.researchSupportedFraming,
    );
    expect(parsed!.evidenceBackedStoryBrief?.observability.answeredQuestionCount).toBe(1);
    expect(parsed!.storyPointRef).toEqual(original.storyPointRef);
  });

  it("injects AUTHORITATIVE_STORY_POINT into synthesis prompt", () => {
    const gathered = bangkokGathered(true);
    const prompt = buildSynthesisPrompt(gathered);
    expect(prompt).toContain("AUTHORITATIVE_STORY_POINT");
    expect(prompt).toContain(BANGKOK.pointId);
    expect(prompt).toContain(BANGKOK.storyQuestion!);
    expect(prompt).toContain(BANGKOK.storyClaim!);
    expect(prompt).toContain(BANGKOK.curiosityGap);
    expect(prompt).toContain(BANGKOK.readerPayoff);
    expect(prompt).toContain(BANGKOK.researchQuestions[0]!);
    expect(prompt).toContain("방콕 호텔 종합 가이드");
    expect(prompt).toContain(createStoryPointHash(BANGKOK));
    expect(prompt).toMatch(/Do NOT invent a new story/i);
    expect(prompt).toMatch(/Do NOT broaden into destination travel tips/i);
    expect(prompt).toMatch(/Interpret ALL evidence relative to this StoryPoint/i);
    expect(prompt).toMatch(/Which researchQuestions were answered/i);
    expect(prompt).toMatch(/How far can the claim safely go/i);
    expect(prompt).not.toMatch(/completely different angle/i);
  });

  it("does not inject StoryPoint when absent (legacy path)", () => {
    const gathered = bangkokGathered(false);
    const prompt = buildSynthesisPrompt(gathered);
    expect(prompt).toContain('"AUTHORITATIVE_STORY_POINT":null');
    expect(prompt).not.toMatch(/Do NOT invent a new story/i);
  });

  it("prohibits generic replacement / REFUTED rescue language in targeted prompt", () => {
    const gathered = bangkokGathered(true);
    const prompt = buildSynthesisPrompt(gathered);
    expect(prompt).toMatch(/Do NOT replace REFUTED or INSUFFICIENT_EVIDENCE/i);
    expect(prompt).toMatch(/not a creative replacement thesis/i);
    expect(prompt).not.toMatch(/What completely different angle could we write instead/i);
  });

  it("PARTIAL boundary must keep same Story core via identity lock", () => {
    const hash = createStoryPointHash(BANGKOK);
    const brief = evidenceBrief(hash);
    const ok = validateStoryResearchLock({
      storyPoint: BANGKOK,
      brief,
      topicIdentity: bangkokIdentity(),
    });
    expect(ok.ok).toBe(true);

    const drifted: EvidenceBackedStoryBrief = {
      ...brief,
      supportedClaimBoundary: "부산 출발 크루즈 탑승 팁 총정리",
      researchSupportedFraming: ["부산 출발 크루즈 탑승 팁 총정리"],
    };
    const bad = validateStoryResearchLock({
      storyPoint: BANGKOK,
      brief: drifted,
      topicIdentity: bangkokIdentity(),
    });
    expect(bad.ok).toBe(false);
  });

  it("REFUTED remains blocked by deterministic CS gate", () => {
    const hash = createStoryPointHash(BANGKOK);
    const brief = evidenceBrief(hash);
    const refuted: EvidenceBackedStoryBrief = {
      ...brief,
      storySupportVerdict: "REFUTED",
      supportedClaimBoundary: null,
      researchSupportedFraming: [],
      refutationNotes: "반증",
    };
    expect(assertStoryResearchCanProceed(refuted).ok).toBe(false);
    expect(assertStoryResearchCanProceed(refuted).reason).toBe("story_point_refuted");
  });
});
