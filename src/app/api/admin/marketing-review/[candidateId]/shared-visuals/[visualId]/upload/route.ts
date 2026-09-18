import { requireAdminPermission } from "@/lib/apiAuth";
import {
  astraHandoffOperatorErrorResponse,
  uploadAstraHandoffSharedVisual,
} from "@/lib/marketing/publishable/sharedVisualAssets/operatorService";

export const dynamic = "force-dynamic";

type RouteContext = { params: Promise<{ candidateId: string; visualId: string }> };

/**
 * POST multipart upload for a Shared Visual slot (visualId authoritative).
 * Form field: "file"
 */
export async function POST(request: Request, context: RouteContext) {
  const auth = await requireAdminPermission("settings.manage");
  if (!auth.ok) return auth.res;

  const { candidateId, visualId } = await context.params;

  let formData: FormData;
  try {
    formData = await request.formData();
  } catch {
    return Response.json(
      { message: "multipart/form-data가 필요합니다.", code: "invalid_form" },
      { status: 400, headers: { "Cache-Control": "no-store" } },
    );
  }

  const file = formData.get("file");
  if (!(file instanceof File)) {
    return Response.json(
      { message: "file 필드가 필요합니다.", code: "missing_file" },
      { status: 400, headers: { "Cache-Control": "no-store" } },
    );
  }

  try {
    const bytes = Buffer.from(await file.arrayBuffer());
    const result = await uploadAstraHandoffSharedVisual({
      candidateId,
      visualId,
      bytes,
      clientFilename: file.name,
    });
    return Response.json(
      {
        ok: true,
        visualId: result.asset.visualId,
        asset: result.asset,
        uploadStatus: result.uploadStatus,
        handoffStale: result.handoffStale,
        message: "이미지를 업로드했습니다.",
      },
      { headers: { "Cache-Control": "no-store" } },
    );
  } catch (error) {
    return astraHandoffOperatorErrorResponse(error);
  }
}
