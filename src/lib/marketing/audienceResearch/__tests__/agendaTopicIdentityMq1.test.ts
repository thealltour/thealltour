import { describe, expect, it } from "vitest";

import { buildDeterministicAcrb } from "@/lib/marketing/audienceResearch/deterministicSkeleton";
import { buildResearchQueryPlan } from "@/lib/marketing/audienceResearch/external/queryPlan";
import { mergeLlmIntoSkeleton } from "@/lib/marketing/audienceResearch/synthesize";
import {
  AGENDA_TOPIC_IDENTITY_CONTRACT,
  deriveAgendaTopicIdentity,
  validateAngleAgainstAgendaIdentity,
  identityIsCruise,
  identityIsPackage,
  type AgendaTopicIdentity,
} from "@/lib/marketing/audienceResearch/topicIdentity";
import { prepareManagerToContentHandoff } from "@/lib/marketing/content/prepareManagerToContentHandoff";
import { createInMemoryContentAssignmentStore } from "@/lib/marketing/content/store/contentAssignmentStore";
import {
  buildContentDraftPrompt,
  requestContentStrategistDraftWithFormatRetry,
} from "@/lib/marketing/cron/marketingPlanSpecialists";
import { ContentStrategistTopicIdentityError } from "@/lib/marketing/cron/contentStrategistTopicIdentity";
import type { ContentDraftRequest } from "@/lib/marketing/bot/organization/handoffs";
import type { AcrbContentAngle } from "@/lib/marketing/audienceResearch/contracts";

function selection(input: {
  title: string;
  summary: string;
  destinations?: string[];
  topics?: string[];
  entities?: string[];
  excerpt?: string;
}) {
  return {
    title: input.title,
    summary: input.summary,
    contentObjective: "inform_travelers" as const,
    commercialIntent: "informational" as const,
    destinations: input.destinations ?? [],
    topics: input.topics ?? [],
    entities: input.entities ?? [],
    researchBriefId: "rb_mq1_test",
    agendaCandidateId: "ac_mq1_test",
    evidenceRefs: [
      {
        evidenceId: "f4e6f641-d2cd-4704-8d01-2fbc890a516b",
        sourceId: "a1000000-0000-4000-8000-000000000001",
        sourceType: "social",
        sourceName: "Meta AI Trend Discovery",
        isOfficial: false,
        evidenceType: "derived_signal",
        url: "https://www.instagram.com/reel/example/",
        reference: "meta_ai:obs_mq1",
        excerpt: input.excerpt ?? input.summary,
        publishedAt: null,
        observedAt: "2026-09-13T00:00:00.000Z",
        credibilityHint: 0.35,
      },
    ],
  };
}

function channelFit(): AcrbContentAngle["channelFit"] {
  return {
    threads: 0.7,
    naver_blog: 0.5,
    naver_band: 0.4,
    kakao_channel: 0.4,
    shortform: 0.6,
    cardnews: 0.4,
  };
}

function angle(partial: Partial<AcrbContentAngle> & { angle: string }): AcrbContentAngle {
  return {
    angleId: partial.angleId ?? "angle_x",
    angle: partial.angle,
    hook: partial.hook ?? partial.angle,
    audienceTension: partial.audienceTension ?? "결정 불안",
    interestScore: partial.interestScore ?? 0.7,
    noveltyScore: partial.noveltyScore ?? 0.6,
    evidenceStrength: partial.evidenceStrength ?? 0.4,
    channelFit: partial.channelFit ?? channelFit(),
    rationale: partial.rationale ?? "test",
    supportingFindingRefs: partial.supportingFindingRefs ?? [],
    limitations: partial.limitations ?? [],
  };
}

describe("MQ-1 AgendaTopicIdentity", () => {
  it("parses/serializes contract with unknown-safe fields", () => {
    const identity = deriveAgendaTopicIdentity({
      selectedAgenda: {
        title: "부산 출발 여행",
        summary: "출발지 단서만 있는 약한 관측",
        destinations: [],
        topics: [],
        entities: [],
      },
    });
    expect(identity.contract).toBe(AGENDA_TOPIC_IDENTITY_CONTRACT);
    expect(identity.productTypes).toContain("unknown");
    expect(identity.originEntities).toContain("부산");
    const roundTrip = JSON.parse(JSON.stringify(identity)) as AgendaTopicIdentity;
    expect(roundTrip.contract).toBe(AGENDA_TOPIC_IDENTITY_CONTRACT);
    expect(roundTrip.productTypes).toEqual(identity.productTypes);
  });

  it("derives Nha Trang Chuseok package identity without cruise", () => {
    const identity = deriveAgendaTopicIdentity({
      selectedAgenda: {
        title: "부산 출발 나트랑 추석 가족 패키지 프로모션 관측",
        summary: "부산 기반 여행사의 나트랑·판랑 추석 가족 패키지 프로모션",
        destinations: [],
        topics: [],
        entities: [],
      },
      assignment: {
        topic: "부산 출발 나트랑 추석 가족 패키지 프로모션 관측",
        destinations: [],
        facts: [
          {
            factId: "f1",
            statement: "부산 기반 여행사의 나트랑·판랑 추석 가족 패키지 프로모션",
            evidenceRefIds: [],
            allowedForDraft: true,
          },
        ],
        evidenceRefs: [
          {
            evidenceId: "e1",
            sourceId: "s1",
            sourceType: "social",
            sourceName: "meta",
            isOfficial: false,
            evidenceType: "derived_signal",
            url: null,
            reference: null,
            excerpt: "부산 기반 여행사의 나트랑·판랑 추석 가족 패키지 프로모션",
            publishedAt: null,
            observedAt: null,
            credibilityHint: 0.3,
          },
        ],
      },
    });
    expect(identity.originEntities).toContain("부산");
    expect(identity.destinationEntities).toEqual(expect.arrayContaining(["나트랑", "판랑"]));
    expect(identityIsPackage(identity)).toBe(true);
    expect(identity.productTypes).not.toContain("cruise");
    expect(identity.campaignSeasonality).toContain("추석");
  });

  it("derives legitimate cruise identity with MSC entity", () => {
    const identity = deriveAgendaTopicIdentity({
      selectedAgenda: {
        title: "부산 출발 MSC 벨리시마 첫 크루즈 탑승 가이드",
        summary: "부산 출발 MSC 벨리시마 첫 크루즈 탑승 동선",
        destinations: ["부산"],
        topics: ["크루즈", "탑승"],
        entities: ["MSC 벨리시마"],
      },
    });
    expect(identityIsCruise(identity)).toBe(true);
    expect(identity.originEntities).toContain("부산");
    expect(identity.sourceKeywords.some((k) => /벨리시마|msc/i.test(k))).toBe(true);
  });

  it("derives hotel / flight / destination-general without cross injection", () => {
    const hotel = deriveAgendaTopicIdentity({
      selectedAgenda: {
        title: "다낭 가족 호텔 위치 비교",
        summary: "다낭 가족 호텔 위치 비교 관측",
        destinations: ["다낭"],
        topics: ["호텔"],
        entities: [],
      },
    });
    expect(hotel.productTypes).toContain("hotel");
    expect(hotel.productTypes).not.toContain("cruise");
    expect(hotel.destinationEntities).toContain("다낭");

    const flight = deriveAgendaTopicIdentity({
      selectedAgenda: {
        title: "부산 출발 후쿠오카 항공권 일정",
        summary: "부산 출발 후쿠오카 항공권 일정 관측",
        destinations: ["후쿠오카"],
        topics: ["항공"],
        entities: [],
      },
    });
    expect(flight.productTypes).toContain("flight");
    expect(flight.productTypes).not.toContain("cruise");
    expect(flight.productTypes).not.toContain("hotel");

    const fit = deriveAgendaTopicIdentity({
      selectedAgenda: {
        title: "아이와 다낭 자유여행",
        summary: "아이와 다낭 자유여행 준비",
        destinations: ["다낭"],
        topics: ["자유여행"],
        entities: [],
      },
    });
    expect(fit.productTypes).toContain("free_independent_travel");
    expect(fit.productTypes).not.toContain("cruise");
    expect(fit.productTypes).not.toContain("package");
  });
});

describe("MQ-1 query plan + skeleton guards", () => {
  it("non-cruise Busan package agenda gets zero cruise queries", () => {
    const handoff = prepareManagerToContentHandoff(
      selection({
        title: "부산 출발 나트랑 추석 가족 패키지 프로모션 관측",
        summary: "부산 기반 여행사의 나트랑·판랑 추석 가족 패키지 프로모션",
        excerpt: "부산 기반 여행사의 나트랑·판랑 추석 가족 패키지 프로모션",
      }),
      { store: createInMemoryContentAssignmentStore() },
    );
    const plan = buildResearchQueryPlan({ handoff, maxQueries: 6 });
    expect(plan.queries.every((q) => !/크루즈|cruise|벨리시마|msc|부산항/i.test(q.query))).toBe(
      true,
    );
    expect(plan.queries.some((q) => /패키지|나트랑|직항|가족/i.test(q.query))).toBe(true);
  });

  it("cruise agenda may generate cruise queries", () => {
    const handoff = prepareManagerToContentHandoff(
      selection({
        title: "부산 출발 MSC 벨리시마 첫 크루즈 탑승 가이드",
        summary: "부산 출발 MSC 벨리시마 첫 크루즈 탑승 동선",
        destinations: ["부산"],
        topics: ["크루즈"],
        entities: ["MSC 벨리시마"],
      }),
      { store: createInMemoryContentAssignmentStore() },
    );
    const plan = buildResearchQueryPlan({ handoff, maxQueries: 6 });
    expect(plan.queries.some((q) => /크루즈|출항|터미널|탑승/i.test(q.query))).toBe(true);
  });

  it("Chuseok package skeleton does not inject cruise angles", () => {
    const handoff = prepareManagerToContentHandoff(
      selection({
        title: "부산 출발 나트랑 추석 가족 패키지 프로모션 관측",
        summary: "부산 기반 여행사의 나트랑·판랑 추석 가족 패키지 프로모션",
      }),
      { store: createInMemoryContentAssignmentStore() },
    );
    const brief = buildDeterministicAcrb({
      gathered: {
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
      },
    });
    expect(brief.contentAngles.every((a) => !/크루즈|cruise|벨리시마|부산항/i.test(a.angle))).toBe(
      true,
    );
    expect(brief.contentAngles.every((a) => !/크루즈|cruise/i.test(a.hook))).toBe(true);
    expect(identityIsPackage(brief.topicIdentity!)).toBe(true);
  });

  it("Chuseok cruise skeleton may keep cruise angles", () => {
    const handoff = prepareManagerToContentHandoff(
      selection({
        title: "부산 출발 MSC 벨리시마 첫 크루즈 탑승 가이드",
        summary: "부산 출발 추석 크루즈 탑승 동선",
        destinations: ["부산"],
        topics: ["크루즈", "추석", "탑승"],
        entities: ["MSC 벨리시마"],
      }),
      { store: createInMemoryContentAssignmentStore() },
    );
    const brief = buildDeterministicAcrb({
      gathered: {
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
      },
    });
    expect(brief.contentAngles.some((a) => /크루즈|탑승|부산항/i.test(a.angle))).toBe(true);
  });
});

describe("MQ-1 angle validation + synthesis", () => {
  const packageIdentity = deriveAgendaTopicIdentity({
    selectedAgenda: {
      title: "부산 출발 나트랑 추석 가족 패키지 프로모션 관측",
      summary: "나트랑 가족 패키지",
      destinations: ["나트랑"],
      topics: ["패키지", "추석"],
      entities: [],
    },
  });

  it("allows same-topic paraphrase and generic seasonal framing", () => {
    expect(
      validateAngleAgainstAgendaIdentity("나트랑 가족 패키지 포함사항 체크", packageIdentity).ok,
    ).toBe(true);
    expect(
      validateAngleAgainstAgendaIdentity(
        "추석 가족여행 상품을 볼 때 일정부터 맞춰야 하는 이유",
        packageIdentity,
      ).ok,
    ).toBe(true);
  });

  it("rejects cross-destination / cross-product / unsupported entity", () => {
    expect(
      validateAngleAgainstAgendaIdentity("일본 온천여행 준비", packageIdentity).ok,
    ).toBe(false);
    expect(
      validateAngleAgainstAgendaIdentity("부산 출발 크루즈 탑승 준비", packageIdentity).ok,
    ).toBe(false);
    expect(
      validateAngleAgainstAgendaIdentity("MSC 벨리시마 첫 승선 준비", packageIdentity).ok,
    ).toBe(false);
  });

  it("rejects contaminated recommended angle and keeps compatible survivors", () => {
    const handoff = prepareManagerToContentHandoff(
      selection({
        title: "부산 출발 나트랑 추석 가족 패키지 프로모션 관측",
        summary: "나트랑 가족 패키지",
      }),
      { store: createInMemoryContentAssignmentStore() },
    );
    const skeleton = buildDeterministicAcrb({
      gathered: {
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
      },
    });
    const merged = mergeLlmIntoSkeleton(skeleton, {
      researchVerdict: "PROCEED",
      researchStatus: "complete",
      contentAngles: [
        angle({
          angleId: "bad_cruise",
          angle: "추석 연휴 크루즈를 볼 때 가족 일정 조율이 먼저다",
          hook: "연휴 크루즈 관심",
          interestScore: 0.99,
          noveltyScore: 0.99,
        }),
        angle({
          angleId: "good_pkg",
          angle: "나트랑 가족 패키지에서 포함사항 먼저 확인하기",
          hook: "포함사항부터",
          interestScore: 0.8,
          noveltyScore: 0.7,
        }),
      ],
      recommendedAngleId: "bad_cruise",
      recommendedAngleReason: "contaminated",
      limitations: [],
      verdictReasons: ["angles_available"],
      audience: skeleton.audience,
      searchIntent: skeleton.searchIntent,
      marketSignals: skeleton.marketSignals,
      researchFindings: skeleton.researchFindings,
      sourceCoverage: skeleton.sourceCoverage,
      provenance: skeleton.provenance,
    });
    expect(merged.contentAngles.every((a) => !/크루즈/i.test(a.angle))).toBe(true);
    expect(merged.contentAngles.some((a) => a.angleId === "good_pkg" || /패키지|나트랑|추석/i.test(a.angle))).toBe(
      true,
    );
    expect(merged.recommendedAngleId).not.toBe("bad_cruise");
  });

  it("fails safely when no valid angles remain", () => {
    const handoff = prepareManagerToContentHandoff(
      selection({
        title: "부산 출발 나트랑 추석 가족 패키지 프로모션 관측",
        summary: "나트랑 가족 패키지",
      }),
      { store: createInMemoryContentAssignmentStore() },
    );
    const skeleton = buildDeterministicAcrb({
      gathered: {
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
      },
    });
    const contaminatedOnly = {
      ...skeleton,
      contentAngles: [],
    };
    const merged = mergeLlmIntoSkeleton(contaminatedOnly, {
      researchVerdict: "PROCEED",
      researchStatus: "complete",
      contentAngles: [
        angle({
          angleId: "only_bad",
          angle: "MSC 벨리시마 부산항 크루즈 탑승",
          hook: "크루즈 탑승",
          interestScore: 0.99,
        }),
      ],
      recommendedAngleId: "only_bad",
      recommendedAngleReason: "bad",
      limitations: [],
      verdictReasons: ["angles_available"],
      audience: skeleton.audience,
      searchIntent: skeleton.searchIntent,
      marketSignals: skeleton.marketSignals,
      researchFindings: skeleton.researchFindings,
      sourceCoverage: skeleton.sourceCoverage,
      provenance: skeleton.provenance,
    });
    expect(merged.contentAngles.length).toBe(0);
    expect(merged.researchVerdict).toBe("SKIP");
    expect(merged.recommendedAngleId).toBeNull();
  });
});

describe("MQ-1 Content Strategist identity guard", () => {
  function payloadWithIdentity(): ContentDraftRequest {
    const handoff = prepareManagerToContentHandoff(
      selection({
        title: "부산 출발 나트랑 추석 가족 패키지 프로모션 관측",
        summary: "나트랑 가족 패키지",
      }),
      { store: createInMemoryContentAssignmentStore() },
    );
    const brief = buildDeterministicAcrb({
      gathered: {
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
      },
    });
    return {
      productId: "theall_travel",
      channel: "threads",
      goal: "draft",
      agenda: handoff.selectedAgenda.title,
      brief,
      audienceContentResearchBrief: brief,
      agendaTopicIdentity: brief.topicIdentity,
      constraints: [],
      memoryReferences: [],
      contentAssignment: handoff.contentAssignment,
      selectedAgenda: handoff.selectedAgenda,
      evidencePack: handoff.evidencePack,
    };
  }

  it("includes identity in CS handoff prompt", () => {
    const prompt = buildContentDraftPrompt(payloadWithIdentity());
    expect(prompt).toMatch(/AgendaTopicIdentity is AUTHORITATIVE/);
    expect(prompt).toMatch(/package/);
  });

  it("blocks contaminated primaryAngle/title and retries then fails closed", async () => {
    const payload = payloadWithIdentity();
    let calls = 0;
    await expect(
      requestContentStrategistDraftWithFormatRetry({
        payload,
        invoke: () => {
          calls += 1;
          return JSON.stringify({
            title: "MSC 벨리시마 첫 승선 준비",
            body: "나트랑 패키지 본문",
            channel: "threads",
            agenda: payload.agenda,
            sourceReferences: [],
            contentPlan: {
              assignmentId: payload.contentAssignment?.assignmentId ?? "",
              factsToUse: [],
              evidenceRefs: [],
              targetChannels: ["threads"],
              primaryAngle: "추석 연휴 크루즈를 볼 때 가족 일정 조율이 먼저다",
              keyMessage: "크루즈 일정 조율",
            },
          });
        },
      }),
    ).rejects.toBeInstanceOf(ContentStrategistTopicIdentityError);
    expect(calls).toBe(2);
  });

  it("accepts identity-compatible CS output", async () => {
    const payload = payloadWithIdentity();
    const result = await requestContentStrategistDraftWithFormatRetry({
      payload,
      invoke: () =>
        JSON.stringify({
          title: "나트랑 가족 패키지, 포함사항부터 확인",
          body: "추석 가족 패키지를 볼 때 일정과 포함사항을 먼저 맞춰보세요.",
          channel: "threads",
          agenda: payload.agenda,
          sourceReferences: [],
          contentPlan: {
            assignmentId: payload.contentAssignment?.assignmentId ?? "",
            factsToUse: [],
            evidenceRefs: [],
            targetChannels: ["threads"],
            primaryAngle: "나트랑 가족 패키지에서 포함사항 먼저 확인하기",
            keyMessage: "포함사항과 일정부터",
            targetAudience: "부산·경남 추석 가족여행 검토자",
            hook: "추석 가족여행, 상품부터 찾으면 일정부터 꼬일 수 있습니다.",
            outline: ["왜 지금", "먼저 확인할 3가지", "공식 확인이 필요한 것"],
            ctaStrategy: "save checklist",
            proposition: {
              contract: "content-proposition-v1",
              primaryAudience: "부산·경남 추석 가족여행 검토자",
              audienceProblem: "가격부터 보면 일정·포함사항이 안 맞을 수 있음",
              audienceTension: "빨리 고르고 싶음 vs 확인 없이 불안",
              whyNow: "추석 가족 패키지 프로모션 관측",
              contentPromise: "예약 후보 전에 일정·직항·포함사항 기준을 정리한다",
              readerGain: "상품 비교 전에 일정·직항·포함사항부터 확인하는 기준을 얻는다",
              specificTakeaways: [
                "가족 전원이 가능한 날짜부터 맞춘다",
                "부산 출발 직항 여부를 확인한다",
                "패키지 포함·불포함 항목을 비교한다",
              ],
              proofRequirements: [
                {
                  claimArea: "직항",
                  requiredProof: "official airline confirmation",
                  severity: "must",
                },
              ],
              contentGapUsed: "가격 훅은 많지만 확인 순서는 없음",
              engagementMechanism: "save_worthy_checklist",
              desiredAudienceAction: "save",
              angle: "나트랑 가족 패키지에서 포함사항 먼저 확인하기",
              keyMessage: "포함사항과 일정부터",
              commercialIntent: "informational",
              propositionStrength: "usable",
              limitations: [],
            },
          },
        }),
    });
    expect(result.output.contentPlan?.primaryAngle).toMatch(/패키지/);
  });
});

describe("MQ-1 2026-09-13 incident regression", () => {
  it("blocks the confirmed contamination path end-to-end at RA-1", () => {
    const handoff = prepareManagerToContentHandoff(
      selection({
        title: "부산 출발 나트랑 추석 가족 패키지 프로모션 관측",
        summary: "부산 기반 여행사의 나트랑·판랑 추석 가족 패키지 프로모션",
        excerpt: "부산 기반 여행사의 나트랑·판랑 추석 가족 패키지 프로모션",
      }),
      { store: createInMemoryContentAssignmentStore() },
    );
    const plan = buildResearchQueryPlan({ handoff });
    const brief = buildDeterministicAcrb({
      gathered: {
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
      },
    });
    expect(plan.queries.every((q) => !/크루즈|cruise|msc|벨리시마/i.test(q.query))).toBe(true);
    expect(brief.contentAngles.every((a) => !/크루즈|cruise/i.test(`${a.angle} ${a.hook}`))).toBe(
      true,
    );
    expect(
      validateAngleAgainstAgendaIdentity("MSC 벨리시마 첫 승선 준비", brief.topicIdentity!).ok,
    ).toBe(false);
    const seasonal = brief.contentAngles.find((a) => /추석|일정/i.test(a.angle));
    expect(seasonal).toBeTruthy();
    expect(/크루즈/i.test(seasonal!.angle)).toBe(false);
  });
});
