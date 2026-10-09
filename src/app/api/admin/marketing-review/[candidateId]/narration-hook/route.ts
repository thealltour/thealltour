import { requireAdminPermission } from "@/lib/apiAuth";
import { loadSceneApiContext, sceneApiError } from "@/lib/marketing/publishable/narrationScenes/apiContext";
import { mutateOpeningHook, openingHookMutationSchema, openingHookView } from "@/lib/marketing/publishable/narration/openingHook";
import { NarrationError } from "@/lib/marketing/publishable/narration/persistence";
export const dynamic = "force-dynamic";
export const runtime = "nodejs";
type Context = { params: Promise<{ candidateId: string }> };
export async function GET(_request: Request, context: Context) {
  const auth = await requireAdminPermission("settings.manage"); if (!auth.ok) return auth.res;
  try { const { candidateId } = await context.params; const { root, canEdit } = await loadSceneApiContext(candidateId, false); return Response.json({ ...openingHookView(root, candidateId), canEdit }); }
  catch (error) { return sceneApiError(error); }
}
export async function POST(request: Request, context: Context) {
  const auth = await requireAdminPermission("settings.manage"); if (!auth.ok) return auth.res;
  try {
    const { candidateId } = await context.params; const { root, canEdit } = await loadSceneApiContext(candidateId, true);
    const parsed = openingHookMutationSchema.safeParse(await request.json().catch(() => null)); if (!parsed.success) throw new NarrationError("도입 문구 요청 형식을 확인해주세요.", 400);
    mutateOpeningHook(root, candidateId, parsed.data); return Response.json({ ...openingHookView(root, candidateId), canEdit });
  } catch (error) { return sceneApiError(error); }
}
