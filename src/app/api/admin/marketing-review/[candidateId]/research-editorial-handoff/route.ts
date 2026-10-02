import { requireAdminPermission } from "@/lib/apiAuth";
import { z } from "zod";
import { createHumanMarketingReviewService } from "@/lib/marketing/review/humanMarketingReviewService";
import { humanReviewErrorResponse } from "@/lib/marketing/review/apiErrors";
import { serializeEditorialResearchHandoff } from "@/lib/marketing/editorialDirector/researchHandoff";
import { buildEditorialResearchHandoffForCandidate } from "@/lib/marketing/editorialDirector/researchHandoff/loadResearchHandoffSource";

export const dynamic = "force-dynamic";

const bodySchema = z.object({
  canonicalLockedTerms: z.array(z.string().max(200)).max(100).optional(),
});

type RouteContext = { params: Promise<{ candidateId: string }> };

/**
 * Build editorial-research-bundle-chatgpt-handoff-v1 clipboard text for an approved Canonical.
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

    const result = buildEditorialResearchHandoffForCandidate({
      candidate: detail.candidate,
      canonicalLockedTerms: parsed.data.canonicalLockedTerms,
    });
    if (!result.ok) {
      return Response.json(
        { message: result.messageKo, code: result.code },
        { status: result.code === "canonical_asset_missing" ? 404 : 409 },
      );
    }

    const { payload } = result;
    return Response.json({
      text: serializeEditorialResearchHandoff(payload),
      contract: payload.contract,
      candidateId: payload.candidateId,
      assetId: payload.assetId,
      canonicalVersion: payload.canonicalVersion,
      sourceRevision: payload.sourceRevision,
      researchContextAvailable: payload.researchContext.available,
      message: payload.researchContext.available
        ? "Research 검증용 JSON을 만들었습니다. ChatGPT에는 research 결과만 요청합니다."
        : "Research 검증용 JSON을 만들었습니다. 연결된 내부 리서치가 없어 researchContext는 비어 있습니다.",
    });
  } catch (error) {
    return humanReviewErrorResponse(error);
  }
}
