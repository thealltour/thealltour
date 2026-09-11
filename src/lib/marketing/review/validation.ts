import { z } from "zod";

export const humanReviewDraftSchema = z.object({
  title: z.string().max(300).nullable().optional(),
  body: z.string().min(1).max(20_000),
  channel: z.string().min(1).max(64).optional(),
});

export const updateHumanDraftSchema = z.object({
  draft: humanReviewDraftSchema,
  humanNotes: z.string().max(4_000).nullable().optional(),
});

export const deferHumanReviewSchema = z.object({
  humanNotes: z.string().max(4_000).nullable().optional(),
  deferredUntil: z.string().datetime().nullable().optional(),
});

export const rejectHumanReviewSchema = z.object({
  rejectionReason: z.string().min(1).max(2_000),
  humanNotes: z.string().max(4_000).nullable().optional(),
});

export const approveHumanReviewSchema = z.object({
  humanNotes: z.string().max(4_000).nullable().optional(),
});

export const manualPublicationSchema = z.object({
  platform: z.string().max(64).optional(),
  publishedAt: z.string().datetime().optional(),
  externalUrl: z.string().url().max(2_000).optional(),
  externalPostId: z.string().max(256).optional(),
  notes: z.string().max(4_000).optional(),
});

export const markManuallyPublishedSchema = z.object({
  manualPublication: manualPublicationSchema,
  humanNotes: z.string().max(4_000).nullable().optional(),
});

/** PUB-4: canonical SocialPublication bridge (no credentials). */
export const recordManualMarketingPublicationSchema = z
  .object({
    socialAccountId: z.string().uuid(),
    humanReviewId: z.string().min(1).max(128).optional(),
    channel: z.string().min(1).max(64).optional(),
    externalPostId: z.string().min(3).max(256).optional(),
    externalUrl: z.string().url().max(2_000).optional(),
    publishedAt: z.string().datetime(),
    notes: z.string().max(4_000).optional(),
    humanNotes: z.string().max(4_000).nullable().optional(),
  })
  .refine((value) => Boolean(value.externalPostId?.trim() || value.externalUrl?.trim()), {
    message: "externalPostId_or_externalUrl_required",
  });

export const queueFilterSchema = z.enum([
  "all",
  "pending",
  "needs_review",
  "approved",
  "deferred",
  "manually_published",
  "blocked_failed",
  "today",
]);
