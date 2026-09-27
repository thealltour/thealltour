import { requireAdminPermission } from "@/lib/apiAuth";
import {
  astraHandoffOperatorErrorResponse,
  rebindAstraHandoffSharedVisuals,
} from "@/lib/marketing/publishable/sharedVisualAssets/operatorService";

export const dynamic = "force-dynamic";

type RouteContext = { params: Promise<{ candidateId: string }> };

/** POST: bind previously uploaded Shared Visual files to the current Astra handoff (no re-upload). */
export async function POST(_request: Request, context: RouteContext) {
  const auth = await requireAdminPermission("settings.manage");
  if (!auth.ok) return auth.res;

  const { candidateId } = await context.params;
  try {
    const result = await rebindAstraHandoffSharedVisuals({ candidateId });
    return Response.json(
      {
        ok: true,
        reboundVisualIds: result.reboundVisualIds,
        uploadStatus: result.uploadStatus,
        message: `기존 업로드 이미지 ${result.reboundVisualIds.length}개를 현재 Astra 요청문에 연결했습니다. 카드뉴스를 다시 렌더하면 반영됩니다.`,
      },
      { headers: { "Cache-Control": "no-store" } },
    );
  } catch (error) {
    return astraHandoffOperatorErrorResponse(error);
  }
}
