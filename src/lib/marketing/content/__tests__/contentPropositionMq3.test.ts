import { describe, expect, it } from "vitest";

import {
  CONTENT_PROPOSITION_CONTRACT,
  type ContentProposition,
} from "@/lib/marketing/content/proposition/contracts";
import { parseContentProposition } from "@/lib/marketing/content/proposition/parseContentProposition";
import { validateContentProposition } from "@/lib/marketing/content/proposition/validateContentProposition";
import { deriveAgendaTopicIdentity } from "@/lib/marketing/audienceResearch/topicIdentity/deriveTopicIdentity";
import { parseProviderContentPlan } from "@/lib/marketing/content/validation/validateContentPlan";
import { CONTENT_PLAN_CONTRACT } from "@/lib/marketing/content/types";
import { prepareManagerToContentHandoff } from "@/lib/marketing/content/prepareManagerToContentHandoff";
import { createInMemoryContentAssignmentStore } from "@/lib/marketing/content/store/contentAssignmentStore";
import { prepareContentToGovernanceHandoff } from "@/lib/marketing/content/governance/prepareContentToGovernanceHandoff";
import { buildPublishableComposerInput } from "@/lib/marketing/publishable/inputs";
import { buildDeterministicAcrb } from "@/lib/marketing/audienceResearch/deterministicSkeleton";
import {
  buildContentDraftPrompt,
  requestContentStrategistDraftWithFormatRetry,
} from "@/lib/marketing/cron/marketingPlanSpecialists";
import type { ContentDraftRequest } from "@/lib/marketing/bot/organization/handoffs";
import type { CompletedMarketingCandidate } from "@/lib/marketing/cron/daily/types";

function packageProposition(overrides: Partial<ContentProposition> = {}): ContentProposition {
  return {
    contract: CONTENT_PROPOSITION_CONTRACT,
    primaryAudience: "부산·경남에서 추석 가족여행을 알아보는 사람",
    audienceProblem: "상품 가격부터 보지만 가족 일정·출발·포함사항이 맞지 않을 수 있음",
    audienceTension: "저렴해 보여 빨리 고르고 싶음 vs 포함사항/일정 확인 없이 결정하기 불안",
    whyNow: "추석 연휴 가족 패키지 프로모션이 소셜에서 관측됨",
    contentPromise: "추석 가족여행 상품을 볼 때 가격보다 먼저 확인할 일정·출발·포함사항 기준을 정리한다",
    readerGain: "비교 전에 일정/직항/포함사항부터 확인해야 한다는 기준을 얻는다",
    specificTakeaways: [
      "가족 전원이 가능한 날짜부터 맞춘다",
      "부산 출발·직항 여부를 확인한다",
      "패키지 포함/불포함 항목을 비교한다",
    ],
    proofRequirements: [
      {
        claimArea: "직항 여부",
        requiredProof: "official airline or travel supplier confirmation",
        severity: "must",
      },
      {
        claimArea: "포함사항",
        requiredProof: "current package product inclusions source",
        severity: "must",
      },
    ],
    contentGapUsed: "소셜은 가격/프로모션 훅은 많지만 가족이 무엇부터 확인해야 하는지는 설명하지 않음",
    engagementMechanism: "save_worthy_checklist",
    desiredAudienceAction: "save",
    angle: "가격보다 가족 일정 조율이 먼저다",
    keyMessage: "상품 비교 전에 일정·출발·포함사항부터",
    commercialIntent: "informational",
    channelIntentHints: {
      threads: "quick decision criteria",
      naver_blog: "search/problem-solving checklist",
      shortform: "hook + one takeaway",
    },
    propositionStrength: "usable",
    limitations: ["직항·요금은 공식 확인 전 단정 금지"],
    ...overrides,
  };
}

function selection(input: {
  title: string;
  summary: string;
  destinations?: string[];
  topics?: string[];
  entities?: string[];
}) {
  return {
    title: input.title,
    summary: input.summary,
    contentObjective: "inform_travelers" as const,
    commercialIntent: "informational" as const,
    destinations: input.destinations ?? [],
    topics: input.topics ?? [],
    entities: input.entities ?? [],
    researchBriefId: "rb_mq3",
    agendaCandidateId: "ac_mq3",
    evidenceRefs: [
      {
        evidenceId: "f4e6f641-d2cd-4704-8d01-2fbc890a516b",
        sourceId: "a1000000-0000-4000-8000-000000000001",
        sourceType: "social",
        sourceName: "Meta",
        isOfficial: false,
        evidenceType: "derived_signal",
        url: "https://www.instagram.com/reel/mq3/",
        reference: "meta_ai:mq3",
        excerpt: input.summary,
        publishedAt: null,
        observedAt: "2026-09-13T00:00:00.000Z",
        credibilityHint: 0.35,
      },
    ],
  };
}

describe("MQ-3 ContentProposition contract", () => {
  it("parses content-proposition-v1 and keeps ContentPlan backward compatible", () => {
    const prop = parseContentProposition(packageProposition());
    expect(prop?.contract).toBe(CONTENT_PROPOSITION_CONTRACT);
    expect(prop?.specificTakeaways.length).toBe(3);

    const plan = parseProviderContentPlan({
      assignmentId: "ca_test",
      primaryAngle: prop!.angle,
      keyMessage: prop!.keyMessage,
      targetAudience: prop!.primaryAudience,
      hook: "899,000원보다 먼저 확인할 게 있습니다",
      outline: ["왜 지금", "먼저 확인할 3가지", "공식 확인이 필요한 것"],
      factsToUse: [],
      evidenceRefs: [],
      targetChannels: ["threads", "shortform"],
      proposition: prop,
    });
    expect(plan.contract).toBe(CONTENT_PLAN_CONTRACT);
    expect(plan.proposition?.contentPromise).toMatch(/기준/);
  });

  it("requires audience/promise/readerGain/takeaway/engagement and rejects placeholders", () => {
    const identity = deriveAgendaTopicIdentity({
      selectedAgenda: {
        title: "부산 출발 나트랑 추석 가족 패키지 프로모션 관측",
        summary: "나트랑 가족 패키지",
        destinations: ["나트랑"],
        topics: ["패키지"],
        entities: [],
      },
    });

    const ok = validateContentProposition(packageProposition(), { identity });
    expect(ok.ok).toBe(true);

    const generic = validateContentProposition(
      packageProposition({
        contentPromise: "관련 정보를 정리한다",
        readerGain: "도움이 되는 정보를 제공한다",
        specificTakeaways: ["여행 준비에 도움이 된다"],
      }),
      { identity },
    );
    expect(generic.ok).toBe(false);
    expect(generic.issues.some((i) => /generic|placeholder|promise|reader_gain|takeaway/i.test(i.code))).toBe(
      true,
    );

    const cruiseDrift = validateContentProposition(
      packageProposition({
        angle: "부산 출발 크루즈 탑승 준비",
        contentPromise: "MSC 벨리시마 첫 승선 체크리스트를 정리한다",
      }),
      { identity },
    );
    expect(cruiseDrift.ok).toBe(false);
    expect(cruiseDrift.issues.some((i) => i.code === "identity_mismatch")).toBe(true);
  });

  it("allows insufficient without fake takeaways", () => {
    const weak = validateContentProposition({
      contract: CONTENT_PROPOSITION_CONTRACT,
      primaryAudience: "",
      audienceProblem: "",
      audienceTension: "",
      whyNow: null,
      contentPromise: "",
      readerGain: "",
      specificTakeaways: [],
      proofRequirements: [],
      contentGapUsed: "",
      engagementMechanism: "other",
      desiredAudienceAction: "save",
      angle: "",
      keyMessage: "",
      commercialIntent: "informational",
      propositionStrength: "insufficient",
      limitations: ["weak social-only observation; no usable content gap"],
    });
    expect(weak.ok).toBe(true);
    expect(weak.effectiveStrength).toBe("insufficient");
  });
});

describe("MQ-3 incident / cruise / weak fixtures", () => {
  it("Nha Trang package proposition has no cruise and concrete takeaways", () => {
    const identity = deriveAgendaTopicIdentity({
      selectedAgenda: {
        title: "부산 출발 나트랑 추석 가족 패키지 프로모션 관측",
        summary: "부산 기반 여행사의 나트랑·판랑 추석 가족 패키지 프로모션",
        destinations: [],
        topics: [],
        entities: [],
      },
    });
    const prop = packageProposition();
    const result = validateContentProposition(prop, { identity });
    expect(result.ok).toBe(true);
    expect(prop.specificTakeaways.length).toBeGreaterThanOrEqual(2);
    expect(prop.proofRequirements.length).toBeGreaterThan(0);
    expect(/크루즈|msc|벨리시마/i.test(`${prop.angle} ${prop.contentPromise}`)).toBe(false);
    expect(/관측됨/.test(prop.contentPromise)).toBe(false);
  });

  it("legitimate cruise proposition preserved", () => {
    const identity = deriveAgendaTopicIdentity({
      selectedAgenda: {
        title: "부산 출발 MSC 벨리시마 첫 크루즈 탑승 가이드",
        summary: "첫 크루즈 탑승 동선",
        destinations: ["부산"],
        topics: ["크루즈", "탑승"],
        entities: ["MSC 벨리시마"],
      },
    });
    const prop = packageProposition({
      primaryAudience: "부산 출발 첫 크루즈를 검토하는 가족",
      audienceProblem: "첫 크루즈라 탑승 직전 절차가 막막함",
      audienceTension: "부산항 출발이 편해 보임 vs 탑승 직전 동선·수속이 불확실",
      whyNow: null,
      contentPromise: "첫 크루즈 이용자가 탑승 직전에 헷갈리는 준비 항목을 공식 확인이 필요한 부분과 함께 구분해준다",
      readerGain: "탑승 전 체크리스트와 공식 확인 포인트를 저장할 수 있다",
      specificTakeaways: [
        "터미널·동선은 공식 안내로 확인한다",
        "수하물·보안검색은 공항과 다를 수 있어 미리 질문 목록을 만든다",
        "가족 동반 시 이동 부담 포인트를 먼저 정리한다",
      ],
      proofRequirements: [
        {
          claimArea: "터미널/탑승 절차",
          requiredProof: "official terminal or cruise operator source",
          severity: "must",
        },
      ],
      contentGapUsed: "후기는 많지만 탑승 직전 공식 확인 포인트가 정리되지 않음",
      engagementMechanism: "save_worthy_checklist",
      desiredAudienceAction: "save",
      angle: "첫 크루즈, 배 안보다 탑승 직전이 더 헷갈린다",
      keyMessage: "탑승 직전 공식 확인 포인트",
      propositionStrength: "usable",
    });
    const result = validateContentProposition(prop, { identity });
    expect(result.ok).toBe(true);
    expect(prop.contentPromise).toMatch(/탑승/);
  });

  it("weak research fixture stays weak/insufficient without fake tips", () => {
    const weak = parseContentProposition({
      primaryAudience: "여행에 관심 있는 사람",
      audienceProblem: "정보가 많다",
      audienceTension: "",
      whyNow: null,
      contentPromise: "여행 정보를 알려준다",
      readerGain: "도움이 된다",
      specificTakeaways: ["자세히 알아본다", "참고한다", "준비한다"],
      proofRequirements: [],
      contentGapUsed: "",
      engagementMechanism: "other",
      desiredAudienceAction: "click",
      angle: "여행 준비",
      keyMessage: "유용한 정보",
      commercialIntent: "informational",
      propositionStrength: "strong",
      limitations: ["one weak social observation only"],
    });
    const result = validateContentProposition(weak);
    expect(result.ok).toBe(false);
    expect(["weak", "insufficient"]).toContain(result.effectiveStrength);
  });
});

describe("MQ-3 CS prompt + handoffs", () => {
  function payload(): ContentDraftRequest {
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
      contentPlanScaffold: handoff.contentPlanScaffold,
    };
  }

  it("prompt explicitly consumes ACRB fields and discourages generic summary", () => {
    const prompt = buildContentDraftPrompt(payload());
    expect(prompt).toMatch(/ContentProposition/);
    expect(prompt).toMatch(/ACRB_STRATEGY_BRIEF/);
    expect(prompt).toMatch(/audience\.primary/);
    expect(prompt).toMatch(/contentGaps/);
    expect(prompt).toMatch(/Forbidden as core value/);
    expect(prompt).toMatch(/Angle = editorial lens/);
  });

  it("parses CS output with proposition and rejects cruise contamination", async () => {
    const req = payload();
    const prop = packageProposition();
    const result = await requestContentStrategistDraftWithFormatRetry({
      payload: req,
      invoke: () =>
        JSON.stringify({
          title: "나트랑 가족 패키지, 포함사항부터",
          body: "추석 가족여행 상품을 볼 때 일정과 포함사항부터 맞춰보세요.",
          channel: "threads",
          agenda: req.agenda,
          sourceReferences: [],
          contentPlan: {
            assignmentId: req.contentAssignment?.assignmentId ?? "",
            factsToUse: [],
            evidenceRefs: [],
            targetChannels: ["threads", "shortform"],
            primaryAngle: prop.angle,
            keyMessage: prop.keyMessage,
            targetAudience: prop.primaryAudience,
            hook: "추석 가족여행, 상품부터 찾으면 일정부터 꼬일 수 있습니다.",
            outline: ["왜 지금", "먼저 확인할 3가지", "공식 확인이 필요한 것"],
            ctaStrategy: "save checklist reminder",
            proposition: prop,
          },
        }),
    });
    expect(result.output.contentPlan?.proposition?.contentPromise).toMatch(/기준|확인/);
    expect(result.output.contentPlan?.proposition?.propositionStrength).not.toBe("insufficient");
  });

  it("governance and composer receive proposition", () => {
    const req = payload();
    const prop = packageProposition();
    const contentPlan = {
      ...req.contentPlanScaffold!,
      primaryAngle: prop.angle,
      keyMessage: prop.keyMessage,
      targetAudience: prop.primaryAudience,
      hook: "추석 가족여행, 상품부터 찾으면 일정부터 꼬일 수 있습니다.",
      outline: ["왜 지금", "먼저 확인할 3가지"],
      proposition: prop,
    };
    const gov = prepareContentToGovernanceHandoff({
      draft: {
        title: "test",
        body: "나트랑 가족 패키지에서 일정과 포함사항부터 확인하세요.",
        channel: "threads",
        agenda: req.agenda,
        sourceReferences: [],
        contentPlan,
        assignmentId: req.contentAssignment?.assignmentId ?? null,
      },
      assignment: req.contentAssignment,
      selectedAgenda: req.selectedAgenda,
      contentPlan,
      audienceContentResearchBrief: req.audienceContentResearchBrief,
      productId: "prod",
      channel: "threads",
    });
    expect(gov.request.contentProposition?.contentPromise).toMatch(/기준|확인/);
    expect(gov.request.contentProposition?.specificTakeaways.length).toBeGreaterThan(0);

    const candidate = {
      candidateId: "cmc_mq3",
      businessDateKst: "2026-09-13",
      selectedAgenda: req.selectedAgenda!,
      contentAssignment: req.contentAssignment!,
      contentPlan,
      draft: { title: "t", body: "b", channel: "threads" },
      governanceDecision: null,
    } as unknown as CompletedMarketingCandidate;
    const composer = buildPublishableComposerInput(candidate, {
      acrb: req.audienceContentResearchBrief,
    });
    expect(composer.contentProposition?.readerGain).toBeTruthy();
    expect(composer.keyMessage).toMatch(/기준|확인|포함/);
  });
});
