/**
 * Distribution checklist — every channel of one candidate on a single screen.
 *
 * With 6 channels a day, tab-by-tab review is the actual bottleneck. This model
 * answers "what still blocks each channel" without the operator clicking through
 * every tab, and mirrors the server-side approval gates so the bulk-approve
 * button never fires requests it knows will be rejected.
 */

import type { ReviewablePublishableChannel } from "@/lib/marketing/review/channelReviews";
import {
  channelBodyCharCount,
  extractHashtagsFromText,
  type CharCount,
} from "@/lib/marketing/review/channelCopyLimits";
import type {
  MorningChannelReviewView,
  MorningMarketingReviewContext,
} from "@/lib/marketing/review/morningReview/types";

/** What the operator must render/attach elsewhere before publishing this channel. */
export type ChannelAssetRequirement = "none" | "cardnews" | "shortform_video";

export type ChannelChecklistRow = {
  channel: ReviewablePublishableChannel;
  label: string;
  status: MorningChannelReviewView["status"];
  statusLabel: string;
  source: "human" | "ai";
  copyReady: boolean;
  copyIssue: string | null;
  charCount: CharCount;
  hashtagCount: number;
  warningCount: number;
  valueVerdict: string | null;
  valueScore: number | null;
  assetRequirement: ChannelAssetRequirement;
  approvable: boolean;
  approvalBlockedReason: string | null;
  approved: boolean;
  skipped: boolean;
};

export type ChannelDistributionChecklist = {
  rows: ChannelChecklistRow[];
  /**
   * Channels a bulk approve should actually send: still undecided and passing
   * every gate. A skipped channel is a deliberate decision, so re-approving it
   * stays a single-channel action in the tab.
   */
  bulkApprovableChannels: ReviewablePublishableChannel[];
  totalCount: number;
  approvedCount: number;
  skippedCount: number;
  blockedCount: number;
  /** True when nothing is left to decide. */
  complete: boolean;
};

function assetRequirementFor(channel: ReviewablePublishableChannel): ChannelAssetRequirement {
  if (channel === "instagram") return "cardnews";
  if (channel === "shortform") return "shortform_video";
  return "none";
}

function copyIssueFor(channel: MorningChannelReviewView, charCount: CharCount): string | null {
  if (channel.awaitingGeneration) return "본문 생성 대기";
  if (!channel.body.trim()) return "본문 없음";
  if (charCount.status === "over_limit") return `글자수 초과 (${charCount.label})`;
  if (channel.validationWarnings.length > 0) return `검증 경고 ${channel.validationWarnings.length}건`;
  return null;
}

/**
 * Mirrors `setChannelReviewStatus`'s approval gate. Kept intentionally
 * conservative: the server stays authoritative, this only avoids doomed calls.
 */
function approvalBlockedReasonFor(input: {
  channel: MorningChannelReviewView;
  candidateBlockedReason: string | null;
  copyIssue: string | null;
}): string | null {
  if (input.candidateBlockedReason) return input.candidateBlockedReason;
  if (input.channel.awaitingGeneration) return "본문 생성 필요";
  if (!input.channel.body.trim()) return "본문 없음";
  const value = input.channel.marketingValue;
  if (value) {
    if (value.hardFail) return "Marketing Value hardFail";
    if (value.stale) return "Marketing Value stale — 재평가 필요";
    if (value.verdict === "reject") return "Marketing Value reject";
    if (value.verdict === "needs_improvement") return "Marketing Value needs_improvement";
  }
  if (
    input.channel.validationWarnings.some((warning) =>
      /degraded:fallback|generation_failed|validation_failed|needs_regeneration/i.test(warning),
    )
  ) {
    return "fallback/검증 실패 — 재생성 필요";
  }
  return null;
}

export function buildChannelDistributionChecklist(
  context: MorningMarketingReviewContext,
): ChannelDistributionChecklist {
  /**
   * The server refuses channel approval for a blocked candidate whether or not a
   * governance decision exists, so both cases block here — but they are different
   * situations for the operator, and calling a quality-gate stop "Governance
   * BLOCK" sends them looking for a GA verdict that was never recorded.
   */
  const candidateBlockedReason =
    context.governance.decision === "BLOCK" || context.governance.blockKind === "governance_block"
      ? "Governance BLOCK"
      : context.governance.blockKind === "pipeline_blocked_without_governance"
        ? "품질 게이트 중단 (GA 판정 없음) — 재생성 필요"
        : null;

  const rows: ChannelChecklistRow[] = (context.channelReviews ?? []).map((channel) => {
    const charCount = channelBodyCharCount(channel.channel, channel.body);
    const copyIssue = copyIssueFor(channel, charCount);
    const approvalBlockedReason = approvalBlockedReasonFor({
      channel,
      candidateBlockedReason,
      copyIssue,
    });
    return {
      channel: channel.channel,
      label: channel.label,
      status: channel.status,
      statusLabel: channel.statusLabel,
      source: channel.source,
      copyReady: copyIssue === null,
      copyIssue,
      charCount,
      hashtagCount: extractHashtagsFromText(channel.body).length,
      warningCount: channel.validationWarnings.length,
      valueVerdict: channel.marketingValue?.verdict ?? null,
      valueScore: channel.marketingValue?.overallScore ?? null,
      assetRequirement: assetRequirementFor(channel.channel),
      approvable:
        approvalBlockedReason === null &&
        channel.status !== "approved" &&
        channel.status !== "skipped",
      approvalBlockedReason,
      approved: channel.status === "approved",
      skipped: channel.status === "skipped",
    };
  });

  const approvedCount = rows.filter((row) => row.approved).length;
  const skippedCount = rows.filter((row) => row.skipped).length;
  return {
    rows,
    bulkApprovableChannels: rows.filter((row) => row.approvable).map((row) => row.channel),
    totalCount: rows.length,
    approvedCount,
    skippedCount,
    blockedCount: rows.filter((row) => !row.approved && !row.skipped && row.approvalBlockedReason)
      .length,
    complete: rows.length > 0 && approvedCount + skippedCount === rows.length,
  };
}
