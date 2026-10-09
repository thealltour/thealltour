import { requireAdminPermission } from "@/lib/apiAuth";
import { loadSceneApiContext, sceneApiError } from "@/lib/marketing/publishable/narrationScenes/apiContext";
import { motionMutationSchema } from "@/lib/marketing/publishable/narrationMotion/contracts";
import { motionView, saveMotionSettings, queueMotionJobs, approveMotionJobs } from "@/lib/marketing/publishable/narrationMotion/service";
import { NarrationError } from "@/lib/marketing/publishable/narration/persistence";
export const dynamic = "force-dynamic";
type Context = { params: Promise<{ candidateId: string }> };
export async function GET(_request: Request, context: Context) {
  const auth = await requireAdminPermission("settings.manage"); if (!auth.ok) return auth.res;
  try { const { candidateId } = await context.params; const { root, canEdit } = await loadSceneApiContext(candidateId, false);
    return Response.json({ ...motionView(root, candidateId), canEdit });
  } catch (error) { return sceneApiError(error); }
}
export async function POST(request: Request, context: Context) {
  const auth = await requireAdminPermission("settings.manage"); if (!auth.ok) return auth.res;
  try {
    const { candidateId } = await context.params; const { root } = await loadSceneApiContext(candidateId, true);
    const input = motionMutationSchema.safeParse(await request.json().catch(() => null));
    if (!input.success) throw new NarrationError("모션 요청 형식을 확인해주세요.", 400);
    const data = input.data;
    if (data.action === "save") saveMotionSettings(root, candidateId, data.expectedPlanFingerprint, data.expectedSettingsFingerprint, data.scenes);
    else if (data.action === "generate") queueMotionJobs(root, candidateId, data.expectedPlanFingerprint, data.expectedSettingsFingerprint, data.visualIds);
    else approveMotionJobs(root, candidateId, data.expectedPlanFingerprint, data.expectedSettingsFingerprint, data.jobs);
    return Response.json({ ...motionView(root, candidateId), canEdit: true }, { status: data.action === "generate" ? 202 : 200 });
  } catch (error) { return sceneApiError(error); }
}
