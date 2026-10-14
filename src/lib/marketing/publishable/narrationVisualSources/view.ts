import { readScenePlan, requireFreshScenePlan } from "../narrationScenes/service";
import { motionFrameLayout } from "../narrationMotion/frameLayout";
import { motionView, motionWorkerAvailable } from "../narrationMotion/service";
import type { CandidateReview, StockCandidate, StockClipJob, StockSourceChoice } from "./contracts";
import { currentStockClipJob, requireStockClipOutput, stockClipJobFresh } from "./clips";
import { assessContent, candidateKey, priorityReason } from "./evaluation";
import { sceneSearchMetrics, stockChoiceHistory, storedSearches } from "./metrics";
import { stockProviderConfigured } from "./providers";
import { readQueryHistory } from "./queryHistory";
import { sceneRequirement, type SceneRequirement } from "./requirements";
import { nextPageAvailable } from "./search";
import { choicesForPlan, readAttemptLog, readReviews, readSceneSearch, readSearchPlan, requirementKey, sceneSearchKey } from "./store";
import { diagnoseSearch } from "./supplement";

const attempt = <T,>(read: () => T): T | null => { try { return read(); } catch { return null; } };
/** Download URLs stay server-side; the browser gets the poster (allowed for displaying results) and a proxied preview. */
function publicCandidate(candidate: StockCandidate, requirement: SceneRequirement | null, review: CandidateReview | null) {
  const { renderRendition, previewRendition, ...rest } = candidate;
  const evidence = requirement ? assessContent(candidate, requirement) : null;
  return { ...rest, renderRendition: { fileKey: renderRendition.fileKey, width: renderRendition.width, height: renderRendition.height, fps: renderRendition.fps },
    preview: previewRendition ? { width: previewRendition.width, height: previewRendition.height } : null, evidence,
    priorityReason: evidence ? priorityReason(candidate, evidence, review?.verdict === "reject") : null,
    review: review ? { verdict: review.verdict, reason: review.reason, note: review.note, decidedAt: review.decidedAt } : null };
}
function clipState(root: string, candidateId: string, job: StockClipJob | null) {
  if (!job) return null;
  let status: string = job.status; let errorCode = job.errorCode; let approved = !!job.approval; let output = job.output; let original = job.original;
  if (!stockClipJobFresh(root, job)) { status = "stale"; approved = false; output = null; }
  else if (job.status === "completed") { try { requireStockClipOutput(root, candidateId, job.jobId); } catch { status = "failed"; errorCode = "output_invalid"; approved = false; output = null; original = null; } }
  return { jobId: job.jobId, status, errorCode, approved, startMs: job.source.startMs, provider: job.source.provider, videoId: job.source.videoId,
    output: output ? { sha256: output.sha256, frameCount: output.frameCount, durationMs: output.durationMs } : null,
    original: original ? { sha256: original.sha256, width: original.width, height: original.height, durationMs: original.durationMs, avgFrameRate: original.avgFrameRate, downloadedAt: original.downloadedAt } : null,
    provenance: { pageUrl: job.source.pageUrl, creatorName: job.source.creatorName, creatorUrl: job.source.creatorUrl } };
}
export function visualSourcesView(root: string, candidateId: string) {
  const plan = readScenePlan(root);
  const providers = { pexels: stockProviderConfigured("pexels"), pixabay: stockProviderConfigured("pixabay") };
  if (!plan || plan.source.candidateId !== candidateId) return { ready: false, planFingerprint: null, searchPlan: null, selection: null, workerAvailable: motionWorkerAvailable(), providers, scenes: [] };
  const ready = !!attempt(() => requireFreshScenePlan(root, candidateId, plan.fingerprint));
  const layout = attempt(() => motionFrameLayout(plan)); const searchPlan = attempt(() => readSearchPlan(root, plan));
  const state = attempt(() => choicesForPlan(root, plan)); const motion = attempt(() => motionView(root, candidateId));
  const scenes = plan.scenes.map((scene, i) => {
    const frameCount = layout ? layout[i]!.endFrame - layout[i]!.startFrame : null;
    const searchScene = searchPlan?.scenes[i] ?? null; const search = attempt(() => readSceneSearch(root, plan.fingerprint, scene.visualId));
    const requirement = searchScene ? sceneRequirement(searchScene) : null; const reviewKey = requirement ? requirementKey(requirement) : null;
    const reviewFile = attempt(() => readReviews(root, plan.fingerprint, scene.visualId));
    const reviews = (reviewFile?.reviews ?? []).filter(r => r.requirementKey === reviewKey);
    const reviewOf = new Map(reviews.map(r => [candidateKey(r), r]));
    const current = !!search && !!searchScene && frameCount !== null && search.sceneSearchKey === sceneSearchKey(plan.fingerprint, searchScene, frameCount);
    const motionSlot = motion?.scenes.find(s => s.visualId === scene.visualId);
    const excludedSummary: Record<string, number> = {};
    for (const item of search?.excluded ?? []) for (const reason of item.reasons) excludedSummary[reason] = (excludedSummary[reason] ?? 0) + 1;
    const choice = state?.choices[i] ?? { visualId: scene.visualId, source: "image_motion" as const };
    const clip = clipState(root, candidateId, currentStockClipJob(root, scene.visualId));
    const attempts = attempt(() => readAttemptLog(root, plan.fingerprint, scene.visualId)) ?? [];
    const stockChoice = choice.source === "stock_video" ? choice as StockSourceChoice : null;
    const metrics = attempt(() => sceneSearchMetrics({ attempts, reviews: reviewFile!, requirementKey: reviewKey, searches: storedSearches(root, plan.fingerprint, scene.visualId),
      currentChoice: stockChoice, pastChoices: stockChoiceHistory(root, scene.visualId),
      clipApproved: !!clip?.approved && !!stockChoice && clip.provider === stockChoice.provider && clip.videoId === stockChoice.videoId }));
    const revealed = search ? search.candidates.slice(0, search.shownCount) : [];
    const rejected = (search?.candidates ?? []).filter(c => reviewOf.get(candidateKey(c))?.verdict === "reject");
    const proposal = search?.supplement?.proposal ?? null;
    const sessionUsable = current && !!search && search.outcome !== "not_applicable" && search.outcome !== "search_failed";
    return { visualId: scene.visualId, sentenceId: scene.sentenceId, order: scene.order, text: scene.sentenceText, frameCount, durationMs: frameCount === null ? null : Math.round(frameCount * 1000 / 30),
      choice, searchScene, requirement,
      search: search ? { current, outcome: search.outcome, attempts: search.attempts, searchedAt: search.searchedAt, sessionId: search.sessionId ?? null, sessionStartedAt: search.sessionStartedAt ?? search.searchedAt,
        sessionQueries: search.sessionQueries ?? null,
        shown: revealed.filter(c => reviewOf.get(candidateKey(c))?.verdict !== "reject").map(c => publicCandidate(c, requirement, reviewOf.get(candidateKey(c)) ?? null)),
        rejected: rejected.map(c => publicCandidate(c, requirement, reviewOf.get(candidateKey(c)) ?? null)),
        total: search.candidates.length, storedNotShown: Math.max(0, search.candidates.length - search.shownCount),
        canRevealMore: search.shownCount < search.candidates.length, canFetchNextPage: sessionUsable && nextPageAvailable(search), excludedSummary,
        supplement: { proposal, ran: !!search.supplement?.ranAttemptId, available: sessionUsable && !search.supplement?.ranAttemptId,
          diagnosis: sessionUsable && requirement ? attempt(() => diagnoseSearch({ requirement, reviews }, search)) : null } } : null,
      attemptHistory: attempts.slice(-20).reverse().map(a => ({ attemptId: a.attemptId, sessionId: a.sessionId, kind: a.kind, changeReason: a.changeReason, startedAt: a.startedAt,
        queries: a.queries, totals: a.totals, stoppedReason: a.stoppedReason, notRunRequests: a.notRunRequests,
        requests: a.requests.map(r => ({ provider: r.provider, query: r.query, strategy: r.strategy, page: r.page, status: r.status, networkRequests: r.networkRequests, rawCount: r.rawCount, duplicateCount: r.duplicateCount, technicalPassCount: r.technicalPassCount })) })),
      queryHistory: searchScene?.searchEnabled ? attempt(() => readQueryHistory(root, plan, scene.visualId).revisions) ?? [] : [],
      noSuitable: reviewFile?.sceneVerdicts.find(v => v.requirementKey === reviewKey) ?? null, metrics, clip,
      motion: motionSlot ? { imageReady: motionSlot.imageReady, status: motionSlot.job?.status ?? null, approved: !!motionSlot.job?.approved && motionSlot.job.status === "completed" } : null };
  });
  return { ready, planFingerprint: plan.fingerprint, searchPlan: searchPlan ? { fingerprint: searchPlan.fingerprint, revision: searchPlan.revision, origin: searchPlan.origin, contract: searchPlan.contract } : null,
    selection: state ? { fingerprint: state.selection?.fingerprint ?? null, matchesPlan: state.matchesPlan } : null, workerAvailable: motionWorkerAvailable(), providers, scenes };
}
