import { z } from "zod";
import { requireAdminPermission } from "@/lib/apiAuth";
import { loadSceneApiContext, sceneApiError } from "@/lib/marketing/publishable/narrationScenes/apiContext";
import { readCompatibleShortform, compatibleShortformFresh, requireCompatibleShortformOutput } from "@/lib/marketing/publishable/narrationShortform/compatible";
import { captionShortformSourceView, motionShortformSourceView, queueCaptionShortform, queueMotionShortform } from "@/lib/marketing/publishable/narrationShortform/motionService";
import { queueShortformJob } from "@/lib/marketing/publishable/narrationShortform/service";
import { NarrationError } from "@/lib/marketing/publishable/narration/persistence";
export const dynamic = "force-dynamic";
type Context = { params: Promise<{ candidateId: string }> };
export async function GET(request: Request, context: Context) {
  const auth = await requireAdminPermission("settings.manage"); if (!auth.ok) return auth.res;
  try {
    const { candidateId } = await context.params; const { root, canEdit } = await loadSceneApiContext(candidateId, false);
    const jobId = new URL(request.url).searchParams.get("jobId");
    if (!jobId) return Response.json({ ...motionShortformSourceView(root, candidateId), captions: captionShortformSourceView(root, candidateId), canEdit });
    const job = readCompatibleShortform(root, jobId);
    if (job.candidateId !== candidateId) throw new NarrationError("후보와 렌더 작업이 다릅니다.");
    const fresh = compatibleShortformFresh(root, jobId);
    let output: ReturnType<typeof requireCompatibleShortformOutput>["output"] | null = null;
    if (fresh && job.status === "completed") output = requireCompatibleShortformOutput(root, candidateId, jobId).output;
    return Response.json({ jobId, status: fresh ? job.status : "stale", errorCode: job.errorCode, output,
      contract: job.contract, sceneCount: job.plan.scenes.length, totalDurationMs: job.timeline.totalDurationMs,
      ...("purpose" in job ? { purpose: job.purpose, captionCueCount: job.captionPlan.cues.length, hookEnabled: job.hook?.enabled ?? false, firstSceneEndMs: job.plan.scenes[0]!.sceneEndMs } : {}) });
  } catch (error) { return sceneApiError(error); }
}
export async function POST(request: Request, context: Context) {
  const auth = await requireAdminPermission("settings.manage"); if (!auth.ok) return auth.res;
  try {
    const { candidateId } = await context.params; const { root } = await loadSceneApiContext(candidateId, true);
    const parsed = z.object({ expectedScenePlanFingerprint: z.string().length(64), expectedInputFingerprint: z.string().length(64).optional(), purpose: z.enum(["preview", "final"]).optional() }).strict()
      .refine(value => !value.purpose || !!value.expectedInputFingerprint).safeParse(await request.json().catch(() => null));
    if (!parsed.success) throw new NarrationError("현재 장면 계획 정보를 확인해주세요.", 400);
    // Existing callers keep the original v1/v2 request shapes; only an explicit purpose selects the v3 caption-cue renderer.
    const { expectedScenePlanFingerprint: plan, expectedInputFingerprint: input, purpose } = parsed.data;
    const job = purpose && input ? queueCaptionShortform(root, candidateId, plan, input, purpose) : input ? queueMotionShortform(root, candidateId, plan, input) : queueShortformJob(root, candidateId, plan);
    return Response.json({ jobId: job.jobId, status: job.status, inputFingerprint: job.inputFingerprint }, { status: 202 });
  } catch (error) { return sceneApiError(error); }
}
