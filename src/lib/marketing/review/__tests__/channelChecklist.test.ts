import { describe, expect, it } from "vitest";

import { buildChannelDistributionChecklist } from "@/lib/marketing/review/channelChecklist";
import type {
  MorningChannelReviewView,
  MorningMarketingReviewContext,
} from "@/lib/marketing/review/morningReview/types";

function channel(
  overrides: Partial<MorningChannelReviewView> & Pick<MorningChannelReviewView, "channel">,
): MorningChannelReviewView {
  return {
    label: overrides.channel,
    status: "needs_review",
    statusLabel: "needs_review",
    title: null,
    body: "부산항 탑승 동선은 터미널 2층에서 시작합니다. 수하물 규정도 공항과 다릅니다.",
    aiTitle: null,
    aiBody: "ai",
    source: "ai",
    validationWarnings: [],
    marketingValue: { verdict: "publishable", overallScore: 74, reasons: [], improvementHints: [] },
    ...overrides,
  } as MorningChannelReviewView;
}

function context(input: {
  channels: MorningChannelReviewView[];
  governanceDecision?: string | null;
  blockKind?: MorningMarketingReviewContext["governance"]["blockKind"];
}): MorningMarketingReviewContext {
  return {
    identity: { candidateId: "cmc_test" },
    channelReviews: input.channels,
    governance: {
      decision: input.governanceDecision ?? "ALLOW",
      blockKind: input.blockKind ?? null,
    },
  } as unknown as MorningMarketingReviewContext;
}

describe("channel distribution checklist", () => {
  it("marks a healthy channel as copy-ready and approvable", () => {
    const checklist = buildChannelDistributionChecklist(
      context({ channels: [channel({ channel: "threads" })] }),
    );
    const row = checklist.rows[0]!;
    expect(row.copyReady).toBe(true);
    expect(row.copyIssue).toBeNull();
    expect(row.approvable).toBe(true);
    expect(row.approvalBlockedReason).toBeNull();
    expect(checklist.bulkApprovableChannels).toEqual(["threads"]);
  });

  it("blocks every channel under a governance BLOCK", () => {
    const checklist = buildChannelDistributionChecklist(
      context({
        channels: [channel({ channel: "threads" }), channel({ channel: "instagram" })],
        governanceDecision: "BLOCK",
        blockKind: "governance_block",
      }),
    );
    expect(checklist.bulkApprovableChannels).toEqual([]);
    expect(checklist.rows.every((row) => row.approvalBlockedReason === "Governance BLOCK")).toBe(
      true,
    );
  });

  it("does not call a quality-gate stop a governance BLOCK", () => {
    const checklist = buildChannelDistributionChecklist(
      context({
        channels: [channel({ channel: "threads" })],
        governanceDecision: null,
        blockKind: "pipeline_blocked_without_governance",
      }),
    );
    expect(checklist.rows[0]!.approvable).toBe(false);
    expect(checklist.rows[0]!.approvalBlockedReason).toBe(
      "품질 게이트 중단 (GA 판정 없음) — 재생성 필요",
    );
  });

  it("reports the specific blocker for weak value, fallback, and missing copy", () => {
    const checklist = buildChannelDistributionChecklist(
      context({
        channels: [
          channel({
            channel: "threads",
            marketingValue: {
              verdict: "needs_improvement",
              overallScore: 58,
              reasons: [],
              improvementHints: [],
            },
          }),
          channel({
            channel: "naver_band",
            validationWarnings: ["degraded:fallback"],
            marketingValue: null,
          }),
          channel({ channel: "kakao_channel", body: "", awaitingGeneration: true }),
        ],
      }),
    );
    expect(checklist.rows[0]!.approvalBlockedReason).toContain("needs_improvement");
    expect(checklist.rows[1]!.approvalBlockedReason).toContain("재생성");
    expect(checklist.rows[2]!.approvalBlockedReason).toBe("채널 생성 필요");
    expect(checklist.rows[2]!.copyIssue).toBe("미생성");
    expect(checklist.blockedCount).toBe(3);
  });

  it("flags an over-limit body without blocking approval on length alone", () => {
    const checklist = buildChannelDistributionChecklist(
      context({ channels: [channel({ channel: "threads", body: "가".repeat(700) })] }),
    );
    const row = checklist.rows[0]!;
    expect(row.charCount.status).toBe("over_limit");
    expect(row.copyReady).toBe(false);
    expect(row.copyIssue).toContain("글자수 초과");
  });

  it("names the asset each channel still needs", () => {
    const checklist = buildChannelDistributionChecklist(
      context({
        channels: [
          channel({ channel: "threads" }),
          channel({ channel: "instagram" }),
          channel({ channel: "shortform" }),
        ],
      }),
    );
    expect(checklist.rows.map((row) => row.assetRequirement)).toEqual([
      "none",
      "cardnews",
      "shortform_video",
    ]);
  });

  it("excludes already approved channels from bulk approve and reports completion", () => {
    const checklist = buildChannelDistributionChecklist(
      context({
        channels: [
          channel({ channel: "threads", status: "approved", statusLabel: "approved" }),
          channel({ channel: "instagram", status: "skipped", statusLabel: "skipped" }),
        ],
      }),
    );
    expect(checklist.bulkApprovableChannels).toEqual([]);
    expect(checklist.approvedCount).toBe(1);
    expect(checklist.skippedCount).toBe(1);
    expect(checklist.complete).toBe(true);
  });

  it("counts hashtags per channel", () => {
    const checklist = buildChannelDistributionChecklist(
      context({
        channels: [
          channel({ channel: "instagram", body: "캡션 본문입니다.\n\n#부산크루즈 #부산항 #부산항" }),
        ],
      }),
    );
    expect(checklist.rows[0]!.hashtagCount).toBe(2);
  });
});
