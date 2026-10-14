import { randomUUID } from "node:crypto";
import { existsSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";
import { z } from "zod";
import { atomicWriteFile } from "@/lib/marketing/assets/atomicWrite";
import { sha256FileSync } from "@/lib/marketing/assets/hashing";
import { resolvePackageArtifactPath } from "@/lib/marketing/assets/paths";
import { NarrationError } from "../narration/persistence";
import { requireFreshScenePlan, sceneHash, withSceneLock } from "../narrationScenes/service";
import type { NarrationScenePlan } from "../narrationScenes/contracts";
import { motionFrameLayout } from "../narrationMotion/frameLayout";
import { motionQueueDirectory, motionWorkerAvailable } from "../narrationMotion/service";
import { STOCK_CLIP_NORMALIZE_CONFIG, stockClipConfigSchema, stockClipJobSchema, type PlaceReview, type PlaceReviewInput, type SceneSourceChoice, type StockClipJob, type StockProvider, type StockSourceChoice, type VisualSourceSelection } from "./contracts";
import { placeEvidence } from "./metadataText";
import { sceneRequirement } from "./requirements";
import { choicesForPlan, readLocators, readReviews, readSceneSearch, readSearchPlan, requirementKey, sceneSearchKey, visualSourcesDirectory, writeLocator, writeSelection } from "./store";

const clipsDirectory = (root: string) => join(visualSourcesDirectory(root), "clips");
const indexSchema = z.record(z.string().uuid(), z.string().uuid());
const indexPath = (root: string) => join(clipsDirectory(root), "jobs-current.json");
function readIndex(root: string) { return existsSync(indexPath(root)) ? indexSchema.parse(JSON.parse(readFileSync(indexPath(root), "utf8"))) : {}; }
function jobPath(root: string, jobId: string) {
  if (!z.string().uuid().safeParse(jobId).success) throw new NarrationError("스톡 클립 작업 ID를 확인해주세요.", 400);
  return join(clipsDirectory(root), "jobs", `${jobId}.json`);
}
export const stockClipConfig = () => stockClipConfigSchema.parse(STOCK_CLIP_NORMALIZE_CONFIG);
export const stockClipFingerprint = (job: Pick<StockClipJob, "source" | "config">) => sceneHash({ contract: "narration-stock-clip-input-v1", source: job.source, config: job.config });
export const stockClipPrefix = (job: Pick<StockClipJob, "inputFingerprint" | "jobId">) => `media/narration-stock/${job.inputFingerprint}/${job.jobId}`;
/** Originals are kept per content hash, so a refreshed download never overwrites the file an earlier approval used. */
export const stockOriginalDirectory = (source: { provider: StockProvider; videoId: string; rendition: { fileKey: string } }) => `media/narration-stock/originals/${source.provider}-${source.videoId}-${source.rendition.fileKey}`;
export function readStockClipJob(root: string, jobId: string) {
  const path = jobPath(root, jobId); if (!existsSync(path)) throw new NarrationError("스톡 클립 작업을 찾을 수 없습니다.", 404);
  const job = stockClipJobSchema.parse(JSON.parse(readFileSync(path, "utf8")));
  if (job.jobId !== jobId || job.inputFingerprint !== stockClipFingerprint(job) || job.source.visualId !== job.source.sentenceId || job.source.endFrame <= job.source.startFrame ||
    (job.status === "completed") !== (!!job.output && !!job.original) ||
    (job.approval && (!job.output || !job.original || job.approval.inputFingerprint !== job.inputFingerprint || job.approval.outputSha256 !== job.output.sha256 || job.approval.originalSha256 !== job.original.sha256))) throw new NarrationError("스톡 클립 작업 연결 정보가 다릅니다.", 409);
  return job;
}
export function writeStockClipJob(root: string, job: StockClipJob) { atomicWriteFile(jobPath(root, job.jobId), JSON.stringify(stockClipJobSchema.parse(job), null, 2), 0o600); }
const choiceSource = (choice: StockSourceChoice) => ({ provider: choice.provider, videoId: choice.videoId, rendition: choice.rendition, pageUrl: choice.snapshot.pageUrl,
  creatorName: choice.snapshot.creatorName, creatorUrl: choice.snapshot.creatorUrl, startMs: choice.startMs, placeReview: choice.placeReview });
const jobSource = (source: StockClipJob["source"]) => ({ provider: source.provider, videoId: source.videoId, rendition: source.rendition, pageUrl: source.pageUrl,
  creatorName: source.creatorName, creatorUrl: source.creatorUrl, startMs: source.startMs, placeReview: source.placeReview });
const sameChoice = (choice: SceneSourceChoice | undefined, source: StockClipJob["source"]) => choice?.source === "stock_video" && sceneHash(choiceSource(choice)) === sceneHash(jobSource(source));
/** Fresh = the current selection, plan timing and normalization config still describe exactly this job. Search results are not consulted. */
export function stockClipJobFresh(root: string, job: StockClipJob) {
  try {
    const plan = requireFreshScenePlan(root, job.source.candidateId, job.source.planFingerprint);
    const { matchesPlan, choices } = choicesForPlan(root, plan); if (!matchesPlan) return false;
    const i = plan.scenes.findIndex(s => s.visualId === job.source.visualId); const interval = motionFrameLayout(plan)[i];
    if (i < 0 || !interval || !sameChoice(choices[i], job.source) || interval.startFrame !== job.source.startFrame || interval.endFrame !== job.source.endFrame) return false;
    return sceneHash(job.config) === sceneHash(stockClipConfig()) && stockClipFingerprint(job) === job.inputFingerprint;
  } catch { return false; }
}
export function requireStockClipOutput(root: string, candidateId: string, jobId: string, approved = false) {
  const job = readStockClipJob(root, jobId);
  if (job.source.candidateId !== candidateId || job.status !== "completed" || !job.output || !job.original || !stockClipJobFresh(root, job) || (approved && !job.approval)) throw new NarrationError("최신 완료 스톡 클립이 필요합니다.", 409);
  const prefix = stockClipPrefix(job); const frameCount = job.source.endFrame - job.source.startFrame;
  if (job.output.relativePath !== `${prefix}/scene.mp4` || job.output.provenanceRelativePath !== `${prefix}/provenance.json` || !job.original.relativePath.startsWith(`${stockOriginalDirectory(job.source)}/`) ||
    job.output.frameCount !== frameCount || Math.abs(job.output.durationMs - frameCount * 1000 / 30) > 50) throw new NarrationError("스톡 클립 출력 연결 정보가 다릅니다.", 409);
  const path = resolvePackageArtifactPath({ packageRoot: root, relativePath: job.output.relativePath });
  const provenance = resolvePackageArtifactPath({ packageRoot: root, relativePath: job.output.provenanceRelativePath });
  const original = resolvePackageArtifactPath({ packageRoot: root, relativePath: job.original.relativePath });
  if (!existsSync(path) || !existsSync(provenance) || !existsSync(original) || statSync(path).size !== job.output.byteSize || statSync(original).size !== job.original.byteSize ||
    sha256FileSync(path) !== job.output.sha256 || sha256FileSync(provenance) !== job.output.provenanceSha256 || sha256FileSync(original) !== job.original.sha256) throw new NarrationError("스톡 클립 또는 원본 파일이 없거나 변경되었습니다.", 409);
  if (!stockClipJobFresh(root, job)) throw new NarrationError("스톡 클립 확인 중 선택이 변경되었습니다.", 409);
  return { job, path };
}
export function currentStockClipJob(root: string, visualId: string) {
  const id = readIndex(root)[visualId]; if (!id) return null;
  try { return readStockClipJob(root, id); } catch { return null; }
}

/**
 * Only the refreshable download URL is looked up here, and only for the same provider/videoId/file identity. What the clip
 * is made from comes from the selection snapshot, never from search results, which may be re-run or expire.
 */
function downloadUrlFor(root: string, choice: StockSourceChoice) {
  const previous = currentStockClipJob(root, choice.visualId);
  if (previous && previous.source.provider === choice.provider && previous.source.videoId === choice.videoId && sceneHash(previous.source.rendition) === sceneHash(choice.rendition)) return previous.downloadUrl;
  const locator = readLocators(root)[choice.visualId];
  if (locator && locator.provider === choice.provider && locator.videoId === choice.videoId && locator.fileKey === choice.rendition.fileKey) return locator.downloadUrl;
  throw new NarrationError("선택한 영상의 다운로드 주소 기록이 없습니다. 후보를 다시 선택해주세요.", 409);
}
/** Must run inside withSceneLock. */
function queueStockClip(root: string, candidateId: string, plan: NarrationScenePlan, visualId: string) {
  if (!motionWorkerAvailable()) throw new NarrationError("영상 실행기가 연결되지 않았습니다. 실행기 연결 후 '구간 클립 만들기'를 눌러주세요.", 503);
  const { matchesPlan, choices } = choicesForPlan(root, plan); const i = plan.scenes.findIndex(s => s.visualId === visualId); const choice = choices[i];
  if (!matchesPlan || i < 0 || choice?.source !== "stock_video") throw new NarrationError("이 장면에는 현재 스톡 영상이 선택되어 있지 않습니다.", 409);
  const interval = motionFrameLayout(plan)[i]!;
  const source: StockClipJob["source"] = { candidateId, planFingerprint: plan.fingerprint, sentenceId: plan.scenes[i]!.sentenceId, visualId, ...interval, ...choiceSource(choice) };
  const config = stockClipConfig(); const inputFingerprint = stockClipFingerprint({ source, config });
  const publish = (job: StockClipJob) => atomicWriteFile(join(motionQueueDirectory(), `${job.jobId}.json`), JSON.stringify({ kind: "stock-clip-v1", root, jobId: job.jobId, createdAt: job.createdAt, order: job.source.startFrame }), 0o600);
  const previous = currentStockClipJob(root, visualId);
  if (previous?.inputFingerprint === inputFingerprint && ["queued", "running", "completed"].includes(previous.status) && stockClipJobFresh(root, previous)) {
    if (previous.status !== "completed") { if (previous.status === "queued") publish(previous); return previous; }
    try { requireStockClipOutput(root, candidateId, previous.jobId); return previous; } catch { /* Rebuild a missing or changed output. */ }
  }
  const job: StockClipJob = { contract: "narration-stock-clip-job-v1", jobId: randomUUID(), inputFingerprint, source, config, downloadUrl: downloadUrlFor(root, choice),
    status: "queued", errorCode: null, createdAt: new Date().toISOString(), startedAt: null, heartbeatAt: null, completedAt: null, original: null, output: null, approval: null };
  writeStockClipJob(root, job);
  atomicWriteFile(indexPath(root), JSON.stringify({ ...readIndex(root), [visualId]: job.jobId }));
  publish(job); return job;
}
function requireSelection(root: string, plan: NarrationScenePlan, expected: string | null) {
  const state = choicesForPlan(root, plan);
  if ((state.selection?.fingerprint ?? null) !== expected) throw new NarrationError("다른 화면에서 영상 소스 선택이 변경되었습니다. 다시 불러와주세요.", 409);
  return state;
}
/** Changing a scene's source never touches images, motion jobs or their approvals; it only clears that scene's stock clip approval. */
function saveChoice(root: string, plan: NarrationScenePlan, state: ReturnType<typeof choicesForPlan>, choice: SceneSourceChoice): VisualSourceSelection {
  const scenes = state.choices.map(c => c.visualId === choice.visualId ? choice : c);
  if (state.selection && state.matchesPlan && sceneHash(state.selection.scenes) === sceneHash(scenes)) return state.selection;
  const before = state.choices.find(c => c.visualId === choice.visualId);
  const selection = writeSelection(root, state.selection, { contract: "narration-visual-source-selection-v1", revision: (state.selection?.revision ?? 0) + 1, planFingerprint: plan.fingerprint, scenes });
  if (sceneHash(before ?? null) !== sceneHash(choice)) {
    const job = currentStockClipJob(root, choice.visualId);
    // Returning to the same candidate later must not revive an approval given before the change.
    if (job?.approval) writeStockClipJob(root, { ...job, approval: null });
  }
  return selection;
}
export function selectStockSource(root: string, candidateId: string, input: { expectedPlanFingerprint: string; expectedSelectionFingerprint: string | null; visualId: string; provider: StockProvider; videoId: string; startMs: number; placeReview: PlaceReviewInput }) {
  return withSceneLock(root, () => {
    const plan = requireFreshScenePlan(root, candidateId, input.expectedPlanFingerprint); const state = requireSelection(root, plan, input.expectedSelectionFingerprint);
    const i = plan.scenes.findIndex(s => s.visualId === input.visualId); if (i < 0) throw new NarrationError("현재 계획에 없는 장면입니다.", 400);
    const searchScene = readSearchPlan(root, plan)?.scenes[i]; const interval = motionFrameLayout(plan)[i]!; const frameCount = interval.endFrame - interval.startFrame;
    const search = readSceneSearch(root, plan.fingerprint, input.visualId);
    if (!searchScene?.searchEnabled || !search || search.sceneSearchKey !== sceneSearchKey(plan.fingerprint, searchScene, frameCount)) throw new NarrationError("현재 검색 계획으로 검색한 결과에서 후보를 골라주세요.", 409);
    const requirement = sceneRequirement(searchScene); const reviewKey = requirementKey(requirement);
    const reviewed = new Set(readReviews(root, plan.fingerprint, input.visualId).reviews.filter(r => r.requirementKey === reviewKey).map(r => `${r.provider}:${r.videoId}`));
    const candidate = search.candidates.find((c, index) => c.provider === input.provider && c.videoId === input.videoId && (index < search.shownCount || reviewed.has(`${c.provider}:${c.videoId}`)));
    if (!candidate) throw new NarrationError("화면에 표시된 후보만 선택할 수 있습니다.", 409);
    const now = new Date().toISOString();
    if (input.placeReview.placeRequirement !== requirement.placeRequirement || (input.placeReview.placeRequirement === "specific_place" && input.placeReview.placeName !== requirement.placeName))
      throw new NarrationError("검색 계획의 장소 요구가 바뀌었습니다. 화면을 다시 불러와주세요.", 409);
    const placeReview = reviewFrom(input.placeReview, { tags: candidate.sourceMetadata.tags, pageUrl: candidate.pageUrl }, now);
    if (input.startMs + Math.ceil(frameCount * 1000 / 30) > candidate.declaredDurationMs) throw new NarrationError("원본 길이가 장면보다 짧습니다. 시작점을 앞당기거나 다른 후보를 고르세요. 반복·슬로모션·정지 프레임으로 늘리지 않습니다.", 409);
    const { url, ...rendition } = candidate.renderRendition;
    writeLocator(root, input.visualId, { provider: input.provider, videoId: input.videoId, fileKey: rendition.fileKey, downloadUrl: url, capturedAt: search.searchedAt });
    const selection = saveChoice(root, plan, state, { visualId: input.visualId, source: "stock_video", provider: input.provider, videoId: input.videoId, rendition,
      snapshot: { pageUrl: candidate.pageUrl, creatorName: candidate.creatorName, creatorUrl: candidate.creatorUrl, declaredDurationMs: candidate.declaredDurationMs,
        posterUrl: candidate.posterUrl, tags: candidate.sourceMetadata.tags, pageSlug: candidate.sourceMetadata.pageSlug,
        selectedFrom: { searchPlanFingerprint: search.searchPlanFingerprint, sceneSearchKey: search.sceneSearchKey, searchedAt: search.searchedAt }, selectedAt: now },
      startMs: input.startMs, placeReview });
    let queued = false; let queueMessage: string | null = null;
    try { queueStockClip(root, candidateId, plan, input.visualId); queued = true; } catch (error) { queueMessage = error instanceof NarrationError ? error.message : "구간 클립 요청에 실패했습니다."; }
    return { selection, queued, queueMessage };
  });
}
/**
 * The place requirement and confirmation belong to the selection snapshot; search-plan edits never change them.
 * Changing them is this explicit selection update: the clip input changes, so the clip needs re-making and re-approval.
 */
export function updateStockPlaceReview(root: string, candidateId: string, input: { expectedPlanFingerprint: string; expectedSelectionFingerprint: string; visualId: string; placeReview: PlaceReviewInput }) {
  return withSceneLock(root, () => {
    const plan = requireFreshScenePlan(root, candidateId, input.expectedPlanFingerprint); const state = requireSelection(root, plan, input.expectedSelectionFingerprint);
    const choice = state.choices.find(c => c.visualId === input.visualId);
    if (!state.matchesPlan || choice?.source !== "stock_video") throw new NarrationError("이 장면에는 현재 스톡 영상이 선택되어 있지 않습니다.", 409);
    const placeReview = reviewFrom(input.placeReview, { tags: choice.snapshot.tags, pageUrl: choice.snapshot.pageUrl }, new Date().toISOString());
    const selection = saveChoice(root, plan, state, { ...choice, placeReview });
    let queueMessage: string | null = null;
    try { queueStockClip(root, candidateId, plan, input.visualId); } catch (error) { queueMessage = error instanceof NarrationError ? error.message : "구간 클립 요청에 실패했습니다."; }
    return { selection, queueMessage };
  });
}
/** Metadata evidence is recomputed on the server from the stored provider facts; the client only supplies its own confirmation. */
function reviewFrom(input: PlaceReviewInput, metadata: { tags: string[]; pageUrl: string }, now: string): PlaceReview {
  if (input.placeRequirement === "generic_allowed") return input;
  return { placeRequirement: "specific_place", placeName: input.placeName, metadataEvidence: placeEvidence(metadata, input.placeName),
    humanConfirmation: input.sourceChecked && input.evidenceUrl ? { evidenceUrl: input.evidenceUrl, note: input.note ?? "", confirmedAt: now } : null };
}
export function selectImageMotion(root: string, candidateId: string, input: { expectedPlanFingerprint: string; expectedSelectionFingerprint: string | null; visualId: string }) {
  return withSceneLock(root, () => {
    const plan = requireFreshScenePlan(root, candidateId, input.expectedPlanFingerprint); const state = requireSelection(root, plan, input.expectedSelectionFingerprint);
    if (!plan.scenes.some(s => s.visualId === input.visualId)) throw new NarrationError("현재 계획에 없는 장면입니다.", 400);
    return { selection: saveChoice(root, plan, state, { visualId: input.visualId, source: "image_motion" }) };
  });
}
export function makeStockClip(root: string, candidateId: string, input: { expectedPlanFingerprint: string; expectedSelectionFingerprint: string; visualId: string }) {
  return withSceneLock(root, () => {
    const plan = requireFreshScenePlan(root, candidateId, input.expectedPlanFingerprint); requireSelection(root, plan, input.expectedSelectionFingerprint);
    return queueStockClip(root, candidateId, plan, input.visualId);
  });
}
export function approveStockClip(root: string, candidateId: string, input: { expectedPlanFingerprint: string; expectedSelectionFingerprint: string; visualId: string; jobId: string; expectedOriginalSha256: string; expectedOutputSha256: string }) {
  return withSceneLock(root, () => {
    const plan = requireFreshScenePlan(root, candidateId, input.expectedPlanFingerprint); requireSelection(root, plan, input.expectedSelectionFingerprint);
    const { job } = requireStockClipOutput(root, candidateId, input.jobId);
    if (job.source.visualId !== input.visualId || job.output!.sha256 !== input.expectedOutputSha256 || job.original!.sha256 !== input.expectedOriginalSha256) throw new NarrationError("검토한 스톡 클립이 변경되었습니다. 다시 확인해주세요.", 409);
    const approved: StockClipJob = { ...job, approval: { inputFingerprint: job.inputFingerprint, originalSha256: job.original!.sha256, outputSha256: job.output!.sha256, approvedAt: new Date().toISOString() } };
    writeStockClipJob(root, approved); return approved;
  });
}
