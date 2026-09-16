/**
 * ED-3 — ContentProposition Story-lock focused tests (validator + revision).
 */

import { describe, expect, it } from "vitest";

import {
  AGENDA_TOPIC_IDENTITY_CONTRACT,
  type AgendaTopicIdentity,
} from "@/lib/marketing/audienceResearch/topicIdentity/contracts";
import {
  CONTENT_PROPOSITION_CONTRACT,
  type ContentProposition,
} from "@/lib/marketing/content/proposition/contracts";
import {
  assertStoryVerdictAllowsContentStrategist,
  computePropositionSourceRevision,
  validateContentPropositionAgainstStory,
} from "@/lib/marketing/content/proposition/storyLock";
import {
  EVIDENCE_BACKED_STORY_BRIEF_CONTRACT,
  STORY_CONTENT_POINT_CONTRACT,
  STORY_RESEARCH_CONTRACT_VERSION,
  type EvidenceBackedStoryBrief,
  type StoryContentPoint,
} from "@/lib/marketing/storyPoint/contracts";
import { createStoryPointHash } from "@/lib/marketing/storyPoint/hash";

const BANGKOK: StoryContentPoint = {
  contract: STORY_CONTENT_POINT_CONTRACT,
  pointId: "sp_bangkok_hotel_ed3",
  storyQuestion: "부모님과 방콕을 갈 때 호텔 등급보다 위치를 먼저 봐야 할까?",
  storyClaim: "방콕에서는 호텔 등급보다 위치가 더 중요하다",
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

function evidenceBrief(
  overrides: Partial<EvidenceBackedStoryBrief> = {},
): EvidenceBackedStoryBrief {
  const hash = createStoryPointHash(BANGKOK);
  return {
    contract: EVIDENCE_BACKED_STORY_BRIEF_CONTRACT,
    researchContractVersion: STORY_RESEARCH_CONTRACT_VERSION,
    storyPointId: BANGKOK.pointId,
    storyPointHash: hash,
    agendaLogicalIdentity: "logical_ed3_bangkok",
    researchExecutionStatus: "complete",
    storySupportVerdict: "SUPPORTED",
    supportedClaimBoundary: null,
    researchQuestionFindings: [
      {
        question: BANGKOK.researchQuestions[0]!,
        status: "answered",
        finding: "숙박지역별 BTS/MRT 접근성 차이가 후기와 안내에서 반복 관측됨",
        evidenceRefs: ["ext_bts_1"],
        sourceClasses: ["community"],
        confidence: 0.7,
        limitations: [],
      },
      {
        question: BANGKOK.researchQuestions[1]!,
        status: "answered",
        finding: "부모님 동반 후기에서 이동거리·위치 불만이 반복됨",
        evidenceRefs: ["ext_parent_1"],
        sourceClasses: ["community"],
        confidence: 0.65,
        limitations: [],
      },
    ],
    evidenceAssessment: [
      {
        evidenceId: "ext_bts_1",
        relationship: "supports",
        relevanceToStoryPoint: 0.7,
        epistemicType: "observed_signal",
        sourceClass: "community",
        note: null,
      },
    ],
    contradictedClaims: [],
    unresolvedQuestions: [],
    usableFactIds: ["ext_bts_1", "ext_parent_1"],
    refutationNotes: null,
    limitations: ["community_signal_not_official_policy"],
    alternateFallbackUsed: false,
    researchSupportedFraming: [
      "부모님 동반 방콕에서 숙소 위치가 이동 편의에 실질적 영향을 준다",
    ],
    observability: {
      plannedQuestionCount: 2,
      answeredQuestionCount: 2,
      unresolvedQuestionCount: 0,
      contradictingEvidenceCount: 0,
      externalQueriesAttempted: 2,
      externalQueriesSuccessful: 2,
      sourceClasses: ["community"],
    },
    ...overrides,
  };
}

function baseProposition(overrides: Partial<ContentProposition> = {}): ContentProposition {
  return {
    contract: CONTENT_PROPOSITION_CONTRACT,
    primaryAudience: "부모님과 방콕을 가는 가족 여행자",
    audienceProblem: "호텔 등급을 올리면 편할 것 같지만 이동이 어려우면 하루가 망가진다",
    audienceTension: BANGKOK.audienceTension,
    whyNow: null,
    contentPromise:
      "부모님 동반 방콕에서 숙소 위치가 호텔 등급만큼 중요한지 판단 기준을 정리한다",
    readerGain: BANGKOK.readerPayoff,
    specificTakeaways: [
      "주요 숙박지역별 BTS/MRT 접근성 차이를 먼저 비교한다",
      "부모님 동반 일정이면 관광지 이동시간을 숙소 선택 기준으로 둔다",
    ],
    proofRequirements: [
      {
        claimArea: "BTS 접근성",
        requiredProof: "지역별 교통 접근 근거",
        severity: "must",
      },
    ],
    contentGapUsed: "등급 중심 숙소 추천은 많지만 부모 동반 이동 기준은 부족",
    engagementMechanism: "decision_aid",
    desiredAudienceAction: "compare",
    angle: "등급 vs 위치 — 부모님 동반 숙소 우선순위",
    keyMessage: "부모님 동반이면 위치·이동을 등급과 함께 비교하라",
    commercialIntent: "informational",
    channelIntentHints: null,
    propositionStrength: "usable",
    limitations: ["community_signal_not_official_policy"],
    takeawayEvidenceRefs: [
      {
        takeaway: "주요 숙박지역별 BTS/MRT 접근성 차이를 먼저 비교한다",
        evidenceRefs: ["ext_bts_1"],
      },
      {
        takeaway: "부모님 동반 일정이면 관광지 이동시간을 숙소 선택 기준으로 둔다",
        evidenceRefs: ["ext_parent_1"],
      },
    ],
    ...overrides,
  };
}

describe("ED-3 ContentProposition Story lock", () => {
  it("SUPPORTED Bangkok proposition aligns; generic fallback fails", () => {
    const brief = evidenceBrief();
    const ok = validateContentPropositionAgainstStory({
      proposition: baseProposition(),
      storyPoint: BANGKOK,
      evidenceBrief: brief,
      topicIdentity: bangkokIdentity(),
    });
    expect(ok.ok).toBe(true);
    expect(ok.evidenceBackedTakeawayCount).toBeGreaterThanOrEqual(1);

    const generic = validateContentPropositionAgainstStory({
      proposition: baseProposition({
        contentPromise: "태국 여행 시 알아둘 점을 소개한다",
        angle: "태국 여행 준비 팁",
        audienceTension: "여행 정보가 부족하다",
        readerGain: "유용한 여행 정보를 얻는다",
        specificTakeaways: ["공항 이동", "환전", "날씨"],
        takeawayEvidenceRefs: null,
      }),
      storyPoint: BANGKOK,
      evidenceBrief: brief,
      topicIdentity: bangkokIdentity(),
    });
    expect(generic.ok).toBe(false);
    expect(generic.issues.length).toBeGreaterThan(0);
  });

  it("PARTIALLY_SUPPORTED enforces supportedClaimBoundary as max scope", () => {
    const boundary =
      "부모님 동반 일정에서는 위치를 호텔 등급만큼 중요하게 비교할 가치가 있다";
    const brief = evidenceBrief({
      storySupportVerdict: "PARTIALLY_SUPPORTED",
      supportedClaimBoundary: boundary,
      researchSupportedFraming: [boundary],
    });

    const narrow = validateContentPropositionAgainstStory({
      proposition: baseProposition({
        contentPromise: boundary,
        keyMessage: "부모님 동반이면 위치를 등급과 동등하게 비교하라",
      }),
      storyPoint: BANGKOK,
      evidenceBrief: brief,
      topicIdentity: bangkokIdentity(),
    });
    expect(narrow.ok).toBe(true);
    expect(narrow.boundaryUsed).toBe(true);

    const overbroad = validateContentPropositionAgainstStory({
      proposition: baseProposition({
        contentPromise: "방콕에서는 무조건 위치가 호텔 등급보다 더 중요하다",
        keyMessage: "위치가 항상 더 중요하다",
      }),
      storyPoint: BANGKOK,
      evidenceBrief: brief,
      topicIdentity: bangkokIdentity(),
    });
    expect(overbroad.ok).toBe(false);
    expect(overbroad.issues.some((i) => String(i.code).includes("boundary"))).toBe(true);
  });

  it("rejects unsupported takeaway", () => {
    const brief = evidenceBrief();
    const bad = validateContentPropositionAgainstStory({
      proposition: baseProposition({
        specificTakeaways: ["강변 호텔은 치안이 더 나쁘다"],
        takeawayEvidenceRefs: null,
      }),
      storyPoint: BANGKOK,
      evidenceBrief: brief,
      topicIdentity: bangkokIdentity(),
    });
    expect(bad.ok).toBe(false);
    expect(bad.unsupportedTakeawayCount).toBeGreaterThanOrEqual(1);
  });

  it("allows evidence-backed checklist without phrase-only penalty", () => {
    const brief = evidenceBrief();
    const checklist = validateContentPropositionAgainstStory({
      proposition: baseProposition({
        contentPromise:
          "부모님과 방콕 숙소를 고를 때 이동 편의를 확인할 세 가지 기준",
        specificTakeaways: [
          "주요 숙박지역별 BTS/MRT 접근성 차이를 먼저 비교한다",
          "부모님 동반 후기에서 이동거리 불만이 반복되는지 본다",
          "관광지 이동시간을 숙소 선택 기준으로 둔다",
        ],
        takeawayEvidenceRefs: [
          {
            takeaway: "주요 숙박지역별 BTS/MRT 접근성 차이를 먼저 비교한다",
            evidenceRefs: ["ext_bts_1"],
          },
          {
            takeaway: "부모님 동반 후기에서 이동거리 불만이 반복되는지 본다",
            evidenceRefs: ["ext_parent_1"],
          },
          {
            takeaway: "관광지 이동시간을 숙소 선택 기준으로 둔다",
            evidenceRefs: ["ext_parent_1"],
          },
        ],
      }),
      storyPoint: BANGKOK,
      evidenceBrief: brief,
      topicIdentity: bangkokIdentity(),
    });
    expect(checklist.ok).toBe(true);
  });

  it("rejects cruise contamination on hotel identity", () => {
    const drifted = validateContentPropositionAgainstStory({
      proposition: baseProposition({
        contentPromise: "MSC 크루즈와 다낭 여행을 비교한다",
        angle: "MSC cruise vs Da Nang",
        keyMessage: "크루즈 승선이 더 편하다",
        specificTakeaways: ["MSC 벨리시마 승선 동선을 확인한다"],
        takeawayEvidenceRefs: null,
      }),
      storyPoint: BANGKOK,
      evidenceBrief: evidenceBrief(),
      topicIdentity: bangkokIdentity(),
    });
    expect(drifted.ok).toBe(false);
  });

  it("REFUTED / INSUFFICIENT_EVIDENCE fail closed", () => {
    expect(assertStoryVerdictAllowsContentStrategist("REFUTED").ok).toBe(false);
    expect(assertStoryVerdictAllowsContentStrategist("INSUFFICIENT_EVIDENCE").ok).toBe(false);
    expect(assertStoryVerdictAllowsContentStrategist("SUPPORTED").ok).toBe(true);
    expect(assertStoryVerdictAllowsContentStrategist("PARTIALLY_SUPPORTED").ok).toBe(true);

    const refuted = validateContentPropositionAgainstStory({
      proposition: baseProposition(),
      storyPoint: BANGKOK,
      evidenceBrief: evidenceBrief({ storySupportVerdict: "REFUTED" }),
      topicIdentity: bangkokIdentity(),
    });
    expect(refuted.ok).toBe(false);
  });

  it("allows English StoryPoint + Korean paraphrase when entity anchors stay (Con Dao)", () => {
    const conDao: StoryContentPoint = {
      ...BANGKOK,
      pointId: "sp_condao_ed3",
      storyQuestion: null,
      storyClaim:
        "Con Dao’s strict environmental conservation model protects its marine ecosystem by limiting mass tourism, creating rare barefoot luxury.",
      audienceTension:
        "Travelers seeking exclusive island luxury fear contributing to overtourism in fragile marine sanctuaries.",
      curiosityGap:
        "How does an isolated archipelago keep ultra-low visitor footprints while delivering hospitality?",
      readerPayoff:
        "Understand how sustainable luxury works in Con Dao before booking.",
      researchQuestions: [
        "What visitor caps or environmental fees are enforced in Con Dao?",
        "How do luxury resorts balance amenities with conservation mandates?",
      ],
      nonGoals: ["generic Vietnam beach guide"],
    };
    const boundary =
      "해당 일정·맥락에서는 Con Dao conservation model limits mass tourism for barefoot luxury — 증거 범위 안에서만 말함";
    const brief = evidenceBrief({
      storyPointId: conDao.pointId,
      storyPointHash: createStoryPointHash(conDao),
      storySupportVerdict: "PARTIALLY_SUPPORTED",
      supportedClaimBoundary: boundary,
      researchSupportedFraming: [boundary],
      researchQuestionFindings: [
        {
          question: conDao.researchQuestions[0]!,
          status: "partially_answered",
          finding: "커뮤니티/후기 수준의 관찰 신호만 있어 부분 답변입니다.",
          evidenceRefs: ["ext_condao_1"],
          sourceClasses: ["unknown"],
          confidence: 0.35,
          limitations: ["social_or_snippet_only"],
        },
      ],
      evidenceAssessment: [
        {
          evidenceId: "ext_condao_1",
          relationship: "partially_supports",
          relevanceToStoryPoint: 0.25,
          epistemicType: "observed_signal",
          sourceClass: "unknown",
          note: "snippet_only_not_verified_fact",
        },
      ],
      usableFactIds: [],
      limitations: ["claim_narrowed_to_supported_boundary", "social_or_community_evidence_only"],
    });
    const identity: AgendaTopicIdentity = {
      ...bangkokIdentity(),
      destinationEntities: ["베트남", "Con Dao"],
      topicEntities: ["Con Dao", "conservation", "luxury"],
      commercialSubject: "Con Dao luxury",
      sourceKeywords: ["Con Dao", "Vietnam", "conservation"],
      productTypes: ["hotel"],
    };
    const ok = validateContentPropositionAgainstStory({
      proposition: baseProposition({
        primaryAudience: "프라이빗 섬 휴양을 찾는 한국 여행자",
        audienceProblem: "럭셔리 휴양과 해양 생태계 보호가 충돌할까 걱정된다",
        audienceTension:
          "독점적인 섬 럭셔리를 원하지만 취약한 해양 안식처에 과잉관광을 남기기 싫은 긴장",
        contentPromise:
          "콘다오가 대규모 관광을 제한하는 보존 모델로 맨발 럭셔리를 만드는지 판단 기준을 정리한다",
        readerGain: "콘다오 지속가능 럭셔리가 본인 가치와 맞는지 예약 전에 이해한다",
        angle: "콘다오 보존 모델 vs 대중 해변 휴양",
        keyMessage: "콘다오는 보존 한도 안에서만 럭셔리를 말하라",
        specificTakeaways: [
          "콘다오 군도는 베트남 남해안에 위치하며, 가파른 화강암 절벽과 보호된 해양만을 품은 고립된 생태 안식처입니다.",
          "콘다오 럭셔리 리조트가 보존 규정과 편의 사이에서 어떻게 균형을 잡는지 부분 근거로만 말한다",
        ],
        takeawayEvidenceRefs: [
          {
            takeaway:
              "콘다오 군도는 베트남 남해안에 위치하며, 가파른 화강암 절벽과 보호된 해양만을 품은 고립된 생태 안식처입니다.",
            evidenceRefs: ["ext_condao_1"],
          },
          {
            takeaway:
              "콘다오 럭셔리 리조트가 보존 규정과 편의 사이에서 어떻게 균형을 잡는지 부분 근거로만 말한다",
            evidenceRefs: ["ext_condao_1"],
          },
        ],
        limitations: ["claim_narrowed_to_supported_boundary", "social_or_community_evidence_only"],
      }),
      storyPoint: conDao,
      evidenceBrief: brief,
      topicIdentity: identity,
    });
    expect(ok.ok).toBe(true);

    const drifted = validateContentPropositionAgainstStory({
      proposition: baseProposition({
        audienceTension: "항공권 환불 분쟁에서 OTA 책임이 헷갈린다",
        readerGain: "취소 수수료를 아낄 체크리스트를 얻는다",
        contentPromise: "글로벌 OTA 항공 취소 분쟁 대응 방법을 정리한다",
        specificTakeaways: ["항공사 위약금과 OTA 수수료를 구분한다"],
        takeawayEvidenceRefs: null,
        limitations: ["claim_narrowed_to_supported_boundary"],
      }),
      storyPoint: conDao,
      evidenceBrief: brief,
      topicIdentity: identity,
    });
    expect(drifted.ok).toBe(false);
  });

  it("same revision is stable; boundary change invalidates", () => {
    const brief = evidenceBrief({
      storySupportVerdict: "PARTIALLY_SUPPORTED",
      supportedClaimBoundary: "A",
    });
    const rev1 = computePropositionSourceRevision({
      storyPointHash: brief.storyPointHash,
      storySupportVerdict: brief.storySupportVerdict,
      supportedClaimBoundary: brief.supportedClaimBoundary,
      evidenceBrief: brief,
    });
    const rev1b = computePropositionSourceRevision({
      storyPointHash: brief.storyPointHash,
      storySupportVerdict: brief.storySupportVerdict,
      supportedClaimBoundary: brief.supportedClaimBoundary,
      evidenceBrief: brief,
    });
    expect(rev1).toBe(rev1b);

    const brief2 = evidenceBrief({
      storySupportVerdict: "PARTIALLY_SUPPORTED",
      supportedClaimBoundary: "B-changed",
    });
    const rev2 = computePropositionSourceRevision({
      storyPointHash: brief2.storyPointHash,
      storySupportVerdict: brief2.storySupportVerdict,
      supportedClaimBoundary: brief2.supportedClaimBoundary,
      evidenceBrief: brief2,
    });
    expect(rev2).not.toBe(rev1);
  });
});
