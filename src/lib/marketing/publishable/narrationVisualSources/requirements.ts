import type { SearchAxes, SearchStrategy, StockSceneSearchPlan, StockSceneSearchPlanV1, StockSceneSearchPlanV2 } from "./contracts";

/** One reading of a v1 or v2 scene. It is a view only: it is never written back, so stored plans and their fingerprints stay as they are. */
export type SceneRequirement = {
  visualId: string; searchEnabled: boolean; legacy: boolean;
  coreSubject: string; coreAction: string;
  placeScope: "specific_place" | "city_region" | "any"; placeName: string | null; region: string | null;
  required: string[]; preferred: string[]; exclude: string[]; relaxable: string[];
  misattributionRisk: string; humanChecks: string[];
  queries: Array<{ text: string; strategy: SearchStrategy | null; purpose: string | null; pixabayText?: string }>;
  /** What the selection records: only a specific venue needs a place check; a city/region scene is reviewed for misattribution. */
  placeRequirement: "specific_place" | "generic_allowed";
  /**
   * Phrases per axis for reading provider metadata. Written axes are added to what the scene already says: subject to
   * the core subject, action to the core action, context to preferences and environment, location to place and region.
   */
  axes: SearchAxes;
  axesWritten: boolean;
};
export const isV2Scene = (scene: StockSceneSearchPlan): scene is StockSceneSearchPlanV2 => "coreSubject" in scene;
const nonEmpty = (values: Array<string | null | undefined>) => [...new Set(values.map(v => v?.trim() ?? "").filter(Boolean))];
export function sceneRequirement(scene: StockSceneSearchPlan): SceneRequirement {
  if (isV2Scene(scene)) {
    const written = scene.axes;
    return { visualId: scene.visualId, searchEnabled: scene.searchEnabled, legacy: false, coreSubject: scene.coreSubject, coreAction: scene.coreAction,
      placeScope: scene.place.scope, placeName: scene.place.name, region: scene.place.region, required: scene.required, preferred: scene.preferred, exclude: scene.exclude,
      relaxable: scene.relaxable, misattributionRisk: scene.misattributionRisk, humanChecks: scene.humanChecks, queries: scene.queries,
      placeRequirement: scene.place.scope === "specific_place" ? "specific_place" : "generic_allowed",
      axes: { subject: nonEmpty([scene.coreSubject, ...(written?.subject ?? [])]), action: nonEmpty([scene.coreAction, ...(written?.action ?? [])]),
        context: nonEmpty([...scene.preferred, ...(written?.context ?? [])]), location: nonEmpty([scene.place.name, scene.place.region, ...(written?.location ?? [])]) },
      axesWritten: !!written };
  }
  // v1 had no region and no relaxable list; its free-text environment reads as a preference.
  return { visualId: scene.visualId, searchEnabled: scene.searchEnabled, legacy: true, coreSubject: scene.subject, coreAction: scene.visibleAction,
    placeScope: scene.placeRequirement === "specific_place" ? "specific_place" : "any", placeName: scene.placeRequirement === "specific_place" ? scene.placeName : null, region: null,
    required: scene.mustMatch, preferred: scene.environment ? [scene.environment] : [], exclude: scene.exclude, relaxable: [], misattributionRisk: scene.misattributionRisk,
    humanChecks: scene.humanChecks, queries: scene.queries.map(text => ({ text, strategy: null, purpose: null })), placeRequirement: scene.placeRequirement,
    axes: { subject: nonEmpty([scene.subject]), action: nonEmpty([scene.visibleAction]), context: nonEmpty([scene.environment]),
      location: nonEmpty([scene.placeRequirement === "specific_place" ? scene.placeName : null]) },
    axesWritten: false };
}
/**
 * Starting point for editing a v1 scene in the v2 form. Strategies are a first guess the reviewer must check; nothing
 * is saved until the reviewer saves, which creates a new v2 revision.
 */
export function upgradeSceneToV2(scene: StockSceneSearchPlanV1): StockSceneSearchPlanV2 {
  const specific = scene.placeRequirement === "specific_place";
  const free: SearchStrategy[] = ["subject_action", "synonym", "allowed_mood"];
  const placeQuery = specific && scene.placeName ? scene.queries.findIndex(q => q.toLowerCase().includes(scene.placeName!.toLowerCase())) : -1;
  return { visualId: scene.visualId, searchEnabled: scene.searchEnabled, coreSubject: scene.subject, coreAction: scene.visibleAction,
    place: specific ? { scope: "specific_place", name: scene.placeName, region: null } : { scope: "any", name: null, region: null },
    required: scene.mustMatch, preferred: scene.environment ? [scene.environment] : [], exclude: scene.exclude, relaxable: [],
    misattributionRisk: scene.misattributionRisk, humanChecks: scene.humanChecks,
    queries: scene.queries.map((text, i) => ({ text, strategy: i === placeQuery ? "place_subject" : free.shift() ?? "synonym", purpose: "이전 형식에서 옮긴 검색어 · 전략 확인 필요" })) };
}
export const emptySceneV2 = (visualId: string): StockSceneSearchPlanV2 => ({ visualId, searchEnabled: false, coreSubject: "", coreAction: "",
  place: { scope: "any", name: null, region: null }, required: [], preferred: [], exclude: [], relaxable: [], misattributionRisk: "", humanChecks: [], queries: [] });
export const emptyAxes = (): SearchAxes => ({ location: [], subject: [], action: [], context: [] });
export const STRATEGY_LABEL: Record<SearchStrategy, string> = { place_subject: "장소 + 피사체", subject_action: "피사체 + 행동", synonym: "동의어·다른 표현", allowed_mood: "허용된 분위기·환경" };
export const AXIS_LABEL: Record<keyof SearchAxes, string> = { location: "장소", subject: "피사체", action: "행동", context: "맥락" };
