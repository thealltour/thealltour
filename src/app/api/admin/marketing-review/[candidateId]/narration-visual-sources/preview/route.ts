import { z } from "zod";
import { requireAdminPermission } from "@/lib/apiAuth";
import { loadSceneApiContext, sceneApiError } from "@/lib/marketing/publishable/narrationScenes/apiContext";
import { NarrationError } from "@/lib/marketing/publishable/narration/persistence";
import { stockProviderSchema, providerVideoIdSchema } from "@/lib/marketing/publishable/narrationVisualSources/contracts";
import { proxyStockPreview, storedPreviewUrl } from "@/lib/marketing/publishable/narrationVisualSources/preview";
export const dynamic = "force-dynamic";
const querySchema = z.object({ planFingerprint: z.string().regex(/^[a-f0-9]{64}$/), visualId: z.string().uuid(), provider: stockProviderSchema, videoId: providerVideoIdSchema }).strict();
export async function GET(request: Request, context: { params: Promise<{ candidateId: string }> }) {
  const auth = await requireAdminPermission("settings.manage"); if (!auth.ok) return auth.res;
  try {
    const { candidateId } = await context.params; const { root } = await loadSceneApiContext(candidateId, false);
    const query = querySchema.safeParse(Object.fromEntries(new URL(request.url).searchParams));
    if (!query.success) throw new NarrationError("미리보기 요청을 확인해주세요.", 400);
    return await proxyStockPreview(storedPreviewUrl(root, candidateId, query.data), query.data.provider, request.headers.get("range"));
  } catch (error) { return sceneApiError(error); }
}
