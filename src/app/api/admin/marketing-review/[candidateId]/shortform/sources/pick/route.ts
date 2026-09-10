import { requireAdminPermission } from "@/lib/apiAuth";
import {
  pickShortformSourceForReview,
  shortformSourceReviewErrorResponse,
  ShortformSourceReviewError,
} from "@/lib/marketing/assets/shortform/review/service";

export const dynamic = "force-dynamic";

type RouteContext = { params: Promise<{ candidateId: string }> };

/**
 * Explicit human PICK for a scene.
 * External: registerExternalSource(external_ref) + setScenePick. No binary ingest.
 */
export async function POST(request: Request, context: RouteContext) {
  const auth = await requireAdminPermission("settings.manage");
  if (!auth.ok) return auth.res;

  const { candidateId } = await context.params;
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return Response.json(
      { message: "JSON body required", code: "INVALID_PAYLOAD" },
      { status: 400, headers: { "Cache-Control": "no-store" } },
    );
  }

  const sceneId =
    typeof body === "object" && body && "sceneId" in body && typeof (body as { sceneId: unknown }).sceneId === "string"
      ? (body as { sceneId: string }).sceneId.trim()
      : "";
  const selectionToken =
    typeof body === "object" &&
    body &&
    "selectionToken" in body &&
    typeof (body as { selectionToken: unknown }).selectionToken === "string"
      ? (body as { selectionToken: string }).selectionToken.trim()
      : "";

  if (!sceneId || !selectionToken) {
    return Response.json(
      { message: "sceneId와 selectionToken이 필요합니다.", code: "INVALID_PAYLOAD" },
      { status: 400, headers: { "Cache-Control": "no-store" } },
    );
  }

  try {
    const result = await pickShortformSourceForReview({
      candidateId,
      sceneId,
      selectionToken,
    });
    return Response.json(
      {
        ok: true,
        ...result,
        message: result.replaced ? "장면 소스를 교체했습니다." : "장면에 소스를 선택했습니다.",
      },
      { headers: { "Cache-Control": "no-store" } },
    );
  } catch (error) {
    if (error instanceof ShortformSourceReviewError) {
      return shortformSourceReviewErrorResponse(error);
    }
    return shortformSourceReviewErrorResponse(error);
  }
}
