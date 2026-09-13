/**
 * MQ-5 — Marketing Value Gate focused tests.
 */
import { describe, expect, it } from "vitest";

import { CONTENT_PROPOSITION_CONTRACT } from "@/lib/marketing/content/proposition/contracts";
import type { ContentProposition } from "@/lib/marketing/content/proposition/contracts";
import {
  MARKETING_VALUE_ASSESSMENT_CONTRACT,
  isMarketingValueApprovable,
  parseMarketingValueAssessment,
  evaluateMarketingValue,
} from "@/lib/marketing/value";
import type { PublishableChannelContent } from "@/lib/marketing/publishable/contracts";

function prop(overrides: Partial<ContentProposition> = {}): ContentProposition {
  return {
    contract: CONTENT_PROPOSITION_CONTRACT,
    primaryAudience: "부산·경남에서 추석 가족여행을 알아보는 사람",
    audienceProblem: "상품 가격부터 보지만 가족 일정·출발·포함사항이 맞지 않을 수 있음",
    audienceTension: "빨리 고르고 싶음 vs 확인 없이 불안",
    whyNow: "추석 가족 패키지 프로모션 관측",
    contentPromise: "가격보다 먼저 확인할 일정·출발·포함사항 기준을 정리한다",
    readerGain: "비교 전에 일정/직항/포함사항부터 확인하는 기준을 얻는다",
    specificTakeaways: [
      "가족 전원이 가능한 날짜부터 맞춘다",
      "부산 출발·직항 여부를 확인한다",
      "패키지 포함/불포함 항목을 비교한다",
    ],
    proofRequirements: [
      { claimArea: "직항", requiredProof: "official confirmation", severity: "must" },
    ],
    contentGapUsed: "가격 훅은 많지만 확인 순서는 없음",
    engagementMechanism: "save_worthy_checklist",
    desiredAudienceAction: "save",
    angle: "가격보다 가족 일정 조율이 먼저다",
    keyMessage: "일정·출발·포함사항부터",
    commercialIntent: "informational",
    propositionStrength: "usable",
    limitations: [],
    ...overrides,
  };
}

function llmContent(body: string, channel: PublishableChannelContent["channel"] = "threads"): PublishableChannelContent {
  return {
    contract: "publishable-channel-content-v1",
    channel,
    format: channel === "shortform" ? "short_video_narration" : "threads_text",
    title: null,
    body,
    status: "generated",
    generatedAt: "2026-09-13T00:00:00.000Z",
    sourceCandidateId: "cmc",
    sourceRevision: "rev",
    provenance: {
      composer: "llm",
      evidenceRefIds: [],
      commercialIntent: "informational",
      generationMode: "llm",
    },
    validation: { ok: true, issues: [] },
    publishableSuccess: true,
    needsRegeneration: false,
  };
}

const GOOD_THREADS = `추석 가족여행, 899,000원보다 먼저 확인할 게 있습니다.

가격부터 보면 가족 일정이 안 맞아 비교 자체가 무의미해질 수 있어요.

저장용 체크 3가지:
1) 가족 전원이 가능한 날짜부터 맞춘다
2) 부산 출발·직항 여부는 예약 전 공식 확인한다
3) 패키지 포함/불포함 항목을 비교한다

직항·요금은 단정하지 말고 여행사/공식 소스로 확인하세요.`;

const BAD_GENERIC = `가족여행을 준비할 때는 일정 조율이 중요합니다.
다양한 정보를 비교하고 미리 확인해보세요.`;

describe("MQ-5 marketing-value-assessment-v1", () => {
  it("parses contract and keeps score/verdict consistent", () => {
    const assessment = evaluateMarketingValue({
      channel: "threads",
      body: GOOD_THREADS,
      content: llmContent(GOOD_THREADS),
      proposition: prop(),
    });
    const parsed = parseMarketingValueAssessment(assessment);
    expect(parsed?.contract).toBe(MARKETING_VALUE_ASSESSMENT_CONTRACT);
    expect(parsed?.overallScore).toBeGreaterThanOrEqual(70);
    expect(["strong", "publishable"]).toContain(parsed?.verdict);
  });
});

describe("MQ-5 hard fails", () => {
  it("rejects insufficient proposition", () => {
    const a = evaluateMarketingValue({
      channel: "threads",
      body: GOOD_THREADS,
      content: llmContent(GOOD_THREADS),
      proposition: prop({ propositionStrength: "insufficient" }),
    });
    expect(a.verdict).toBe("reject");
    expect(a.hardFail).toBe(true);
    expect(isMarketingValueApprovable(a)).toBe(false);
  });

  it("rejects fallback-generated", () => {
    const content = llmContent(GOOD_THREADS);
    content.status = "fallback_generated";
    content.provenance.composer = "deterministic_fallback";
    content.publishableSuccess = false;
    const a = evaluateMarketingValue({
      channel: "threads",
      body: GOOD_THREADS,
      content,
      proposition: prop(),
    });
    expect(a.verdict).toBe("reject");
    expect(a.hardFailReasons).toContain("deterministic_fallback_or_non_publishable");
  });

  it("rejects generation_failed / validation_failed", () => {
    for (const status of ["generation_failed", "validation_failed"] as const) {
      const content = llmContent(GOOD_THREADS);
      content.status = status;
      content.publishableSuccess = false;
      const a = evaluateMarketingValue({
        channel: "threads",
        body: GOOD_THREADS,
        content,
        proposition: prop(),
      });
      expect(a.verdict).toBe("reject");
    }
  });

  it("rejects missing takeaway / promise not delivered", () => {
    const body = "가족 여행은 일정 조율이 중요합니다.";
    const a = evaluateMarketingValue({
      channel: "threads",
      body,
      content: llmContent(body),
      proposition: prop(),
    });
    expect(["reject", "needs_improvement"]).toContain(a.verdict);
    expect(a.overallScore).toBeLessThan(70);
  });

  it("rejects shortform hook/payoff mismatch", () => {
    const body = "이 한 가지만 기억하세요";
    const content = llmContent(body, "shortform");
    content.narrationSegments = [
      {
        segmentId: "narr-01",
        narrationText: "이 한 가지만 기억하세요",
        subtitleText: "이 한 가지만 기억하세요",
        purpose: "hook",
        visualIntent: "x",
        evidenceRefs: [],
      },
      {
        segmentId: "narr-02",
        narrationText: "끝",
        subtitleText: "끝",
        purpose: "close",
        visualIntent: "x",
        evidenceRefs: [],
      },
    ];
    const a = evaluateMarketingValue({
      channel: "shortform",
      body,
      content,
      proposition: prop(),
    });
    expect(a.verdict).toBe("reject");
    expect(a.hardFailReasons?.some((r) => /hook_payoff|no_useful/.test(r))).toBe(true);
  });
});

describe("MQ-5 generic vs good fixtures", () => {
  it("bad fixture scores needs_improvement or reject", () => {
    const a = evaluateMarketingValue({
      channel: "threads",
      body: BAD_GENERIC,
      content: llmContent(BAD_GENERIC),
      proposition: prop(),
    });
    expect(["needs_improvement", "reject"]).toContain(a.verdict);
    expect(a.overallScore).toBeLessThan(70);
    expect(a.improvementHints.length).toBeGreaterThan(0);
  });

  it("good fixture is publishable or strong", () => {
    const a = evaluateMarketingValue({
      channel: "threads",
      body: GOOD_THREADS,
      content: llmContent(GOOD_THREADS),
      proposition: prop(),
    });
    expect(["publishable", "strong"]).toContain(a.verdict);
    expect(a.overallScore).toBeGreaterThanOrEqual(70);
    expect(isMarketingValueApprovable(a)).toBe(true);
  });
});

describe("MQ-5 channel-aware + proposition delivery", () => {
  it("blog/kakao/band/shortform evaluate without throwing", () => {
    const blogBody = `# 추석 가족 패키지, 가격 전에 확인할 3가지

## 왜 필요한가
가격만 보면 일정이 어긋날 수 있습니다.

## 확인 기준
1. 가족 날짜
2. 부산 출발/직항(공식 확인)
3. 포함/불포함

직항은 예약 전 확인하세요.`;
    const kakaoBody = `추석 가족여행, 가격 전에 일정·직항·포함사항부터 확인하세요. 저장해 두고 여행사에 물어보세요.`;
    const bandBody = `추석 나트랑 가족 패키지 보시는 분들, 가격보다 일정부터요.
1) 가족 날짜 2) 직항 여부(공식 확인) 3) 포함사항
아이/부모님 동반이면 어떤 항목이 제일 걱정되세요?`;
    const shortBody = `추석 가족여행, 가격보다 먼저 확인할 3가지.\n\n일정, 직항 여부, 포함사항.\n\n직항은 예약 전 확인하세요.`;
    const short = llmContent(shortBody, "shortform");
    short.narrationSegments = [
      {
        segmentId: "n1",
        narrationText: "추석 가족여행, 가격보다 먼저 확인할 3가지.",
        subtitleText: "",
        purpose: "hook",
        visualIntent: "a",
        evidenceRefs: [],
      },
      {
        segmentId: "n2",
        narrationText: "가족 일정, 직항 여부, 포함사항을 맞춰보세요.",
        subtitleText: "",
        purpose: "body",
        visualIntent: "b",
        evidenceRefs: [],
      },
      {
        segmentId: "n3",
        narrationText: "직항은 예약 전 공식 확인이 필요합니다.",
        subtitleText: "",
        purpose: "close",
        visualIntent: "c",
        evidenceRefs: [],
      },
    ];

    for (const [channel, body, content] of [
      ["naver_blog", blogBody, llmContent(blogBody, "naver_blog")],
      ["kakao_channel", kakaoBody, llmContent(kakaoBody, "kakao_channel")],
      ["naver_band", bandBody, llmContent(bandBody, "naver_band")],
      ["shortform", shortBody, short],
    ] as const) {
      const a = evaluateMarketingValue({
        channel,
        body,
        content,
        proposition: prop(),
      });
      expect(a.contract).toBe(MARKETING_VALUE_ASSESSMENT_CONTRACT);
      expect(a.overallScore).toBeGreaterThan(40);
      expect(a.verdict).not.toBeUndefined();
    }
  });

  it("engagement mechanism checklist is required for high engagement score", () => {
    const weak = evaluateMarketingValue({
      channel: "threads",
      body: "여러분은 어떠신가요? 가족여행 준비 화이팅!",
      content: llmContent("여러분은 어떠신가요? 가족여행 준비 화이팅!"),
      proposition: prop(),
    });
    expect(weak.engagementPotentialScore).toBeLessThan(60);
  });
});

describe("MQ-5 approval policy", () => {
  it("needs_improvement blocked unless override; reject blocked; fallback still blocked", () => {
    const needs = evaluateMarketingValue({
      channel: "threads",
      body: BAD_GENERIC,
      content: llmContent(BAD_GENERIC),
      proposition: prop(),
    });
    // Force needs_improvement path if hard-reject
    if (needs.verdict === "reject") {
      expect(isMarketingValueApprovable(needs)).toBe(false);
    } else {
      expect(isMarketingValueApprovable(needs)).toBe(false);
      expect(
        isMarketingValueApprovable(needs, { allowNeedsImprovementOverride: true }),
      ).toBe(true);
    }
    const good = evaluateMarketingValue({
      channel: "threads",
      body: GOOD_THREADS,
      content: llmContent(GOOD_THREADS),
      proposition: prop(),
    });
    expect(isMarketingValueApprovable(good)).toBe(true);
    expect(isMarketingValueApprovable({ ...good, stale: true })).toBe(false);
  });
});
