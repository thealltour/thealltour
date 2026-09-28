/**
 * Instagram Card Copy human review layer.
 *
 * The generated `context/instagram-card-copy.json` (Hermes or External) is never rewritten.
 * Operator edits live beside it in `human-edited/instagram-card-copy-review.json` (mirrored on
 * the DB channel review). Effective copy = humanDraft ?? aiDraft per card, and only applies while
 * the review still points at the current generated copy (baseCardCopyFingerprint).
 */

import type {
  PublishableContentBundle,
  PublishableInstagramCardPlan,
} from "@/lib/marketing/publishable/contracts";
import {
  readPackageJson,
  removePackageFile,
  writeMutablePackageJson,
} from "@/lib/marketing/publishable/channelSources/packageIo";
import type { ChannelGenerationSource } from "@/lib/marketing/publishable/channelSources/contracts";
import {
  assembleInstagramCardPlanFromEditorial,
  deriveLegacySlideHeadlines,
} from "@/lib/marketing/publishable/instagramEditorial/assemblePublishable";
import type {
  InstagramCardCopy,
  InstagramCardCopyItem,
  InstagramCarouselPlan,
  InstagramCarouselRole,
} from "@/lib/marketing/publishable/instagramEditorial/contracts";
import {
  buildInstagramCardCopyContentFingerprint,
  buildInstagramCardCopyReviewApprovalFingerprint,
} from "@/lib/marketing/publishable/instagramEditorial/fingerprint";
import {
  readInstagramCardCopyFromPackage,
  readInstagramCarouselPlanFromPackage,
} from "@/lib/marketing/publishable/instagramEditorial/persist";

export const INSTAGRAM_CARD_COPY_REVIEW_CONTRACT = "instagram-card-copy-review-v1" as const;
export const INSTAGRAM_CARD_COPY_REVIEW_RELATIVE_PATH =
  "human-edited/instagram-card-copy-review.json" as const;

/** Mirrors the cardPlan truncation in assembleInstagramCardPlanFromEditorial. */
export const INSTAGRAM_CARD_COPY_FIELD_LIMITS = {
  kicker: 40,
  headline: 80,
  body: 400,
  microcopy: 120,
} as const;

/** Review-level thumbnail title (1:1 first card only); not a card field. */
export const INSTAGRAM_COVER_TITLE_MAX_LENGTH = 80;

export type InstagramCardCopyFields = {
  kicker: string | null;
  headline: string;
  body: string | null;
  microcopy: string | null;
};

export type InstagramCardCopyReviewCard = {
  cardId: string;
  role: InstagramCarouselRole | null;
  evidenceRefs: string[];
  aiDraft: InstagramCardCopyFields;
  humanDraft: InstagramCardCopyFields | null;
};

export type InstagramCardCopyReviewStatus = "pending" | "approved";

export type InstagramCardCopyReview = {
  contract: typeof INSTAGRAM_CARD_COPY_REVIEW_CONTRACT;
  candidateId: string;
  assetId: string;
  assetVersion: number;
  source: { kind: ChannelGenerationSource; candidateRef: string | null };
  baseCardCopyFingerprint: string;
  status: InstagramCardCopyReviewStatus;
  approvedEffectiveFingerprint: string | null;
  approvedAt: string | null;
  approvedBy: string | null;
  updatedAt: string;
  updatedBy: string | null;
  cards: InstagramCardCopyReviewCard[];
  /**
   * Operator-only title for the 1:1 Instagram thumbnail variant of the first card. Absent on
   * reviews written before the field existed; null/absent means no thumbnail variant.
   */
  instagramCoverTitleKo?: string | null;
};

export type InstagramCardCopyReviewGateState =
  | "not_applicable"
  | "review_missing"
  | "pending"
  | "base_changed"
  | "approved_stale"
  | "approved";

export type InstagramCardCopyReviewErrorCode =
  | "card_copy_missing"
  | "review_missing"
  | "base_changed"
  | "unknown_card"
  | "headline_required"
  | "field_too_long";

export class InstagramCardCopyReviewError extends Error {
  constructor(
    readonly code: InstagramCardCopyReviewErrorCode,
    readonly messageKo: string,
  ) {
    super(`${code}: ${messageKo}`);
    this.name = "InstagramCardCopyReviewError";
  }
}

function normalizeOptional(value: string | null | undefined): string | null {
  const trimmed = value?.trim() ?? "";
  return trimmed ? trimmed : null;
}

function fieldsFromItem(item: InstagramCardCopyItem): InstagramCardCopyFields {
  return {
    kicker: normalizeOptional(item.kicker),
    headline: item.headline.trim(),
    body: normalizeOptional(item.body),
    microcopy: normalizeOptional(item.microcopy),
  };
}

function sameFields(a: InstagramCardCopyFields, b: InstagramCardCopyFields): boolean {
  return (
    a.kicker === b.kicker &&
    a.headline === b.headline &&
    a.body === b.body &&
    a.microcopy === b.microcopy
  );
}

function hasInstagramCardDraftEdits(review: InstagramCardCopyReview | null | undefined): boolean {
  return Boolean(review?.cards.some((card) => card.humanDraft !== null));
}

export function resolveInstagramCoverTitleKo(
  review: Pick<InstagramCardCopyReview, "instagramCoverTitleKo"> | null | undefined,
): string | null {
  return normalizeOptional(review?.instagramCoverTitleKo);
}

/** Card text edits or a thumbnail title — either one is operator work a rebase must not drop. */
export function hasInstagramCardHumanEdits(review: InstagramCardCopyReview | null | undefined): boolean {
  return hasInstagramCardDraftEdits(review) || resolveInstagramCoverTitleKo(review) !== null;
}

function approvalFingerprint(base: InstagramCardCopy, review: InstagramCardCopyReview): string {
  return buildInstagramCardCopyReviewApprovalFingerprint({
    cardCopyFingerprint: buildInstagramCardCopyContentFingerprint(applyInstagramCardCopyReview(base, review)),
    instagramCoverTitleKo: resolveInstagramCoverTitleKo(review),
  });
}

export function buildInstagramCardCopyReview(input: {
  candidateId: string;
  cardCopy: InstagramCardCopy;
  carousel: InstagramCarouselPlan | null;
  source: InstagramCardCopyReview["source"];
  updatedBy: string | null;
  nowIso: string;
}): InstagramCardCopyReview {
  const roleById = new Map((input.carousel?.cards ?? []).map((c) => [c.cardId, c.role]));
  return {
    contract: INSTAGRAM_CARD_COPY_REVIEW_CONTRACT,
    candidateId: input.candidateId,
    assetId: input.cardCopy.assetId,
    assetVersion: input.cardCopy.assetVersion,
    source: input.source,
    baseCardCopyFingerprint: buildInstagramCardCopyContentFingerprint(input.cardCopy),
    status: "pending",
    approvedEffectiveFingerprint: null,
    approvedAt: null,
    approvedBy: null,
    updatedAt: input.nowIso,
    updatedBy: input.updatedBy,
    cards: input.cardCopy.cards.map((item) => ({
      cardId: item.cardId,
      role: roleById.get(item.cardId) ?? null,
      evidenceRefs: [...(item.evidenceRefs ?? [])],
      aiDraft: fieldsFromItem(item),
      humanDraft: null,
    })),
    instagramCoverTitleKo: null,
  };
}

function reviewAppliesTo(base: InstagramCardCopy, review: InstagramCardCopyReview | null | undefined) {
  return Boolean(
    review && review.baseCardCopyFingerprint === buildInstagramCardCopyContentFingerprint(base),
  );
}

/**
 * Effective copy: humanDraft text over the generated card. cardId, order and evidenceRefs always
 * come from the generated copy — human review never changes provenance.
 */
export function applyInstagramCardCopyReview(
  base: InstagramCardCopy,
  review: InstagramCardCopyReview | null | undefined,
): InstagramCardCopy {
  if (!review || !reviewAppliesTo(base, review) || !hasInstagramCardDraftEdits(review)) return base;
  const humanById = new Map(review.cards.map((card) => [card.cardId, card.humanDraft]));
  return {
    ...base,
    cards: base.cards.map((item) => {
      const human = humanById.get(item.cardId);
      if (!human) return item;
      const next: InstagramCardCopyItem = { ...item, headline: human.headline };
      if (human.kicker) next.kicker = human.kicker;
      else delete next.kicker;
      if (human.body) next.body = human.body;
      else delete next.body;
      if (human.microcopy) next.microcopy = human.microcopy;
      else delete next.microcopy;
      return next;
    }),
  };
}

export function resolveInstagramCardCopyReviewGateState(
  base: InstagramCardCopy | null,
  review: InstagramCardCopyReview | null,
): {
  state: InstagramCardCopyReviewGateState;
  baseFingerprint: string | null;
  effectiveFingerprint: string | null;
} {
  if (!base) return { state: "not_applicable", baseFingerprint: null, effectiveFingerprint: null };
  const baseFingerprint = buildInstagramCardCopyContentFingerprint(base);
  if (!review) return { state: "review_missing", baseFingerprint, effectiveFingerprint: baseFingerprint };
  if (review.baseCardCopyFingerprint !== baseFingerprint) {
    return { state: "base_changed", baseFingerprint, effectiveFingerprint: baseFingerprint };
  }
  const effectiveFingerprint = approvalFingerprint(base, review);
  if (review.status !== "approved") return { state: "pending", baseFingerprint, effectiveFingerprint };
  if (review.approvedEffectiveFingerprint !== effectiveFingerprint) {
    return { state: "approved_stale", baseFingerprint, effectiveFingerprint };
  }
  return { state: "approved", baseFingerprint, effectiveFingerprint };
}

export type InstagramCardCopyEdit = {
  cardId: string;
  kicker?: string | null;
  headline: string;
  body?: string | null;
  microcopy?: string | null;
};

function assertLength(cardId: string, field: keyof typeof INSTAGRAM_CARD_COPY_FIELD_LIMITS, value: string | null) {
  if (value && value.length > INSTAGRAM_CARD_COPY_FIELD_LIMITS[field]) {
    throw new InstagramCardCopyReviewError(
      "field_too_long",
      `${cardId}.${field} ${value.length}자 > ${INSTAGRAM_CARD_COPY_FIELD_LIMITS[field]}자`,
    );
  }
}

/**
 * Save operator text edits. Only text fields are accepted; cards not listed keep their current
 * humanDraft. Any save moves the review back to pending (approval must be explicit).
 */
export function updateInstagramCardCopyReviewDrafts(input: {
  review: InstagramCardCopyReview;
  base: InstagramCardCopy;
  edits: InstagramCardCopyEdit[];
  /** undefined keeps the stored title; null or blank clears it. */
  instagramCoverTitleKo?: string | null;
  updatedBy: string | null;
  nowIso: string;
}): InstagramCardCopyReview {
  if (!reviewAppliesTo(input.base, input.review)) {
    throw new InstagramCardCopyReviewError(
      "base_changed",
      "생성된 카드 문구가 바뀌었습니다. 새 AI 초안으로 다시 시작하세요.",
    );
  }
  const editById = new Map(input.edits.map((edit) => [edit.cardId, edit]));
  for (const cardId of editById.keys()) {
    if (!input.review.cards.some((card) => card.cardId === cardId)) {
      throw new InstagramCardCopyReviewError("unknown_card", `${cardId}는 이 캐러셀에 없는 카드입니다.`);
    }
  }
  const cards = input.review.cards.map((card) => {
    const edit = editById.get(card.cardId);
    if (!edit) return card;
    const fields: InstagramCardCopyFields = {
      kicker: normalizeOptional(edit.kicker),
      headline: edit.headline.trim(),
      body: normalizeOptional(edit.body),
      microcopy: normalizeOptional(edit.microcopy),
    };
    if (!fields.headline) {
      throw new InstagramCardCopyReviewError("headline_required", `${card.cardId} 헤드라인이 비어 있습니다.`);
    }
    assertLength(card.cardId, "kicker", fields.kicker);
    assertLength(card.cardId, "headline", fields.headline);
    assertLength(card.cardId, "body", fields.body);
    assertLength(card.cardId, "microcopy", fields.microcopy);
    return { ...card, humanDraft: sameFields(fields, card.aiDraft) ? null : fields };
  });
  const instagramCoverTitleKo =
    input.instagramCoverTitleKo === undefined
      ? resolveInstagramCoverTitleKo(input.review)
      : normalizeOptional(input.instagramCoverTitleKo);
  if (instagramCoverTitleKo && instagramCoverTitleKo.length > INSTAGRAM_COVER_TITLE_MAX_LENGTH) {
    throw new InstagramCardCopyReviewError(
      "field_too_long",
      `썸네일 제목 ${instagramCoverTitleKo.length}자 > ${INSTAGRAM_COVER_TITLE_MAX_LENGTH}자`,
    );
  }
  return {
    ...input.review,
    cards,
    instagramCoverTitleKo,
    status: "pending",
    approvedEffectiveFingerprint: null,
    approvedAt: null,
    approvedBy: null,
    updatedAt: input.nowIso,
    updatedBy: input.updatedBy,
  };
}

export function approveInstagramCardCopyReview(input: {
  review: InstagramCardCopyReview;
  base: InstagramCardCopy;
  approvedBy: string | null;
  nowIso: string;
}): InstagramCardCopyReview {
  if (!reviewAppliesTo(input.base, input.review)) {
    throw new InstagramCardCopyReviewError(
      "base_changed",
      "생성된 카드 문구가 바뀌었습니다. 새 AI 초안으로 다시 검토하세요.",
    );
  }
  return {
    ...input.review,
    status: "approved",
    approvedEffectiveFingerprint: approvalFingerprint(input.base, input.review),
    approvedAt: input.nowIso,
    approvedBy: input.approvedBy,
    updatedAt: input.nowIso,
    updatedBy: input.approvedBy,
  };
}

/**
 * In-memory overlay of effective card copy onto publishable cardPlan (headline/body/visualIntent)
 * and slideHeadlines. The on-disk bundle stays untouched so Hermes auto snapshots never capture
 * human card text.
 */
export function overlayInstagramCardCopyOnBundle(input: {
  bundle: PublishableContentBundle;
  carousel: InstagramCarouselPlan | null;
  effective: InstagramCardCopy;
}): PublishableContentBundle {
  const meta = input.bundle.instagram?.instagramMeta;
  if (!meta?.cardPlan?.length || !input.carousel) return input.bundle;
  const assembledById = new Map(
    assembleInstagramCardPlanFromEditorial({
      carousel: input.carousel,
      cardCopy: input.effective,
    }).map((card) => [card.cardId, card]),
  );
  const cardPlan: PublishableInstagramCardPlan[] = meta.cardPlan.map((card) => {
    const assembled = card.cardId ? assembledById.get(card.cardId) : undefined;
    if (!assembled) return card;
    return {
      ...card,
      headline: assembled.headline,
      body: assembled.body,
      visualIntent: assembled.visualIntent,
    };
  });
  return {
    ...input.bundle,
    instagram: {
      ...input.bundle.instagram!,
      instagramMeta: {
        ...meta,
        cardPlan,
        slideHeadlines: deriveLegacySlideHeadlines(input.effective),
      },
    },
  };
}

export function readInstagramCardCopyReviewFromPackage(
  packageRoot: string,
): InstagramCardCopyReview | null {
  const raw = readPackageJson<InstagramCardCopyReview>(
    packageRoot,
    INSTAGRAM_CARD_COPY_REVIEW_RELATIVE_PATH,
  );
  return raw?.contract === INSTAGRAM_CARD_COPY_REVIEW_CONTRACT && Array.isArray(raw.cards)
    ? raw
    : null;
}

export function persistInstagramCardCopyReview(input: {
  packageRoot: string;
  review: InstagramCardCopyReview;
}): void {
  writeMutablePackageJson(
    input.packageRoot,
    INSTAGRAM_CARD_COPY_REVIEW_RELATIVE_PATH,
    input.review,
    input.review.updatedAt,
  );
}

export function removeInstagramCardCopyReviewFromPackage(packageRoot: string): void {
  removePackageFile(packageRoot, INSTAGRAM_CARD_COPY_REVIEW_RELATIVE_PATH);
}

export function resolveEffectiveInstagramCardCopy(packageRoot: string): InstagramCardCopy | null {
  const base = readInstagramCardCopyFromPackage(packageRoot);
  if (!base) return null;
  return applyInstagramCardCopyReview(base, readInstagramCardCopyReviewFromPackage(packageRoot));
}

export function resolveInstagramCardCopyReviewGate(packageRoot: string): {
  state: InstagramCardCopyReviewGateState;
  baseFingerprint: string | null;
  effectiveFingerprint: string | null;
  base: InstagramCardCopy | null;
  review: InstagramCardCopyReview | null;
} {
  const base = readInstagramCardCopyFromPackage(packageRoot);
  const review = base ? readInstagramCardCopyReviewFromPackage(packageRoot) : null;
  return { ...resolveInstagramCardCopyReviewGateState(base, review), base, review };
}

export function overlayEffectiveInstagramCardCopyForPackage(
  bundle: PublishableContentBundle,
  packageRoot: string,
): PublishableContentBundle {
  const base = readInstagramCardCopyFromPackage(packageRoot);
  if (!base) return bundle;
  const effective = applyInstagramCardCopyReview(base, readInstagramCardCopyReviewFromPackage(packageRoot));
  if (effective === base) return bundle;
  return overlayInstagramCardCopyOnBundle({
    bundle,
    carousel: readInstagramCarouselPlanFromPackage(packageRoot),
    effective,
  });
}

export const INSTAGRAM_CARD_COPY_REVIEW_GATE_MESSAGES_KO: Record<
  Exclude<InstagramCardCopyReviewGateState, "not_applicable" | "approved">,
  string
> = {
  review_missing: "Instagram 카드 문구 검토가 아직 시작되지 않았습니다. 카드별 문구를 확인하고 승인하세요.",
  pending: "Instagram 카드 문구 검토가 승인되지 않았습니다. 카드별 문구를 확인하고 승인하세요.",
  base_changed: "생성된 Instagram 카드 문구가 바뀌어 이전 검토가 무효가 되었습니다. 다시 검토하세요.",
  approved_stale: "승인 이후 카드 문구가 바뀌었습니다. 다시 승인하세요.",
};
