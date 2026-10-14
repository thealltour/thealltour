import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { z } from "zod";
import { atomicWriteFile } from "@/lib/marketing/assets/atomicWrite";
import { NarrationError } from "../narration/persistence";
import { sceneHash } from "../narrationScenes/service";
import type { NarrationScenePlan } from "../narrationScenes/contracts";
import { candidateReviewFileSchema, searchAttemptLogSchema, stockLocatorsSchema, stockSceneSearchSchema, stockSearchPlanSchema, visualSourceSelectionSchema, type CandidateReviewFile, type SceneSourceChoice, type SearchAttemptRecord, type StockSceneSearch, type StockSceneSearchPlan, type StockSearchPlan, type VisualSourceSelection } from "./contracts";
import { isV2Scene, type SceneRequirement } from "./requirements";

export const visualSourcesDirectory = (root: string) => join(root, "context/narration/visual-sources");
const hash = z.string().regex(/^[a-f0-9]{64}$/);
const parseFile = (path: string) => JSON.parse(readFileSync(path, "utf8")) as unknown;

function searchPlanPath(root: string, scenePlanFingerprint: string) { return join(visualSourcesDirectory(root), "search-plans", `${hash.parse(scenePlanFingerprint)}.json`); }
export function searchPlanFingerprint(plan: Pick<StockSearchPlan, "contract" | "revision" | "scenePlanFingerprint" | "origin" | "scenes">) {
  return sceneHash({ contract: plan.contract, revision: plan.revision, scenePlanFingerprint: plan.scenePlanFingerprint, origin: plan.origin, scenes: plan.scenes });
}
export function readSearchPlan(root: string, scenePlan: NarrationScenePlan): StockSearchPlan | null {
  const path = searchPlanPath(root, scenePlan.fingerprint); if (!existsSync(path)) return null;
  const plan = stockSearchPlanSchema.parse(parseFile(path));
  if (plan.fingerprint !== searchPlanFingerprint(plan) || plan.scenePlanFingerprint !== scenePlan.fingerprint || plan.scenes.length !== scenePlan.scenes.length ||
    plan.scenes.some((scene, i) => scene.visualId !== scenePlan.scenes[i]!.visualId)) throw new NarrationError("스톡 검색 계획 연결 정보가 다릅니다.", 409);
  return plan;
}
export function writeSearchPlan(root: string, previous: StockSearchPlan | null, plan: StockSearchPlan) {
  if (previous) atomicWriteFile(join(visualSourcesDirectory(root), "search-plans", "revisions", `${previous.scenePlanFingerprint}-${previous.revision}.json`), JSON.stringify(previous, null, 2));
  atomicWriteFile(searchPlanPath(root, plan.scenePlanFingerprint), JSON.stringify(stockSearchPlanSchema.parse(plan), null, 2));
}
/**
 * Only fields that change what is fetched or filtered; edits to notes, conditions or human checks keep stored results.
 * v1 scenes keep the v1 formula so existing results and selections stay current.
 */
export function sceneSearchKey(scenePlanFingerprint: string, scene: StockSceneSearchPlan, frameCount: number) {
  if (!isV2Scene(scene)) return sceneHash({ contract: "narration-stock-scene-search-key-v1", scenePlanFingerprint, searchEnabled: scene.searchEnabled, queries: scene.queries,
    placeRequirement: scene.placeRequirement, placeName: scene.placeName, frameCount });
  return sceneHash({ contract: "narration-stock-scene-search-key-v2", scenePlanFingerprint, searchEnabled: scene.searchEnabled,
    queries: scene.queries.map(q => ({ text: q.text, strategy: q.strategy, ...(q.pixabayText ? { pixabayText: q.pixabayText } : {}) })), place: scene.place, frameCount });
}
/** Reviews belong to what the scene must show; query, preference or note edits keep them, a changed subject, action, place or required condition does not. */
export function requirementKey(requirement: SceneRequirement) {
  return sceneHash({ contract: "narration-stock-scene-requirement-v1", visualId: requirement.visualId, coreSubject: requirement.coreSubject.trim().toLowerCase(),
    coreAction: requirement.coreAction.trim().toLowerCase(), placeScope: requirement.placeScope, placeName: requirement.placeName, region: requirement.region,
    required: requirement.required.map(r => r.trim().toLowerCase()).sort() });
}
function sceneSearchPath(root: string, scenePlanFingerprint: string, visualId: string) {
  if (!z.string().uuid().safeParse(visualId).success) throw new NarrationError("장면 ID를 확인해주세요.", 400);
  return join(visualSourcesDirectory(root), "search", hash.parse(scenePlanFingerprint), `${visualId}.json`);
}
export function readSceneSearch(root: string, scenePlanFingerprint: string, visualId: string): StockSceneSearch | null {
  const path = sceneSearchPath(root, scenePlanFingerprint, visualId); if (!existsSync(path)) return null;
  const search = stockSceneSearchSchema.parse(parseFile(path));
  if (search.visualId !== visualId || search.scenePlanFingerprint !== scenePlanFingerprint || search.shownCount > search.candidates.length) throw new NarrationError("스톡 검색 결과 연결 정보가 다릅니다.", 409);
  return search;
}
export function writeSceneSearch(root: string, search: StockSceneSearch) {
  atomicWriteFile(sceneSearchPath(root, search.scenePlanFingerprint, search.visualId), JSON.stringify(stockSceneSearchSchema.parse(search), null, 2));
}
/** A new session never overwrites the previous one; it is moved next to the current file. */
export function archiveSceneSearch(root: string, search: StockSceneSearch) {
  const name = `${search.visualId}-${search.sessionId ?? sceneHash({ searchedAt: search.searchedAt, key: search.sceneSearchKey }).slice(0, 16)}.json`;
  atomicWriteFile(join(visualSourcesDirectory(root), "search", hash.parse(search.scenePlanFingerprint), "archive", name), JSON.stringify(search, null, 2));
}
function sceneFile(root: string, kind: "search-attempts" | "reviews", scenePlanFingerprint: string, visualId: string) {
  if (!z.string().uuid().safeParse(visualId).success) throw new NarrationError("장면 ID를 확인해주세요.", 400);
  return join(visualSourcesDirectory(root), kind, hash.parse(scenePlanFingerprint), `${visualId}.json`);
}
export function readAttemptLog(root: string, scenePlanFingerprint: string, visualId: string): SearchAttemptRecord[] {
  const path = sceneFile(root, "search-attempts", scenePlanFingerprint, visualId); if (!existsSync(path)) return [];
  const log = searchAttemptLogSchema.parse(parseFile(path));
  if (log.visualId !== visualId || log.scenePlanFingerprint !== scenePlanFingerprint) throw new NarrationError("스톡 검색 이력 연결 정보가 다릅니다.", 409);
  return log.attempts;
}
/** Append-only; the oldest entries roll off after 200 actions. */
export function appendAttempt(root: string, scenePlanFingerprint: string, visualId: string, attempt: SearchAttemptRecord) {
  const attempts = [...readAttemptLog(root, scenePlanFingerprint, visualId), attempt].slice(-200);
  atomicWriteFile(sceneFile(root, "search-attempts", scenePlanFingerprint, visualId), JSON.stringify(searchAttemptLogSchema.parse({ contract: "narration-stock-search-attempts-v1", visualId, scenePlanFingerprint, attempts }), null, 2));
}
export function readReviews(root: string, scenePlanFingerprint: string, visualId: string): CandidateReviewFile {
  const path = sceneFile(root, "reviews", scenePlanFingerprint, visualId);
  if (!existsSync(path)) return { contract: "narration-stock-candidate-reviews-v1", visualId, scenePlanFingerprint, reviews: [], sceneVerdicts: [], history: [] };
  const file = candidateReviewFileSchema.parse(parseFile(path));
  if (file.visualId !== visualId || file.scenePlanFingerprint !== scenePlanFingerprint) throw new NarrationError("후보 검토 기록 연결 정보가 다릅니다.", 409);
  return file;
}
export function writeReviews(root: string, file: CandidateReviewFile) {
  atomicWriteFile(sceneFile(root, "reviews", file.scenePlanFingerprint, file.visualId), JSON.stringify(candidateReviewFileSchema.parse(file), null, 2));
}

const selectionPath = (root: string) => join(visualSourcesDirectory(root), "selection.json");
/** Content-only identity used by the render: a revision bump with the same choices is the same selection. */
export const selectionContentFingerprint = (scenes: SceneSourceChoice[]) => sceneHash({ contract: "narration-visual-source-selection-content-v1", scenes });
export function readSelection(root: string): VisualSourceSelection | null {
  if (!existsSync(selectionPath(root))) return null;
  const selection = visualSourceSelectionSchema.parse(parseFile(selectionPath(root)));
  const { fingerprint, ...body } = selection;
  if (sceneHash(body) !== fingerprint || new Set(selection.scenes.map(s => s.visualId)).size !== selection.scenes.length) throw new NarrationError("영상 소스 선택 연결 정보가 다릅니다.", 409);
  return selection;
}
export function writeSelection(root: string, previous: VisualSourceSelection | null, body: Omit<VisualSourceSelection, "fingerprint">) {
  const selection = visualSourceSelectionSchema.parse({ ...body, fingerprint: sceneHash(body) });
  if (previous) atomicWriteFile(join(visualSourcesDirectory(root), "selection-revisions", `${previous.revision}-${previous.fingerprint}.json`), JSON.stringify(previous, null, 2));
  atomicWriteFile(selectionPath(root), JSON.stringify(selection, null, 2));
  return selection;
}
const locatorsPath = (root: string) => join(visualSourcesDirectory(root), "selection-locators.json");
export function readLocators(root: string) { return existsSync(locatorsPath(root)) ? stockLocatorsSchema.parse(parseFile(locatorsPath(root))) : {}; }
export function writeLocator(root: string, visualId: string, locator: z.infer<typeof stockLocatorsSchema>[string]) {
  atomicWriteFile(locatorsPath(root), JSON.stringify(stockLocatorsSchema.parse({ ...readLocators(root), [visualId]: locator }), null, 2));
}
/**
 * Choices aligned to the plan order. A missing file means every scene uses image motion.
 * A selection saved for another plan revision is carried by visualId but reported as not matching.
 */
export function choicesForPlan(root: string, plan: NarrationScenePlan) {
  const selection = readSelection(root);
  const choices: SceneSourceChoice[] = plan.scenes.map(scene => selection?.scenes.find(s => s.visualId === scene.visualId) ?? { visualId: scene.visualId, source: "image_motion" });
  return { selection, matchesPlan: !selection || selection.planFingerprint === plan.fingerprint, choices };
}
