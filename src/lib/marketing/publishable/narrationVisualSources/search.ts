import { randomUUID } from "node:crypto";
import { NarrationError } from "../narration/persistence";
import { requireFreshScenePlan, sceneHash, withSceneLock } from "../narrationScenes/service";
import { motionFrameLayout } from "../narrationMotion/frameLayout";
import { STOCK_PROVIDERS, type ExclusionReason, type SearchAttempt, type SearchAttemptRecord, type SearchRequestRecord, type SearchStrategy, type StockCandidate, type StockProvider, type StockSceneSearch } from "./contracts";
import { candidateKey, rankCandidates } from "./evaluation";
import { chooseRenderRendition, choosePreviewRendition } from "./fit";
import { metadataMatch, pageSlug, placeEvidence, uniqueTerms } from "./metadataText";
import { searchStockPage, STOCK_SEARCH_LIMITS, type RawStockVideo } from "./providers";
import { sceneRequirement, type SceneRequirement } from "./requirements";
import { appendAttempt, archiveSceneSearch, readAttemptLog, readReviews, readSceneSearch, readSearchPlan, requirementKey, sceneSearchKey, writeSceneSearch } from "./store";

export { metadataMatch, placeEvidence, sceneTerms } from "./metadataText";
export const CANDIDATES_PER_REVEAL = 3;
const FAILED: SearchAttempt["status"][] = ["rate_limited", "auth_failed", "error", "disabled", "cap_reached"];

function evaluate(video: RawStockVideo, requirement: SceneRequirement, frameCount: number): { candidate: Omit<StockCandidate, "foundBy"> } | { reasons: ExclusionReason[] } {
  const reasons: ExclusionReason[] = [];
  if (video.declaredDurationMs < Math.ceil(frameCount * 1000 / 30)) reasons.push("too_short");
  const render = chooseRenderRendition(video.renditions);
  if ("reason" in render) reasons.push(render.reason);
  const evidence = requirement.placeRequirement === "specific_place" && requirement.placeName ? placeEvidence(video, requirement.placeName) : null;
  if (reasons.length || "reason" in render) return { reasons: reasons.length ? reasons : ["no_usable_rendition"] };
  const sceneWords = uniqueTerms([requirement.coreSubject, requirement.coreAction, ...requirement.required]);
  return { candidate: { provider: video.provider, videoId: video.videoId, pageUrl: video.pageUrl, creatorName: video.creatorName, creatorUrl: video.creatorUrl,
    declaredDurationMs: video.declaredDurationMs, posterUrl: video.posterUrl, previewRendition: choosePreviewRendition(video.renditions), renderRendition: render.rendition, fit: render.fit,
    sourceMetadata: { tags: video.tags, pageSlug: pageSlug(video.pageUrl) }, placeEvidence: evidence, metadataMatch: metadataMatch(video, sceneWords).slice(0, 30) } };
}
type Hit = { video: RawStockVideo; request: number; foundBy: StockCandidate["foundBy"][number] };
/** Provider order is kept within each (provider, query) list; lists are interleaved so no single query dominates. */
function interleave(lists: Hit[][]) {
  const out: Hit[] = []; const longest = Math.max(0, ...lists.map(l => l.length));
  for (let i = 0; i < longest; i++) for (const list of lists) if (list[i]) out.push(list[i]!);
  return out;
}
/**
 * A video found again keeps one candidate entry and gains the new query in foundBy. Already revealed candidates keep
 * their place, so revealing more never hides one; the rest are ordered by rankCandidates.
 */
function merge(previous: StockSceneSearch | null, hits: Hit[], requests: SearchRequestRecord[], requirement: SceneRequirement, frameCount: number, rejected: Set<string>) {
  const candidates = new Map<string, StockCandidate>((previous?.candidates ?? []).map(c => [candidateKey(c), c]));
  const excluded = new Map<string, StockSceneSearch["excluded"][number]>((previous?.excluded ?? []).map(e => [candidateKey(e), e]));
  for (const hit of hits) {
    const key = candidateKey(hit.video); const tally = requests[hit.request]!;
    const existing = candidates.get(key);
    if (existing || excluded.has(key)) {
      tally.duplicateCount++;
      if (existing && !existing.foundBy.some(f => f.query === hit.foundBy.query) && existing.foundBy.length < 9) candidates.set(key, { ...existing, foundBy: [...existing.foundBy, hit.foundBy] });
      continue;
    }
    const result = evaluate(hit.video, requirement, frameCount);
    if ("candidate" in result) { candidates.set(key, { ...result.candidate, foundBy: [hit.foundBy] }); tally.technicalPassCount++; }
    else { excluded.set(key, { provider: hit.video.provider, videoId: hit.video.videoId, reasons: result.reasons }); for (const reason of result.reasons) tally.excludedByReason[reason] = (tally.excludedByReason[reason] ?? 0) + 1; }
  }
  const all = [...candidates.values()]; const fixed = all.slice(0, previous?.shownCount ?? 0);
  return { candidates: [...fixed, ...rankCandidates(all.slice(fixed.length), requirement, rejected)].slice(0, 90), excluded: [...excluded.values()].slice(0, 400) };
}
type PlannedRequest = { provider: StockProvider; query: string; strategy: SearchStrategy | null; page: number };
/**
 * Sends the planned requests one by one. A 429 stops the whole action at once; an auth failure skips the rest of that
 * provider. Requests not sent are counted, not recorded as attempts.
 */
async function runRequests(planned: PlannedRequest[], attemptId: string) {
  const requests: SearchRequestRecord[] = []; const lists: Hit[][] = []; const legacy: SearchAttempt[] = [];
  let stoppedReason: "rate_limited" | null = null; let notRunRequests = 0; const authFailed = new Set<StockProvider>();
  for (const item of planned) {
    if (stoppedReason || authFailed.has(item.provider)) { notRunRequests++; continue; }
    const result = await searchStockPage({ provider: item.provider, query: item.query, page: item.page });
    const request = requests.push({ ...item, status: result.status, cacheHit: result.status === "cache_hit", networkRequests: result.networkRequests, rawCount: result.videos.length,
      duplicateCount: 0, technicalPassCount: 0, excludedByReason: {}, message: result.message }) - 1;
    legacy.push({ provider: item.provider, query: item.query, page: item.page, status: result.status, rawCount: result.videos.length, message: result.message });
    lists.push(result.videos.map((video, i) => ({ video, request, foundBy: { query: item.query, page: item.page, providerRank: (item.page - 1) * STOCK_SEARCH_LIMITS.perPage[item.provider] + i + 1, strategy: item.strategy, attemptId } })));
    if (result.status === "rate_limited") stoppedReason = "rate_limited";
    if (result.status === "auth_failed") authFailed.add(item.provider);
  }
  return { requests, hits: interleave(lists), legacy, stoppedReason, notRunRequests };
}
/** The text a provider receives: Pixabay gets the shorter pixabayText when the plan has one. Still one request per provider. */
export const providerQuery = (q: { text: string; pixabayText?: string }, provider: StockProvider) => provider === "pixabay" && q.pixabayText ? q.pixabayText : q.text;
export function planRequests(queries: Array<{ text: string; strategy: SearchStrategy | null; pixabayText?: string }>, page: (provider: StockProvider, query: string) => number | null): PlannedRequest[] {
  return queries.flatMap(q => STOCK_PROVIDERS.flatMap(provider => {
    const query = providerQuery(q, provider); const p = page(provider, query);
    return p === null ? [] : [{ provider, query, strategy: q.strategy, page: p }];
  }));
}

type Target = { expectedPlanFingerprint: string; expectedSearchPlanFingerprint: string; visualId: string };
export function sceneContext(root: string, candidateId: string, input: Target) {
  const plan = requireFreshScenePlan(root, candidateId, input.expectedPlanFingerprint);
  const searchPlan = readSearchPlan(root, plan);
  if (!searchPlan || searchPlan.fingerprint !== input.expectedSearchPlanFingerprint) throw new NarrationError("스톡 검색 계획이 변경되었습니다. 다시 불러와주세요.", 409);
  const index = plan.scenes.findIndex(s => s.visualId === input.visualId); if (index < 0) throw new NarrationError("현재 계획에 없는 장면입니다.", 400);
  const scene = searchPlan.scenes[index]!; const interval = motionFrameLayout(plan)[index]!; const frameCount = interval.endFrame - interval.startFrame;
  const requirement = sceneRequirement(scene); const key = sceneSearchKey(plan.fingerprint, scene, frameCount);
  const stored = readSceneSearch(root, plan.fingerprint, input.visualId);
  const reviewKey = requirementKey(requirement);
  const reviews = readReviews(root, plan.fingerprint, input.visualId).reviews.filter(r => r.requirementKey === reviewKey);
  return { candidateId, plan, searchPlan, scene, requirement, frameCount, key, stored, current: stored?.sceneSearchKey === key ? stored : null, reviewKey, reviews,
    rejected: new Set(reviews.filter(r => r.verdict === "reject").map(candidateKey)) };
}
export type SceneContext = ReturnType<typeof sceneContext>;
/**
 * Writes under the scene lock. Attempt records are appended even when the write is refused, because their requests were
 * really sent. Search results never touch the selection, clip jobs or render inputs.
 */
export function commitSearch(root: string, context: SceneContext, next: StockSceneSearch, attempt: SearchAttemptRecord | null, archive: StockSceneSearch | null) {
  return withSceneLock(root, () => {
    if (attempt) appendAttempt(root, context.plan.fingerprint, context.scene.visualId, attempt);
    const current = requireFreshScenePlan(root, context.candidateId, context.plan.fingerprint);
    if (readSearchPlan(root, current)?.fingerprint !== context.searchPlan.fingerprint) throw new NarrationError("검색 중 스톡 검색 계획이 변경되었습니다. 다시 검색해주세요.", 409);
    const now = readSceneSearch(root, context.plan.fingerprint, context.scene.visualId);
    if (sceneHash(now ?? null) !== sceneHash(context.stored ?? null)) throw new NarrationError("다른 화면에서 이 장면의 검색 결과가 바뀌었습니다. 다시 불러와주세요.", 409);
    if (archive) archiveSceneSearch(root, archive);
    writeSceneSearch(root, next); return next;
  });
}
const sumBy = (requests: SearchRequestRecord[], pick: (r: SearchRequestRecord) => number) => requests.reduce((total, r) => total + pick(r), 0);
export function attemptRecord(context: SceneContext, input: { attemptId: string; sessionId: string; kind: SearchAttemptRecord["kind"]; parentAttemptId: string | null; changeReason: string | null;
  startedAt: string; queries: SearchAttemptRecord["queries"]; run: Awaited<ReturnType<typeof runRequests>> }): SearchAttemptRecord {
  const excludedByReason: Record<string, number> = {};
  for (const r of input.run.requests) for (const [reason, n] of Object.entries(r.excludedByReason)) excludedByReason[reason] = (excludedByReason[reason] ?? 0) + n;
  return { attemptId: input.attemptId, sessionId: input.sessionId, kind: input.kind, parentAttemptId: input.parentAttemptId, changeReason: input.changeReason,
    searchPlanFingerprint: context.searchPlan.fingerprint, searchPlanRevision: context.searchPlan.revision, sceneSearchKey: context.key, startedAt: input.startedAt, finishedAt: new Date().toISOString(), queries: input.queries,
    requests: input.run.requests, totals: { networkRequests: sumBy(input.run.requests, r => r.networkRequests), cacheHits: input.run.requests.filter(r => r.cacheHit).length,
      rawCount: sumBy(input.run.requests, r => r.rawCount), duplicateCount: sumBy(input.run.requests, r => r.duplicateCount), technicalPassCount: sumBy(input.run.requests, r => r.technicalPassCount), excludedByReason },
    stoppedReason: input.run.stoppedReason, notRunRequests: input.run.notRunRequests };
}
/** Runs requests and folds them into the session. Used by the initial batch, the next page and the single supplement. */
export async function executeBatch(context: SceneContext, input: { previous: StockSceneSearch | null; sessionId: string; kind: SearchAttemptRecord["kind"]; parentAttemptId: string | null;
  changeReason: string | null; queries: SearchAttemptRecord["queries"]; planned: PlannedRequest[] }) {
  const attemptId = randomUUID(); const startedAt = new Date().toISOString();
  const run = await runRequests(input.planned, attemptId);
  const merged = merge(input.previous, run.hits, run.requests, context.requirement, context.frameCount, context.rejected);
  const allFailed = run.requests.every(r => FAILED.includes(r.status));
  const outcome = merged.candidates.length ? "candidates" as const : allFailed ? "search_failed" as const : "no_suitable_candidate" as const;
  const attempt = attemptRecord(context, { attemptId, sessionId: input.sessionId, kind: input.kind, parentAttemptId: input.parentAttemptId, changeReason: input.changeReason, startedAt, queries: input.queries, run });
  const pages = [...(input.previous?.attempts ?? []), ...run.legacy].map(a => a.page);
  return { attempt, merged, outcome, legacy: run.legacy, pagesFetched: Math.min(STOCK_SEARCH_LIMITS.maxPages, Math.max(1, ...pages)) };
}
/** Sessions written before session fields existed are read as one session whose queries are the ones they searched. */
export function sessionQueries(search: StockSceneSearch): NonNullable<StockSceneSearch["sessionQueries"]> {
  return search.sessionQueries ?? [...new Set(search.attempts.map(a => a.query))].map(text => ({ text, strategy: null, purpose: null, batch: "initial" as const }));
}
export function lastAttemptOfSession(root: string, context: SceneContext, search: StockSceneSearch) {
  return search.sessionId ? readAttemptLog(root, context.plan.fingerprint, context.scene.visualId).filter(a => a.sessionId === search.sessionId).at(-1) ?? null : null;
}

/**
 * Explicit user action only. Never called on screen entry or render. Without newSession a stored current result is
 * returned without any request; a new session archives the previous result and runs the plan's queries once.
 */
export async function runSceneSearch(root: string, candidateId: string, input: Target & { newSession?: boolean }) {
  const context = sceneContext(root, candidateId, input);
  const base = { contract: "narration-stock-scene-search-v1" as const, visualId: input.visualId, scenePlanFingerprint: context.plan.fingerprint, searchPlanFingerprint: context.searchPlan.fingerprint, sceneSearchKey: context.key, frameCount: context.frameCount };
  const now = new Date().toISOString();
  if (!context.requirement.searchEnabled) {
    return commitSearch(root, context, { ...base, outcome: "not_applicable", attempts: [], candidates: [], excluded: [], shownCount: 0, pagesFetched: 1, searchedAt: now },
      null, context.stored && context.stored.outcome !== "not_applicable" ? context.stored : null);
  }
  if (!input.newSession && context.current && context.current.outcome !== "search_failed") return context.current;
  const sessionId = randomUUID(); const queries = context.requirement.queries;
  const batch = await executeBatch(context, { previous: null, sessionId, kind: "initial", parentAttemptId: null, changeReason: null, queries, planned: planRequests(queries, () => 1) });
  const next: StockSceneSearch = { ...base, outcome: batch.outcome, attempts: batch.legacy.slice(-40), ...batch.merged, shownCount: Math.min(batch.merged.candidates.length, CANDIDATES_PER_REVEAL),
    pagesFetched: 1, searchedAt: now, sessionId, sessionStartedAt: now, sessionQueries: queries.map(q => ({ ...q, batch: "initial" as const })), supplement: { proposal: null, ranAttemptId: null } };
  return commitSearch(root, context, next, batch.attempt, context.stored);
}
function requireCurrentSession(context: SceneContext) {
  const current = context.current;
  if (!current || current.outcome === "not_applicable") throw new NarrationError("먼저 '스톡 영상 찾기'로 현재 검색 조건의 검색을 실행해주세요.", 409);
  return current;
}
/** Shows more candidates that are already stored. Never contacts a provider. */
export function revealMoreCandidates(root: string, candidateId: string, input: Target) {
  const context = sceneContext(root, candidateId, input); const current = requireCurrentSession(context);
  if (current.shownCount >= current.candidates.length) throw new NarrationError("저장된 후보를 모두 표시했습니다. 새 후보가 필요하면 '다음 페이지 검색'(외부 호출)이나 보완 검색을 사용해주세요.", 409);
  return commitSearch(root, context, { ...current, shownCount: Math.min(current.candidates.length, current.shownCount + CANDIDATES_PER_REVEAL) }, null, null);
}
const pageKey = (provider: StockProvider, query: string) => `${provider}\u0000${query}`;
const pagesByQuery = (search: StockSceneSearch) => {
  const pages = new Map<string, number>(); for (const a of search.attempts) { const key = pageKey(a.provider, a.query); pages.set(key, Math.max(pages.get(key) ?? 0, a.page)); } return pages;
};
export const nextPageAvailable = (search: StockSceneSearch) => {
  if (search.outcome === "not_applicable") return false;
  const pages = pagesByQuery(search);
  return sessionQueries(search).some(q => STOCK_PROVIDERS.some(provider => (pages.get(pageKey(provider, providerQuery(q, provider))) ?? 0) < STOCK_SEARCH_LIMITS.maxPages));
};
/** Next provider page for each of the session's queries (external requests, within the existing page and hourly caps). */
export async function fetchNextPage(root: string, candidateId: string, input: Target) {
  const context = sceneContext(root, candidateId, input); const current = requireCurrentSession(context);
  if (current.outcome === "search_failed") throw new NarrationError("이전 검색이 실패했습니다. '스톡 영상 찾기'로 다시 검색해주세요.", 409);
  const pages = pagesByQuery(current); const queries = sessionQueries(current);
  const planned = planRequests(queries, (provider, text) => { const next = (pages.get(pageKey(provider, text)) ?? 0) + 1; return next <= STOCK_SEARCH_LIMITS.maxPages ? next : null; });
  if (!planned.length) throw new NarrationError("이 세션의 검색어는 더 가져올 페이지가 없습니다. 보완 검색이나 새 검색을 사용해주세요.", 409);
  const sessionId = current.sessionId ?? randomUUID();
  const used = queries.filter(q => planned.some(p => p.query === providerQuery(q, p.provider)))
    .map(({ text, strategy, purpose, pixabayText }) => ({ text, strategy, purpose, ...(pixabayText ? { pixabayText } : {}) }));
  const batch = await executeBatch(context, { previous: current, sessionId, kind: "next_page", parentAttemptId: lastAttemptOfSession(root, context, current)?.attemptId ?? null, changeReason: null, queries: used, planned });
  return commitSearch(root, context, { ...current, outcome: batch.outcome, attempts: [...current.attempts, ...batch.legacy].slice(-40), ...batch.merged,
    shownCount: Math.min(batch.merged.candidates.length, current.shownCount + CANDIDATES_PER_REVEAL), pagesFetched: batch.pagesFetched, searchedAt: new Date().toISOString(),
    sessionId, sessionStartedAt: current.sessionStartedAt ?? current.searchedAt, sessionQueries: queries }, batch.attempt, null);
}
