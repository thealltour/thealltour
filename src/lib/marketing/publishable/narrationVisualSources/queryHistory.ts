import { existsSync, readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import type { NarrationScenePlan } from "../narrationScenes/contracts";
import { STOCK_PROVIDERS, stockSceneSearchSchema, stockSearchPlanSchema, visualSourceSelectionSchema, type SearchStrategy, type StockProvider, type StockSceneSearch, type StockSearchPlan } from "./contracts";
import { candidateKey } from "./evaluation";
import { sceneRequirement } from "./requirements";
import { readAttemptLog, readReviews, readSearchPlan, readSelection, visualSourcesDirectory } from "./store";

/**
 * Read-only history of the queries each search-plan revision gave this scene. It never re-runs a query, never merges an
 * old result into the current candidates and never touches reviews or the selection; a reviewer may copy a query into
 * the plan being edited. Counts are null when no stored record covers that revision ("기록 없음"), never zero.
 */
export type QueryHistoryRow = {
  provider: StockProvider; query: string; planQuery: string; strategy: SearchStrategy | null;
  ran: boolean; runs: number; rawCount: number | null; technicalPassCount: number | null; adopted: number | null;
  lastRunAt: string | null; resultRefs: string[];
};
export type QueryHistoryRevision = { revision: number; fingerprint: string; current: boolean; updatedAt: string; rows: QueryHistoryRow[] };
export type QueryHistory = { visualId: string; revisions: QueryHistoryRevision[] };

const readJson = (path: string) => { try { return JSON.parse(readFileSync(path, "utf8")) as unknown; } catch { return null; } };
const listJson = (dir: string, prefix: string) => existsSync(dir) ? readdirSync(dir).filter(name => name.startsWith(prefix) && name.endsWith(".json")).sort() : [];
function planRevisions(root: string, scenePlan: NarrationScenePlan) {
  const dir = join(visualSourcesDirectory(root), "search-plans", "revisions");
  const plans = new Map<string, StockSearchPlan>();
  for (const name of listJson(dir, `${scenePlan.fingerprint}-`)) {
    const parsed = stockSearchPlanSchema.safeParse(readJson(join(dir, name)));
    if (parsed.success && parsed.data.scenePlanFingerprint === scenePlan.fingerprint) plans.set(parsed.data.fingerprint, parsed.data);
  }
  const current = readSearchPlan(root, scenePlan); if (current) plans.set(current.fingerprint, current);
  return { plans: [...plans.values()].sort((a, b) => a.revision - b.revision), current };
}
function storedResults(root: string, scenePlanFingerprint: string, visualId: string) {
  const base = join(visualSourcesDirectory(root), "search", scenePlanFingerprint);
  const files = [`${visualId}.json`, ...listJson(join(base, "archive"), `${visualId}-`).map(name => `archive/${name}`)];
  return files.flatMap(file => {
    const parsed = stockSceneSearchSchema.safeParse(readJson(join(base, file)));
    return parsed.success && parsed.data.visualId === visualId ? [{ ref: `search/${scenePlanFingerprint}/${file}`, search: parsed.data }] : [];
  });
}
function adoptedKeys(root: string, scenePlanFingerprint: string, visualId: string) {
  const keys = new Set(readReviews(root, scenePlanFingerprint, visualId).reviews.filter(r => r.verdict === "shortlist").map(candidateKey));
  const dir = join(visualSourcesDirectory(root), "selection-revisions");
  const selections = [readSelection(root), ...listJson(dir, "").map(name => { const parsed = visualSourceSelectionSchema.safeParse(readJson(join(dir, name))); return parsed.success ? parsed.data : null; })];
  for (const selection of selections) for (const choice of selection?.scenes ?? []) if (choice.visualId === visualId && choice.source === "stock_video") keys.add(candidateKey(choice));
  return keys;
}
const rowKey = (fingerprint: string, provider: StockProvider, query: string) => `${fingerprint}\u0000${provider}\u0000${query}`;

export function readQueryHistory(root: string, scenePlan: NarrationScenePlan, visualId: string): QueryHistory {
  const { plans, current } = planRevisions(root, scenePlan);
  const tally = new Map<string, { runs: number; raw: number; pass: number; lastRunAt: string | null; refs: Set<string> }>();
  const touch = (key: string) => { const t = tally.get(key) ?? { runs: 0, raw: 0, pass: 0, lastRunAt: null, refs: new Set<string>() }; tally.set(key, t); return t; };
  const results = storedResults(root, scenePlan.fingerprint, visualId);
  const refBySession = new Map(results.flatMap(r => r.search.sessionId ? [[r.search.sessionId, r.ref] as const] : []));
  const attempts = readAttemptLog(root, scenePlan.fingerprint, visualId);
  const recordedSessions = new Set(attempts.map(a => a.sessionId));
  for (const attempt of attempts) for (const request of attempt.requests) {
    if (request.status === "disabled" || request.status === "cap_reached") continue;
    const t = touch(rowKey(attempt.searchPlanFingerprint, request.provider, request.query));
    t.runs++; t.raw += request.rawCount; t.pass += request.technicalPassCount; t.lastRunAt = attempt.finishedAt;
    const ref = refBySession.get(attempt.sessionId); if (ref) t.refs.add(ref);
  }
  // Results written before attempt records existed: their request list and the candidates each query found.
  const legacyPass = (search: StockSceneSearch, provider: StockProvider, query: string) => search.candidates.filter(c => c.provider === provider && c.foundBy.some(f => f.query === query)).length;
  for (const { ref, search } of results) {
    if (search.sessionId && recordedSessions.has(search.sessionId)) continue;
    const seen = new Set<string>();
    for (const a of search.attempts) {
      if (a.status === "disabled" || a.status === "cap_reached") continue;
      const key = rowKey(search.searchPlanFingerprint, a.provider, a.query); const t = touch(key);
      t.runs++; t.raw += a.rawCount; t.lastRunAt = search.searchedAt; t.refs.add(ref);
      if (!seen.has(key)) { seen.add(key); t.pass += legacyPass(search, a.provider, a.query); }
    }
  }
  const adopted = adoptedKeys(root, scenePlan.fingerprint, visualId);
  const adoptedBy = (fingerprint: string, provider: StockProvider, query: string) => {
    const found = new Set<string>();
    for (const { search } of results) if (search.searchPlanFingerprint === fingerprint) for (const c of search.candidates) if (c.provider === provider && c.foundBy.some(f => f.query === query) && adopted.has(candidateKey(c))) found.add(candidateKey(c));
    return found.size;
  };
  return { visualId, revisions: plans.flatMap(plan => {
    const scene = plan.scenes.find(s => s.visualId === visualId); if (!scene) return [];
    const rows = sceneRequirement(scene).queries.flatMap(q => STOCK_PROVIDERS.map(provider => {
      const query = provider === "pixabay" && q.pixabayText ? q.pixabayText : q.text;
      const t = tally.get(rowKey(plan.fingerprint, provider, query));
      return { provider, query, planQuery: q.text, strategy: q.strategy, ran: !!t, runs: t?.runs ?? 0, rawCount: t ? t.raw : null, technicalPassCount: t ? t.pass : null,
        adopted: t && t.refs.size ? adoptedBy(plan.fingerprint, provider, query) : null, lastRunAt: t?.lastRunAt ?? null, resultRefs: t ? [...t.refs] : [] };
    }));
    return [{ revision: plan.revision, fingerprint: plan.fingerprint, current: plan.fingerprint === current?.fingerprint, updatedAt: plan.updatedAt, rows }];
  }).reverse() };
}
