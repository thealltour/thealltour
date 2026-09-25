/**
 * Instagram carousel → cardnews card mapping.
 *
 * Pure: no sharp, no filesystem.
 *
 * Copy authority (production):
 *   publishable.instagram.instagramMeta.cardPlan  ← assembled from Instagram Card Copy
 * Legacy fallback (no usable cardPlan):
 *   slideHeadlines + caption body lines
 *
 * `media-brief.formats.cardnews.cards` is NOT copy-authoritative. Render/export must
 * resolve through {@link resolveInstagramCardnewsRenderBrief} so stale brief copy
 * cannot silently win over a current cardPlan.
 *
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

  // Prefer cardPlan whenever it carries usable headlines — even if shorter than
  // slideHeadlines — so a current Card Copy plan is never displaced by stale
  // legacy slideHeadlines that still sit on the same publishable meta.
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
 *
 * Replaces `formats.cardnews.cards` with cardPlan/slideHeadlines-derived copy.
 * Does not persist — callers that must not rewrite `media-brief.json` should
 * keep the result in memory only (see render step).
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

/**
 * In-memory render/export brief: overlay publishable cardPlan copy onto the
 * disk media-brief without rewriting the artifact. Prefer this over reading
 * `formats.cardnews.cards` as-is.
 */
export function resolveInstagramCardnewsRenderBrief(
  brief: MediaBrief,
  bundle: PublishableContentBundle,
): MediaBrief {
  return applyInstagramCardnewsToBrief(brief, bundle);
}

export type InstagramCardCopyParityMismatch = {
  index: number;
  field: "cardId" | "headline" | "body";
  expected: string;
  actual: string;
};

/**
 * Source-parity check: when publishable.cardPlan is the production SoT,
 * resolved renderer cards must match plan cardId/headline/body in order.
 * Returns mismatches (empty = ok). Does not throw.
 */
export function diffInstagramCardPlanCopyParity(
  bundle: PublishableContentBundle,
  resolvedCards: ReadonlyArray<Pick<CardNewsCard, "cardId" | "headline" | "body">>,
): InstagramCardCopyParityMismatch[] {
  const plan =
    bundle.instagram?.instagramMeta?.cardPlan?.filter((c) => c.headline?.trim()) ?? [];
  if (plan.length < INSTAGRAM_CARDNEWS_MIN_SLIDES) return [];

  const mismatches: InstagramCardCopyParityMismatch[] = [];
  const n = Math.min(plan.length, resolvedCards.length);
  for (let i = 0; i < n; i++) {
    const expected = plan[i]!;
    const actual = resolvedCards[i]!;
    const expectedId = expected.cardId || `card-${String(i + 1).padStart(2, "0")}`;
    if (actual.cardId !== expectedId) {
      mismatches.push({
        index: i,
        field: "cardId",
        expected: expectedId,
        actual: actual.cardId,
      });
    }
    if (actual.headline !== expected.headline) {
      mismatches.push({
        index: i,
        field: "headline",
        expected: expected.headline,
        actual: actual.headline,
      });
    }
    if ((actual.body || "") !== (expected.body || "")) {
      mismatches.push({
        index: i,
        field: "body",
        expected: expected.body || "",
        actual: actual.body || "",
      });
    }
  }
  if (resolvedCards.length !== plan.length) {
    mismatches.push({
      index: Math.min(resolvedCards.length, plan.length),
      field: "cardId",
      expected: `len=${plan.length}`,
      actual: `len=${resolvedCards.length}`,
    });
  }
  return mismatches;
}
