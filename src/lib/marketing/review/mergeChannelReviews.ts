/**
 * Seed / merge channelReviews from a PublishableContentBundle.
 */

import type { PublishableContentBundle, PublishableChannelContent } from "@/lib/marketing/publishable/contracts";
import { channelCountsAsPublishableSuccess } from "@/lib/marketing/publishable/publishableSuccess";
import {
  emptyChannelReviewEntry,
  type ChannelReviewEntry,
  type ChannelReviewsMap,
  type ReviewablePublishableChannel,
} from "@/lib/marketing/review/channelReviews";
import { toMarketingValueCompact } from "@/lib/marketing/value/contracts";

function warningsFrom(content: {
  validation?: { ok: boolean; issues: Array<{ message: string }> };
  status?: string;
  provenance?: { composer?: string };
  publishableSuccess?: boolean;
  needsRegeneration?: boolean;
  marketingValue?: { verdict?: string; stale?: boolean } | null;
} | undefined): string[] {
  if (!content) return [];
  const out: string[] = [];
  if (content.validation && !content.validation.ok) {
    out.push(...content.validation.issues.map((i) => i.message).slice(0, 8));
  }
  if (!channelCountsAsPublishableSuccess(content as never) && content.status !== "human_edited") {
    if (content.status === "fallback_generated" || content.provenance?.composer === "deterministic_fallback") {
      out.push("degraded:fallback_generated — regeneration required before approval");
    } else if (content.status === "generation_failed") {
      out.push("degraded:generation_failed — regeneration required before approval");
    } else if (content.status === "validation_failed") {
      out.push("degraded:validation_failed — regeneration required before approval");
    } else if (content.needsRegeneration) {
      out.push("degraded:needs_regeneration");
    }
  }
  if (content.marketingValue?.verdict === "reject") {
    out.push("marketing_value:reject — not approvable until edit/regenerate");
  } else if (content.marketingValue?.verdict === "needs_improvement") {
    out.push("marketing_value:needs_improvement — edit or explicit override required");
  } else if (content.marketingValue?.stale) {
    out.push("marketing_value:stale — re-evaluate after human edit");
  }
  return out.slice(0, 10);
}

function valueFromContent(
  content: PublishableChannelContent | undefined,
): ChannelReviewEntry["marketingValue"] {
  if (!content?.marketingValue) return null;
  return toMarketingValueCompact(content.marketingValue);
}

function seedFromBundleSlot(
  channel: ReviewablePublishableChannel,
  content: PublishableChannelContent | undefined,
  existing: ChannelReviewEntry | undefined,
): ChannelReviewEntry | undefined {
  if (!content?.body?.trim()) return existing;
  const marketingValue = valueFromContent(content);
  if (existing) {
    return {
      ...existing,
      aiDraft: existing.humanDraft ? existing.aiDraft : { title: content.title, body: content.body },
      validationWarnings: warningsFrom(content),
      marketingValue: existing.humanDraft ? existing.marketingValue ?? marketingValue : marketingValue,
    };
  }
  const entry = emptyChannelReviewEntry(
    channel,
    { title: content.title, body: content.body },
    warningsFrom(content),
  );
  entry.marketingValue = marketingValue;
  return entry;
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
  return order.filter((ch) => Boolean(map?.[ch]?.aiDraft?.body || map?.[ch]?.humanDraft?.body));
}
