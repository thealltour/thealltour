/**
 * Shared Visual Plan v1 — cross-channel normalized visual planning.
 * Planning only: no image generation, Astra, upload, or renderer wiring.
 */

import { SOCIAL_VISUAL_ASSET_FAMILY } from "@/lib/marketing/publishable/socialVisualPlan";
import type { SourceChannelSnapshot } from "@/lib/marketing/publishable/sharedVisualPlan/sourceChannelSnapshot";

export const SHARED_VISUAL_PLAN_CONTRACT = "shared-visual-plan-v1" as const;

export const SHARED_VISUAL_MODES = [
  "editorial_photo",
  "object_or_detail",
  "icon_infographic",
  "contrast_diagram",
  "map_context",
  "fact_card",
  "evidence_boundary",
  "minimal_closing",
] as const;

export type SharedVisualMode = (typeof SHARED_VISUAL_MODES)[number];

export type SharedVisualUsage =
  | { channel: "threads"; slotIndex: number }
  | { channel: "instagram"; cardId: string };

export type SharedVisualPlanningMode = "llm" | "deterministic_fallback";

export type SharedVisual = {
  visualId: string;
  assetFamily: typeof SOCIAL_VISUAL_ASSET_FAMILY;
  /** Canonical role retained for handoff (prefer primary source role). */
  role: string;
  visualIntent: string;
  visualMode?: SharedVisualMode;
  generatedVisualNeeded: boolean;
  usages: SharedVisualUsage[];
};

export type SharedVisualPlan = {
  contract: typeof SHARED_VISUAL_PLAN_CONTRACT;
  sourceAssetId: string;
  sourceAssetVersion: number;
  generatedAt: string;
  /**
   * Fingerprint of sourceChannelSnapshot (authoritative stale key).
   * Legacy plans may still carry visual-only hashes.
   */
  sourceVisualPlanFingerprint: string;
  /** Which channel outputs this plan was built against. */
  sourceChannelSnapshot?: SourceChannelSnapshot;
  /** LLM strategy summary when planningMode=llm. */
  strategySummary?: string | null;
  planningMode?: SharedVisualPlanningMode;
  visuals: SharedVisual[];
};

/** Internal normalized request — worker visualId is request/suggested only. */
export type SocialVisualRequest = {
  sourceChannel: "threads" | "instagram";
  /** Worker-suggested ID (social_visual_NN) — never treated as master identity. */
  sourceVisualId?: string;
  role: string;
  visualIntent: string;
  visualMode?: SharedVisualMode;
  generatedVisualNeeded: boolean;
  reusableCrossChannel: boolean;
  usage: SharedVisualUsage;
  /** Stable sort key within source channel. */
  orderKey: number;
};
