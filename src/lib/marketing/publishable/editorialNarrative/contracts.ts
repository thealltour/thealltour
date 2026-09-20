/**
 * Channel-agnostic Editorial Narrative Plan — reusable across Instagram/Threads/Blog/…
 * Decides story progression only; never card count, copy, or visuals.
 */

export const EDITORIAL_NARRATIVE_PLAN_CONTRACT = "editorial-narrative-plan-v1" as const;
export const EDITORIAL_NARRATIVE_PLANNER_HERMES_PROFILE = "editorial-narrative-planner" as const;

export const NARRATIVE_BEAT_PURPOSES = [
  "hook",
  "familiar_frame",
  "reframe",
  "context",
  "evidence",
  "detail",
  "contrast",
  "payoff",
  "closing",
] as const;

export type NarrativeBeatPurpose = (typeof NARRATIVE_BEAT_PURPOSES)[number];

export type EditorialNarrativeBeat = {
  beatId: string;
  purpose: NarrativeBeatPurpose;
  message: string;
  evidenceRefs?: string[];
};

export type EditorialNarrativePlanProvenance = {
  sourceAssetId: string;
  sourceVersion: number;
  modelProfile: string;
  generatedAt: string;
};

export type EditorialNarrativePlan = {
  contract: typeof EDITORIAL_NARRATIVE_PLAN_CONTRACT;
  assetId: string;
  assetVersion: number;
  editorialArchetype?: string | null;
  narrativePromise: string;
  audienceTakeaway: string;
  beats: EditorialNarrativeBeat[];
  /** Fingerprint of Canonical inputs used to build this plan. */
  sourceCanonicalFingerprint: string;
  provenance: EditorialNarrativePlanProvenance;
};
