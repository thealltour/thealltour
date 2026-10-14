import { existsSync, readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { candidateReviewFileSchema, searchAttemptLogSchema, stockSceneSearchSchema, visualSourceSelectionSchema, type CandidateReviewFile, type SearchAttemptRecord, type StockCandidate, type StockSceneSearch, type StockSourceChoice } from "./contracts";
import { candidateKey } from "./evaluation";
import { visualSourcesDirectory } from "./store";

/**
 * Observable counts only. Unreviewed candidates are not failures, elapsed time may include time away from the screen,
 * and nothing here changes prompts or ranks strategies globally: small samples are shown with their size.
 */
type Bucket = { requests: number; externalRequests: number; rawCount: number; technicalPassCount: number; shortlisted: number; rejected: number; rejectedByReason: Record<string, number>; usedForRange: number };
const bucket = (): Bucket => ({ requests: 0, externalRequests: 0, rawCount: 0, technicalPassCount: 0, shortlisted: 0, rejected: 0, rejectedByReason: {}, usedForRange: 0 });
export type SceneSearchMetrics = {
  searchActions: Record<SearchAttemptRecord["kind"], number>; externalRequests: number; cacheHits: number; notRunRequests: number; rateLimitedStops: number;
  untilSelection: { selected: boolean; searchActions: number; externalRequests: number; elapsedSinceFirstSearchMs: number | null };
  reviews: { shortlisted: number; rejected: number; shortlistedLedToRange: number; rejectedByReason: Record<string, number> };
  clipApproved: boolean; noSuitable: boolean;
  byStrategy: Record<string, Bucket>; byProvider: Record<string, Bucket>;
};
export type SceneMetricInput = { attempts: SearchAttemptRecord[]; reviews: CandidateReviewFile; requirementKey: string | null; searches: StockSceneSearch[];
  currentChoice: StockSourceChoice | null; pastChoices: StockSourceChoice[]; clipApproved: boolean };
export function sceneSearchMetrics(input: SceneMetricInput): SceneSearchMetrics {
  const byStrategy: Record<string, Bucket> = {}; const byProvider: Record<string, Bucket> = {};
  const at = (map: Record<string, Bucket>, key: string) => (map[key] ??= bucket());
  for (const attempt of input.attempts) for (const r of attempt.requests) for (const b of [at(byStrategy, r.strategy ?? "unspecified"), at(byProvider, r.provider)]) {
    b.requests++; b.externalRequests += r.networkRequests; b.rawCount += r.rawCount; b.technicalPassCount += r.technicalPassCount;
  }
  const candidates = new Map<string, StockCandidate>(); for (const search of input.searches) for (const c of search.candidates) if (!candidates.has(candidateKey(c))) candidates.set(candidateKey(c), c);
  const ranged = new Set([...input.pastChoices, ...(input.currentChoice ? [input.currentChoice] : [])].map(candidateKey));
  const reviews = input.reviews.reviews.filter(r => input.requirementKey === null || r.requirementKey === input.requirementKey);
  const rejectedByReason: Record<string, number> = {};
  for (const review of reviews) {
    const candidate = candidates.get(candidateKey(review));
    const strategies = candidate ? [...new Set(candidate.foundBy.map(f => f.strategy ?? "unspecified"))] : [];
    for (const b of [...strategies.map(s => at(byStrategy, s)), at(byProvider, review.provider)]) {
      if (review.verdict === "shortlist") b.shortlisted++; else { b.rejected++; b.rejectedByReason[review.reason!] = (b.rejectedByReason[review.reason!] ?? 0) + 1; }
      if (ranged.has(candidateKey(review))) b.usedForRange++;
    }
    if (review.verdict === "reject") rejectedByReason[review.reason!] = (rejectedByReason[review.reason!] ?? 0) + 1;
  }
  const selectedAt = input.currentChoice ? Date.parse(input.currentChoice.snapshot.selectedAt) : null;
  const before = selectedAt === null ? [] : input.attempts.filter(a => Date.parse(a.finishedAt) <= selectedAt);
  const first = input.attempts.map(a => Date.parse(a.startedAt)).sort((a, b) => a - b)[0];
  const kinds = { initial: 0, supplement: 0, next_page: 0 }; for (const a of input.attempts) kinds[a.kind]++;
  return {
    searchActions: kinds, externalRequests: input.attempts.reduce((n, a) => n + a.totals.networkRequests, 0), cacheHits: input.attempts.reduce((n, a) => n + a.totals.cacheHits, 0),
    notRunRequests: input.attempts.reduce((n, a) => n + a.notRunRequests, 0), rateLimitedStops: input.attempts.filter(a => a.stoppedReason === "rate_limited").length,
    untilSelection: { selected: selectedAt !== null, searchActions: before.length, externalRequests: before.reduce((n, a) => n + a.totals.networkRequests, 0),
      elapsedSinceFirstSearchMs: selectedAt !== null && first !== undefined && first <= selectedAt ? selectedAt - first : null },
    reviews: { shortlisted: reviews.filter(r => r.verdict === "shortlist").length, rejected: reviews.filter(r => r.verdict === "reject").length,
      shortlistedLedToRange: reviews.filter(r => r.verdict === "shortlist" && ranged.has(candidateKey(r))).length, rejectedByReason },
    clipApproved: input.clipApproved,
    noSuitable: input.reviews.sceneVerdicts.some(v => input.requirementKey === null || v.requirementKey === input.requirementKey),
    byStrategy, byProvider,
  };
}

const readJson = (path: string) => { try { return JSON.parse(readFileSync(path, "utf8")) as unknown; } catch { return null; } };
const jsonFiles = (directory: string) => existsSync(directory) ? readdirSync(directory).filter(n => n.endsWith(".json")).map(n => join(directory, n)) : [];
/** Every stored session for a scene: the current file and the archived ones. Unreadable files are skipped. */
export function storedSearches(root: string, scenePlanFingerprint: string, visualId: string) {
  const directory = join(visualSourcesDirectory(root), "search", scenePlanFingerprint);
  const paths = [join(directory, `${visualId}.json`), ...jsonFiles(join(directory, "archive")).filter(p => p.split("/").at(-1)!.startsWith(`${visualId}-`))];
  return paths.flatMap(path => { const parsed = stockSceneSearchSchema.safeParse(readJson(path)); return parsed.success ? [parsed.data] : []; });
}
/** Stock choices this scene has had, from the current selection and its revisions. */
export function stockChoiceHistory(root: string, visualId: string) {
  const directory = visualSourcesDirectory(root);
  return [join(directory, "selection.json"), ...jsonFiles(join(directory, "selection-revisions"))].flatMap(path => {
    const parsed = visualSourceSelectionSchema.safeParse(readJson(path)); if (!parsed.success) return [];
    return parsed.data.scenes.filter((s): s is StockSourceChoice => s.visualId === visualId && s.source === "stock_video");
  });
}
/**
 * Read-only roll-up across contents for the metrics script. Each scene contributes its own records; no review travels
 * to another scene, and the result is a table of counts, not a ranking.
 */
export function aggregateStockSearchMetrics(roots: string[]) {
  const total = { contents: 0, scenes: 0, scenesWithSelection: 0, scenesNoSuitable: 0, clipApprovals: 0, searchActions: { initial: 0, supplement: 0, next_page: 0 }, externalRequests: 0,
    shortlisted: 0, shortlistedLedToRange: 0, rejected: 0, rejectedByReason: {} as Record<string, number>, byStrategy: {} as Record<string, Bucket>, byProvider: {} as Record<string, Bucket> };
  const add = (target: Record<string, Bucket>, source: Record<string, Bucket>) => { for (const [key, b] of Object.entries(source)) {
    const t = (target[key] ??= bucket()); for (const field of ["requests", "externalRequests", "rawCount", "technicalPassCount", "shortlisted", "rejected", "usedForRange"] as const) t[field] += b[field];
    for (const [reason, n] of Object.entries(b.rejectedByReason)) t.rejectedByReason[reason] = (t.rejectedByReason[reason] ?? 0) + n;
  } };
  for (const root of roots) {
    const base = visualSourcesDirectory(root); if (!existsSync(base)) continue; total.contents++;
    const scenes = new Set<string>();
    for (const kind of ["search-attempts", "reviews"]) for (const fp of existsSync(join(base, kind)) ? readdirSync(join(base, kind)) : []) for (const path of jsonFiles(join(base, kind, fp))) scenes.add(`${fp}/${path.split("/").at(-1)!.replace(/\.json$/, "")}`);
    const currentSelection = visualSourceSelectionSchema.safeParse(readJson(join(base, "selection.json")));
    for (const scene of scenes) {
      const [fp, visualId] = scene.split("/") as [string, string];
      const log = searchAttemptLogSchema.safeParse(readJson(join(base, "search-attempts", fp, `${visualId}.json`)));
      const reviewFile = candidateReviewFileSchema.safeParse(readJson(join(base, "reviews", fp, `${visualId}.json`)));
      const current = currentSelection.success && currentSelection.data.planFingerprint === fp ? currentSelection.data.scenes.find((s): s is StockSourceChoice => s.visualId === visualId && s.source === "stock_video") ?? null : null;
      const metrics = sceneSearchMetrics({ attempts: log.success ? log.data.attempts : [], requirementKey: null, searches: storedSearches(root, fp, visualId), currentChoice: current,
        reviews: reviewFile.success ? reviewFile.data : { contract: "narration-stock-candidate-reviews-v1", visualId, scenePlanFingerprint: fp, reviews: [], sceneVerdicts: [], history: [] },
        pastChoices: stockChoiceHistory(root, visualId), clipApproved: false });
      total.scenes++; if (metrics.untilSelection.selected) total.scenesWithSelection++; if (metrics.noSuitable) total.scenesNoSuitable++;
      for (const kind of ["initial", "supplement", "next_page"] as const) total.searchActions[kind] += metrics.searchActions[kind];
      total.externalRequests += metrics.externalRequests; total.shortlisted += metrics.reviews.shortlisted; total.rejected += metrics.reviews.rejected; total.shortlistedLedToRange += metrics.reviews.shortlistedLedToRange;
      for (const [reason, n] of Object.entries(metrics.reviews.rejectedByReason)) total.rejectedByReason[reason] = (total.rejectedByReason[reason] ?? 0) + n;
      add(total.byStrategy, metrics.byStrategy); add(total.byProvider, metrics.byProvider);
    }
    total.clipApprovals += countApprovedClips(base);
  }
  return total;
}
function countApprovedClips(base: string) {
  return jsonFiles(join(base, "clips", "jobs")).filter(path => { const job = readJson(path) as { approval?: unknown } | null; return !!job?.approval; }).length;
}
