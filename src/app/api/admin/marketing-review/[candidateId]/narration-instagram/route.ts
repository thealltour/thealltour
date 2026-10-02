import { requireAdminPermission } from "@/lib/apiAuth";
import { loadSceneApiContext, sceneApiError } from "@/lib/marketing/publishable/narrationScenes/apiContext";
import { NarrationError } from "@/lib/marketing/publishable/narration/persistence";
import { instagramMutationSchema } from "@/lib/marketing/publishable/narrationInstagram/contracts";
import { loadAdaptationView, mutateAdaptation, requireApprovedAdaptation } from "@/lib/marketing/publishable/narrationInstagram/service";
import { readAdaptationRender, renderAdaptation } from "@/lib/marketing/publishable/narrationInstagram/render";
export const dynamic = "force-dynamic";
type Context = { params: Promise<{ candidateId: string }> };
export async function GET(_request: Request, context: Context) {
  const auth = await requireAdminPermission("settings.manage"); if (!auth.ok) return auth.res;
  try {
    const { candidateId } = await context.params; const { root, canEdit } = await loadSceneApiContext(candidateId, false);
    const view = loadAdaptationView(root, candidateId);
    let rendered: ReturnType<typeof readAdaptationRender> = null; let renderError: string | null = null;
    if (view.adaptation && view.gateState === "approved") {
      try { rendered = readAdaptationRender(root, candidateId, view.adaptation.fingerprint); }
      catch { renderError = "렌더 파일이 없거나 변경되었습니다. 다시 렌더해주세요."; }
    }
    return Response.json({ ...view, canEdit, rendered, renderError });
  } catch (error) { return sceneApiError(error); }
}
export async function POST(request: Request, context: Context) {
  const auth = await requireAdminPermission("settings.manage"); if (!auth.ok) return auth.res;
  try {
    const { candidateId } = await context.params; const { root } = await loadSceneApiContext(candidateId, true);
    const parsed = instagramMutationSchema.safeParse(await request.json().catch(() => null));
    if (!parsed.success) throw new NarrationError("카드 4~10장과 현재 revision 정보를 확인해주세요.", 400);
    if (parsed.data.action === "render") {
      const value = requireApprovedAdaptation(root, candidateId, parsed.data.expectedFingerprint ?? "");
      if (value.revision !== parsed.data.expectedRevision || value.source.scenePlanFingerprint !== parsed.data.expectedScenePlanFingerprint) throw new NarrationError("렌더 요청의 장면·카드 revision이 다릅니다.");
      return Response.json({ rendered: await renderAdaptation(root, candidateId, value.fingerprint) });
    }
    return Response.json(mutateAdaptation(root, candidateId, parsed.data));
  } catch (error) { return sceneApiError(error); }
}
