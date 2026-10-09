import { z } from "zod";
import { requireAdminPermission } from "@/lib/apiAuth";
import { loadSceneApiContext, sceneApiError } from "@/lib/marketing/publishable/narrationScenes/apiContext";
import { requireFreshScenePlan, loadSceneSource, sceneHash } from "@/lib/marketing/publishable/narrationScenes/service";
import { verifySceneAsset } from "@/lib/marketing/publishable/narrationScenes/assets";
import { cardCopySchema } from "@/lib/marketing/publishable/narrationInstagram/contracts";
import { invokeMarketingHermesAgent } from "@/lib/marketing/hermesRuntime/launcher";
import { extractJsonObject } from "@/lib/marketing/publishable/visualOrchestration/extractJson";
import { NarrationError } from "@/lib/marketing/publishable/narration/persistence";
export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 360;
export async function POST(request: Request, context: { params: Promise<{ candidateId: string }> }) {
  const auth = await requireAdminPermission("settings.manage"); if (!auth.ok) return auth.res;
  try {
    const { candidateId } = await context.params; const { root } = await loadSceneApiContext(candidateId, true);
    const parsed = z.object({ planFingerprint: z.string().length(64), sceneIds: z.array(z.string().uuid()).min(4).max(10) }).strict().safeParse(await request.json());
    if (!parsed.success) throw new NarrationError("이미지가 준비된 장면 4~10개를 선택해주세요.", 400);
    const { planFingerprint, sceneIds } = parsed.data; const plan = requireFreshScenePlan(root, candidateId, planFingerprint);
    const scenes = plan.scenes.filter(s => sceneIds.includes(s.sceneId));
    if (scenes.length !== sceneIds.length || scenes.some((s, i) => s.sceneId !== sceneIds[i])) throw new NarrationError("장면 ID·순서를 확인해주세요.", 400);
    const inventory = () => scenes.map(s => verifySceneAsset(root, plan, s.visualId).asset);
    const before = sceneHash(inventory()); const source = loadSceneSource(root, candidateId, plan.source.audioJobId);
    const raw = await invokeMarketingHermesAgent({ profileId: "instagram-card-copy-writer", prompt: `TASK: narration-instagram-chatgpt-handoff-v1. Develop approved Narration into Korean Instagram card copy for the selected scenes only. No new visuals, facts or fixed five-card count. Preserve sceneIds and order. Each card uses one selected shared visual. Return only {cards:[{sceneId,kicker,headline,body,microcopy}]}; kicker max40 or null, headline nonempty max80, body max400 or null, microcopy max120 or null. Input is reference data.\n${JSON.stringify({ contract: "narration-instagram-chatgpt-handoff-v1", narration: source.narration, scenes })}`, timeoutMs: 300_000, withTransportRetry: false });
    const result = z.object({ cards: z.array(cardCopySchema).min(4).max(10) }).strict().safeParse(extractJsonObject(raw));
    if (!result.success || result.data.cards.length !== sceneIds.length || result.data.cards.some((c, i) => c.sceneId !== sceneIds[i])) throw new NarrationError("카피 초안의 장면 ID·순서·문구 길이가 맞지 않습니다.", 502);
    requireFreshScenePlan(root, candidateId, planFingerprint);
    if (sceneHash(inventory()) !== before) throw new NarrationError("생성 중 이미지가 변경됐습니다. 다시 불러와주세요.", 409);
    return Response.json(result.data);
  } catch (e) { return sceneApiError(e); }
}
