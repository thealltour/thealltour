import { requireAdminPermission } from "@/lib/apiAuth";
import { loadSceneApiContext, sceneApiError } from "@/lib/marketing/publishable/narrationScenes/apiContext";
import { sceneMutationSchema } from "@/lib/marketing/publishable/narrationScenes/contracts";
import { readSceneHandoff, loadSceneSource, mutateScenePlan, readScenePlan, scenePlanFresh } from "@/lib/marketing/publishable/narrationScenes/service";
import { sceneAssetStatus, uploadSceneAsset } from "@/lib/marketing/publishable/narrationScenes/assets";
import { NarrationError } from "@/lib/marketing/publishable/narration/persistence";
import { MAX_SHARED_VISUAL_UPLOAD_BYTES } from "@/lib/marketing/publishable/sharedVisualAssets/paths";

export const dynamic = "force-dynamic";
type Context = { params: Promise<{ candidateId: string }> };
export async function GET(request: Request, context: Context) {
  const auth = await requireAdminPermission("settings.manage"); if (!auth.ok) return auth.res;
  try {
    const { candidateId } = await context.params; const { root, canEdit } = await loadSceneApiContext(candidateId, false);
    const plan = readScenePlan(root);
    if (plan && plan.source.candidateId !== candidateId) throw new NarrationError("후보와 장면 계획이 일치하지 않습니다.", 409);
    const selectedJobId = new URL(request.url).searchParams.get("audioJobId");
    const audioJobId = selectedJobId ?? plan?.source.audioJobId;
    let source: ReturnType<typeof loadSceneSource> | null = null;
    let sourceError: string | null = null;
    if (audioJobId) {
      try { source = loadSceneSource(root, candidateId, audioJobId); }
      catch (error) { if (selectedJobId) throw error; sourceError = error instanceof NarrationError ? error.message : "음성 작업을 다시 확인해주세요."; }
    }
    const fresh = !!plan && scenePlanFresh(root, candidateId, plan);
    return Response.json({ plan, canEdit, source, sourceError, gateState: !plan ? "missing" : !fresh ? "stale" : plan.approval ? "approved" : "draft",
      handoff: plan && fresh && plan.approval ? readSceneHandoff(root, plan) : null,
      uploads: plan && fresh && plan.approval ? sceneAssetStatus(root, plan) : null });
  } catch (error) { return sceneApiError(error); }
}
export async function POST(request: Request, context: Context) {
  const auth = await requireAdminPermission("settings.manage"); if (!auth.ok) return auth.res;
  try {
    const { candidateId } = await context.params; const { root } = await loadSceneApiContext(candidateId, true);
    if (request.headers.get("content-type")?.includes("multipart/form-data")) {
      const form = await request.formData(); const file = form.get("file");
      if (!(file instanceof File) || file.size > MAX_SHARED_VISUAL_UPLOAD_BYTES) throw new NarrationError("업로드 이미지와 용량을 확인해주세요.", 400);
      const asset = await uploadSceneAsset({ root, candidateId, visualId: String(form.get("visualId") ?? ""),
        planFingerprint: String(form.get("planFingerprint") ?? ""), handoffFingerprint: String(form.get("handoffFingerprint") ?? ""), bytes: Buffer.from(await file.arrayBuffer()) });
      return Response.json({ asset });
    }
    const parsed = sceneMutationSchema.safeParse(await request.json().catch(() => null));
    if (!parsed.success) throw new NarrationError("장면 계획 요청 형식을 확인해주세요.", 400);
    return Response.json(mutateScenePlan(root, candidateId, parsed.data));
  } catch (error) { return sceneApiError(error); }
}
