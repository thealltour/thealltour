/**
 * CG-4C — Per-channel human review state (additive on HumanMarketingReview payload).
 */

import type { PublishableChannel } from "@/lib/marketing/publishable/contracts";

export const CHANNEL_REVIEW_STATUSES = [
  "draft",
  "needs_review",
  "approved",
  "skipped",
  "blocked",
] as const;
export type ChannelReviewStatus = (typeof CHANNEL_REVIEW_STATUSES)[number];

export const REVIEWABLE_PUBLISHABLE_CHANNELS = [
  "threads",
  "instagram",
  "naver_blog",
  "naver_band",
  "kakao_channel",
  "shortform",
] as const;
export type ReviewablePublishableChannel = (typeof REVIEWABLE_PUBLISHABLE_CHANNELS)[number];

export type ChannelReviewEntry = {
  channel: ReviewablePublishableChannel;
  status: ChannelReviewStatus;
  /** AI/generated snapshot at bootstrap or last regen (immutable for operator). */
  aiDraft: {
    title: string | null;
    body: string;
  };
  /** Operator-edited copy; takes precedence over aiDraft when set. */
  humanDraft: {
    title: string | null;
    body: string;
  } | null;
  validationWarnings: string[];
  lastEditedAt: string | null;
  approvedAt: string | null;
  skippedAt: string | null;
  notes: string | null;
  /** MQ-5 — compact marketing value (optional, additive). */
  marketingValue?: import("@/lib/marketing/value/contracts").MarketingValueCompact | null;
};

export type ChannelReviewsMap = Partial<
  Record<ReviewablePublishableChannel, ChannelReviewEntry>
>;

export function isReviewablePublishableChannel(
  value: unknown,
): value is ReviewablePublishableChannel {
  return (
    typeof value === "string" &&
    (REVIEWABLE_PUBLISHABLE_CHANNELS as readonly string[]).includes(value)
  );
}

export function effectiveChannelDraft(entry: ChannelReviewEntry): {
  title: string | null;
  body: string;
  source: "human" | "ai";
} {
  if (entry.humanDraft?.body?.trim()) {
    return {
      title: entry.humanDraft.title ?? null,
      body: entry.humanDraft.body,
      source: "human",
    };
  }
  return {
    title: entry.aiDraft?.title ?? null,
    body: entry.aiDraft?.body ?? "",
    source: "ai",
  };
}

export function emptyChannelReviewEntry(
  channel: ReviewablePublishableChannel,
  ai: { title: string | null; body: string },
  warnings: string[] = [],
): ChannelReviewEntry {
  return {
    channel,
    status: "needs_review",
    aiDraft: { title: ai.title, body: ai.body },
    humanDraft: null,
    validationWarnings: warnings,
    lastEditedAt: null,
    approvedAt: null,
    skippedAt: null,
    notes: null,
  };
}

export function channelLabel(channel: ReviewablePublishableChannel | PublishableChannel): string {
  switch (channel) {
    case "threads":
      return "Threads";
    case "instagram":
      return "Instagram";
    case "naver_blog":
      return "Naver Blog";
    case "naver_band":
      return "Naver Band";
    case "kakao_channel":
      return "Kakao Channel";
    case "shortform":
      return "Shortform";
    default:
      return channel;
  }
}

export function channelStatusLabel(status: ChannelReviewStatus): string {
  switch (status) {
    case "draft":
      return "draft";
    case "needs_review":
      return "needs_review";
    case "approved":
      return "approved";
    case "skipped":
      return "skipped";
    case "blocked":
      return "blocked";
  }
}

/** Map publishable artifact path for human-edited export. */
export function humanEditedRelativePath(channel: ReviewablePublishableChannel): string {
  switch (channel) {
    case "threads":
      return "human-edited/threads.txt";
    case "instagram":
      return "human-edited/instagram-caption.txt";
    case "naver_blog":
      return "human-edited/naver-blog.md";
    case "naver_band":
      return "human-edited/naver-band.txt";
    case "kakao_channel":
      return "human-edited/kakao-channel.txt";
    case "shortform":
      return "human-edited/shortform-narration.txt";
  }
}
