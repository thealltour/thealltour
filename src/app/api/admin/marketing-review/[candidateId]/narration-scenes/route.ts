import { requireAdminPermission } from "@/lib/apiAuth";
import { loadSceneApiContext, sceneApiError } from "@/lib/marketing/publishable/narrationScenes/apiContext";
import { sceneMutationSchema } from "@/lib/marketing/publishable/narrationScenes/contracts";
import { readSceneHandoff, loadSceneSource, mutateScenePlan, readScenePlan, scenePlanFresh } from "@/lib/marketing/publishable/narrationScenes/service";
import { sceneAssetStatus, uploadSceneAsset } from "@/lib/marketing/publishable/narrationScenes/assets";
import { latestNarrationAudioJob } from "@/lib/marketing/publishable/narration/audio";
import { NarrationError } from "@/lib/marketing/publishable/narration/persistence";
import { MAX_SHARED_VISUAL_UPLOAD_BYTES } from "@/lib/marketing/publishable/sharedVisualAssets/paths";

import { z } from "zod";
import { workerRequestSchema, runSceneWorker, readSceneExchange, importSceneResult } from "@/lib/marketing/publishable/narrationScenes/workers";
export const runtime = "nodejs";
export const maxDuration = 360;
export const dynamic = "force-dynamic";
type Context = { params: Promise<{ candidateId: string }> };
export async function GET(request: Request, context: Context) {
  const auth = await requireAdminPermission("settings.manage"); if (!auth.ok) return auth.res;
  try {
    const { candidateId } = await context.params; const { root, canEdit } = await loadSceneApiContext(candidateId, false);
    const plan = readScenePlan(root);
    if (plan && plan.source.candidateId !== candidateId) throw new NarrationError("후보와 장면 계획이 일치하지 않습니다.", 409);
    const selectedJobId = new URL(request.url).searchParams.get("audioJobId");
    const audioJobId = selectedJobId ?? latestNarrationAudioJob(root, candidateId)?.jobId ?? plan?.source.audioJobId;
    let source: ReturnType<typeof loadSceneSource> | null = null;
    let sourceError: string | null = null;
    if (audioJobId) {
      try { source = loadSceneSource(root, candidateId, audioJobId); }
      catch (error) { if (selectedJobId) throw error; sourceError = error instanceof NarrationError ? error.message : "음성 작업을 다시 확인해주세요."; }
    }
    const fresh = !!plan && scenePlanFresh(root, candidateId, plan);
    return Response.json({ ...(plan && fresh && plan.approval ? readSceneExchange(root, candidateId, plan.fingerprint) : { astraRequest: null, astraResult: null }), plan, canEdit, source, sourceError, gateState: !plan ? "missing" : !fresh ? "stale" : plan.approval ? "approved" : "draft",
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
      if (!(file instanceof File) || file.size === 0) throw new NarrationError("업로드할 이미지 파일을 선택해주세요.", 400);
      if (file.size > MAX_SHARED_VISUAL_UPLOAD_BYTES) throw new NarrationError("이미지 용량은 최대 15MB입니다.", 400);
      const fit = form.get("fit");
      if (fit !== null && fit !== "contain") throw new NarrationError("이미지 비율 맞춤 방식을 확인해주세요.", 400);
      const asset = await uploadSceneAsset({ root, candidateId, visualId: String(form.get("visualId") ?? ""),
        planFingerprint: String(form.get("planFingerprint") ?? ""), handoffFingerprint: String(form.get("handoffFingerprint") ?? ""), bytes: Buffer.from(await file.arrayBuffer()), ...(fit === "contain" ? { fit: "contain" as const } : {}) });
      return Response.json({ asset });
    }
    const body = await request.json().catch(() => null);
    if (body?.action === "generate" || body?.action === "write-handoff") {
      const parsedWorker = workerRequestSchema.safeParse(body);
      if (!parsedWorker.success) throw new NarrationError("초안 생성 요청 형식을 확인해주세요.", 400);
      if (parsedWorker.data.action === "write-handoff") mutateScenePlan(root, candidateId, { ...parsedWorker.data, action: "handoff" });
      return Response.json(await runSceneWorker(root, candidateId, parsedWorker.data));
    }
    if (body?.action === "import-astra") {
      const parsedImport = z.object({ action: z.literal("import-astra"), planFingerprint: z.string().length(64), payload: z.unknown() }).strict().safeParse(body);
      if (!parsedImport.success) throw new NarrationError("Astra 결과 인입 형식을 확인해주세요.", 400);
      return Response.json(importSceneResult(root, candidateId, parsedImport.data.planFingerprint, parsedImport.data.payload));
    }
    const parsed = sceneMutationSchema.safeParse(body);
    if (!parsed.success) throw new NarrationError("장면 계획 요청 형식을 확인해주세요.", 400);
    return Response.json(mutateScenePlan(root, candidateId, parsed.data));
  } catch (error) { return sceneApiError(error); }
}
