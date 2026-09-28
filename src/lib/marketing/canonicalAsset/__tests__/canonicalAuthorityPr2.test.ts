/**
 * PR2 — Canonical Writer authority + downstream Story semantics after PR1.
 * Decision context reaches RA-1 / ASW only for decision/practical Stories;
 * the locked supportedClaimBoundary cannot be replaced by the Writer.
 */
import { describe, expect, it } from "vitest";

import type { AcrbGatheredInputs } from "@/lib/marketing/audienceResearch/gatherInputs";
import { buildSynthesisPrompt } from "@/lib/marketing/audienceResearch/synthesize";
import { ensureCanonicalMarketingAsset } from "@/lib/marketing/canonicalAsset/ensureCanonicalMarketingAsset";
import { parseDurableCanonicalMarketingAsset } from "@/lib/marketing/canonicalAsset/parseCanonicalMarketingAsset";
import {
  ASSET_SOURCE_WRITER_CONTRACT_PROMPT,
  buildAssetSourceWriterPrompt,
} from "@/lib/marketing/canonicalAsset/prompt";
import {
  buildCanonicalAssetWriterInput,
  resolveStoryDecisionContext,
} from "@/lib/marketing/canonicalAsset/revisions";
import { CANONICAL_LIMITATION_PLACEMENT_EN } from "@/lib/marketing/canonicalAsset/surfaceLanguageContract";
import { prepareManagerToContentHandoff } from "@/lib/marketing/content/prepareManagerToContentHandoff";
import { createInMemoryContentAssignmentStore } from "@/lib/marketing/content/store/contentAssignmentStore";
import {
  CONTENT_PROPOSITION_CONTRACT,
  type ContentProposition,
} from "@/lib/marketing/content/proposition/contracts";
import {
  EVIDENCE_BACKED_STORY_BRIEF_CONTRACT,
  STORY_CONTENT_POINT_CONTRACT,
  STORY_RESEARCH_CONTRACT_VERSION,
  type EvidenceBackedStoryBrief,
  type StoryContentPoint,
} from "@/lib/marketing/storyPoint/contracts";
import { createStoryPointHash } from "@/lib/marketing/storyPoint/hash";

const CLEAN_WHY = "가족 여행에서 좋은 호텔 직관이 이동 불편으로 자주 깨진다";
const DECISION_AT_STAKE = "부모님 동반 숙소를 등급으로 고를지 위치로 고를지";
const STAKES = ["부모님 이동 피로", "숙박 비용"];
const WEAK_DECISION = "다음 방콕 일정에 이 골목을 넣을지";
const WEAK_STAKE = "일정 여유";
const LOCKED_BOUNDARY = "수쿰빗·실롬 등 일부 숙박 지역의 BTS 접근성 차이가 후기에서 관측된다";
const BROADER_BOUNDARY = "방콕 가족여행에서는 언제나 숙소 위치가 호텔 등급보다 중요하다";

function story(overrides: Partial<StoryContentPoint> = {}): StoryContentPoint {
  return {
    contract: STORY_CONTENT_POINT_CONTRACT,
    pointId: "sp_pr2_bangkok",
    storyQuestion: "부모님과 방콕을 갈 때 호텔 등급보다 위치를 먼저 봐야 할까?",
    storyClaim: null,
    whyInteresting: CLEAN_WHY,
    audienceTension: "등급을 올리면 편할 것 같지만 이동이 어려우면 하루가 망가진다",
    curiosityGap: "높은 등급이 항상 더 좋다는 직관과 이동 편의가 충돌한다",
    readerPayoff: "부모님 동반 숙소 우선 비교 기준을 얻음",
    mechanisms: ["counter_intuition", "decision_relief"],
    researchNeeded: ["숙박 지역별 BTS 접근성"],
    researchQuestions: ["방콕 주요 숙박지역별 BTS 접근성 차이가 큰가?"],
    genericRisk: "체크리스트 붕괴",
    genericRiskMitigation: null,
    channelPotential: {
      conversation: "high",
      visualExplainability: "medium",
      searchDepth: "high",
      shortformHookability: "medium",
    },
    nonGoals: ["방콕 호텔 종합 가이드"],
    agendaFitNotes: null,
    ...overrides,
  };
}

function decisionStory(): StoryContentPoint {
  return story({
    editorialArchetype: "worth_it_or_not",
    decisionAtStake: DECISION_AT_STAKE,
    stakes: [...STAKES],
  });
}

function discoveryStory(): StoryContentPoint {
  return story({
    pointId: "sp_pr2_discovery",
    editorialArchetype: "discovery",
    mechanisms: ["curiosity_gap"],
    decisionAtStake: WEAK_DECISION,
    stakes: [WEAK_STAKE],
  });
}

function evidence(
  point: StoryContentPoint,
  verdict: EvidenceBackedStoryBrief["storySupportVerdict"] = "PARTIALLY_SUPPORTED",
  boundary: string | null = LOCKED_BOUNDARY,
): EvidenceBackedStoryBrief {
  return {
    contract: EVIDENCE_BACKED_STORY_BRIEF_CONTRACT,
    researchContractVersion: STORY_RESEARCH_CONTRACT_VERSION,
    storyPointId: point.pointId,
    storyPointHash: createStoryPointHash(point),
    agendaLogicalIdentity: "logical_pr2",
    researchExecutionStatus: "partial",
    storySupportVerdict: verdict,
    supportedClaimBoundary: boundary,
    researchQuestionFindings: [
      {
        question: "방콕 주요 숙박지역별 BTS 접근성 차이가 큰가?",
        status: "partially_answered",
        finding: "수쿰빗·실롬 등 지역별 BTS 접근성 차이가 후기에서 반복 관측된다",
        evidenceRefs: ["ev1"],
        sourceClasses: ["community"],
        confidence: 0.6,
        limitations: [],
      },
    ],
    evidenceAssessment: [
      {
        evidenceId: "ev1",
        relationship: "partially_supports",
        relevanceToStoryPoint: 0.7,
        epistemicType: "observed_signal",
        sourceClass: "community",
        note: "test",
      },
    ],
    contradictedClaims: ["방콕 전 지역 호텔은 이동이 동일하다"],
    unresolvedQuestions: ["특정 호텔의 확정 조식 가격은?"],
    usableFactIds: [],
    refutationNotes: null,
    researchSupportedFraming: [LOCKED_BOUNDARY],
    limitations: ["개별 호텔 가격은 확인하지 않음"],
    alternateFallbackUsed: false,
    observability: {
      plannedQuestionCount: 1,
      answeredQuestionCount: 0,
      unresolvedQuestionCount: 1,
      contradictingEvidenceCount: 0,
      externalQueriesAttempted: 1,
      externalQueriesSuccessful: 1,
      sourceClasses: ["community"],
    },
  };
}

function proposition(point: StoryContentPoint): ContentProposition {
  return {
    contract: CONTENT_PROPOSITION_CONTRACT,
    primaryAudience: "부모님 동반 방콕 가족여행 준비자",
    audienceProblem: "등급만 보고 고르면 이동 피로가 커질 수 있다",
    audienceTension: "등급 vs 위치",
    whyNow: null,
    contentPromise: "숙소 위치를 등급과 함께 보는 기준을 정리한다",
    readerGain: "부모님 동반 시 무엇을 먼저 볼지 기준을 얻는다",
    specificTakeaways: ["BTS 접근성을 먼저 본다"],
    proofRequirements: [{ claimArea: "접근성", requiredProof: "지역 관측", severity: "must" }],
    contentGapUsed: "위치 우선 기준 부족",
    engagementMechanism: "save_worthy_checklist",
    desiredAudienceAction: "save",
    angle: "방콕 가족 호텔은 위치도 등급만큼 본다",
    keyMessage: "위치부터 비교",
    commercialIntent: "informational",
    propositionStrength: "usable",
    limitations: ["개별 요금은 단정하지 않음"],
    storyPointRef: { storyPointId: point.pointId, storyPointHash: createStoryPointHash(point) },
    storyPointHash: createStoryPointHash(point),
    storySupportVerdict: "PARTIALLY_SUPPORTED",
    supportedClaimBoundaryUsed: LOCKED_BOUNDARY,
  };
}

function writerFor(point: StoryContentPoint) {
  return buildCanonicalAssetWriterInput({
    agendaId: "ag_pr2",
    storyPoint: point,
    storyPointHash: createStoryPointHash(point),
    evidenceBrief: evidence(point),
    proposition: proposition(point),
    topicIdentitySummary: "방콕 · 호텔",
  });
}

function gathered(point: StoryContentPoint): AcrbGatheredInputs {
  const handoff = prepareManagerToContentHandoff(
    {
      title: "방콕 가족 호텔 위치 vs 등급",
      summary: "방콕 가족여행에서 숙소 등급보다 BTS 접근성이 후기에서 반복 언급되는 관측",
      contentObjective: "inform_travelers" as const,
      commercialIntent: "informational" as const,
      destinations: ["방콕", "태국"],
      topics: ["호텔", "가족여행"],
      entities: [],
      researchBriefId: "rb_pr2",
      agendaCandidateId: "ac_pr2",
      evidenceRefs: [
        {
          evidenceId: "ev_pr2",
          sourceId: "src_pr2",
          sourceType: "social",
          sourceName: "Test",
          isOfficial: false,
          evidenceType: "derived_signal",
          url: "https://example.com/bangkok",
          reference: "test:obs",
          excerpt: "방콕 가족여행 후기에서 숙소 위치와 BTS 접근성이 반복 언급됨",
          publishedAt: null,
          observedAt: "2026-09-09T15:10:00.000Z",
          credibilityHint: 0.4,
        },
      ],
    },
    { store: createInMemoryContentAssignmentStore() },
  );
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
    externalResearch: null,
    storyPoint: point,
    storyPointHash: createStoryPointHash(point),
    storyPointGatePass: true,
  };
}

function writerReply(extra: Record<string, unknown> = {}): string {
  return JSON.stringify({
    titleKo: "방콕 숙소, 등급보다 먼저 보이는 BTS 거리",
    dekKo: null,
    openingHookKo: "수쿰빗과 실롬 후기에서는 호텔 등급보다 BTS까지의 거리가 먼저 언급됩니다.",
    bodyKo: [
      "현재 확인된 자료에서는 수쿰빗·실롬 등 일부 숙박 지역의 BTS 접근성 차이가 후기에서 반복해서 관측됩니다.",
      "같은 등급이라도 역까지 걷는 거리에 따라 하루 이동의 체감이 달라진다는 이야기가 많습니다.",
      "개별 호텔 요금은 여기서 다루지 않습니다.",
      "역과의 거리를 알고 나면 방콕 숙소 지도를 조금 다르게 읽게 됩니다.",
    ].join("\n\n"),
    keyTakeawaysKo: [
      "수쿰빗·실롬 후기에서 BTS 접근성 차이가 반복 관측된다",
      "같은 등급이어도 역까지 거리가 이동 체감을 바꾼다",
    ],
    decisionGuidanceKo: "방콕 숙소 지도를 역과의 거리로 한 번 다시 읽어 보는 시선이 생깁니다.",
    optionalCtaIntentKo: null,
    limitationsKo: ["개별 호텔 요금은 확인하지 않음"],
    forbiddenClaimsKo: [],
    supportedClaimBoundaryKo: BROADER_BOUNDARY,
    unresolvedQuestionsKo: [],
    evidenceRefs: [{ evidenceId: "ev1", noteKo: "지역별 접근성 관측" }],
    ...extra,
  });
}

describe("PR2 — decision context transport", () => {
  it("1. discovery Story: no decisionAtStake/stakes in RA-1 or Canonical decision framing", () => {
    const point = discoveryStory();
    expect(resolveStoryDecisionContext(point)).toBeNull();

    const writer = writerFor(point);
    expect(writer).not.toHaveProperty("decisionContext");
    const aswPrompt = buildAssetSourceWriterPrompt({ writerInput: writer });
    const lockedJson = aswPrompt.slice(aswPrompt.indexOf("LOCKED_INPUT_JSON:"));
    expect(lockedJson).not.toContain("decisionContext");
    expect(lockedJson).not.toContain(WEAK_DECISION);
    expect(lockedJson).not.toContain(WEAK_STAKE);

    const raPrompt = buildSynthesisPrompt(gathered(point));
    expect(raPrompt).not.toContain("decisionContext");
    expect(raPrompt).not.toContain(WEAK_DECISION);
    expect(raPrompt).not.toContain(WEAK_STAKE);
  });

  it("2. decision/practical Story: genuine decisionAtStake/stakes explicitly available downstream", () => {
    const point = decisionStory();
    expect(resolveStoryDecisionContext(point)).toEqual({
      decisionAtStake: DECISION_AT_STAKE,
      stakes: STAKES,
    });

    const writer = writerFor(point);
    expect(writer.decisionContext).toEqual({ decisionAtStake: DECISION_AT_STAKE, stakes: STAKES });
    const aswPrompt = buildAssetSourceWriterPrompt({ writerInput: writer });
    expect(aswPrompt).toContain(
      `"decisionContext":${JSON.stringify({ decisionAtStake: DECISION_AT_STAKE, stakes: STAKES })}`,
    );
    expect(aswPrompt).toContain("DECISION CONTEXT (LOCKED_INPUT_JSON.decisionContext)");

    const raPrompt = buildSynthesisPrompt(gathered(point));
    expect(raPrompt).toContain(`"decisionContext":{"decisionAtStake":"${DECISION_AT_STAKE}"`);
    expect(raPrompt).toContain("AUTHORITATIVE_STORY_POINT.decisionContext");
  });

  it("decision archetype without a real decision gets no decision context (never from audienceTension)", () => {
    const point = story({ editorialArchetype: "worth_it_or_not" });
    expect(resolveStoryDecisionContext(point)).toBeNull();
    expect(writerFor(point)).not.toHaveProperty("decisionContext");
    expect(buildSynthesisPrompt(gathered(point))).not.toContain("decisionContext");
  });

  it("3. whyInteresting stays clean prose for both archetypes", () => {
    for (const point of [discoveryStory(), decisionStory()]) {
      const writer = writerFor(point);
      expect(writer.whyInteresting).toBe(CLEAN_WHY);
      const aswPrompt = buildAssetSourceWriterPrompt({ writerInput: writer });
      const raPrompt = buildSynthesisPrompt(gathered(point));
      for (const prompt of [aswPrompt, raPrompt]) {
        expect(prompt).toContain(`"whyInteresting":"${CLEAN_WHY}"`);
        expect(prompt).not.toContain("선택:");
        expect(prompt).not.toContain("스테이크:");
      }
    }
  });
});

describe("PR2 — supportedClaimBoundary authority", () => {
  it("4. PARTIALLY_SUPPORTED: Writer's broader boundary cannot replace the locked boundary", async () => {
    const point = decisionStory();
    const result = await ensureCanonicalMarketingAsset({
      agendaId: "ag_pr2",
      storyPoint: point,
      storyPointHash: createStoryPointHash(point),
      evidenceBrief: evidence(point),
      proposition: proposition(point),
      topicIdentitySummary: "방콕 · 호텔",
      invoke: () => writerReply(),
      now: new Date("2026-09-28T00:00:00.000Z"),
    });
    expect(result.outcome).toBe("generated");
    expect(result.writerInput.supportedClaimBoundary).toBe(LOCKED_BOUNDARY);
    expect(result.asset?.supportedClaimBoundaryKo).toBe(LOCKED_BOUNDARY);
    expect(result.asset?.supportedClaimBoundaryKo).not.toBe(BROADER_BOUNDARY);

    const persisted = parseDurableCanonicalMarketingAsset(JSON.parse(JSON.stringify(result.asset)));
    expect(persisted?.supportedClaimBoundaryKo).toBe(LOCKED_BOUNDARY);
  });

  it("proposition boundary is the fallback lock; Writer value never fills a missing lock", async () => {
    const point = decisionStory();
    const noEvidenceBoundary = await ensureCanonicalMarketingAsset({
      agendaId: "ag_pr2",
      storyPoint: point,
      storyPointHash: createStoryPointHash(point),
      evidenceBrief: evidence(point, "PARTIALLY_SUPPORTED", null),
      proposition: proposition(point),
      topicIdentitySummary: "방콕 · 호텔",
      invoke: () => writerReply(),
    });
    expect(noEvidenceBoundary.asset?.supportedClaimBoundaryKo).toBe(LOCKED_BOUNDARY);

    const supported = await ensureCanonicalMarketingAsset({
      agendaId: "ag_pr2",
      storyPoint: point,
      storyPointHash: createStoryPointHash(point),
      evidenceBrief: evidence(point, "SUPPORTED", null),
      proposition: { ...proposition(point), storySupportVerdict: "SUPPORTED", supportedClaimBoundaryUsed: null },
      topicIdentitySummary: "방콕 · 호텔",
      invoke: () => writerReply(),
    });
    expect(supported.asset?.supportedClaimBoundaryKo).toBeNull();
  });

  it("prompt tells the Writer the boundary is locked, not redefinable", () => {
    expect(ASSET_SOURCE_WRITER_CONTRACT_PROMPT).toContain("replace or redefine supportedClaimBoundary");
    expect(ASSET_SOURCE_WRITER_CONTRACT_PROMPT).toContain(
      "echo LOCKED_INPUT_JSON.supportedClaimBoundary unchanged",
    );
  });
});

describe("PR2 — archetype-aware takeaways / guidance / limitations / CTA", () => {
  it("5 + 6. discovery asset with fact takeaways and a bounded editorial close passes", async () => {
    const point = discoveryStory();
    const result = await ensureCanonicalMarketingAsset({
      agendaId: "ag_pr2",
      storyPoint: point,
      storyPointHash: createStoryPointHash(point),
      evidenceBrief: evidence(point),
      proposition: proposition(point),
      topicIdentitySummary: "방콕 · 호텔",
      invoke: () => writerReply(),
    });
    expect(result.outcome).toBe("generated");
    expect(result.asset?.decisionGuidanceKo).toContain("다시 읽어 보는 시선");
  });

  it("5. prompt: discovery takeaways do not require decision criteria", () => {
    expect(ASSET_SOURCE_WRITER_CONTRACT_PROMPT).toContain("keyTakeawaysKo SEMANTICS");
    expect(ASSET_SOURCE_WRITER_CONTRACT_PROMPT).toContain(
      "Decision criteria are NOT required for discovery-like Stories",
    );
    expect(ASSET_SOURCE_WRITER_CONTRACT_PROMPT).toContain(
      "decision criteria, conditions, trade-offs, and verification points",
    );
  });

  it("6. prompt: discovery decisionGuidance is a bounded close; no invented action tasks", () => {
    expect(ASSET_SOURCE_WRITER_CONTRACT_PROMPT).toContain("bounded editorial close");
    expect(ASSET_SOURCE_WRITER_CONTRACT_PROMPT).toContain(
      "Do not invent booking, purchase, visit, comparison, recommendation, or verification tasks",
    );
    expect(ASSET_SOURCE_WRITER_CONTRACT_PROMPT).toContain(
      "Never invent a decision just to satisfy the field name",
    );
    expect(ASSET_SOURCE_WRITER_CONTRACT_PROMPT).not.toContain("investigate this area further");
    expect(ASSET_SOURCE_WRITER_CONTRACT_PROMPT).not.toContain(
      "compare this type of experience with the travel style",
    );
  });

  it("7. limitation guidance is claim-near qualification; no limitation-only conclusion default", () => {
    expect(ASSET_SOURCE_WRITER_CONTRACT_PROMPT).toContain(CANONICAL_LIMITATION_PLACEMENT_EN);
    expect(ASSET_SOURCE_WRITER_CONTRACT_PROMPT).toContain(
      "State each qualification near the claim it qualifies",
    );
    expect(ASSET_SOURCE_WRITER_CONTRACT_PROMPT).toContain("Do not hide uncertainty");
    expect(ASSET_SOURCE_WRITER_CONTRACT_PROMPT).not.toMatch(
      /(conclude|end|finish|close)\s+(the article\s+)?(with|on)\s+(the\s+)?(limitations?|unresolved)/i,
    );
  });

  it("CTA boundary: no channel-native engagement CTAs; commercial actions need commercial intent", () => {
    expect(ASSET_SOURCE_WRITER_CONTRACT_PROMPT).toContain("CTA BOUNDARY");
    expect(ASSET_SOURCE_WRITER_CONTRACT_PROMPT).toContain(
      "follow, save, comment, subscribe",
    );
    expect(ASSET_SOURCE_WRITER_CONTRACT_PROMPT).toContain("Channel editors add channel-native CTAs downstream");
    expect(ASSET_SOURCE_WRITER_CONTRACT_PROMPT).toContain("commercialIntent is commercial or mixed");
  });
});
