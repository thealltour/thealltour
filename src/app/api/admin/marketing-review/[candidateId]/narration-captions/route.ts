import { z } from "zod";
import { requireAdminPermission } from "@/lib/apiAuth";
import { loadSceneApiContext, sceneApiError } from "@/lib/marketing/publishable/narrationScenes/apiContext";
import { captionBulkApprovalSchema, captionMutationSchema } from "@/lib/marketing/publishable/narrationShortform/captionContracts";
import { bulkApproveCaptionPlan, captionPlanView, mutateCaptionPlan } from "@/lib/marketing/publishable/narrationShortform/captionPlan";
import { alignmentView, queueCaptionAlignment } from "@/lib/marketing/publishable/narrationShortform/captionAlignment";
import { currentCaptionPreviewJobId, requireCaptionPreviewFor } from "@/lib/marketing/publishable/narrationShortform/motionService";
import { NarrationError } from "@/lib/marketing/publishable/narration/persistence";
export const dynamic = "force-dynamic";
export const runtime = "nodejs";
type Context = { params: Promise<{ candidateId: string }> };
const alignRequestSchema = z.object({ action: z.literal("align"), expectedInputFingerprint: z.string().regex(/^[a-f0-9]{64}$/).nullable() }).strict();
function view(root: string, candidateId: string, canEdit: boolean) {
  const caption = captionPlanView(root, candidateId);
  return { ...caption, alignment: alignmentView(root, candidateId), previewJobId: currentCaptionPreviewJobId(root, candidateId, caption.plan?.fingerprint ?? null), canEdit };
}
export async function GET(_request: Request, context: Context) {
  const auth = await requireAdminPermission("settings.manage"); if (!auth.ok) return auth.res;
  try { const { candidateId } = await context.params; const { root, canEdit } = await loadSceneApiContext(candidateId, false); return Response.json(view(root, candidateId, canEdit)); }
  catch (error) { return sceneApiError(error); }
}
export async function POST(request: Request, context: Context) {
  const auth = await requireAdminPermission("settings.manage"); if (!auth.ok) return auth.res;
  try {
    const { candidateId } = await context.params; const { root, canEdit } = await loadSceneApiContext(candidateId, true);
    const body: unknown = await request.json().catch(() => null);
    const align = alignRequestSchema.safeParse(body); const bulk = captionBulkApprovalSchema.safeParse(body);
    if (align.success) queueCaptionAlignment(root, candidateId, align.data.expectedInputFingerprint);
    else if (bulk.success) bulkApproveCaptionPlan(root, candidateId, bulk.data, plan => requireCaptionPreviewFor(root, candidateId, bulk.data.previewJobId, plan.fingerprint));
    else {
      const parsed = captionMutationSchema.safeParse(body); if (!parsed.success) throw new NarrationError("자막 cue 요청 형식을 확인해주세요.", 400);
      mutateCaptionPlan(root, candidateId, parsed.data);
    }
    return Response.json(view(root, candidateId, canEdit));
  } catch (error) { return sceneApiError(error); }
}
