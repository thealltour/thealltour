/**
 * Instagram carousel → cardnews card mapping.
 *
 * Pure: no sharp, no filesystem. Prefer cardPlan (storyboard) when present;
 * fall back to slideHeadlines + caption lines for legacy drafts.
 * Planning-only visual metadata (visualId etc.) stays on instagramMeta — not CardNewsCard.
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
  PublishableInstagramCardPlan,
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
  const planCount = instagram.instagramMeta?.cardPlan?.length ?? 0;
  const headlineCount = instagram.instagramMeta?.slideHeadlines.length ?? 0;
  if (Math.max(planCount, headlineCount) < INSTAGRAM_CARDNEWS_MIN_SLIDES) {
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

function mapPlanRole(role: PublishableInstagramCardPlan["role"]): CardNewsCard["role"] {
  if (role === "cover" || role === "information" || role === "evidence" || role === "cta") {
    return role;
  }
  return "information";
}

function cardsFromPlan(
  plan: PublishableInstagramCardPlan[],
  fallbackEvidence: string[],
): CardNewsCard[] {
  return plan.slice(0, 12).map((card, index) => ({
    cardId: card.cardId || `card-${String(index + 1).padStart(2, "0")}`,
    role: mapPlanRole(card.role),
    headline: card.headline,
    body: card.body || "",
    visualIntent: card.visual?.visualIntent || card.visualIntent || "",
    evidenceRefs:
      card.role === "evidence"
        ? (card.evidenceRefs?.length ? card.evidenceRefs : fallbackEvidence).slice(0, 8)
        : card.evidenceRefs?.slice(0, 8) ?? [],
  }));
}

export function buildInstagramCardnewsCards(
  instagram: PublishableChannelContent,
  evidenceRefIds: string[] = [],
): CardNewsCard[] {
  const meta = instagram.instagramMeta;
  if (!meta) return [];

  const plan = meta.cardPlan?.filter((c) => c.headline?.trim()) ?? [];
  if (plan.length >= INSTAGRAM_CARDNEWS_MIN_SLIDES) {
    return cardsFromPlan(plan, evidenceRefIds.slice(0, 8));
  }

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

  const detailStart = hook ? 0 : 1;
  for (const [offset, headline] of headlines.slice(1).entries()) {
    const isLast = offset === headlines.slice(1).length - 1;
    const looksEvidence =
      /근거|한계|확인된|관측|출처|증거/.test(headline) ||
      /근거|한계|관측|출처/.test(details[detailStart + offset] ?? "");
    cards.push({
      cardId: `card-info-${String(offset + 1).padStart(2, "0")}`,
      role: looksEvidence && !isLast ? "evidence" : "information",
      headline,
      body: details[detailStart + offset] ?? "",
      visualIntent: "",
      evidenceRefs: looksEvidence ? evidence : evidence,
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
  const aspect =
    bundle.instagram!.instagramMeta?.aspectRatio === "1:1"
      ? "1:1"
      : (brief.formats.cardnews.aspectRatio ?? CARDNEWS_DEFAULT_ASPECT_RATIO);
  return parseMediaBrief({
    ...brief,
    formats: {
      ...brief.formats,
      cardnews: {
        ...brief.formats.cardnews,
        enabled: true,
        aspectRatio: aspect,
        cards,
      },
    },
  });
}
