import { readFileSync } from "node:fs";
import { requireAdminPermission } from "@/lib/apiAuth";
import { resolvePackageArtifactPath } from "@/lib/marketing/assets/paths";
import { loadSceneApiContext, sceneApiError } from "@/lib/marketing/publishable/narrationScenes/apiContext";
import { readAdaptationRender } from "@/lib/marketing/publishable/narrationInstagram/render";
import { requireApprovedAdaptation } from "@/lib/marketing/publishable/narrationInstagram/service";
import { NarrationError } from "@/lib/marketing/publishable/narration/persistence";
export const dynamic = "force-dynamic";
export async function GET(request: Request, context: { params: Promise<{ candidateId: string; cardId: string }> }) {
  const auth = await requireAdminPermission("settings.manage"); if (!auth.ok) return auth.res;
  try {
    const { candidateId, cardId } = await context.params; const { root } = await loadSceneApiContext(candidateId, false);
    const fingerprint = new URL(request.url).searchParams.get("fingerprint") ?? "";
    const card = readAdaptationRender(root, candidateId, fingerprint)?.cards.find(c => c.cardId === cardId);
    if (!card) throw new NarrationError("렌더 카드를 찾을 수 없습니다.", 404);
    const bytes = readFileSync(resolvePackageArtifactPath({ packageRoot: root, relativePath: card.relativePath }));
    requireApprovedAdaptation(root, candidateId, fingerprint);
    return new Response(new Uint8Array(bytes), { headers: { "Content-Type": "image/png", "Cache-Control": "no-store" } });
  } catch (error) { return sceneApiError(error); }
}
