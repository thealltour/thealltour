/**
 * ASSET_SOURCE_WRITER_PHASE5_ALIGNMENT — focused tests.
 */
import { describe, expect, it } from "vitest";

import {
  ASSET_SOURCE_WRITER_ROLE,
  type CanonicalMarketingAsset,
} from "@/lib/marketing/canonicalAsset/contracts";
import {
  buildCanonicalAssetWriterInput,
  computeCanonicalAssetSourceRevision,
  resolveStoryEditorialArchetype,
} from "@/lib/marketing/canonicalAsset/revisions";
import {
  ASSET_SOURCE_WRITER_CONTRACT_PROMPT,
  buildAssetSourceWriterPrompt,
  isAsWDecisionPracticalArchetype,
  isAsWDiscoveryLikeArchetype,
} from "@/lib/marketing/canonicalAsset/prompt";
import { parseCanonicalMarketingAssetContent } from "@/lib/marketing/canonicalAsset/parseCanonicalMarketingAsset";
import { validateCanonicalMarketingAsset } from "@/lib/marketing/canonicalAsset/validateCanonicalMarketingAsset";
import { CONTENT_PROPOSITION_CONTRACT } from "@/lib/marketing/content/proposition/contracts";
import type { ContentProposition } from "@/lib/marketing/content/proposition/contracts";
import {
  EVIDENCE_BACKED_STORY_BRIEF_CONTRACT,
  STORY_CONTENT_POINT_CONTRACT,
  STORY_RESEARCH_CONTRACT_VERSION,
  type EvidenceBackedStoryBrief,
  type StoryContentPoint,
} from "@/lib/marketing/storyPoint/contracts";
import { createStoryPointHash } from "@/lib/marketing/storyPoint/hash";
import { normalizeExternalStoryToPoint } from "@/lib/marketing/editorialDirector/normalizeExternalStory";
import type { ExternalStoryCandidate } from "@/lib/marketing/editorialDirector/contracts";

const BASE_STORY: StoryContentPoint = {
  contract: STORY_CONTENT_POINT_CONTRACT,
  pointId: "sp_langson_discovery",
  storyQuestion: "랑선 흙담 마을이 베트남 북부에서 왜 눈에 띌까?",
  storyClaim: "랑선 흙담 건축은 흔한 베트남 골목과 다른 시각적 리듬을 준다",
  whyInteresting: "흙담·골목 비율이 사진보다 현장에서 더 두드러진다는 관측이 있다",
  audienceTension: "유명 명소만 보면 이런 디테일을 놓치기 쉽다",
  curiosityGap: "같은 북부라도 랑선의 흙담 풍경이 왜 다르게 읽히는지",
  readerPayoff: "랑선을 볼 때 흙담·골목 리듬을 찾는 새로운 시선",
  mechanisms: ["curiosity_gap"],
  researchNeeded: ["흙담 건축 공식·관광 안내 언급"],
  researchQuestions: ["랑선 흙담 마을이 공식 안내·보도에 반복 등장하는가?"],
  genericRisk: "문화 일반론",
  genericRiskMitigation: "구체 건축 디테일 고정",
  channelPotential: {
    conversation: "high",
    visualExplainability: "high",
    searchDepth: "medium",
    shortformHookability: "high",
  },
  nonGoals: ["베트남 문화 종합 가이드"],
  agendaFitNotes: null,
  editorialArchetype: null,
};

function story(overrides: Partial<StoryContentPoint> = {}): StoryContentPoint {
  return { ...BASE_STORY, ...overrides };
}

function evidence(): EvidenceBackedStoryBrief {
  const point = story({ editorialArchetype: "discovery" });
  return {
    contract: EVIDENCE_BACKED_STORY_BRIEF_CONTRACT,
    researchContractVersion: STORY_RESEARCH_CONTRACT_VERSION,
    storyPointId: point.pointId,
    storyPointHash: createStoryPointHash(point),
    agendaLogicalIdentity: "logical_langson_phase5",
    researchExecutionStatus: "partial",
    storySupportVerdict: "PARTIALLY_SUPPORTED",
    supportedClaimBoundary: "공식·보도에서 흙담 마을이 시각적 특징으로 언급되는 범위",
    researchQuestionFindings: [
      {
        question: "랑선 흙담 마을이 공식 안내·보도에 반복 등장하는가?",
        status: "partially_answered",
        finding: "일부 관광·지방 안내에서 흙담 건축이 소개된다",
        evidenceRefs: ["ev_ls1"],
        sourceClasses: ["tourism_board"],
        confidence: 0.55,
        limitations: ["현장 체감 미확인"],
      },
    ],
    evidenceAssessment: [
      {
        evidenceId: "ev_ls1",
        relationship: "partially_supports",
        relevanceToStoryPoint: 0.6,
        epistemicType: "observed_signal",
        sourceClass: "tourism_board",
        note: "phase5-test",
      },
    ],
    contradictedClaims: [],
    unresolvedQuestions: ["현지인 일상 체험 강도는 미확인"],
    usableFactIds: ["ev_ls1"],
    refutationNotes: null,
    researchSupportedFraming: ["흙담·골목 시각 차이를 탐색 포인트로 볼 단서가 있다"],
    limitations: ["실제 방문 체감은 추가 확인 필요"],
    alternateFallbackUsed: false,
    observability: {
      plannedQuestionCount: 1,
      answeredQuestionCount: 0,
      unresolvedQuestionCount: 1,
      contradictingEvidenceCount: 0,
      externalQueriesAttempted: 1,
      externalQueriesSuccessful: 1,
      sourceClasses: ["tourism_board"],
    },
  };
}

function proposition(): ContentProposition {
  const point = story({ editorialArchetype: "discovery" });
  return {
    contract: CONTENT_PROPOSITION_CONTRACT,
    primaryAudience: "베트남 북부 대안 루트에 관심 있는 한국 여행자",
    audienceProblem: "유명 명소만 보면 랑선 흙담 디테일을 놓친다",
    audienceTension: "익숙한 골목 vs 흙담 리듬",
    whyNow: null,
    contentPromise: "랑선 흙담이 눈에 띄는 구체 디테일을 짧게 풀어준다",
    readerGain: "랑선을 볼 때 흙담·골목을 찾는 시선",
    specificTakeaways: ["흙담 비율을 먼저 본다", "공식 안내 범위 안에서만 말한다"],
    proofRequirements: [{ claimArea: "건축 언급", requiredProof: "안내/보도", severity: "must" }],
    contentGapUsed: "일반 문화론만 많고 구체 디테일 부족",
    engagementMechanism: "save_worthy_checklist",
    desiredAudienceAction: "save",
    angle: "랑선 흙담은 흔한 골목과 다른 시각 리듬이다",
    keyMessage: "흙담·골목 리듬을 찾아보라",
    commercialIntent: "informational",
    propositionStrength: "usable",
    limitations: ["일상 체험 강도는 단정하지 않음"],
    storyPointRef: {
      storyPointId: point.pointId,
      storyPointHash: createStoryPointHash(point),
    },
    storyPointHash: createStoryPointHash(point),
    storySupportVerdict: "PARTIALLY_SUPPORTED",
    supportedClaimBoundaryUsed: "공식·보도에서 흙담 마을이 시각적 특징으로 언급되는 범위",
  };
}

function writerFor(point: StoryContentPoint) {
  return buildCanonicalAssetWriterInput({
    agendaId: "ag_langson",
    storyPoint: point,
    storyPointHash: createStoryPointHash(point),
    evidenceBrief: evidence(),
    proposition: proposition(),
    topicIdentitySummary: "베트남 · 랑선",
  });
}

function baseAsset(
  point: StoryContentPoint,
  overrides: Partial<CanonicalMarketingAsset> = {},
): CanonicalMarketingAsset {
  const writer = writerFor(point);
  const sourceRevision = computeCanonicalAssetSourceRevision({
    storyPointId: writer.storyPointId,
    storyPointHash: writer.storyPointHash,
    evidenceRevision: writer.evidenceRevision,
    propositionRevision: writer.proposition.propositionRevision,
    supportedClaimBoundary: writer.supportedClaimBoundary,
    editorialArchetype: writer.editorialArchetype,
  });
  return {
    contract: "canonical-marketing-asset-v1",
    assetId: `cma_${sourceRevision}`,
    version: 1,
    status: "draft",
    agendaId: "ag_langson",
    storyPointId: point.pointId,
    storyPointHash: createStoryPointHash(point),
    evidenceBriefRef: writer.evidenceBriefRef,
    evidenceRevision: writer.evidenceRevision,
    contentPropositionRef: proposition().contract,
    propositionRevision: writer.proposition.propositionRevision,
    sourceRevision,
    titleKo: "랑선 흙담, 흔한 골목과 다른 리듬",
    dekKo: null,
    openingHookKo: "랑선 골목에서는 흙담 비율이 먼저 눈에 들어옵니다.",
    bodyKo: [
      "확인 가능한 범위에서는 랑선 일부 안내·보도가 흙담 건축을 시각적 특징으로 소개합니다.",
      "유명 명소 체크리스트만 따르면 이 디테일은 쉽게 스쳐 지나갑니다.",
      "실제 방문 체감 강도는 여기서 단정하지 않습니다.",
      "다만 흙담·골목 리듬을 찾는 시선은 랑선을 다르게 보게 하는 탐색 포인트가 됩니다.",
    ].join("\n\n"),
    keyTakeawaysKo: ["흙담 비율을 먼저 본다", "공식 안내 범위 안에서만 말한다"],
    decisionGuidanceKo: "이 디테일을 탐색 목록에 넣어볼 만하다",
    optionalCtaIntentKo: null,
    evidenceRefs: [{ evidenceId: "ev_ls1", noteKo: "안내 언급" }],
    limitationsKo: ["실제 방문 체감은 추가 확인 필요"],
    forbiddenClaimsKo: [],
    supportedClaimBoundaryKo: writer.supportedClaimBoundary,
    unresolvedQuestionsKo: ["현지인 일상 체험 강도는 미확인"],
    storySupportVerdict: "PARTIALLY_SUPPORTED",
    generatedAt: "2026-09-18T00:00:00.000Z",
    editedAt: null,
    approvedAt: null,
    approvedVersion: null,
    humanEdited: false,
    approvalSource: null,
    approvedBy: null,
    generatedBy: ASSET_SOURCE_WRITER_ROLE,
    repairCount: 0,
    validationIssues: [],
    ...overrides,
  };
}

describe("ASW Phase5 — writer input archetype", () => {
  it("includes editorialArchetype in CanonicalAssetWriterInput", () => {
    const point = story({ editorialArchetype: "cultural_curiosity" });
    const writer = writerFor(point);
    expect(writer.editorialArchetype).toBe("cultural_curiosity");
    const prompt = buildAssetSourceWriterPrompt({ writerInput: writer });
    expect(prompt).toContain('"editorialArchetype":"cultural_curiosity"');
  });

  it("archetype change affects source revision", () => {
    const a = writerFor(story({ editorialArchetype: "discovery" }));
    const b = writerFor(story({ editorialArchetype: "hidden_detail" }));
    const revA = computeCanonicalAssetSourceRevision({
      storyPointId: a.storyPointId,
      storyPointHash: a.storyPointHash,
      evidenceRevision: a.evidenceRevision,
      propositionRevision: a.proposition.propositionRevision,
      supportedClaimBoundary: a.supportedClaimBoundary,
      editorialArchetype: a.editorialArchetype,
    });
    const revB = computeCanonicalAssetSourceRevision({
      storyPointId: b.storyPointId,
      storyPointHash: b.storyPointHash,
      evidenceRevision: b.evidenceRevision,
      propositionRevision: b.proposition.propositionRevision,
      supportedClaimBoundary: b.supportedClaimBoundary,
      editorialArchetype: b.editorialArchetype,
    });
    expect(revA).not.toBe(revB);
  });

  it("legacy/missing archetype remains safe (null, no invent)", () => {
    const point = story({ editorialArchetype: null, agendaFitNotes: null });
    expect(resolveStoryEditorialArchetype(point)).toBeNull();
    const writer = writerFor(point);
    expect(writer.editorialArchetype).toBeNull();
    const revWithNull = computeCanonicalAssetSourceRevision({
      storyPointId: writer.storyPointId,
      storyPointHash: writer.storyPointHash,
      evidenceRevision: writer.evidenceRevision,
      propositionRevision: writer.proposition.propositionRevision,
      supportedClaimBoundary: writer.supportedClaimBoundary,
      editorialArchetype: null,
    });
    const revOmitted = computeCanonicalAssetSourceRevision({
      storyPointId: writer.storyPointId,
      storyPointHash: writer.storyPointHash,
      evidenceRevision: writer.evidenceRevision,
      propositionRevision: writer.proposition.propositionRevision,
      supportedClaimBoundary: writer.supportedClaimBoundary,
    });
    expect(revWithNull).toBe(revOmitted);
  });

  it("recovers archetype from legacy agendaFitNotes without inventing", () => {
    const point = story({
      editorialArchetype: null,
      agendaFitNotes: "title:랑선 | archetype:discovery | source:external_editorial_director",
    });
    expect(resolveStoryEditorialArchetype(point)).toBe("discovery");
  });

  it("normalizeExternalStory copies exact editorialArchetype onto StoryContentPoint", () => {
    const candidate: ExternalStoryCandidate = {
      externalStoryId: "ext_1",
      storyTitleKo: "랑선 흙담",
      storyQuestionKo: BASE_STORY.storyQuestion,
      storyClaimKo: BASE_STORY.storyClaim,
      audienceProblemKo: null,
      decisionAtStakeKo: null,
      stakes: [],
      whyKoreanTravelerCaresKo: null,
      whyInterestingKo: BASE_STORY.whyInteresting,
      audienceTensionKo: BASE_STORY.audienceTension,
      curiosityGapKo: BASE_STORY.curiosityGap,
      readerPayoffKo: BASE_STORY.readerPayoff,
      editorialArchetype: "hidden_detail",
      researchNeededKo: BASE_STORY.researchNeeded,
      researchQuestionsKo: BASE_STORY.researchQuestions,
      recommendedChannels: ["threads"],
      channelReasonKo: null,
      riskKo: BASE_STORY.genericRisk,
      nonGoalsKo: BASE_STORY.nonGoals,
    };
    const point = normalizeExternalStoryToPoint(candidate, "ag_langson");
    expect(point.editorialArchetype).toBe("hidden_detail");
  });
});

describe("ASW Phase5 — archetype-aware prompt", () => {
  it("discovery-like prompt forbids forced decision/trade-off; allows light exploration", () => {
    expect(ASSET_SOURCE_WRITER_CONTRACT_PROMPT).toContain(
      "Decision is one Story type, not a universal quality criterion",
    );
    expect(ASSET_SOURCE_WRITER_CONTRACT_PROMPT).toContain("Do NOT force");
    expect(ASSET_SOURCE_WRITER_CONTRACT_PROMPT).toContain("A vs B framing");
    expect(ASSET_SOURCE_WRITER_CONTRACT_PROMPT).toContain("LIGHT EXPLORATION GUIDANCE");
    expect(ASSET_SOURCE_WRITER_CONTRACT_PROMPT).toContain(
      "provide archetype-appropriate reader guidance",
    );
    expect(ASSET_SOURCE_WRITER_CONTRACT_PROMPT).not.toContain(
      "surface decision guidance for the reader",
    );
    expect(isAsWDiscoveryLikeArchetype("discovery")).toBe(true);
    expect(isAsWDiscoveryLikeArchetype("CULTURAL_CURIOSITY")).toBe(true);
    expect(isAsWDiscoveryLikeArchetype("experience_fit")).toBe(true);
  });

  it("decision/practical archetype still allows strong decision guidance", () => {
    expect(ASSET_SOURCE_WRITER_CONTRACT_PROMPT).toContain(
      "Stronger decision guidance is appropriate when supported",
    );
    expect(isAsWDecisionPracticalArchetype("worth_it_or_not")).toBe(true);
    expect(isAsWDecisionPracticalArchetype("practical")).toBe(true);
    expect(isAsWDecisionPracticalArchetype("decision_rule")).toBe(true);
    const writer = writerFor(story({ editorialArchetype: "worth_it_or_not" }));
    const prompt = buildAssetSourceWriterPrompt({ writerInput: writer });
    expect(prompt).toContain('"editorialArchetype":"worth_it_or_not"');
    expect(prompt).toContain("Stronger decision guidance is appropriate");
  });

  it("concrete detail first + soft-claim discipline present", () => {
    expect(ASSET_SOURCE_WRITER_CONTRACT_PROMPT).toContain("CONCRETE DETAIL FIRST");
    expect(ASSET_SOURCE_WRITER_CONTRACT_PROMPT).toContain("문화적 다양성");
    expect(ASSET_SOURCE_WRITER_CONTRACT_PROMPT).toContain("현명한 선택");
    expect(ASSET_SOURCE_WRITER_CONTRACT_PROMPT).toContain("EVIDENCE DISCIPLINE");
    expect(ASSET_SOURCE_WRITER_CONTRACT_PROMPT).toContain(
      "현지인의 삶이 고스란히 담겨 있다",
    );
  });
});

describe("ASW Phase5 — parser / validator / contract keys", () => {
  it("parser still requires decisionGuidanceKo", () => {
    const ok = parseCanonicalMarketingAssetContent({
      titleKo: "제목",
      openingHookKo: "훅입니다",
      bodyKo: "본문입니다 ".repeat(20),
      keyTakeawaysKo: ["하나"],
      decisionGuidanceKo: "탐색 목록에 넣어볼 만하다",
    });
    expect(ok?.decisionGuidanceKo).toBeTruthy();
    const missing = parseCanonicalMarketingAssetContent({
      titleKo: "제목",
      openingHookKo: "훅입니다",
      bodyKo: "본문입니다 ".repeat(20),
      keyTakeawaysKo: ["하나"],
    });
    expect(missing).toBeNull();
  });

  it("concise exploration guidance passes validation", () => {
    const point = story({ editorialArchetype: "discovery" });
    const asset = baseAsset(point, {
      decisionGuidanceKo: "탐색 목록에 넣어볼 만하다",
    });
    const check = validateCanonicalMarketingAsset({
      asset,
      storyPoint: point,
      storyPointHash: createStoryPointHash(point),
      evidenceBrief: evidence(),
      proposition: proposition(),
      expectedSourceRevision: asset.sourceRevision,
    });
    expect(check.ok).toBe(true);
  });

  it("evidence/boundary validation still fails on unsupported price", () => {
    const point = story({ editorialArchetype: "discovery" });
    const asset = baseAsset(point, {
      bodyKo: `${baseAsset(point).bodyKo}\n\n항공권 899,000원으로 확정 가격이다.`,
    });
    const check = validateCanonicalMarketingAsset({
      asset,
      storyPoint: point,
      storyPointHash: createStoryPointHash(point),
      evidenceBrief: evidence(),
      proposition: proposition(),
      expectedSourceRevision: asset.sourceRevision,
    });
    expect(check.ok).toBe(false);
    expect(check.issues.some((i) => i.code === "unsupported_price_or_route")).toBe(true);
  });

  it("output contract keys unchanged in prompt schema", () => {
    const keys = [
      "titleKo",
      "dekKo",
      "openingHookKo",
      "bodyKo",
      "keyTakeawaysKo",
      "decisionGuidanceKo",
      "optionalCtaIntentKo",
      "limitationsKo",
      "forbiddenClaimsKo",
      "supportedClaimBoundaryKo",
      "unresolvedQuestionsKo",
      "evidenceRefs",
    ];
    for (const key of keys) {
      expect(ASSET_SOURCE_WRITER_CONTRACT_PROMPT).toContain(key);
    }
  });
});
