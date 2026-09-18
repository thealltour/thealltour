/**
 * Per-channel copy limits and clipboard payloads for the distribution workbench.
 *
 * The operator pastes into each platform's own composer, so the counter here has
 * to mirror the same numbers `validatePublishableText` enforces — otherwise a
 * body that reads "fine" in the review UI gets truncated on the platform.
 */

import type { ReviewablePublishableChannel } from "@/lib/marketing/review/channelReviews";
import {
  INSTAGRAM_CAPTION_MAX_CHARS,
  INSTAGRAM_HOOK_VISIBLE_CHARS,
  THREADS_BODY_MAX_CHARS,
} from "@/lib/marketing/publishable/validate";

/** Re-export publishability SSoT so review UI stays aligned with validate.ts. */
export { THREADS_BODY_MAX_CHARS };
export const NAVER_BAND_BODY_MAX_CHARS = 2200;
export const KAKAO_CHANNEL_BODY_MAX_CHARS = 900;
export const NAVER_BLOG_TITLE_MAX_CHARS = 100;

export type ChannelCopyLimits = {
  bodyMax: number | null;
  titleMax: number | null;
  /** Characters visible before the platform truncates with a "more" tap. */
  foldAt: number | null;
};

export const CHANNEL_COPY_LIMITS: Record<ReviewablePublishableChannel, ChannelCopyLimits> = {
  threads: { bodyMax: THREADS_BODY_MAX_CHARS, titleMax: null, foldAt: null },
  instagram: {
    bodyMax: INSTAGRAM_CAPTION_MAX_CHARS,
    titleMax: null,
    foldAt: INSTAGRAM_HOOK_VISIBLE_CHARS,
  },
  naver_blog: { bodyMax: null, titleMax: NAVER_BLOG_TITLE_MAX_CHARS, foldAt: null },
  naver_band: { bodyMax: NAVER_BAND_BODY_MAX_CHARS, titleMax: null, foldAt: null },
  kakao_channel: { bodyMax: KAKAO_CHANNEL_BODY_MAX_CHARS, titleMax: null, foldAt: null },
  shortform: { bodyMax: null, titleMax: null, foldAt: null },
};

export type CharCountStatus = "ok" | "near_limit" | "over_limit";

export type CharCount = {
  length: number;
  max: number | null;
  remaining: number | null;
  status: CharCountStatus;
  label: string;
};

/** Warn at 90% so the operator can trim before the platform refuses the paste. */
const NEAR_LIMIT_RATIO = 0.9;

export function describeCharCount(text: string, max: number | null): CharCount {
  const length = text.length;
  if (max == null) {
    return { length, max: null, remaining: null, status: "ok", label: `${length}자` };
  }
  const remaining = max - length;
  const status: CharCountStatus =
    remaining < 0 ? "over_limit" : length >= max * NEAR_LIMIT_RATIO ? "near_limit" : "ok";
  return {
    length,
    max,
    remaining,
    status,
    label:
      status === "over_limit"
        ? `${length}/${max}자 (${Math.abs(remaining)}자 초과)`
        : `${length}/${max}자`,
  };
}

export function channelBodyCharCount(
  channel: ReviewablePublishableChannel,
  body: string,
): CharCount {
  return describeCharCount(body, CHANNEL_COPY_LIMITS[channel]?.bodyMax ?? null);
}

export function channelTitleCharCount(
  channel: ReviewablePublishableChannel,
  title: string,
): CharCount {
  return describeCharCount(title, CHANNEL_COPY_LIMITS[channel]?.titleMax ?? null);
}

export function extractHashtagsFromText(text: string): string[] {
  const seen = new Set<string>();
  const output: string[] = [];
  for (const raw of text.match(/#[^\s#]+/g) ?? []) {
    const tag = raw.trim();
    const key = tag.toLowerCase();
    if (!tag || seen.has(key)) continue;
    seen.add(key);
    output.push(tag);
  }
  return output;
}

/** Body with trailing hashtag-only lines removed, for platforms that take tags separately. */
export function bodyWithoutTrailingHashtags(body: string): string {
  const lines = body.split(/\r?\n/);
  while (lines.length > 0) {
    const last = lines[lines.length - 1]!.trim();
    if (last === "" || /^#[^\s#]/.test(last)) {
      lines.pop();
      continue;
    }
    break;
  }
  return lines.join("\n").trim();
}

export type ChannelCopyPayload = {
  body: string;
  title: string | null;
  hashtags: string[];
  hashtagLine: string | null;
  bodyWithoutHashtags: string;
};

export function buildChannelCopyPayload(input: {
  title?: string | null;
  body: string;
}): ChannelCopyPayload {
  const body = input.body ?? "";
  const hashtags = extractHashtagsFromText(body);
  return {
    body,
    title: input.title?.trim() ? input.title : null,
    hashtags,
    hashtagLine: hashtags.length > 0 ? hashtags.join(" ") : null,
    bodyWithoutHashtags: bodyWithoutTrailingHashtags(body),
  };
}

/** The slice the reader sees before tapping "more". Null when the channel has no fold. */
export function channelFoldPreview(
  channel: ReviewablePublishableChannel,
  body: string,
): { text: string; truncated: boolean } | null {
  const foldAt = CHANNEL_COPY_LIMITS[channel]?.foldAt;
  if (!foldAt) return null;
  const trimmed = body.trim();
  return { text: trimmed.slice(0, foldAt), truncated: trimmed.length > foldAt };
}
