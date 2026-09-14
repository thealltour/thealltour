/**
 * Follow-up for "mark manually published".
 *
 * The review transition alone leaves the SocialPublication bridge and the
 * performance snapshot untouched, which is why the 08:30 Performance Analyst
 * brief only ever saw DB counts. This runs both right after the operator records
 * the publication.
 *
 * Every step is best-effort: the operator's transition already succeeded, so a
 * misconfigured social account or an unreachable metrics adapter must degrade to
 * a reported skip rather than undo it.
 */

import type { CompletedMarketingCandidate } from "@/lib/marketing/cron/daily/types";
import type { HumanMarketingReview, ManualPublicationRecord } from "@/lib/marketing/review/types";

export type ManualPublicationFollowUpStepName = "publication_bridge" | "performance_snapshot";

export type ManualPublicationFollowUpStatus = "recorded" | "reused" | "skipped" | "failed";

export type ManualPublicationFollowUpStep = {
  step: ManualPublicationFollowUpStepName;
  status: ManualPublicationFollowUpStatus;
  reason: string | null;
  /** Publication id or snapshot id when the step produced one. */
  ref: string | null;
};

export type ManualPublicationFollowUpResult = {
  steps: ManualPublicationFollowUpStep[];
  /** Latest review, when the bridge produced a newer one. */
  review: HumanMarketingReview;
};

export type ManualPublicationFollowUpDeps = {
  recordPublication: (input: {
    candidateId: string;
    socialAccountId: string;
    channel?: string | null;
    externalPostId?: string | null;
    externalUrl?: string | null;
    publishedAt: string;
    notes?: string | null;
    humanNotes?: string | null;
    reviewedBy?: string | null;
  }) => Promise<{ publicationId: string; created: boolean; review: HumanMarketingReview }>;
  loadCandidate: (candidateId: string) => Promise<CompletedMarketingCandidate | null>;
  collectPerformance: (input: {
    review: HumanMarketingReview;
    candidate: CompletedMarketingCandidate;
    correlationId?: string | null;
  }) => Promise<{ snapshotId: string | null; status: string; idempotentReuse: boolean }>;
};

function externalEvidence(record: ManualPublicationRecord | null): {
  externalPostId: string | null;
  externalUrl: string | null;
} | null {
  const externalPostId = record?.externalPostId?.trim() || null;
  const externalUrl = record?.externalUrl?.trim() || null;
  if (!externalPostId && !externalUrl) return null;
  return { externalPostId, externalUrl };
}

function messageOf(error: unknown): string {
  return error instanceof Error ? error.message : "unknown_error";
}

export async function runManualPublicationFollowUp(input: {
  candidateId: string;
  review: HumanMarketingReview;
  humanNotes?: string | null;
  reviewedBy?: string | null;
  correlationId?: string | null;
  deps: ManualPublicationFollowUpDeps;
}): Promise<ManualPublicationFollowUpResult> {
  const steps: ManualPublicationFollowUpStep[] = [];
  let review = input.review;

  const record = review.manualPublication;
  const socialAccountId = record?.socialAccountId?.trim() || null;
  const evidence = externalEvidence(record);
  const publishedAt = record?.publishedAt?.trim() || null;

  if (!socialAccountId) {
    // Not every channel has a registered SocialAccount yet; the review record
    // still stands on its own.
    steps.push({
      step: "publication_bridge",
      status: "skipped",
      reason: "social_account_not_provided",
      ref: null,
    });
  } else if (!evidence) {
    steps.push({
      step: "publication_bridge",
      status: "skipped",
      reason: "external_evidence_missing",
      ref: null,
    });
  } else if (!publishedAt) {
    steps.push({
      step: "publication_bridge",
      status: "skipped",
      reason: "published_at_missing",
      ref: null,
    });
  } else {
    try {
      const result = await input.deps.recordPublication({
        candidateId: input.candidateId,
        socialAccountId,
        channel: record?.channel ?? record?.platform ?? null,
        externalPostId: evidence.externalPostId,
        externalUrl: evidence.externalUrl,
        publishedAt,
        notes: record?.notes ?? null,
        humanNotes: input.humanNotes ?? null,
        reviewedBy: input.reviewedBy ?? null,
      });
      review = result.review;
      steps.push({
        step: "publication_bridge",
        status: result.created ? "recorded" : "reused",
        reason: null,
        ref: result.publicationId,
      });
    } catch (error) {
      steps.push({
        step: "publication_bridge",
        status: "failed",
        reason: messageOf(error),
        ref: null,
      });
    }
  }

  steps.push(
    await collectManualPublicationSnapshot({
      candidateId: input.candidateId,
      review,
      correlationId: input.correlationId,
      deps: input.deps,
    }),
  );

  return { steps, review };
}

/**
 * The snapshot half on its own, so the canonical `manual-publication` route can
 * reuse it after the bridge already recorded the publication.
 */
export async function collectManualPublicationSnapshot(input: {
  candidateId: string;
  review: HumanMarketingReview;
  correlationId?: string | null;
  deps: Pick<ManualPublicationFollowUpDeps, "loadCandidate" | "collectPerformance">;
}): Promise<ManualPublicationFollowUpStep> {
  try {
    const candidate = await input.deps.loadCandidate(input.candidateId);
    if (!candidate) {
      return {
        step: "performance_snapshot",
        status: "skipped",
        reason: "candidate_not_found",
        ref: null,
      };
    }
    const collected = await input.deps.collectPerformance({
      review: input.review,
      candidate,
      correlationId: input.correlationId ?? "mark-manually-published",
    });
    return {
      step: "performance_snapshot",
      status: collected.snapshotId
        ? collected.idempotentReuse
          ? "reused"
          : "recorded"
        : "skipped",
      reason: collected.snapshotId ? null : collected.status,
      ref: collected.snapshotId,
    };
  } catch (error) {
    return {
      step: "performance_snapshot",
      status: "failed",
      reason: messageOf(error),
      ref: null,
    };
  }
}

/** Production wiring — Supabase repositories + the canonical bridge. */
export async function createManualPublicationFollowUpDeps(input: {
  humanNotes?: string | null;
  reviewedBy?: string | null;
}): Promise<ManualPublicationFollowUpDeps> {
  const { createHumanMarketingReviewService } = await import(
    "@/lib/marketing/review/humanMarketingReviewService"
  );
  const { createHumanMarketingReviewRepository } = await import(
    "@/lib/marketing/review/repository/createHumanMarketingReviewRepository"
  );
  const { createDailyMarketingRunRepository } = await import(
    "@/lib/marketing/cron/daily/repository/createDailyMarketingRunRepository"
  );
  const { createSocialRepository } = await import(
    "@/lib/marketing/social/repository/createSocialRepository"
  );
  const { createManualMarketingPublicationBridge } = await import(
    "@/lib/marketing/social/publication/manualPublicationBridge"
  );
  const { createManualPublicationPerformanceCollectionService } = await import(
    "@/lib/marketing/performance/services/manualPublicationCollectionService"
  );

  const reviewService = await createHumanMarketingReviewService();
  const reviewRepo = await createHumanMarketingReviewRepository();
  const candidateRepo = await createDailyMarketingRunRepository();

  return {
    recordPublication: async (args) => {
      const socialRepo = await createSocialRepository({ backend: "supabase" });
      const bridge = createManualMarketingPublicationBridge({
        repository: socialRepo,
        loadHumanReview: async (candidateId) => reviewRepo.findByCandidateId(candidateId),
        persistManualReviewPublication: async ({ candidateId, manualPublication }) =>
          reviewService.markManuallyPublished({
            candidateId,
            manualPublication,
            humanNotes: input.humanNotes ?? null,
            reviewedBy: input.reviewedBy ?? null,
          }),
      });
      const result = await bridge.recordManualMarketingPublication({
        candidateId: args.candidateId,
        socialAccountId: args.socialAccountId,
        channel: args.channel ?? undefined,
        externalPostId: args.externalPostId ?? undefined,
        externalUrl: args.externalUrl ?? undefined,
        publishedAt: args.publishedAt,
        notes: args.notes ?? undefined,
      });
      return {
        publicationId: result.publication.id,
        created: result.created,
        review: result.review,
      };
    },
    loadCandidate: async (candidateId) => candidateRepo.findCandidateByCandidateId(candidateId),
    collectPerformance: async (args) => {
      const service = await createManualPublicationPerformanceCollectionService();
      const collected = await service.collectPerformanceForManualPublication(args);
      return {
        snapshotId: collected.snapshot?.snapshotId ?? null,
        status: collected.snapshot?.collectionStatus ?? collected.eligibility.status,
        idempotentReuse: Boolean(collected.idempotentReuse),
      };
    },
  };
}
