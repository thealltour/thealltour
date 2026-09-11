/**
 * Narrow marketing PublicationOrchestrator (PUB-2).
 *
 * prepare: approval gate + pending SocialPublication (idempotent)
 * execute: side-effect allowlist + adapter publish + status persistence
 *
 * Live SNS remains denied by default. Does not use admin Threads routes.
 */

import "server-only";

import type { CredentialReference, CredentialStore } from "@/lib/marketing/social/domain/credentials";
import { assertNoRawCredentialMaterial } from "@/lib/marketing/social/domain/credentials";
import type { SocialChannel } from "@/lib/marketing/social/domain/providers";
import { CHANNEL_PROVIDER } from "@/lib/marketing/social/domain/providers";
import type { SocialPublicationRow } from "@/lib/marketing/social/persistence/types";
import {
  MARKETING_PUBLICATION_ERROR_CODES,
  MarketingPublicationError,
} from "@/lib/marketing/social/publication/errors";
import {
  PUBLICATION_ORCHESTRATOR_CALLER,
  assertCanInvokePublicationAdapter,
} from "@/lib/marketing/social/publication/governanceBoundary";
import {
  buildHumanApprovalRef,
  buildMarketingPublicationIdempotencyKey,
} from "@/lib/marketing/social/publication/idempotency";
import {
  DEFAULT_MARKETING_PUBLICATION_SIDE_EFFECTS,
  type MarketingPublicationSideEffectAllowlist,
  isMarketingPublicationSideEffectAllowed,
} from "@/lib/marketing/social/publication/sideEffectGate";
import type {
  PublicationAdapter,
  PublicationResult,
} from "@/lib/marketing/social/publication/types";
import type { SocialRepository } from "@/lib/marketing/social/repository/contracts";
import { SocialIdempotencyConflictError } from "@/lib/marketing/social/repository/errors";
import type { HumanMarketingReview } from "@/lib/marketing/review/types";

export type LoadApprovedHumanReview = (
  candidateId: string,
) => Promise<HumanMarketingReview | null>;

export type PrepareMarketingPublicationInput = {
  candidateId: string;
  socialAccountId: string;
  channel: SocialChannel;
  text: string;
  imageUrl?: string | null;
  contentId?: string | null;
  governanceDecision?: string | null;
  governanceRunId?: string | null;
};

export type PrepareMarketingPublicationResult = {
  publication: SocialPublicationRow;
  created: boolean;
  humanApprovalRef: string;
  idempotencyKey: string;
  mediaType: "TEXT" | "IMAGE";
};

export type ExecuteMarketingPublicationInput = {
  publicationId: string;
  adapter: PublicationAdapter;
  credentialStore: CredentialStore;
  credentialRef: CredentialReference;
  /**
   * Caption/body for adapter (must match prepared publication intent).
   * Taken from approved draft / prepare input — not from SocialPublication row.
   */
  text: string;
  imageUrl?: string | null;
  sideEffectPolicy?: MarketingPublicationSideEffectAllowlist;
};

export type ExecuteMarketingPublicationResult = {
  outcome: "published" | "failed" | "side_effects_denied" | "already_published";
  publication: SocialPublicationRow;
  adapterResult?: PublicationResult;
};

function requireApprovedReview(review: HumanMarketingReview | null, candidateId: string): HumanMarketingReview {
  if (!review || review.candidateId !== candidateId) {
    throw new MarketingPublicationError(
      `Human approval required for candidate=${candidateId}`,
      MARKETING_PUBLICATION_ERROR_CODES.APPROVAL_REQUIRED,
    );
  }
  if (review.status !== "approved_for_manual_publish") {
    throw new MarketingPublicationError(
      `Human approval status must be approved_for_manual_publish, got ${review.status}`,
      MARKETING_PUBLICATION_ERROR_CODES.APPROVAL_REQUIRED,
    );
  }
  return review;
}

export function createMarketingPublicationOrchestrator(deps: {
  repository: SocialRepository;
  loadApprovedHumanReview: LoadApprovedHumanReview;
}) {
  const { repository, loadApprovedHumanReview } = deps;

  return {
    /**
     * Persist/reuse pending SocialPublication. Never calls remote APIs.
     */
    async prepare(input: PrepareMarketingPublicationInput): Promise<PrepareMarketingPublicationResult> {
      const candidateId = input.candidateId.trim();
      const socialAccountId = input.socialAccountId.trim();
      const text = input.text.trim();
      if (!candidateId || !socialAccountId || !text) {
        throw new MarketingPublicationError(
          "candidateId, socialAccountId, and text are required",
          MARKETING_PUBLICATION_ERROR_CODES.INVALID_INPUT,
        );
      }
      if (input.channel !== "threads") {
        throw new MarketingPublicationError(
          `PUB-2 orchestrator only supports threads (got ${input.channel})`,
          MARKETING_PUBLICATION_ERROR_CODES.CHANNEL_UNSUPPORTED,
        );
      }

      const review = requireApprovedReview(await loadApprovedHumanReview(candidateId), candidateId);
      const humanApprovalRef = buildHumanApprovalRef({
        reviewId: review.reviewId,
        candidateId,
      });

      const account = await repository.getSocialAccountById(socialAccountId);
      if (!account || account.status !== "connected") {
        throw new MarketingPublicationError(
          `Connected social account required: ${socialAccountId}`,
          MARKETING_PUBLICATION_ERROR_CODES.ACCOUNT_REQUIRED,
        );
      }
      if (account.channel !== input.channel) {
        throw new MarketingPublicationError(
          `Account channel mismatch: account=${account.channel} request=${input.channel}`,
          MARKETING_PUBLICATION_ERROR_CODES.ACCOUNT_REQUIRED,
        );
      }

      const imageUrl = input.imageUrl?.trim() || null;
      const mediaType: "TEXT" | "IMAGE" = imageUrl ? "IMAGE" : "TEXT";
      const idempotencyKey = buildMarketingPublicationIdempotencyKey({
        candidateId,
        socialAccountId,
        channel: input.channel,
        mediaType,
        text,
        imageUrl,
      });

      const existing = await repository.findPublicationByIdempotency(socialAccountId, idempotencyKey);
      if (existing) {
        assertNoRawCredentialMaterial(existing);
        return {
          publication: existing,
          created: false,
          humanApprovalRef: existing.humanApprovalRef ?? humanApprovalRef,
          idempotencyKey,
          mediaType,
        };
      }

      try {
        const publication = await repository.createPendingPublication({
          contentId: input.contentId ?? candidateId,
          socialAccountId,
          provider: CHANNEL_PROVIDER[input.channel],
          channel: input.channel,
          mediaType,
          idempotencyKey,
          governanceDecision: input.governanceDecision ?? null,
          governanceRunId: input.governanceRunId ?? null,
          humanApprovalRef,
        });
        assertNoRawCredentialMaterial(publication);
        return {
          publication,
          created: true,
          humanApprovalRef,
          idempotencyKey,
          mediaType,
        };
      } catch (error) {
        if (error instanceof SocialIdempotencyConflictError) {
          const raced = await repository.findPublicationByIdempotency(socialAccountId, idempotencyKey);
          if (raced) {
            return {
              publication: raced,
              created: false,
              humanApprovalRef: raced.humanApprovalRef ?? humanApprovalRef,
              idempotencyKey,
              mediaType,
            };
          }
        }
        throw error;
      }
    },

    /**
     * Attempt live publish only when side-effect allowlist permits.
     * Default policy denies remote calls (PUB-2 safe).
     */
    async execute(input: ExecuteMarketingPublicationInput): Promise<ExecuteMarketingPublicationResult> {
      const publication = await repository.getPublicationById(input.publicationId);
      if (!publication) {
        throw new MarketingPublicationError(
          `publication not found: ${input.publicationId}`,
          MARKETING_PUBLICATION_ERROR_CODES.INVALID_INPUT,
        );
      }
      assertNoRawCredentialMaterial(publication);

      if (publication.status === "published" && publication.externalPostId) {
        return { outcome: "already_published", publication };
      }

      const policy = input.sideEffectPolicy ?? DEFAULT_MARKETING_PUBLICATION_SIDE_EFFECTS;
      const allowed = isMarketingPublicationSideEffectAllowed(policy, {
        channel: publication.channel as SocialChannel,
        socialAccountId: publication.socialAccountId,
        publicationId: publication.id,
      });
      if (!allowed) {
        return { outcome: "side_effects_denied", publication };
      }

      assertCanInvokePublicationAdapter(PUBLICATION_ORCHESTRATOR_CALLER, {
        sideEffectsExplicitlyAllowed: true,
      });

      if (input.adapter.channel !== publication.channel) {
        throw new MarketingPublicationError(
          "Adapter channel does not match publication",
          MARKETING_PUBLICATION_ERROR_CODES.CHANNEL_UNSUPPORTED,
        );
      }

      let credential;
      try {
        credential = await input.credentialStore.resolve(input.credentialRef);
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        throw new MarketingPublicationError(
          message.slice(0, 240),
          MARKETING_PUBLICATION_ERROR_CODES.CREDENTIAL_UNRESOLVED,
        );
      }

      await repository.updatePublicationStatus(publication.id, "publishing");

      const adapterResult = await input.adapter.publish(
        {
          provider: input.adapter.provider,
          channel: input.adapter.channel,
          marketingPost: {
            contentId: publication.contentId,
            channel: publication.channel,
            body: input.text,
            mediaTypes: publication.mediaType === "IMAGE" ? ["image"] : ["text"],
          },
          socialAccountId: publication.socialAccountId,
          idempotencyKey: publication.idempotencyKey,
          imageUrl: input.imageUrl ?? null,
          humanApprovalRef: publication.humanApprovalRef,
        },
        { credential },
      );

      // Never persist credential material on the row
      assertNoRawCredentialMaterial(adapterResult);

      if (adapterResult.status === "published" && adapterResult.externalPostId) {
        const updated = await repository.updatePublicationStatus(publication.id, "published", {
          externalPostId: adapterResult.externalPostId,
          externalUrl: adapterResult.externalUrl ?? null,
          publishedAt: new Date().toISOString(),
          providerStatusMetadata: {
            sideEffectPerformed: adapterResult.sideEffectPerformed,
          },
        });
        assertNoRawCredentialMaterial(updated);
        return { outcome: "published", publication: updated, adapterResult };
      }

      const failed = await repository.updatePublicationStatus(publication.id, "failed", {
        providerStatusMetadata: {
          errorCode: adapterResult.error?.code ?? "ADAPTER_FAILED",
          errorMessage: adapterResult.error?.message ?? "adapter failed",
          retryable: adapterResult.error?.retryable ?? false,
          sideEffectPerformed: adapterResult.sideEffectPerformed,
        },
      });
      assertNoRawCredentialMaterial(failed);
      return { outcome: "failed", publication: failed, adapterResult };
    },
  };
}

export type MarketingPublicationOrchestrator = ReturnType<
  typeof createMarketingPublicationOrchestrator
>;
