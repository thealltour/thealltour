import { z } from "zod";
import { requireAdminPermission } from "@/lib/apiAuth";
import { createHumanMarketingReviewService } from "@/lib/marketing/review/humanMarketingReviewService";
import { resolveCandidatePackageRoot } from "@/lib/marketing/editorialDirector/researchHandoff/loadResearchHandoffSource";
import { readCanonicalAssetFromPackage } from "@/lib/marketing/canonicalAsset/persistence";
import { narrationLineage, NarrationError } from "@/lib/marketing/publishable/narration/persistence";
import { audioConfigFingerprint, audioJobFresh, queueNarrationAudio, readNarrationAudioJob, resolveNarrationAudioProfile } from "@/lib/marketing/publishable/narration/audio";
import { parseVoiceStudioConfig } from "@/lib/marketing/tts/voiceStudio/config";

export const dynamic = "force-dynamic";
type Context = { params: Promise<{ candidateId: string }> };
const schema = z.object({ profileId: z.string().min(1), expectedRevision: z.number().int().positive(), expectedFingerprint: z.string().length(64) }).strict();
async function handle(request: Request, context: Context, queue: boolean) {
  const auth = await requireAdminPermission("settings.manage"); if (!auth.ok) return auth.res;
  try {
    const { candidateId } = await context.params;
    const detail = await (await createHumanMarketingReviewService()).getHumanReviewDetail(candidateId);
    if (!detail) throw new NarrationError("후보를 찾을 수 없습니다.", 404);
    const root = resolveCandidatePackageRoot(detail.candidate);
    if (!root) throw new NarrationError("자료 폴더를 찾을 수 없습니다.", 404);
    const canonical = readCanonicalAssetFromPackage(root);
    if (!canonical) throw new NarrationError("저장된 승인 원문을 찾을 수 없습니다.");
    const lineage = narrationLineage(canonical);
    if (queue) {
      if (!detail.canEdit) throw new NarrationError("현재 후보는 편집할 수 없습니다.", 403);
      const parsed = schema.safeParse(await request.json().catch(() => null));
      if (!parsed.success) throw new NarrationError("음성 요청 형식을 확인해주세요.", 400);
      const profile = resolveNarrationAudioProfile(parsed.data.profileId);
      const config = parseVoiceStudioConfig();
      const job = queueNarrationAudio({ root, candidateId, ...parsed.data, lineage, profile, endpointIdentity: config.baseUrl });
      return Response.json({ jobId: job.jobId, status: job.status, configFingerprint: job.configFingerprint }, { status: 202 });
    }
    const job = readNarrationAudioJob(root, new URL(request.url).searchParams.get("jobId") ?? "");
    if (job.narration.candidateId !== candidateId) throw new NarrationError("후보와 음성 작업이 일치하지 않습니다.", 409);
    const profile = resolveNarrationAudioProfile(job.profile.profileId);
    const fresh = audioJobFresh(root, job, lineage, audioConfigFingerprint(profile, parseVoiceStudioConfig().baseUrl));
    return Response.json({ jobId: job.jobId, status: fresh ? job.status : "stale", errorCode: job.errorCode,
      narrationRevision: job.narration.revision, narrationFingerprint: job.narration.fingerprint,
      configFingerprint: job.configFingerprint, timeline: fresh && job.status === "completed" ? job.timeline : null });
  } catch (error) { return Response.json({ message: error instanceof NarrationError ? error.message : "음성 설정 또는 작업 파일을 확인해주세요." }, { status: error instanceof NarrationError ? error.status : 409 }); }
}
export function GET(request: Request, context: Context) { return handle(request, context, false); }
export function POST(request: Request, context: Context) { return handle(request, context, true); }
