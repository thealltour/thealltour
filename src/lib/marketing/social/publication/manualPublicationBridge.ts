/**
 * Manual Publication Bridge (PUB-4).
 *
 * Records a human-published external post against an approved marketing candidate
 * as a durable published SocialPublication. Does NOT call remote publish APIs,
 * adapters, or CredentialStore.
 */

import "server-only";

import type { SocialAccount } from "@/lib/marketing/social/domain/accounts";
import {
  assertSocialChannel,
  CHANNEL_PROVIDER,
  isSocialChannel,
  type SocialChannel,
} from "@/lib/marketing/social/domain/providers";
import type { SocialPublicationRow } from "@/lib/marketing/social/persistence/types";
import {
  MARKETING_PUBLICATION_ERROR_CODES,
  MarketingPublicationError,
} from "@/lib/marketing/social/publication/errors";
import {
  buildHumanApprovalRef,
  buildManualMarketingPublicationIdempotencyKey,
  normalizeExternalPublicationUrl,
} from "@/lib/marketing/social/publication/idempotency";
import { SocialIdempotencyConflictError } from "@/lib/marketing/social/repository/errors";
import type { SocialRepository } from "@/lib/marketing/social/repository/contracts";
import type { HumanMarketingReview, ManualPublicationRecord } from "@/lib/marketing/review/types";

/** Canonical provenance for insight ingestion later. */
export const MANUAL_PUBLICATION_METHOD = "manual" as const;

export type ManualPublicationProvenance = {
  publicationMethod: typeof MANUAL_PUBLICATION_METHOD;
  hermesCreatedRemotePost: false;
  recordedBy: "manual_publication_bridge";
  candidateId: string;
  reviewId: string;
  notes?: string | null;
};

export type RecordManualMarketingPublicationInput = {
  candidateId: string;
  /** Optional hard check against the loaded review */
  humanReviewId?: string | null;
  socialAccountId: string;
  /** Optional; must match SocialAccount.channel when provided */
  channel?: SocialChannel | string | null;
  externalPostId?: string | null;
  externalUrl?: string | null;
  publishedAt: string;
  notes?: string | null;
};

export type RecordManualMarketingPublicationResult = {
  publication: SocialPublicationRow;
  created: boolean;
  reused: boolean;
  updated: boolean;
  humanApprovalRef: string;
  idempotencyKey: string;
  review: HumanMarketingReview;
  provenance: ManualPublicationProvenance;
};

export type LoadHumanMarketingReview = (
  candidateId: string,
) => Promise<HumanMarketingReview | null>;

export type PersistManualReviewPublication = (input: {
  candidateId: string;
  manualPublication: ManualPublicationRecord;
  reviewedBy?: string | null;
}) => Promise<HumanMarketingReview>;

function requireNonEmpty(value: string | null | undefined, label: string): string {
  const trimmed = value?.trim() || "";
  if (!trimmed) {
    throw new MarketingPublicationError(
      `${label} is required`,
      MARKETING_PUBLICATION_ERROR_CODES.INVALID_INPUT,
    );
  }
  return trimmed;
}

function requireExternalEvidence(input: {
  externalPostId?: string | null;
  externalUrl?: string | null;
}): { externalPostId: string | null; externalUrl: string | null; normalizedUrl: string | null } {
  const externalPostId = input.externalPostId?.trim() || null;
  const externalUrl = input.externalUrl?.trim() || null;
  const normalizedUrl = externalUrl ? normalizeExternalPublicationUrl(externalUrl) : null;
  if (externalUrl && !normalizedUrl) {
    throw new MarketingPublicationError(
      "externalUrl must be a valid http(s) URL",
      MARKETING_PUBLICATION_ERROR_CODES.INVALID_INPUT,
    );
  }
  if (!externalPostId && !normalizedUrl) {
    throw new MarketingPublicationError(
      "externalPostId or externalUrl is required",
      MARKETING_PUBLICATION_ERROR_CODES.INSUFFICIENT_EXTERNAL_EVIDENCE,
    );
  }
  return { externalPostId, externalUrl, normalizedUrl };
}

function requireApprovedOrAlreadyManual(
  review: HumanMarketingReview | null,
  candidateId: string,
): HumanMarketingReview {
  if (!review || review.candidateId !== candidateId) {
    throw new MarketingPublicationError(
      `Human approval required for candidate=${candidateId}`,
      MARKETING_PUBLICATION_ERROR_CODES.APPROVAL_REQUIRED,
    );
  }
  if (review.status !== "approved_for_manual_publish" && review.status !== "manually_published") {
    throw new MarketingPublicationError(
      `Human approval status must be approved_for_manual_publish (or already manually_published), got ${review.status}`,
      MARKETING_PUBLICATION_ERROR_CODES.APPROVAL_REQUIRED,
    );
  }
  return review;
}

function assertAccountUsable(account: SocialAccount, channel: SocialChannel): void {
  if (account.channel !== channel) {
    throw new MarketingPublicationError(
      `SocialAccount channel=${account.channel} does not match requested channel=${channel}`,
      MARKETING_PUBLICATION_ERROR_CODES.CHANNEL_MISMATCH,
    );
  }
  if (account.provider !== CHANNEL_PROVIDER[channel]) {
    throw new MarketingPublicationError(
      `SocialAccount provider/channel inconsistency`,
      MARKETING_PUBLICATION_ERROR_CODES.CHANNEL_MISMATCH,
    );
  }
  if (account.status === "disabled" || account.status === "disconnected") {
    throw new MarketingPublicationError(
      `SocialAccount status=${account.status} is not usable for manual publication recording`,
      MARKETING_PUBLICATION_ERROR_CODES.ACCOUNT_INACTIVE,
    );
  }
}

function buildProvenance(input: {
  candidateId: string;
  reviewId: string;
  notes?: string | null;
}): ManualPublicationProvenance {
  return {
    publicationMethod: MANUAL_PUBLICATION_METHOD,
    hermesCreatedRemotePost: false,
    recordedBy: "manual_publication_bridge",
    candidateId: input.candidateId,
    reviewId: input.reviewId,
    notes: input.notes?.trim() || null,
  };
}

function sameNormalizedUrl(a: string | null | undefined, b: string | null | undefined): boolean {
  const left = a ? normalizeExternalPublicationUrl(a) : null;
  const right = b ? normalizeExternalPublicationUrl(b) : null;
  return Boolean(left && right && left === right);
}

function readCandidateIdFromPublication(row: SocialPublicationRow): string | null {
  const value = row.providerStatusMetadata?.candidateId;
  return typeof value === "string" && value.trim() ? value.trim() : null;
}

function hasConflictingRemoteIdentity(
  existing: SocialPublicationRow,
  evidence: { externalPostId: string | null; normalizedUrl: string | null },
): boolean {
  if (
    evidence.externalPostId &&
    existing.externalPostId &&
    evidence.externalPostId !== existing.externalPostId
  ) {
    return true;
  }
  // Matching externalPostId → URL/publishedAt may be corrected.
  if (
    evidence.externalPostId &&
    existing.externalPostId &&
    evidence.externalPostId === existing.externalPostId
  ) {
    return false;
  }
  // No shared post id: different normalized URLs conflict.
  if (
    evidence.normalizedUrl &&
    existing.externalUrl &&
    !sameNormalizedUrl(existing.externalUrl, evidence.normalizedUrl)
  ) {
    return true;
  }
  return false;
}

function findDuplicateByExternalIdentity(
  rows: SocialPublicationRow[],
  evidence: { externalPostId: string | null; normalizedUrl: string | null },
): SocialPublicationRow | null {
  for (const row of rows) {
    if (evidence.externalPostId && row.externalPostId === evidence.externalPostId) {
      return row;
    }
    if (
      evidence.normalizedUrl &&
      row.externalUrl &&
      sameNormalizedUrl(row.externalUrl, evidence.normalizedUrl)
    ) {
      return row;
    }
  }
  return null;
}

function resolveChannel(
  account: SocialAccount,
  requested: string | null | undefined,
): SocialChannel {
  if (!requested?.trim()) return account.channel;
  const channel = assertSocialChannel(requested.trim().toLowerCase());
  if (channel !== account.channel) {
    throw new MarketingPublicationError(
      `Requested channel=${channel} does not match SocialAccount.channel=${account.channel}`,
      MARKETING_PUBLICATION_ERROR_CODES.CHANNEL_MISMATCH,
    );
  }
  return channel;
}

function mergeSafeRemoteFields(
  existing: SocialPublicationRow,
  evidence: { externalPostId: string | null; externalUrl: string | null },
  publishedAt: string,
): {
  externalPostId: string | null;
  externalUrl: string | null;
  publishedAt: string | null;
} {
  // Never replace a known post id with a different one (caller already conflict-checked).
  const externalPostId = existing.externalPostId ?? evidence.externalPostId;
  // Allow URL correction when post ids match; otherwise only fill if missing.
  let externalUrl = existing.externalUrl ?? evidence.externalUrl;
  if (
    evidence.externalUrl &&
    existing.externalPostId &&
    evidence.externalPostId &&
    existing.externalPostId === evidence.externalPostId
  ) {
    externalUrl = evidence.externalUrl;
  }
  const nextPublishedAt = existing.publishedAt ?? publishedAt;
  // Allow publishedAt correction when identity is confirmed by post id.
  const publishedAtOut =
    existing.externalPostId && evidence.externalPostId && existing.externalPostId === evidence.externalPostId
      ? publishedAt
      : nextPublishedAt;
  return {
    externalPostId: externalPostId ?? null,
    externalUrl: externalUrl ?? null,
    publishedAt: publishedAtOut,
  };
}

/**
 * Canonical manual publication bridge entry point.
 */
export function createManualMarketingPublicationBridge(deps: {
  repository: SocialRepository;
  loadHumanReview: LoadHumanMarketingReview;
  persistManualReviewPublication: PersistManualReviewPublication;
  now?: () => Date;
}) {
  const { repository, loadHumanReview, persistManualReviewPublication } = deps;
  const now = () => deps.now?.() ?? new Date();

  async function recordManualMarketingPublication(
    input: RecordManualMarketingPublicationInput,
  ): Promise<RecordManualMarketingPublicationResult> {
    const candidateId = requireNonEmpty(input.candidateId, "candidateId");
    const socialAccountId = requireNonEmpty(input.socialAccountId, "socialAccountId");
    const publishedAt = requireNonEmpty(input.publishedAt, "publishedAt");
    if (Number.isNaN(Date.parse(publishedAt))) {
      throw new MarketingPublicationError(
        "publishedAt must be a valid ISO datetime",
        MARKETING_PUBLICATION_ERROR_CODES.INVALID_INPUT,
      );
    }

    const evidence = requireExternalEvidence(input);
    const review = requireApprovedOrAlreadyManual(await loadHumanReview(candidateId), candidateId);

    if (input.humanReviewId?.trim() && input.humanReviewId.trim() !== review.reviewId) {
      throw new MarketingPublicationError(
        `humanReviewId does not match review for candidate=${candidateId}`,
        MARKETING_PUBLICATION_ERROR_CODES.REVIEW_MISMATCH,
      );
    }

    const account = await repository.getSocialAccountById(socialAccountId);
    if (!account) {
      throw new MarketingPublicationError(
        `SocialAccount not found: ${socialAccountId}`,
        MARKETING_PUBLICATION_ERROR_CODES.ACCOUNT_REQUIRED,
      );
    }

    const channel = resolveChannel(account, input.channel);
    assertAccountUsable(account, channel);

    const humanApprovalRef = buildHumanApprovalRef({
      reviewId: review.reviewId,
      candidateId,
    });
    const idempotencyKey = buildManualMarketingPublicationIdempotencyKey({
      candidateId,
      socialAccountId,
      channel,
    });
    const provenance = buildProvenance({
      candidateId,
      reviewId: review.reviewId,
      notes: input.notes,
    });

    const accountPublications = await repository.listPublicationsForAccount(socialAccountId);
    const duplicate = findDuplicateByExternalIdentity(accountPublications, evidence);
    let existing =
      (await repository.findPublicationByIdempotency(socialAccountId, idempotencyKey)) ?? null;

    if (duplicate && existing && duplicate.id !== existing.id) {
      throw new MarketingPublicationError(
        "external post identity already bound to a different SocialPublication for this account",
        MARKETING_PUBLICATION_ERROR_CODES.CONFLICTING_REMOTE_IDENTITY,
      );
    }
    if (duplicate && !existing) {
      const dupCandidateId = readCandidateIdFromPublication(duplicate);
      if (dupCandidateId && dupCandidateId !== candidateId) {
        throw new MarketingPublicationError(
          "external post identity already recorded for a different candidate",
          MARKETING_PUBLICATION_ERROR_CODES.CONFLICTING_REMOTE_IDENTITY,
        );
      }
      existing = duplicate;
    }

    if (existing) {
      if (hasConflictingRemoteIdentity(existing, evidence)) {
        throw new MarketingPublicationError(
          "conflicting remote identity for existing SocialPublication",
          MARKETING_PUBLICATION_ERROR_CODES.CONFLICTING_REMOTE_IDENTITY,
        );
      }

      const merged = mergeSafeRemoteFields(existing, evidence, publishedAt);
      const meta = {
        ...existing.providerStatusMetadata,
        ...provenance,
      };
      const needsUpdate =
        existing.status !== "published" ||
        existing.externalPostId !== merged.externalPostId ||
        existing.externalUrl !== merged.externalUrl ||
        existing.publishedAt !== merged.publishedAt ||
        existing.humanApprovalRef !== humanApprovalRef ||
        existing.providerStatusMetadata?.publicationMethod !== MANUAL_PUBLICATION_METHOD;

      const publication = needsUpdate
        ? await repository.updatePublicationStatus(existing.id, "published", {
            externalPostId: merged.externalPostId,
            externalUrl: merged.externalUrl,
            publishedAt: merged.publishedAt,
            humanApprovalRef,
            providerStatusMetadata: meta,
          })
        : existing;

      const updatedReview = await persistManualReviewPublication({
        candidateId,
        manualPublication: {
          platform: channel,
          externalPostId: publication.externalPostId ?? undefined,
          externalUrl: publication.externalUrl ?? undefined,
          publishedAt: publication.publishedAt ?? publishedAt,
          notes: input.notes ?? undefined,
        },
      });

      return {
        publication,
        created: false,
        reused: true,
        updated: needsUpdate,
        humanApprovalRef,
        idempotencyKey,
        review: updatedReview,
        provenance,
      };
    }

    let pending: SocialPublicationRow;
    try {
      pending = await repository.createPendingPublication({
        socialAccountId,
        provider: account.provider,
        channel,
        mediaType: null,
        idempotencyKey,
        humanApprovalRef,
        governanceDecision: "ALLOW",
      });
    } catch (error) {
      if (error instanceof SocialIdempotencyConflictError) {
        // Race: re-enter and take the reuse path.
        return recordManualMarketingPublication(input);
      }
      throw error;
    }

    const publication = await repository.updatePublicationStatus(pending.id, "published", {
      externalPostId: evidence.externalPostId,
      externalUrl: evidence.externalUrl,
      publishedAt,
      providerStatusMetadata: {
        ...provenance,
        recordedAt: now().toISOString(),
      },
    });

    const updatedReview = await persistManualReviewPublication({
      candidateId,
      manualPublication: {
        platform: channel,
        externalPostId: evidence.externalPostId ?? undefined,
        externalUrl: evidence.externalUrl ?? undefined,
        publishedAt,
        notes: input.notes ?? undefined,
      },
    });

    return {
      publication,
      created: true,
      reused: false,
      updated: false,
      humanApprovalRef,
      idempotencyKey,
      review: updatedReview,
      provenance,
    };
  }

  return { recordManualMarketingPublication };
}

export type ManualMarketingPublicationBridge = ReturnType<
  typeof createManualMarketingPublicationBridge
>;

/** Insight-ingestion helper: detect manual provenance on a SocialPublication row. */
export function isManualSocialPublication(row: SocialPublicationRow): boolean {
  return row.providerStatusMetadata?.publicationMethod === MANUAL_PUBLICATION_METHOD;
}

export function mapPlatformToSocialChannel(
  platform: string | null | undefined,
): SocialChannel | null {
  const value = platform?.trim().toLowerCase().replace(/\s+/g, "_") || "";
  if (!value) return null;
  return isSocialChannel(value) ? value : null;
}
