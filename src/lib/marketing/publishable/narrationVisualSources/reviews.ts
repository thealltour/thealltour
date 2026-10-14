import { NarrationError } from "../narration/persistence";
import { requireFreshScenePlan, withSceneLock } from "../narrationScenes/service";
import type { CandidateReviewFile, RejectReason, StockProvider } from "./contracts";
import { candidateKey } from "./evaluation";
import { sceneRequirement } from "./requirements";
import { readReviews, readSceneSearch, readSearchPlan, requirementKey, writeReviews } from "./store";

/**
 * Review records are the reviewer's notes on candidates for one scene requirement. They never select a source, never
 * approve a clip and never exclude a video anywhere else. Nothing is recorded for candidates nobody judged.
 */
function sceneReviewContext(root: string, candidateId: string, planFingerprint: string, visualId: string) {
  const plan = requireFreshScenePlan(root, candidateId, planFingerprint);
  const index = plan.scenes.findIndex(s => s.visualId === visualId); if (index < 0) throw new NarrationError("현재 계획에 없는 장면입니다.", 400);
  const scene = readSearchPlan(root, plan)?.scenes[index]; if (!scene) throw new NarrationError("먼저 검색 계획을 저장해주세요.", 409);
  return { plan, key: requirementKey(sceneRequirement(scene)), file: readReviews(root, plan.fingerprint, visualId) };
}
const appendHistory = (file: CandidateReviewFile, event: CandidateReviewFile["history"][number]) => [...file.history, event].slice(-1000);

export function reviewCandidate(root: string, candidateId: string, input: { expectedPlanFingerprint: string; visualId: string; provider: StockProvider; videoId: string;
  verdict: "shortlist" | "reject"; reason: RejectReason | null; note: string | null }) {
  if ((input.verdict === "reject") !== (input.reason !== null)) throw new NarrationError(input.verdict === "reject" ? "맞지 않는 이유를 하나 골라주세요." : "검토 후보 표시에는 사유를 넣지 않습니다.", 400);
  return withSceneLock(root, () => {
    const { plan, key, file } = sceneReviewContext(root, candidateId, input.expectedPlanFingerprint, input.visualId);
    const search = readSceneSearch(root, plan.fingerprint, input.visualId);
    const candidate = search?.candidates.find(c => c.provider === input.provider && c.videoId === input.videoId);
    if (!candidate) throw new NarrationError("검색 결과에 있는 후보만 검토 기록을 남길 수 있습니다.", 409);
    const now = new Date().toISOString(); const note = input.note?.trim() || null;
    const others = file.reviews.filter(r => !(r.requirementKey === key && candidateKey(r) === candidateKey(input)));
    const next: CandidateReviewFile = { ...file,
      reviews: [...others, { provider: input.provider, videoId: input.videoId, requirementKey: key, verdict: input.verdict, reason: input.reason, note, decidedAt: now, sessionId: search?.sessionId ?? null }].slice(-400),
      history: appendHistory(file, { at: now, requirementKey: key, event: input.verdict, provider: input.provider, videoId: input.videoId, reason: input.reason, note }) };
    writeReviews(root, next); return next;
  });
}
export function clearCandidateReview(root: string, candidateId: string, input: { expectedPlanFingerprint: string; visualId: string; provider: StockProvider; videoId: string }) {
  return withSceneLock(root, () => {
    const { key, file } = sceneReviewContext(root, candidateId, input.expectedPlanFingerprint, input.visualId);
    const reviews = file.reviews.filter(r => !(r.requirementKey === key && candidateKey(r) === candidateKey(input)));
    if (reviews.length === file.reviews.length) return file;
    const next = { ...file, reviews, history: appendHistory(file, { at: new Date().toISOString(), requirementKey: key, event: "clear", provider: input.provider, videoId: input.videoId, reason: null, note: null }) };
    writeReviews(root, next); return next;
  });
}
/** "적합한 후보 없음" for the scene under its current requirement; a later requirement change starts clean. */
export function setSceneNoSuitable(root: string, candidateId: string, input: { expectedPlanFingerprint: string; visualId: string; noSuitable: boolean; note: string | null }) {
  return withSceneLock(root, () => {
    const { key, file } = sceneReviewContext(root, candidateId, input.expectedPlanFingerprint, input.visualId);
    const now = new Date().toISOString(); const note = input.note?.trim() || null;
    const others = file.sceneVerdicts.filter(v => v.requirementKey !== key);
    const had = others.length !== file.sceneVerdicts.length;
    if (!input.noSuitable && !had) return file;
    const next: CandidateReviewFile = { ...file, sceneVerdicts: input.noSuitable ? [...others, { requirementKey: key, noSuitable: true as const, note, decidedAt: now }].slice(-20) : others,
      history: appendHistory(file, { at: now, requirementKey: key, event: input.noSuitable ? "scene_no_suitable" : "scene_clear", provider: null, videoId: null, reason: null, note }) };
    writeReviews(root, next); return next;
  });
}
