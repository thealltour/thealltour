/**
 * Instagram card copy review — package context + operator view.
 * DB channelReviews.instagram.cardCopyReview is the edit authority; the package sidecar is what
 * VRA/SVP/render gates read, so every write goes package-first.
 */

import { resolveMarketingAssetRoot } from "@/lib/marketing/assets/config";
import { resolvePackageDirectory } from "@/lib/marketing/assets/paths";
import type { CompletedMarketingCandidate } from "@/lib/marketing/cron/daily/types";
import { readPublishableBundle } from "@/lib/marketing/publishable/channelSources/packageIo";
import { readChannelSourceSelection } from "@/lib/marketing/publishable/channelSources/selection";
import {
  buildInstagramCardCopyReview,
  hasInstagramCardHumanEdits,
  INSTAGRAM_CARD_COPY_FIELD_LIMITS,
  InstagramCardCopyReviewError,
  resolveInstagramCardCopyReviewGate,
  type InstagramCardCopyReview,
  type InstagramCardCopyReviewGateState,
} from "@/lib/marketing/publishable/instagramEditorial/cardCopyReview";
import type { InstagramCardCopy } from "@/lib/marketing/publishable/instagramEditorial/contracts";
import { buildInstagramCardCopyContentFingerprint } from "@/lib/marketing/publishable/instagramEditorial/fingerprint";
import { readInstagramCarouselPlanFromPackage } from "@/lib/marketing/publishable/instagramEditorial/persist";
import {
  emptyChannelReviewEntry,
  type ChannelReviewEntry,
} from "@/lib/marketing/review/channelReviews";
import type { HumanMarketingReview } from "@/lib/marketing/review/types";

export type InstagramCardCopyReviewView = {
  applicable: boolean;
  /** What the render / SVP gates currently see (package sidecar). */
  gateState: InstagramCardCopyReviewGateState;
  /** Editable review: stored one when it still matches the generated copy, else a fresh AI draft. */
  review: InstagramCardCopyReview | null;
  persisted: boolean;
  /** Stored human edits were made on a previous generated copy (reset required). */
  staleHumanEdits: boolean;
  limits: typeof INSTAGRAM_CARD_COPY_FIELD_LIMITS;
};

export function defaultInstagramCardCopyPackageRoot(candidate: CompletedMarketingCandidate): string {
  return resolvePackageDirectory({
    assetRoot: resolveMarketingAssetRoot({}),
    businessDateKst: candidate.businessDateKst,
    candidateId: candidate.candidateId,
  });
}

function sourceIdentity(packageRoot: string): InstagramCardCopyReview["source"] {
  const record = readChannelSourceSelection(packageRoot)?.channels.instagram;
  return {
    kind: record?.selectedSource ?? "hermes_auto",
    candidateRef: record?.selectedSource === "external_editorial" ? record.candidateRef : null,
  };
}

function freshReview(input: {
  candidateId: string;
  packageRoot: string;
  base: InstagramCardCopy;
  updatedBy: string | null;
  nowIso: string;
}): InstagramCardCopyReview {
  return buildInstagramCardCopyReview({
    candidateId: input.candidateId,
    cardCopy: input.base,
    carousel: readInstagramCarouselPlanFromPackage(input.packageRoot),
    source: sourceIdentity(input.packageRoot),
    updatedBy: input.updatedBy,
    nowIso: input.nowIso,
  });
}

function storedReview(review: HumanMarketingReview | null): InstagramCardCopyReview | null {
  return review?.channelReviews?.instagram?.cardCopyReview ?? null;
}

export function buildInstagramCardCopyReviewView(input: {
  candidateId: string;
  packageRoot: string;
  review: HumanMarketingReview | null;
  nowIso: string;
}): InstagramCardCopyReviewView {
  const gate = resolveInstagramCardCopyReviewGate(input.packageRoot);
  if (!gate.base) {
    return {
      applicable: false,
      gateState: gate.state,
      review: null,
      persisted: false,
      staleHumanEdits: false,
      limits: INSTAGRAM_CARD_COPY_FIELD_LIMITS,
    };
  }
  const stored = storedReview(input.review) ?? gate.review;
  const matches = Boolean(stored && stored.baseCardCopyFingerprint === gate.baseFingerprint);
  return {
    applicable: true,
    gateState: gate.state,
    review: matches
      ? stored
      : freshReview({
          candidateId: input.candidateId,
          packageRoot: input.packageRoot,
          base: gate.base,
          updatedBy: null,
          nowIso: input.nowIso,
        }),
    persisted: matches,
    staleHumanEdits: !matches && hasInstagramCardHumanEdits(stored),
    limits: INSTAGRAM_CARD_COPY_FIELD_LIMITS,
  };
}

/**
 * Review to mutate on save/approve. Silently rebases an unedited stale review, but refuses to drop
 * human edits made on a previous generated copy (operator must reset explicitly).
 */
export function resolveMutableInstagramCardCopyReview(input: {
  candidateId: string;
  packageRoot: string;
  review: HumanMarketingReview;
  updatedBy: string | null;
  nowIso: string;
}): { base: InstagramCardCopy; current: InstagramCardCopyReview } {
  const gate = resolveInstagramCardCopyReviewGate(input.packageRoot);
  if (!gate.base) {
    throw new InstagramCardCopyReviewError("card_copy_missing", "Instagram 카드 문구가 아직 생성되지 않았습니다.");
  }
  const stored = storedReview(input.review);
  if (stored && stored.baseCardCopyFingerprint === buildInstagramCardCopyContentFingerprint(gate.base)) {
    return { base: gate.base, current: stored };
  }
  if (hasInstagramCardHumanEdits(stored)) {
    throw new InstagramCardCopyReviewError(
      "base_changed",
      "생성된 카드 문구가 바뀌었습니다. 새 AI 초안으로 다시 시작하세요.",
    );
  }
  return {
    base: gate.base,
    current: freshReview({ ...input, base: gate.base }),
  };
}

export function freshInstagramCardCopyReviewForReset(input: {
  candidateId: string;
  packageRoot: string;
  updatedBy: string | null;
  nowIso: string;
}): InstagramCardCopyReview {
  const gate = resolveInstagramCardCopyReviewGate(input.packageRoot);
  if (!gate.base) {
    throw new InstagramCardCopyReviewError("card_copy_missing", "Instagram 카드 문구가 아직 생성되지 않았습니다.");
  }
  return freshReview({ ...input, base: gate.base });
}

export function withInstagramCardCopyReview(input: {
  review: HumanMarketingReview;
  packageRoot: string;
  cardCopyReview: InstagramCardCopyReview;
  nowIso: string;
}): HumanMarketingReview {
  const existing: ChannelReviewEntry =
    input.review.channelReviews?.instagram ??
    (() => {
      const slot = readPublishableBundle(input.packageRoot)?.instagram;
      return emptyChannelReviewEntry("instagram", { title: slot?.title ?? null, body: slot?.body ?? "" });
    })();
  return {
    ...input.review,
    status: input.review.status === "pending" ? "editing" : input.review.status,
    channelReviews: {
      ...(input.review.channelReviews ?? {}),
      instagram: { ...existing, cardCopyReview: input.cardCopyReview, lastEditedAt: input.nowIso },
    },
    updatedAt: input.nowIso,
  };
}
