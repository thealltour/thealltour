/**
 * Manual Astra Handoff v1 — human-in-the-loop image generation request payload.
 * No Astra/OpenAI API calls; planning/copy artifact only.
 */

import type {
  SharedVisualMode,
  SharedVisualUsage,
} from "@/lib/marketing/publishable/sharedVisualPlan/contracts";

export const MANUAL_ASTRA_HANDOFF_CONTRACT = "manual-astra-handoff-v1" as const;

export type ManualAstraAspectRatio = "4:5" | "1:1" | "9:16";

export type ManualAstraVisualRequest = {
  visualId: string;
  role: string;
  visualIntent: string;
  visualMode?: SharedVisualMode;
  usages: SharedVisualUsage[];
  aspectRatio: ManualAstraAspectRatio;
  compositionGuidance: string;
  textSafeArea: string;
  generatedTextAllowed: false;
  logoAllowed: false;
  readableSignageAllowed: false;
  evidenceGuidance: string[];
  expectedFilename: string;
};

export type ManualAstraHandoff = {
  contract: typeof MANUAL_ASTRA_HANDOFF_CONTRACT;
  sourceAssetId: string;
  sourceAssetVersion: number;
  sourceSharedVisualPlanFingerprint: string;
  generatedAt: string;
  generationMode: "manual_human_in_the_loop";
  providerIntent: "astra";
  visualCount: number;
  contentTitleKo: string | null;
  editorialArchetype: string | null;
  batchInstructions: {
    consistencyIntent: string;
    textPolicy: "no_generated_text";
    brandingPolicy: "no_generated_branding";
  };
  visuals: ManualAstraVisualRequest[];
  /** Operator-facing paste payload for ChatGPT/Astra. */
  copyText: string;
};

/** Evidence/safety context from approved Canonical — constraints only, not Story rewrite. */
export type ManualAstraApprovedAssetContext = {
  titleKo?: string | null;
  supportedClaimBoundaryKo?: string | null;
  limitationsKo?: string[] | null;
  forbiddenClaimsKo?: string[] | null;
  storySupportVerdict?: string | null;
  editorialArchetype?: string | null;
};
