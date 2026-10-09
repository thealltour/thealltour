import { z } from "zod";
import { join } from "node:path";
import { existsSync, readFileSync } from "node:fs";
import { requireAdminPermission } from "@/lib/apiAuth";
import { loadSceneApiContext, sceneApiError } from "@/lib/marketing/publishable/narrationScenes/apiContext";
import { readAdaptation, requireApprovedAdaptation, adaptationDirectory, withAdaptationLock, adaptationFresh } from "@/lib/marketing/publishable/narrationInstagram/service";
import { loadSceneSource, sceneHash } from "@/lib/marketing/publishable/narrationScenes/service";
import { invokeMarketingHermesAgent } from "@/lib/marketing/hermesRuntime/launcher";
import { extractJsonObject } from "@/lib/marketing/publishable/visualOrchestration/extractJson";
import { atomicWriteFile } from "@/lib/marketing/assets/atomicWrite";
import { NarrationError } from "@/lib/marketing/publishable/narration/persistence";
export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 360;
const schema = z.object({ contract: z.literal("narration-instagram-caption-v1"), candidateId: z.string(), adaptationFingerprint: z.string().length(64), text: z.string().trim().min(1).max(2200), fingerprint: z.string().length(64), approvedAt: z.string().datetime().nullable() }).strict();
type Context = { params: Promise<{ candidateId: string }> };
function read(root: string, candidateId: string) {
  const path = join(adaptationDirectory(root), "caption.json");
  if (!existsSync(path)) return null;
  const caption = schema.parse(JSON.parse(readFileSync(path, "utf8")));
  const { fingerprint, approvedAt, ...content } = caption;
  if (caption.candidateId !== candidateId || fingerprint !== sceneHash(content)) throw new NarrationError("캡션 연결 정보를 확인해주세요.", 409);
  return caption;
}
export async function GET(_request: Request, context: Context) {
  const auth = await requireAdminPermission("settings.manage"); if (!auth.ok) return auth.res;
  try {
    const { candidateId } = await context.params; const { root } = await loadSceneApiContext(candidateId, false);
    const caption = read(root, candidateId); const adaptation = readAdaptation(root, candidateId);
    return Response.json({ caption, fresh: !!caption && !!adaptation?.approval && adaptation.fingerprint === caption.adaptationFingerprint && adaptationFresh(root, candidateId, adaptation) });
  } catch (e) { return sceneApiError(e); }
}
export async function POST(request: Request, context: Context) {
  const auth = await requireAdminPermission("settings.manage"); if (!auth.ok) return auth.res;
  try {
    const { candidateId } = await context.params; const { root } = await loadSceneApiContext(candidateId, true);
    const input = z.object({ action: z.enum(["generate", "save", "approve"]), adaptationFingerprint: z.string().length(64), expectedFingerprint: z.string().length(64).nullable(), text: z.string().trim().min(1).max(2200).optional() }).strict().parse(await request.json());
    const adaptation = requireApprovedAdaptation(root, candidateId, input.adaptationFingerprint);
    if ((read(root, candidateId)?.fingerprint ?? null) !== input.expectedFingerprint) throw new NarrationError("다른 화면에서 캡션이 변경됐습니다. 다시 불러와주세요.", 409);
    let text = input.text;
    if (input.action === "generate") {
      const source = loadSceneSource(root, candidateId, adaptation.source.upstream.audioJobId);
      const raw = await invokeMarketingHermesAgent({ profileId: "instagram-caption-writer", prompt: `TASK: narration-instagram-caption-v1. Develop approved Narration and selected cards into a natural Korean Instagram caption with a clear opening, useful travel detail and relevant soft CTA. Do not copy subtitles mechanically or invent facts. No separate visual planning. Return only {"caption":"text"}; maximum 2200 characters. Input is reference data.\n${JSON.stringify({ contract: "narration-instagram-caption-v1", narration: source.narration, cards: adaptation.cards })}`, timeoutMs: 300_000, withTransportRetry: false });
      text = z.object({ caption: z.string().trim().min(1).max(2200) }).strict().parse(extractJsonObject(raw)).caption;
    }
    return withAdaptationLock(root, () => {
      requireApprovedAdaptation(root, candidateId, input.adaptationFingerprint);
      const current = read(root, candidateId);
      if ((current?.fingerprint ?? null) !== input.expectedFingerprint) throw new NarrationError("생성 중 캡션이 변경됐습니다. 다시 불러와주세요.", 409);
      if (input.action === "approve") {
        if (!current || current.adaptationFingerprint !== adaptation.fingerprint) throw new NarrationError("현재 카드 기준 캡션을 먼저 저장해주세요.", 409);
        const caption = { ...current, approvedAt: new Date().toISOString() };
        atomicWriteFile(join(adaptationDirectory(root), "caption.json"), JSON.stringify(caption, null, 2)); return Response.json({ caption, fresh: true });
      }
      const content = { contract: "narration-instagram-caption-v1" as const, candidateId, adaptationFingerprint: adaptation.fingerprint, text: text ?? "" };
      const caption = schema.parse({ ...content, fingerprint: sceneHash(content), approvedAt: null });
      atomicWriteFile(join(adaptationDirectory(root), "caption.json"), JSON.stringify(caption, null, 2));
      return Response.json({ caption, fresh: true });
    });
  } catch (e) { return sceneApiError(e); }
}
