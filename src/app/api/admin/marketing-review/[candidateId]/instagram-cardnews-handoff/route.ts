import { requireAdminPermission } from "@/lib/apiAuth";
import { z } from "zod";
import { createHumanMarketingReviewService } from "@/lib/marketing/review/humanMarketingReviewService";
import { humanReviewErrorResponse } from "@/lib/marketing/review/apiErrors";
import { serializeInstagramCardnewsHandoff } from "@/lib/marketing/editorialDirector/instagramCardnewsHandoff";
import { buildInstagramCardnewsHandoffForCandidate } from "@/lib/marketing/editorialDirector/instagramCardnewsHandoff/loadInstagramCardnewsHandoffSource";

export const dynamic = "force-dynamic";

const bodySchema = z.object({
  canonicalLockedTerms: z.array(z.string().max(200)).max(100).optional(),
});

type RouteContext = { params: Promise<{ candidateId: string }> };

/**
 * Build instagram-cardnews-chatgpt-handoff-v1 clipboard text for an approved Canonical.
 * Does not call OpenAI and does not persist anything — returns text for human paste.
 */
export async function POST(request: Request, context: RouteContext) {
  const auth = await requireAdminPermission("settings.manage");
  if (!auth.ok) return auth.res;

  const { candidateId } = await context.params;
  let body: unknown = {};
  try {
    body = await request.json();
  } catch {
    body = {};
  }
  const parsed = bodySchema.safeParse(body ?? {});
  if (!parsed.success) {
    return Response.json({ message: "요청 형식이 올바르지 않습니다." }, { status: 400 });
  }

  try {
    const service = await createHumanMarketingReviewService();
    const detail = await service.getHumanReviewDetail(candidateId);
    if (!detail?.candidate) {
      return Response.json({ message: "후보를 찾을 수 없습니다." }, { status: 404 });
    }

    const result = buildInstagramCardnewsHandoffForCandidate({
      candidate: detail.candidate,
      canonicalLockedTerms: parsed.data.canonicalLockedTerms,
    });
    if (!result.ok) {
      return Response.json(
        { message: result.messageKo, code: result.code },
        { status: result.code === "canonical_asset_missing" ? 404 : 409 },
      );
    }

    const { payload, warnings } = result;
    return Response.json({
      text: serializeInstagramCardnewsHandoff(payload),
      contract: payload.contract,
      candidateId: payload.candidateId,
      assetId: payload.assetId,
      canonicalVersion: payload.canonicalVersion,
      sourceRevision: payload.sourceRevision,
      researchApplied: payload.researchApplied,
      warnings,
      message: `Instagram 카드뉴스용 JSON을 만들었습니다 (승인본 v${payload.canonicalVersion}).`,
    });
  } catch (error) {
    return humanReviewErrorResponse(error);
  }
}
