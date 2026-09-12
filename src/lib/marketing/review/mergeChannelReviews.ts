/**
 * Seed / merge channelReviews from a PublishableContentBundle.
 */

import type { PublishableContentBundle } from "@/lib/marketing/publishable/contracts";
import {
  emptyChannelReviewEntry,
  type ChannelReviewEntry,
  type ChannelReviewsMap,
  type ReviewablePublishableChannel,
} from "@/lib/marketing/review/channelReviews";

function warningsFrom(content: { validation?: { ok: boolean; issues: Array<{ message: string }> } } | undefined): string[] {
  if (!content?.validation || content.validation.ok) return [];
  return content.validation.issues.map((i) => i.message).slice(0, 8);
}

function seedFromBundleSlot(
  channel: ReviewablePublishableChannel,
  content: { title: string | null; body: string; validation?: { ok: boolean; issues: Array<{ message: string }> } } | undefined,
  existing: ChannelReviewEntry | undefined,
): ChannelReviewEntry | undefined {
  if (!content?.body?.trim()) return existing;
  if (existing) {
    // Preserve human draft / status; refresh AI snapshot only when no human edit.
    return {
      ...existing,
      aiDraft: existing.humanDraft ? existing.aiDraft : { title: content.title, body: content.body },
      validationWarnings: warningsFrom(content),
    };
  }
  return emptyChannelReviewEntry(channel, { title: content.title, body: content.body }, warningsFrom(content));
}

export function mergeChannelReviewsFromPublishable(input: {
  existing?: ChannelReviewsMap | null;
  bundle: PublishableContentBundle;
}): ChannelReviewsMap {
  const prev = input.existing ?? {};
  const next: ChannelReviewsMap = { ...prev };
  const b = input.bundle;

  const threads = seedFromBundleSlot("threads", b.threads, prev.threads);
  if (threads) next.threads = threads;

  if (b.naver_blog) {
    const entry = seedFromBundleSlot("naver_blog", b.naver_blog, prev.naver_blog);
    if (entry) next.naver_blog = entry;
  }
  if (b.naver_band) {
    const entry = seedFromBundleSlot("naver_band", b.naver_band, prev.naver_band);
    if (entry) next.naver_band = entry;
  }
  if (b.kakao_channel) {
    const entry = seedFromBundleSlot("kakao_channel", b.kakao_channel, prev.kakao_channel);
    if (entry) next.kakao_channel = entry;
  }
  if (b.shortform?.body) {
    const entry = seedFromBundleSlot("shortform", b.shortform, prev.shortform);
    if (entry) next.shortform = entry;
  }

  return next;
}

export function visibleChannelsFromReviews(map: ChannelReviewsMap | null | undefined): ReviewablePublishableChannel[] {
  const order: ReviewablePublishableChannel[] = [
    "threads",
    "naver_blog",
    "naver_band",
    "kakao_channel",
    "shortform",
  ];
  return order.filter((ch) => Boolean(map?.[ch]?.aiDraft.body || map?.[ch]?.humanDraft?.body));
}
