import { z } from "zod";
import { requireAdminPermission } from "@/lib/apiAuth";
import { loadSceneApiContext, sceneApiError } from "@/lib/marketing/publishable/narrationScenes/apiContext";
import { readScenePlan, requireFreshScenePlan } from "@/lib/marketing/publishable/narrationScenes/service";
import { sceneAssetStatus } from "@/lib/marketing/publishable/narrationScenes/assets";
import { queueShortformJob, readShortformJob, shortformJobFresh, requireFreshShortformOutput } from "@/lib/marketing/publishable/narrationShortform/service";
import { SHORTFORM_RENDER_CONFIG, type NarrationShortformJob } from "@/lib/marketing/publishable/narrationShortform/contracts";
import { NarrationError } from "@/lib/marketing/publishable/narration/persistence";
export const dynamic = "force-dynamic";
type Context = { params: Promise<{ candidateId: string }> };
export async function GET(request: Request, context: Context) {
  const auth = await requireAdminPermission("settings.manage"); if (!auth.ok) return auth.res;
  try {
    const { candidateId } = await context.params; const { root, canEdit } = await loadSceneApiContext(candidateId, false);
    const jobId = new URL(request.url).searchParams.get("jobId");
    const plan = readScenePlan(root); let ready = false;
    if (plan && plan.source.candidateId !== candidateId) throw new NarrationError("후보와 장면 계획이 일치하지 않습니다.", 409);
    try { if (plan) { requireFreshScenePlan(root, candidateId, plan.fingerprint); ready = sceneAssetStatus(root, plan).complete; } } catch { /* No usable render source. */ }
    if (!jobId) return Response.json({ ready, canEdit, planFingerprint: plan?.fingerprint ?? null, sceneCount: plan?.scenes.length ?? 0,
      totalDurationMs: ready ? plan?.totalDurationMs ?? null : null, config: SHORTFORM_RENDER_CONFIG });
    const job = readShortformJob(root, jobId);
    if (job.candidateId !== candidateId) throw new NarrationError("후보와 렌더 작업이 다릅니다.");
    const fresh = shortformJobFresh(root, job);
    let output: NarrationShortformJob["output"] = null;
    if (fresh && job.status === "completed") output = requireFreshShortformOutput(root, candidateId, jobId).output;
    return Response.json({ jobId, status: fresh ? job.status : "stale", errorCode: job.errorCode, output,
      sceneCount: job.plan.scenes.length, totalDurationMs: job.timeline.totalDurationMs });
  } catch (error) { return sceneApiError(error); }
}
export async function POST(request: Request, context: Context) {
  const auth = await requireAdminPermission("settings.manage"); if (!auth.ok) return auth.res;
  try {
    const { candidateId } = await context.params; const { root } = await loadSceneApiContext(candidateId, true);
    const parsed = z.object({ expectedScenePlanFingerprint: z.string().length(64) }).strict().safeParse(await request.json().catch(() => null));
    if (!parsed.success) throw new NarrationError("현재 장면 계획 정보를 확인해주세요.", 400);
    const job = queueShortformJob(root, candidateId, parsed.data.expectedScenePlanFingerprint);
    return Response.json({ jobId: job.jobId, status: job.status, inputFingerprint: job.inputFingerprint }, { status: 202 });
  } catch (error) { return sceneApiError(error); }
}
