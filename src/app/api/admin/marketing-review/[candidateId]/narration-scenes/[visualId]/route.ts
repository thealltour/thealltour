import { requireAdminPermission } from "@/lib/apiAuth";
import { loadSceneApiContext, sceneApiError } from "@/lib/marketing/publishable/narrationScenes/apiContext";
import { requireFreshScenePlan } from "@/lib/marketing/publishable/narrationScenes/service";
import { verifySceneAsset } from "@/lib/marketing/publishable/narrationScenes/assets";
export const dynamic = "force-dynamic";
export async function GET(request: Request, context: { params: Promise<{ candidateId: string; visualId: string }> }) {
  const auth = await requireAdminPermission("settings.manage"); if (!auth.ok) return auth.res;
  try {
    const { candidateId, visualId } = await context.params; const { root } = await loadSceneApiContext(candidateId, false);
    const plan = requireFreshScenePlan(root, candidateId, new URL(request.url).searchParams.get("planFingerprint") ?? "");
    const { bytes } = verifySceneAsset(root, plan, visualId);
    requireFreshScenePlan(root, candidateId, plan.fingerprint);
    return new Response(new Uint8Array(bytes), { headers: { "Content-Type": "image/png", "Cache-Control": "no-store" } });
  } catch (error) { return sceneApiError(error); }
}
