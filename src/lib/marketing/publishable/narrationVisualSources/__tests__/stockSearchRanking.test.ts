// @vitest-environment node
import { mkdirSync, mkdtempSync, readdirSync, rmSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import { stockSceneSearchPlanV2Schema, stockSceneSearchSchema, stockSearchPlanSchema, type StockCandidate, type StockSceneSearchPlanV1, type StockSceneSearchPlanV2, type StockSearchPlan } from "../contracts";
import { assessContent, candidateKey, priorityReason, RANKING, rankCandidates, rankingAdjustment, rrfScore } from "../evaluation";
import { readQueryHistory } from "../queryHistory";
import { emptySceneV2, sceneRequirement } from "../requirements";
import { reviewCandidate } from "../reviews";
import { planRequests, runSceneSearch } from "../search";
import { saveSearchPlan } from "../searchPlan";
import { readAttemptLog, requirementKey, sceneSearchKey, searchPlanFingerprint, writeSceneSearch, writeSearchPlan } from "../store";
import { conceptsIn, sequencesOf, withNarrower } from "../vocabulary";
import { fixtureFetch } from "./stockFixtures";
import productionPlan from "./fixtures/production-v1-search-plan.json";
import productionSearch from "./fixtures/production-v1-scene-search.json";
import responses from "./fixtures/oc-oanh-provider-responses.json";
import baseline from "./fixtures/oc-oanh-baseline-orders.json";

const harness = vi.hoisted(() => ({ plan: null as null | { fingerprint: string; scenes: Array<{ visualId: string }> }, frames: 194 }));
vi.mock("../../narrationScenes/service", async importOriginal => {
  const actual = await importOriginal<typeof import("../../narrationScenes/service")>();
  return { ...actual,
    requireFreshScenePlan: (_root: string, _candidateId: string, fingerprint: string) => { if (fingerprint !== harness.plan!.fingerprint) throw new Error("stale_scene_plan"); return harness.plan; },
    withSceneLock: <T,>(_root: string, run: () => T) => run() };
});
vi.mock("../../narrationMotion/frameLayout", () => ({ motionFrameLayout: (plan: { scenes: unknown[] }) => plan.scenes.map((_, i) => ({ startFrame: i * harness.frames, endFrame: (i + 1) * harness.frames })) }));
vi.mock("@/lib/marketing/hermesRuntime/launcher", () => ({ invokeMarketingHermesAgent: vi.fn() }));

const plan = stockSearchPlanSchema.parse(productionPlan) as StockSearchPlan;
const VID = productionSearch.visualId;
const candidateId = "ranking-test";
type Replay = { planRevision: number; provider: "pexels" | "pixabay"; query: string; body: unknown };
const replays = (responses as { responses: Replay[] }).responses;
const replay = (provider: Replay["provider"]) => (url: URL) => {
  const query = url.searchParams.get(provider === "pexels" ? "query" : "q");
  const hit = replays.find(r => r.provider === provider && r.query === query);
  if (!hit) throw new Error(`fixture_missing:${provider}:${query}`);
  return hit.body;
};
let work: string; let net: ReturnType<typeof fixtureFetch>;
const providerCalls = () => net.log.filter(l => l.kind === "provider_api").length;
const bindPlan = (root: string, next: StockSearchPlan) => { harness.plan = { fingerprint: next.scenePlanFingerprint, scenes: next.scenes.map(s => ({ visualId: s.visualId })) }; return root; };
const target = (searchPlan: StockSearchPlan) => ({ expectedPlanFingerprint: searchPlan.scenePlanFingerprint, expectedSearchPlanFingerprint: searchPlan.fingerprint, visualId: VID });
/** The production v1 plan with this scene's queries from an earlier revision, as the deployed code stored them. */
function revisionPlan(revision: number): StockSearchPlan {
  const queries = [...new Set(replays.filter(r => r.planRevision === revision).map(r => r.query))];
  const scenes = plan.scenes.map(s => s.visualId === VID ? { ...(s as StockSceneSearchPlanV1), queries } : s);
  const body = { contract: plan.contract, revision, scenePlanFingerprint: plan.scenePlanFingerprint, origin: plan.origin, scenes } as StockSearchPlan;
  return stockSearchPlanSchema.parse({ ...body, fingerprint: searchPlanFingerprint(body), updatedAt: new Date(Date.UTC(2026, 9, 4, revision)).toISOString() });
}

beforeAll(() => {
  work = mkdtempSync(join(tmpdir(), "stock-ranking-"));
  vi.stubEnv("PEXELS_API_KEY", "fixture-pexels-key"); vi.stubEnv("PIXABAY_API_KEY", "fixture-pixabay-key");
  vi.stubEnv("NARRATION_STOCK_STATE_DIR", join(work, ".stock-state")); vi.stubEnv("NARRATION_STOCK_SEARCH_CACHE_DIR", join(work, ".stock-cache"));
  net = fixtureFetch({ files: {}, pexels: replay("pexels"), pixabay: replay("pixabay") }); vi.stubGlobal("fetch", net.impl);
});
afterAll(() => { vi.unstubAllEnvs(); vi.unstubAllGlobals(); rmSync(work, { recursive: true, force: true }); });

const requirement = sceneRequirement(plan.scenes.find(s => s.visualId === VID)!);
const describedBy = (c: Pick<StockCandidate, "pageUrl" | "sourceMetadata">) => sequencesOf([c.sourceMetadata.pageSlug, ...c.sourceMetadata.tags]);
const names = (c: StockCandidate, ids: Set<string>) => conceptsIn(describedBy(c), "subject").some(h => ids.has(h.concept.id));
const GROUPS = {
  shrimp: (c: StockCandidate) => names(c, withNarrower("shrimp")),
  seafood: (c: StockCandidate) => names(c, withNarrower("seafood")),
  streetDining: (c: StockCandidate) => conceptsIn(describedBy(c), "context").some(h => h.concept.id === "street_food" || h.concept.id === "outdoor_dining"),
  pizza: (c: StockCandidate) => names(c, new Set(["pizza"])),
};
const firstRank = (c: StockCandidate) => Math.min(...c.foundBy.map(f => f.providerRank));
const creator = (c: StockCandidate) => c.creatorUrl ?? c.creatorName ?? "unknown";
const maxPerCreator = (list: StockCandidate[]) => Math.max(0, ...Object.values(list.reduce<Record<string, number>>((out, c) => ({ ...out, [creator(c)]: (out[creator(c)] ?? 0) + 1 }), {})));

describe("Oc Oanh fixture replay: v1 deployed vs v2 local vs PR1 (16 cached responses, no network)", () => {
  it("ranks the same candidate set so shrimp and seafood clues rise and the rooftop pizza falls", async () => {
    const root = bindPlan(join(work, "replay"), plan); writeSearchPlan(root, null, plan);
    const before = providerCalls();
    const result = await runSceneSearch(root, candidateId, target(plan));
    expect(providerCalls() - before).toBe(6);
    expect(net.log.filter(l => l.kind === "blocked")).toEqual([]);
    const byKey = new Map(result.candidates.map(c => [candidateKey(c), c]));
    const orders = { v1: baseline.v1Deployed, v2: baseline.v2Local, pr1: result.candidates.map(candidateKey) };
    expect([...orders.pr1].sort()).toEqual([...orders.v1].sort());
    expect([...orders.v2].sort()).toEqual([...orders.v1].sort());

    const ranks = (order: string[], group: (c: StockCandidate) => boolean) => order.flatMap((key, i) => group(byKey.get(key)!) ? [i + 1] : []);
    const best = (order: string[], group: (c: StockCandidate) => boolean) => ranks(order, group)[0] ?? Infinity;
    // Case A/B on real data: groups come from provider metadata, not from video ids.
    expect(best(orders.pr1, GROUPS.shrimp)).toBeLessThan(best(orders.v1, GROUPS.shrimp));
    expect(best(orders.pr1, GROUPS.shrimp)).toBeLessThan(best(orders.v2, GROUPS.shrimp));
    expect(best(orders.pr1, GROUPS.shrimp)).toBeLessThanOrEqual(6);
    expect(best(orders.pr1, GROUPS.pizza)).toBeGreaterThan(best(orders.v2, GROUPS.pizza));
    expect(best(orders.pr1, GROUPS.pizza)).toBeGreaterThan(RANKING.diversity.window);
    const top = (order: string[], n: number) => order.slice(0, n).map(k => byKey.get(k)!);
    expect(top(orders.pr1, 6).filter(c => assessContent(c, requirement).facets.subject.status === "conflict")).toEqual([]);
    expect(ranks(orders.pr1, GROUPS.seafood).filter(r => r <= 6).length).toBeGreaterThan(ranks(orders.v1, GROUPS.seafood).filter(r => r <= 6).length);
    expect(maxPerCreator(top(orders.pr1, 6))).toBeLessThanOrEqual(RANKING.diversity.maxPerCreator);
    // Case E: the same input in any order gives the same ranking.
    const shuffled = [...result.candidates].reverse();
    expect(rankCandidates(shuffled, requirement, new Set()).map(candidateKey)).toEqual(rankCandidates(result.candidates, requirement, new Set()).map(candidateKey));

    if (process.env.STOCK_RANKING_REPORT === "1") writeReport({ orders, byKey, ranks, best, top });
  });
});

describe("ranking rules (unit)", () => {
  const candidate = (id: string, slug: string | null, tags: string[], ranks: Array<[string, number]>, creatorName: string | null = null) => ({
    provider: "pexels", videoId: id, creatorName, creatorUrl: null, pageUrl: slug ? `https://www.pexels.com/video/${slug.replace(/ /g, "-")}-${id}/` : `https://pixabay.com/videos/id-${id}/`,
    sourceMetadata: { tags, pageSlug: slug }, foundBy: ranks.map(([query, providerRank]) => ({ query, page: 1, providerRank, strategy: null })) }) as unknown as StockCandidate;

  it("Case A: a narrower subject or synonym counts as subject evidence, with the relation shown", () => {
    const shrimp = assessContent(candidate("1", "grilling shrimp outdoors with friends", [], [["q", 9]]), requirement);
    expect(shrimp.facets.subject).toEqual({ status: "match", evidence: ["shrimp (seafood의 하위어)"] });
    expect(shrimp.facets.action).toMatchObject({ status: "no_info" });
    const prawnScene = sceneRequirement({ ...emptySceneV2(VID), searchEnabled: true, coreSubject: "grilled shrimp", coreAction: "grilling" });
    expect(assessContent(candidate("2", null, ["prawns", "barbecue"], [["q", 1]]), prawnScene).facets).toMatchObject({
      subject: { status: "match", evidence: ["prawn (shrimp와 같은 개념)"] }, action: { status: "match", evidence: ["barbecue"], weak: false } });
    // Broader is not narrower: "seafood" does not confirm a shrimp scene, and it is not a conflict either.
    expect(assessContent(candidate("3", "seafood platter", [], [["q", 1]]), prawnScene).facets.subject.status).toBe("no_info");
    // Words inside other words never match.
    expect(assessContent(candidate("4", "shrimpton village road", [], [["q", 1]]), prawnScene).facets.subject.status).toBe("no_info");
  });

  it("Case B: generic word counts never outweigh a missing or conflicting subject", () => {
    const generic = candidate("generic", "people eating sitting at a table on the street outdoors", ["people", "street", "food", "table"], [["q1", 1], ["q2", 1]]);
    const pizza = candidate("pizza", "people eating pizza on a street table", [], [["q1", 1], ["q2", 1]]);
    const shrimp = candidate("shrimp", "shrimp", [], [["q1", 4]]);
    const evidence = assessContent(generic, requirement);
    expect(evidence.facets.subject.status).toBe("no_info");
    expect(evidence.facets.action).toMatchObject({ status: "match", weak: true });
    expect(rankingAdjustment(evidence)).toBe(0);
    expect(evidence.genericOnly.length).toBeGreaterThan(2);
    expect(rankingAdjustment(assessContent(pizza, requirement))).toBeLessThan(0);
    const order = rankCandidates([generic, pizza, shrimp], requirement, new Set()).map(c => c.videoId);
    expect(order.indexOf("pizza")).toBeGreaterThan(order.indexOf("generic"));
    expect(priorityReason(generic, evidence, false)).toMatch(/일반 행동어\(eat\)만 일치/);
    expect(priorityReason(pizza, assessContent(pizza, requirement), false)).toMatch(/다른 피사체 언급\(pizza\)/);
  });

  it("Case C: missing metadata is no information, never a penalty", () => {
    const empty = candidate("empty", null, [], [["q1", 2]]);
    const evidence = assessContent(empty, requirement);
    expect([evidence.facets.subject.status, evidence.facets.action.status, evidence.facets.context.status, evidence.facets.exclusion.status]).toEqual(["no_info", "no_info", "no_info", "no_info"]);
    expect(rankingAdjustment(evidence)).toBe(0);
    expect(priorityReason(empty, evidence, false)).toMatch(/피사체 정보 부족 · 장소 일치 여부는 확인 필요/);
    const conflicting = candidate("burger", "burger", [], [["q1", 2]]);
    expect(rankCandidates([conflicting, empty], requirement, new Set()).map(c => c.videoId)).toEqual(["empty", "burger"]);
  });

  it("RRF counts each query once, keeps provider order and breaks ties deterministically", () => {
    const k = RANKING.rrfK;
    expect(rrfScore(candidate("a", null, [], [["q1", 3], ["q1", 7], ["q2", 1]]))).toBeCloseTo(1 / (k + 3) + 1 / (k + 1));
    const list = [candidate("b", null, [], [["q1", 2]]), candidate("a", null, [], [["q1", 2]]), candidate("c", null, [], [["q1", 1]])];
    expect(rankCandidates(list, requirement, new Set()).map(c => c.videoId)).toEqual(["c", "a", "b"]);
    // Pixabay pages hold 20, Pexels 15: rank 16-20 only exists on Pixabay and is scored by rank alone, not by page.
    expect(rrfScore(candidate("p", null, [], [["q", 20]]))).toBeCloseTo(1 / (k + 20));
  });

  it("limits one creator in the first places but never constrains unknown creators", () => {
    const same = ["a", "b", "c", "d"].map((id, i) => candidate(id, null, [], [["q1", i + 1]], "creator-x"));
    const others = ["e", "f"].map((id, i) => candidate(id, null, [], [["q1", 10 + i]], null));
    // Others move up within the lookahead; when only the same creator is left, the score order stands.
    expect(rankCandidates([...same, ...others], requirement, new Set()).map(c => c.videoId)).toEqual(["a", "e", "b", "f", "c", "d"]);
    const unknown = ["a", "b", "c"].map((id, i) => candidate(id, null, [], [["q1", i + 1]], null));
    expect(rankCandidates(unknown, requirement, new Set()).map(c => c.videoId)).toEqual(["a", "b", "c"]);
  });
});

describe("axes and provider-specific query text", () => {
  const v2 = (over: Partial<StockSceneSearchPlanV2> = {}): StockSceneSearchPlanV2 => ({ ...emptySceneV2(VID), searchEnabled: true, coreSubject: "grilled shrimp", coreAction: "grilling on a street table",
    place: { scope: "city_region", name: null, region: "Ho Chi Minh City" }, misattributionRisk: "generic street eatery",
    queries: [{ text: "grilled shrimp Ho Chi Minh City", strategy: "place_subject", purpose: "지역 + 피사체", pixabayText: "grilled shrimp" }, { text: "shrimp barbecue street", strategy: "subject_action", purpose: "행동" }], ...over });

  it("keeps axes optional, rejects a location axis without a place and leaves review and search keys alone", () => {
    expect(stockSceneSearchPlanV2Schema.safeParse(v2()).success).toBe(true);
    const axes = { location: [], subject: ["grilled shrimp", "prawns"], action: ["grilling"], context: ["street food"] };
    expect(stockSceneSearchPlanV2Schema.safeParse(v2({ axes })).success).toBe(true);
    const anyPlace = stockSceneSearchPlanV2Schema.safeParse(v2({ place: { scope: "any", name: null, region: null }, axes: { ...axes, location: ["Saigon"] },
      queries: [{ text: "shrimp barbecue street", strategy: "subject_action", purpose: "행동" }] }));
    expect(anyPlace.success ? [] : anyPlace.error.issues.map(i => i.message)).toContain("장소 무관 장면에는 장소 축 용어를 넣지 않습니다.");
    expect(requirementKey(sceneRequirement(v2({ axes })))).toBe(requirementKey(sceneRequirement(v2())));
    expect(sceneSearchKey(plan.scenePlanFingerprint, v2({ axes }), 194)).toBe(sceneSearchKey(plan.scenePlanFingerprint, v2(), 194));
    const first = { ...v2().queries[0]!, pixabayText: undefined };
    expect(sceneSearchKey(plan.scenePlanFingerprint, v2({ queries: [first, v2().queries[1]!] }), 194)).not.toBe(sceneSearchKey(plan.scenePlanFingerprint, v2(), 194));
    expect(sceneRequirement(v2({ axes })).axes.subject).toEqual(["grilled shrimp", "prawns"]);
  });

  it("sends Pixabay the short text with the same number of requests", () => {
    const planned = planRequests(v2().queries, () => 1);
    expect(planned.map(p => [p.provider, p.query])).toEqual([["pexels", "grilled shrimp Ho Chi Minh City"], ["pixabay", "grilled shrimp"], ["pexels", "shrimp barbecue street"], ["pixabay", "shrimp barbecue street"]]);
  });
});

describe("Case D: plan revision query history", () => {
  it("keeps every revision's queries and results, never merges them and records the revision on attempts", async () => {
    const root = join(work, "history");
    const [rev2, rev3, rev4] = [revisionPlan(2), revisionPlan(3), revisionPlan(4)];
    bindPlan(root, rev2); writeSearchPlan(root, null, rev2);
    await runSceneSearch(root, candidateId, target(rev2));
    writeSearchPlan(root, rev2, rev3); await runSceneSearch(root, candidateId, target(rev3));
    writeSearchPlan(root, rev3, rev4); const current = await runSceneSearch(root, candidateId, target(rev4));
    expect(readAttemptLog(root, plan.scenePlanFingerprint, VID).map(a => a.searchPlanRevision)).toEqual([2, 3, 4]);
    expect(readdirSync(join(root, "context/narration/visual-sources/search", plan.scenePlanFingerprint, "archive"))).toHaveLength(2);
    const rev4Queries = new Set(replays.filter(r => r.planRevision === 4).map(r => r.query));
    expect(current.candidates.every(c => c.foundBy.every(f => rev4Queries.has(f.query)))).toBe(true);

    const before = providerCalls();
    const history = readQueryHistory(root, harness.plan as never, VID);
    expect(providerCalls()).toBe(before);
    expect(history.revisions.map(r => [r.revision, r.current, r.rows.length])).toEqual([[4, true, 6], [3, false, 6], [2, false, 4]]);
    for (const revision of history.revisions) for (const row of revision.rows) {
      const raw = replays.find(r => r.provider === row.provider && r.query === row.query)!.body as { videos?: unknown[]; hits?: unknown[] };
      expect(row).toMatchObject({ ran: true, runs: 1, rawCount: (raw.videos ?? raw.hits)!.length });
      expect(row.technicalPassCount).not.toBeNull(); expect(row.resultRefs).toHaveLength(1);
    }
  });

  it("reads results stored before attempt records and reports adoption from shortlists", async () => {
    const root = bindPlan(join(work, "legacy-history"), plan);
    writeSearchPlan(root, null, plan); writeSceneSearch(root, stockSceneSearchSchema.parse(productionSearch));
    const first = productionSearch.candidates[0]!;
    reviewCandidate(root, candidateId, { expectedPlanFingerprint: plan.scenePlanFingerprint, visualId: VID, provider: first.provider as "pexels", videoId: first.videoId, verdict: "shortlist", reason: null, note: null });
    const [revision] = readQueryHistory(root, harness.plan as never, VID).revisions;
    expect(revision).toMatchObject({ revision: 4, current: true });
    const foundFirst = new Set(first.foundBy.map(f => f.query));
    for (const row of revision!.rows) {
      expect(row.ran).toBe(true); expect(row.rawCount).toBe(row.provider === "pexels" ? 15 : 20);
      expect(row.adopted).toBe(row.provider === "pexels" && foundFirst.has(row.query) ? 1 : 0);
    }
  });

  it("a plan without records shows no record instead of zero", () => {
    const root = join(work, "no-record"); const rev2 = revisionPlan(2); bindPlan(root, rev2); writeSearchPlan(root, null, rev2);
    const saved = saveSearchPlan(root, candidateId, rev2.scenePlanFingerprint, rev2.fingerprint, rev2.scenes.map(s => s.visualId === VID ? { ...emptySceneV2(VID), searchEnabled: true, coreSubject: "seafood",
      coreAction: "eating", misattributionRisk: "generic", queries: [{ text: "grilled shrimp street", strategy: "subject_action" as const, purpose: "새 검색어" }] } : emptySceneV2(s.visualId)));
    const history = readQueryHistory(root, harness.plan as never, VID);
    expect(history.revisions.map(r => r.revision)).toEqual([saved.revision, 2]);
    expect(history.revisions[1]!.rows.every(r => !r.ran && r.rawCount === null && r.adopted === null)).toBe(true);
  });
});

type ReportInput = { orders: Record<"v1" | "v2" | "pr1", string[]>; byKey: Map<string, StockCandidate>;
  ranks: (order: string[], group: (c: StockCandidate) => boolean) => number[]; best: (order: string[], group: (c: StockCandidate) => boolean) => number; top: (order: string[], n: number) => StockCandidate[] };
/** Local comparison only (STOCK_RANKING_REPORT=1); written under artifacts/, which is never committed. */
function writeReport({ orders, byKey, ranks, best, top }: ReportInput) {
  const label = (c: StockCandidate) => c.sourceMetadata.pageSlug ?? c.sourceMetadata.tags.join(", ");
  const versions = (["v1", "v2", "pr1"] as const).map(v => ({ version: v, top3Valid: "미평가", top6Valid: "미평가",
    shrimpRanks: ranks(orders[v], GROUPS.shrimp), seafoodRanks: ranks(orders[v], GROUPS.seafood), streetDiningRanks: ranks(orders[v], GROUPS.streetDining), pizzaRank: best(orders[v], GROUPS.pizza),
    maxPerCreatorTop6: maxPerCreator(top(orders[v], 6)), maxPerCreatorTop10: maxPerCreator(top(orders[v], 10)),
    top10: top(orders[v], 10).map((c, i) => ({ rank: i + 1, provider: c.provider, id: c.videoId, slug: label(c), firstProviderRank: firstRank(c), queries: new Set(c.foundBy.map(f => f.query)).size,
      creator: creator(c), subject: assessContent(c, requirement).facets.subject, reason: v === "pr1" ? priorityReason(c, assessContent(c, requirement), false) : null })) }));
  const shift = orders.pr1.map((key, i) => ({ key, finalRank: i + 1, firstProviderRank: firstRank(byKey.get(key)!) }));
  const dir = join(process.cwd(), "artifacts", "stock-search-pr1"); mkdirSync(dir, { recursive: true });
  writeFileSync(join(dir, "oc-oanh-comparison.json"), JSON.stringify({ note: "Offline replay of 16 cached provider responses; no human relevance labels, so validity is 미평가.", versions, shift }, null, 2));
}
