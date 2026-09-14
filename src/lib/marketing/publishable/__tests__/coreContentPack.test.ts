vi.mock("server-only", () => ({}));

import { describe, expect, it, vi } from "vitest";

import {
  CORE_CONTENT_PACK_CONTRACT,
  buildCoreContentPack,
  evaluateCoreFactSufficiency,
  factHasOperationalDetail,
  formatCoreContentPackPromptBlock,
  resolveCoreGateDecision,
  type CoreFact,
} from "@/lib/marketing/publishable/core/coreContentPack";
import type {
  PublishableComposerFact,
  PublishableComposerInput,
} from "@/lib/marketing/publishable/inputs";

function fact(overrides: Partial<PublishableComposerFact> = {}): PublishableComposerFact {
  return {
    statement: "태국은 한국 여권 소지자에게 90일 무비자 체류를 허용한다",
    confidence: "high",
    evidenceRefIds: ["ev-1"],
    usable: true,
    epistemicType: "verified_fact",
    ...overrides,
  };
}

function composerInput(
  overrides: Partial<PublishableComposerInput> = {},
): PublishableComposerInput {
  return {
    candidateId: "cmc_test",
    businessDateKst: "2026-09-14",
    topic: "태국 입국 준비",
    audience: "첫 동남아 여행자",
    commercialIntent: "awareness",
    hookHint: null,
    keyMessage: "입국 절차만 알면 준비는 단순해진다",
    destinations: ["방콕"],
    entities: [],
    usableFacts: [fact()],
    avoidedStatements: ["직항 특가 확정"],
    unsupportedClaims: ["좌석 마감 임박"],
    governanceDecision: "ALLOW",
    sourceRevision: "rev-1",
    evidenceRefIds: ["ev-1"],
    research: null,
    targetChannels: ["threads", "shortform"],
    contentProposition: null,
    ...overrides,
  };
}

const proposition = {
  contract: "content-proposition-v1",
  primaryAudience: "첫 동남아 여행자",
  audienceProblem: "입국 절차를 몰라 불안하다",
  audienceTension: "정보가 흩어져 있다",
  whyNow: "성수기 진입",
  contentPromise: "입국 절차 3단계",
  readerGain: "공항에서 헤매지 않는다",
  specificTakeaways: ["TDAC 사전 등록", "무비자 체류 기간", "우기 월 구분"],
  proofRequirements: ["항공 직항 여부는 공식 시간표 확인 필요"],
  contentGapUsed: "절차를 순서대로 정리한 글이 없다",
  engagementMechanism: "comment_question",
  desiredAudienceAction: "comment",
  angle: "절차 순서 정리",
  keyMessage: "순서만 알면 된다",
  commercialIntent: "awareness",
  propositionStrength: "strong",
  limitations: [],
} as unknown as NonNullable<PublishableComposerInput["contentProposition"]>;

describe("factHasOperationalDetail", () => {
  it("recognizes dates, durations, visa terms, and prices as anchors", () => {
    expect(factHasOperationalDetail("90일 무비자 체류")).toBe(true);
    expect(factHasOperationalDetail("우기는 5월부터 10월")).toBe(true);
    expect(factHasOperationalDetail("TDAC 사전 등록이 필요하다")).toBe(true);
    expect(factHasOperationalDetail("입국 심사는 약 30분 소요")).toBe(true);
  });

  it("rejects vague statements", () => {
    expect(factHasOperationalDetail("여행 수요가 늘고 있다")).toBe(false);
    expect(factHasOperationalDetail("공식 채널을 확인하는 것이 좋다")).toBe(false);
  });
});

describe("evaluateCoreFactSufficiency", () => {
  const coreFact = (overrides: Partial<CoreFact> = {}): CoreFact => ({
    statement: "여행 수요가 늘고 있다",
    confidence: "medium",
    epistemicType: "observed_signal",
    evidenceRefIds: [],
    operational: false,
    ...overrides,
  });

  it("is insufficient with zero facts", () => {
    const out = evaluateCoreFactSufficiency([]);
    expect(out.verdict).toBe("insufficient");
    expect(out.reasons[0]).toContain("no usable facts");
  });

  it("is thin with a single fact", () => {
    expect(evaluateCoreFactSufficiency([coreFact({ operational: true })]).verdict).toBe("thin");
  });

  it("is thin when facts lack any operational or high-confidence anchor", () => {
    const out = evaluateCoreFactSufficiency([coreFact(), coreFact(), coreFact()]);
    expect(out.verdict).toBe("thin");
    expect(out.reasons.some((r) => r.includes("no operational or high-confidence"))).toBe(true);
  });

  it("is sufficient with two facts and an anchor", () => {
    const out = evaluateCoreFactSufficiency([coreFact({ operational: true }), coreFact()]);
    expect(out.verdict).toBe("sufficient");
    expect(out.operationalFactCount).toBe(1);
  });
});

describe("buildCoreContentPack", () => {
  it("carries proposition CTA intent and orders operational facts first", () => {
    const pack = buildCoreContentPack({
      composerInput: composerInput({
        contentProposition: proposition,
        usableFacts: [
          fact({ statement: "여행 수요가 늘고 있다", confidence: "medium", evidenceRefIds: [] }),
          fact({ statement: "우기는 5월부터 10월까지다" }),
        ],
      }),
      now: new Date("2026-09-14T09:00:00.000Z"),
    });

    expect(pack.contract).toBe(CORE_CONTENT_PACK_CONTRACT);
    expect(pack.coreFacts[0]?.statement).toBe("우기는 5월부터 10월까지다");
    expect(pack.coreFacts[0]?.operational).toBe(true);
    expect(pack.desiredAudienceAction).toBe("comment");
    expect(pack.ctaIntent).toContain("댓글");
    expect(pack.factSufficiency.verdict).toBe("sufficient");
  });

  it("merges unsupported claims and avoided statements into forbiddenStatements", () => {
    const pack = buildCoreContentPack({ composerInput: composerInput() });
    expect(pack.forbiddenStatements).toContain("좌석 마감 임박");
    expect(pack.forbiddenStatements).toContain("직항 특가 확정");
  });

  it("treats proof requirements and research limitations as hedge-only", () => {
    const pack = buildCoreContentPack({
      composerInput: composerInput({ contentProposition: proposition }),
    });
    expect(pack.hedgeOnly).toContain("항공 직항 여부는 공식 시간표 확인 필요");
  });
});

describe("resolveCoreGateDecision", () => {
  const targetChannels = [
    "threads",
    "shortform",
    "naver_blog",
    "naver_band",
    "kakao_channel",
  ] as const;

  it("allows every requested channel when the core is sufficient", () => {
    const pack = buildCoreContentPack({
      composerInput: composerInput({
        contentProposition: proposition,
        usableFacts: [fact(), fact({ statement: "우기는 5월부터 10월까지다" })],
      }),
    });
    const decision = resolveCoreGateDecision({ pack, targetChannels: [...targetChannels] });
    expect(decision.sufficiency).toBe("sufficient");
    expect(decision.allowedChannels).toHaveLength(5);
    expect(decision.blockedChannels).toEqual([]);
  });

  it("limits a thin core to baseline channels instead of cloning it five times", () => {
    const pack = buildCoreContentPack({
      composerInput: composerInput({
        usableFacts: [fact({ statement: "여행 수요가 늘고 있다", confidence: "medium" })],
      }),
    });
    const decision = resolveCoreGateDecision({ pack, targetChannels: [...targetChannels] });
    expect(decision.sufficiency).toBe("thin");
    expect(decision.allowedChannels).toEqual(["threads", "shortform"]);
    expect(decision.blockedChannels).toEqual(["naver_blog", "naver_band", "kakao_channel"]);
    expect(decision.reason).toContain("core_facts_thin");
  });

  it("blocks all channels when there is no usable fact at all", () => {
    const pack = buildCoreContentPack({ composerInput: composerInput({ usableFacts: [] }) });
    const decision = resolveCoreGateDecision({ pack, targetChannels: [...targetChannels] });
    expect(decision.sufficiency).toBe("insufficient");
    expect(decision.allowedChannels).toEqual([]);
    expect(decision.blockedChannels).toHaveLength(5);
    expect(decision.reason).toContain("core_facts_insufficient");
  });
});

describe("formatCoreContentPackPromptBlock", () => {
  it("lists core facts and CTA intent", () => {
    const pack = buildCoreContentPack({
      composerInput: composerInput({
        contentProposition: proposition,
        usableFacts: [fact(), fact({ statement: "우기는 5월부터 10월까지다" })],
      }),
    });
    const block = formatCoreContentPackPromptBlock(pack);
    expect(block).toContain("CORE_CONTENT_PACK");
    expect(block).toContain("CORE_FACTS");
    expect(block).toContain("90일 무비자");
    expect(block).toContain("CTA_INTENT");
    expect(block).toContain("FORBIDDEN");
    expect(block).not.toContain("FACTS ARE THIN");
  });

  it("tells the model not to pad when facts are thin", () => {
    const pack = buildCoreContentPack({
      composerInput: composerInput({
        usableFacts: [fact({ statement: "여행 수요가 늘고 있다", confidence: "medium" })],
      }),
    });
    const block = formatCoreContentPackPromptBlock(pack);
    expect(block).toContain("FACTS ARE THIN");
    expect(block).toContain("공식 채널에서 확인하세요");
  });
});
