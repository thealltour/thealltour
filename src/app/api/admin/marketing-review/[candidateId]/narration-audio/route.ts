import { z } from "zod";
import { readFileSync } from "node:fs";
import { resolvePackageArtifactPath } from "@/lib/marketing/assets/paths";
import { requireAdminPermission } from "@/lib/apiAuth";
import { createHumanMarketingReviewService } from "@/lib/marketing/review/humanMarketingReviewService";
import { resolveCandidatePackageRoot } from "@/lib/marketing/editorialDirector/researchHandoff/loadResearchHandoffSource";
import { readCanonicalAssetFromPackage } from "@/lib/marketing/canonicalAsset/persistence";
import { narrationLineage, NarrationError } from "@/lib/marketing/publishable/narration/persistence";
import { currentAudioConfigFingerprint, audioJobFresh, queueNarrationAudio, latestNarrationAudioJob, configuredNarrationAudioProfiles, resolveNarrationAudioProfile, reprocessNarrationAudio, processingPolicyOutdated, applyEdgeRanges, edgeRangeMutationSchema, edgeReviewView } from "@/lib/marketing/publishable/narration/audio";
import { approveKeepRawRange, audioReviewMutationSchema, audioReviewState } from "@/lib/marketing/publishable/narration/audioReview";
import { createFfprobeDurationProbe } from "@/lib/marketing/tts/duration/ffprobe";
import { dispatchNarrationAudio, reconcileNarrationAudioWorker } from "@/lib/marketing/publishable/narration/audioWorker";
import { parseVoiceStudioConfig } from "@/lib/marketing/tts/voiceStudio/config";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";
type Context = { params: Promise<{ candidateId: string }> };
const schema = z.object({ profileId: z.string().min(1), speed: z.number().min(0.7).max(2).optional(), expectedRevision: z.number().int().positive(), expectedFingerprint: z.string().length(64) }).strict();
const reprocessSchema = z.object({ action: z.literal("reprocess"), sourceJobId: z.string().uuid() }).strict();
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
    const lineage = narrationLineage(canonical, root);
    if (queue) {
      if (!detail.canEdit) throw new NarrationError("현재 후보는 편집할 수 없습니다.", 403);
      const body: unknown = await request.json().catch(() => null);
      const review = audioReviewMutationSchema.safeParse(body);
      if (review.success) {
        const state = approveKeepRawRange({ root, candidateId, mutation: review.data });
        return Response.json({ pending: state.pending, approvals: state.approvals.length });
      }
      const edges = edgeRangeMutationSchema.safeParse(body);
      if (edges.success) {
        const previous = latestNarrationAudioJob(root, candidateId); if (previous) reconcileNarrationAudioWorker(root, previous.jobId);
        const job = await applyEdgeRanges({ root, candidateId, mutation: edges.data, lineage, durationProbe: createFfprobeDurationProbe() });
        return Response.json({ jobId: job.jobId, status: job.status, configFingerprint: job.configFingerprint }, { status: 201 });
      }
      const reprocess = reprocessSchema.safeParse(body);
      if (reprocess.success) {
        const previous = latestNarrationAudioJob(root, candidateId); if (previous) reconcileNarrationAudioWorker(root, previous.jobId);
        const job = await reprocessNarrationAudio({ root, candidateId, sourceJobId: reprocess.data.sourceJobId, lineage, durationProbe: createFfprobeDurationProbe() });
        return Response.json({ jobId: job.jobId, status: job.status, configFingerprint: job.configFingerprint }, { status: 201 });
      }
      const parsed = schema.safeParse(body);
      if (!parsed.success) throw new NarrationError("음성 요청 형식을 확인해주세요.", 400);
      const profile = resolveNarrationAudioProfile(parsed.data.profileId);
      if (!configuredNarrationAudioProfiles().some(p => p.profileId === profile.profileId)) throw new NarrationError("설정된 음성 프로필을 선택해주세요.", 400);
      const config = parseVoiceStudioConfig();
      const previous = latestNarrationAudioJob(root, candidateId);
      if (previous) reconcileNarrationAudioWorker(root, previous.jobId);
      const job = queueNarrationAudio({ root, candidateId, ...parsed.data, lineage, profile, endpointIdentity: config.baseUrl });
      await dispatchNarrationAudio(root, job.jobId);
      return Response.json({ jobId: job.jobId, status: job.status, configFingerprint: job.configFingerprint }, { status: 202 });
    }
    const params = new URL(request.url).searchParams;
    const profiles = configuredNarrationAudioProfiles().map(p => ({ profileId: p.profileId, displayName: p.displayName }));
    const config = parseVoiceStudioConfig();
    const jobId = params.get("jobId");
    const latest = jobId ? null : latestNarrationAudioJob(root, candidateId);
    if (!jobId && !latest) return Response.json({ profiles, jobId: null });
    const job = reconcileNarrationAudioWorker(root, jobId ?? latest!.jobId);
    if (job.narration.candidateId !== candidateId) throw new NarrationError("후보와 음성 작업이 일치하지 않습니다.", 409);
    const profile = configuredNarrationAudioProfiles().find(p => p.profileId === job.profile.profileId);
    const fresh = !!profile && audioJobFresh(root, job, lineage, currentAudioConfigFingerprint(job, config.baseUrl));
    const sentenceId = params.get("sentenceId");
    if (sentenceId) {
      if (!fresh || job.status !== "completed") throw new NarrationError("최신 승인본의 완료된 음성만 재생할 수 있습니다.");
      if (params.get("waveform") === "1") return Response.json(edgeReviewView(root, job, sentenceId));
      const segment = job.timeline?.segments.find(s => s.segmentId === sentenceId);
      if (!segment) throw new NarrationError("문장 음성을 찾을 수 없습니다.", 404);
      const raw = params.get("variant") === "raw" && job.contract === "narration-audio-job-v2" ? job.processing.segments.find(s => s.segmentId === sentenceId)?.rawRelativePath : null;
      const buffer = readFileSync(resolvePackageArtifactPath({ packageRoot: root, relativePath: raw ?? segment.relativeAudioPath }));
      return new Response(new Uint8Array(buffer), { headers: { "Content-Type": "audio/wav", "Content-Length": String(buffer.length), "Cache-Control": "private, no-store" } });
    }
    const review = audioReviewState(root, job);
    return Response.json({ profiles, jobId: job.jobId, profileId: job.profile.profileId, speed: job.profile.speed ?? 1, status: fresh ? job.status : "stale", errorCode: job.errorCode,
      narrationRevision: job.narration.revision, narrationFingerprint: job.narration.fingerprint,
      configFingerprint: job.configFingerprint, timeline: fresh && job.status === "completed" ? job.timeline : null,
      processing: job.contract === "narration-audio-job-v2" ? { policyId: job.processing.policyId, policyFingerprint: job.processing.policyFingerprint, sourceAudioJobId: job.processing.sourceAudioJobId,
        segments: job.processing.segments.map(s => { const reviewed = review.segments.find(r => r.sentenceId === s.segmentId); return { segmentId: s.segmentId, status: s.status,
          removedLeadingMs: s.removedLeadingMs, removedTrailingMs: s.removedTrailingMs, rawDurationMs: s.rawDurationMs, measuredDurationMs: s.measuredDurationMs, diagnostics: s.diagnostics,
          rawSha256: s.rawSha256, processedSha256: s.processedSha256, keepRawApproved: reviewed ? !!reviewed.approval : null, edgeDecision: s.edgeDecision ?? null }; }) } : null,
      reviewPending: review.pending.length, canReprocess: fresh && job.status === "completed" && processingPolicyOutdated(job) });
  } catch (error) { return Response.json({ message: error instanceof NarrationError ? error.message : "음성 설정 또는 작업 파일을 확인해주세요." }, { status: error instanceof NarrationError ? error.status : 409 }); }
}
export function GET(request: Request, context: Context) { return handle(request, context, false); }
export function POST(request: Request, context: Context) { return handle(request, context, true); }
