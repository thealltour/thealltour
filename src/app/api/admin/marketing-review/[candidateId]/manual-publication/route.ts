import { requireAdminPermission } from "@/lib/apiAuth";
import { createHumanMarketingReviewService } from "@/lib/marketing/review/humanMarketingReviewService";
import { humanReviewErrorResponse } from "@/lib/marketing/review/apiErrors";
import { createHumanMarketingReviewRepository } from "@/lib/marketing/review/repository/createHumanMarketingReviewRepository";
import { recordManualMarketingPublicationSchema } from "@/lib/marketing/review/validation";
import {
  MarketingPublicationError,
  MARKETING_PUBLICATION_ERROR_CODES,
} from "@/lib/marketing/social/publication/errors";
import {
  createManualMarketingPublicationBridge,
  MANUAL_PUBLICATION_METHOD,
} from "@/lib/marketing/social/publication/manualPublicationBridge";
import { createSocialRepository } from "@/lib/marketing/social/repository/createSocialRepository";

export const dynamic = "force-dynamic";

type RouteContext = { params: Promise<{ candidateId: string }> };

function publicationErrorResponse(error: unknown): Response {
  if (error instanceof MarketingPublicationError) {
    const status =
      error.code === MARKETING_PUBLICATION_ERROR_CODES.APPROVAL_REQUIRED ||
      error.code === MARKETING_PUBLICATION_ERROR_CODES.ACCOUNT_INACTIVE ||
      error.code === MARKETING_PUBLICATION_ERROR_CODES.CHANNEL_MISMATCH ||
      error.code === MARKETING_PUBLICATION_ERROR_CODES.INSUFFICIENT_EXTERNAL_EVIDENCE ||
      error.code === MARKETING_PUBLICATION_ERROR_CODES.INVALID_INPUT ||
      error.code === MARKETING_PUBLICATION_ERROR_CODES.REVIEW_MISMATCH
        ? 422
        : error.code === MARKETING_PUBLICATION_ERROR_CODES.ACCOUNT_REQUIRED
          ? 404
          : error.code === MARKETING_PUBLICATION_ERROR_CODES.CONFLICTING_REMOTE_IDENTITY
            ? 409
            : 400;
    return Response.json({ message: error.message, code: error.code }, { status });
  }
  return humanReviewErrorResponse(error);
}

/**
 * Canonical manual publication bridge.
 * Records external human-published evidence onto SocialPublication (published).
 * Never calls remote publish APIs or CredentialStore.
 */
export async function POST(request: Request, context: RouteContext) {
  const auth = await requireAdminPermission("settings.manage");
  if (!auth.ok) return auth.res;

  const { candidateId } = await context.params;
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return Response.json({ message: "invalid json" }, { status: 400 });
  }
  const parsed = recordManualMarketingPublicationSchema.safeParse(body);
  if (!parsed.success) {
    return Response.json({ message: "invalid payload", issues: parsed.error.issues }, { status: 400 });
  }

  try {
    const reviewedBy = auth.session.username ?? auth.session.adminUserId ?? null;
    const reviewService = await createHumanMarketingReviewService();
    const reviewRepo = await createHumanMarketingReviewRepository();
    const socialRepo = await createSocialRepository({ backend: "supabase" });
    const existingReview = await reviewRepo.findByCandidateId(candidateId);

    const bridge = createManualMarketingPublicationBridge({
      repository: socialRepo,
      loadHumanReview: async () => existingReview,
      persistManualReviewPublication: async ({ candidateId: id, manualPublication }) =>
        reviewService.markManuallyPublished({
          candidateId: id,
          manualPublication,
          humanNotes: parsed.data.humanNotes,
          reviewedBy,
        }),
    });

    const result = await bridge.recordManualMarketingPublication({
      candidateId,
      humanReviewId: parsed.data.humanReviewId,
      socialAccountId: parsed.data.socialAccountId,
      channel: parsed.data.channel,
      externalPostId: parsed.data.externalPostId,
      externalUrl: parsed.data.externalUrl,
      publishedAt: parsed.data.publishedAt,
      notes: parsed.data.notes,
    });

    return Response.json({
      publicationId: result.publication.id,
      status: result.publication.status,
      provider: result.publication.provider,
      channel: result.publication.channel,
      socialAccountId: result.publication.socialAccountId,
      externalPostId: result.publication.externalPostId,
      externalUrl: result.publication.externalUrl,
      publishedAt: result.publication.publishedAt,
      humanApprovalRef: result.humanApprovalRef,
      provenance: MANUAL_PUBLICATION_METHOD,
      publicationMethod: result.provenance.publicationMethod,
      hermesCreatedRemotePost: result.provenance.hermesCreatedRemotePost,
      created: result.created,
      reused: result.reused,
      updated: result.updated,
      reviewId: result.review.reviewId,
      reviewStatus: result.review.status,
    });
  } catch (error) {
    return publicationErrorResponse(error);
  }
}
