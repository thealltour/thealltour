/**
 * Instagram carousel → cardnews card mapping.
 *
 * Pure: no sharp, no filesystem. The Instagram composer already decided what
 * belongs on each slide, so the cards are derived from `instagramMeta` rather
 * than re-cut from the caption.
 */

import type { CardNewsCard, MediaBrief } from "@/lib/marketing/assets/contracts";
import {
  CARDNEWS_DEFAULT_ASPECT_RATIO,
  type CardNewsAspectRatio,
} from "@/lib/marketing/assets/cardnews/brand";
import { parseMediaBrief } from "@/lib/marketing/assets/parse";
import type {
  PublishableChannelContent,
  PublishableContentBundle,
} from "@/lib/marketing/publishable/contracts";
import { channelCountsAsPublishableSuccess } from "@/lib/marketing/publishable/publishableSuccess";

/** 4:5 is the feed default; 1:1 covers the profile grid. 9:16 belongs to shortform. */
export const INSTAGRAM_CARDNEWS_ASPECT_RATIOS: CardNewsAspectRatio[] = [
  CARDNEWS_DEFAULT_ASPECT_RATIO,
  "1:1",
];

export const INSTAGRAM_CARDNEWS_MIN_SLIDES = 4;

export type InstagramCardnewsSkipReason =
  | "instagram_not_selected"
  | "instagram_not_publishable"
  | "slide_headlines_missing";

export function resolveInstagramCardnewsSkip(
  bundle: PublishableContentBundle,
): InstagramCardnewsSkipReason | null {
  const instagram = bundle.instagram;
  if (!instagram || !(bundle.targetChannels ?? []).includes("instagram")) {
    return "instagram_not_selected";
  }
  if (!channelCountsAsPublishableSuccess(instagram)) return "instagram_not_publishable";
  if ((instagram.instagramMeta?.slideHeadlines.length ?? 0) < INSTAGRAM_CARDNEWS_MIN_SLIDES) {
    return "slide_headlines_missing";
  }
  return null;
}

/** Caption lines carrying substance — hook, hashtag rows, and CTA are placed separately. */
function captionDetailLines(instagram: PublishableChannelContent): string[] {
  const hook = instagram.instagramMeta?.hook?.trim() ?? "";
  const cta = instagram.instagramMeta?.cta?.trim() ?? "";
  return instagram.body
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean)
    .filter((line) => line !== hook && line !== cta)
    .filter((line) => !line.startsWith("#"))
    .map((line) => line.replace(/^\s*(?:\d+[.)]|[-•·])\s*/, "").trim())
    .filter(Boolean);
}

export function buildInstagramCardnewsCards(
  instagram: PublishableChannelContent,
  evidenceRefIds: string[] = [],
): CardNewsCard[] {
  const meta = instagram.instagramMeta;
  if (!meta) return [];
  const headlines = meta.slideHeadlines.map((line) => line.trim()).filter(Boolean);
  const cover = headlines[0];
  if (!cover) return [];

  const details = captionDetailLines(instagram);
  const hook = meta.hook?.trim() ?? "";
  const evidence = evidenceRefIds.slice(0, 8);
  const cards: CardNewsCard[] = [
    {
      cardId: "card-cover",
      role: "cover",
      headline: cover,
      body: hook || details[0] || "",
      visualIntent: meta.altText?.trim() || "",
      evidenceRefs: [],
    },
  ];

  // Detail lines feed the information cards in order, minus any line the cover took.
  const detailStart = hook ? 0 : 1;
  for (const [offset, headline] of headlines.slice(1).entries()) {
    cards.push({
      cardId: `card-info-${String(offset + 1).padStart(2, "0")}`,
      role: "information",
      headline,
      body: details[detailStart + offset] ?? "",
      visualIntent: "",
      evidenceRefs: evidence,
    });
  }

  const cta = meta.cta?.trim();
  if (cta) {
    cards.push({
      cardId: "card-cta",
      role: "cta",
      headline: cta,
      body: "",
      visualIntent: "",
      evidenceRefs: [],
    });
  }

  return cards.slice(0, 12);
}

/**
 * Enables the cardnews format when Instagram is a selected, publishable channel.
 * Without this the brief's `cardnews.enabled` depends on an `instagram_carousel`
 * format hint that the operator's channel selection never touches.
 */
export function applyInstagramCardnewsToBrief(
  brief: MediaBrief,
  bundle: PublishableContentBundle,
): MediaBrief {
  if (resolveInstagramCardnewsSkip(bundle)) return brief;
  const cards = buildInstagramCardnewsCards(
    bundle.instagram!,
    bundle.instagram!.provenance.evidenceRefIds ?? [],
  );
  if (cards.length === 0) return brief;
  return parseMediaBrief({
    ...brief,
    formats: {
      ...brief.formats,
      cardnews: {
        ...brief.formats.cardnews,
        enabled: true,
        aspectRatio: brief.formats.cardnews.aspectRatio ?? CARDNEWS_DEFAULT_ASPECT_RATIO,
        cards,
      },
    },
  });
}
