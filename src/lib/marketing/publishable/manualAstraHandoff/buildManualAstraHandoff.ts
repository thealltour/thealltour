/**
 * Build ManualAstraHandoff from SharedVisualPlan + approved asset evidence context.
 * Deterministic — no LLM, no provider calls.
 */

import type { SharedVisualPlan } from "@/lib/marketing/publishable/sharedVisualPlan/contracts";
import {
  MANUAL_ASTRA_HANDOFF_CONTRACT,
  type ManualAstraApprovedAssetContext,
  type ManualAstraHandoff,
  type ManualAstraVisualRequest,
} from "@/lib/marketing/publishable/manualAstraHandoff/contracts";
import {
  batchConsistencyIntent,
  buildCompositionGuidance,
  buildTextSafeArea,
  resolveAspectRatio,
} from "@/lib/marketing/publishable/manualAstraHandoff/compositionGuidance";
import { buildEvidenceGuidance } from "@/lib/marketing/publishable/manualAstraHandoff/evidenceGuidance";
import { formatManualAstraCopyText } from "@/lib/marketing/publishable/manualAstraHandoff/formatCopyText";

export class ManualAstraHandoffValidationError extends Error {
  readonly code: string;
  constructor(code: string, message: string) {
    super(message);
    this.name = "ManualAstraHandoffValidationError";
    this.code = code;
  }
}

export function expectedFilenameForVisualId(visualId: string): string {
  return `${visualId.trim()}.png`;
}

function validateHandoff(handoff: ManualAstraHandoff): void {
  if (handoff.visualCount !== handoff.visuals.length) {
    throw new ManualAstraHandoffValidationError(
      "visual_count_mismatch",
      `visualCount ${handoff.visualCount} !== visuals.length ${handoff.visuals.length}`,
    );
  }
  if (!handoff.sourceAssetId.trim()) {
    throw new ManualAstraHandoffValidationError("missing_source_asset", "sourceAssetId required");
  }
  if (!handoff.sourceSharedVisualPlanFingerprint.trim()) {
    throw new ManualAstraHandoffValidationError(
      "missing_fingerprint",
      "sourceSharedVisualPlanFingerprint required",
    );
  }

  const ids = new Set<string>();
  const files = new Set<string>();
  for (const v of handoff.visuals) {
    if (!v.visualId.trim()) {
      throw new ManualAstraHandoffValidationError("empty_visual_id", "visualId required");
    }
    if (ids.has(v.visualId)) {
      throw new ManualAstraHandoffValidationError("duplicate_visual_id", v.visualId);
    }
    ids.add(v.visualId);

    if (!v.visualIntent.trim()) {
      throw new ManualAstraHandoffValidationError(
        "missing_visual_intent",
        `visual ${v.visualId} missing visualIntent`,
      );
    }
    if (v.generatedTextAllowed !== false || v.logoAllowed !== false || v.readableSignageAllowed !== false) {
      throw new ManualAstraHandoffValidationError(
        "unsafe_text_policy",
        `visual ${v.visualId} must disallow text/logo/signage`,
      );
    }
    const expected = expectedFilenameForVisualId(v.visualId);
    if (v.expectedFilename !== expected) {
      throw new ManualAstraHandoffValidationError(
        "filename_mismatch",
        `${v.expectedFilename} !== ${expected}`,
      );
    }
    if (files.has(v.expectedFilename)) {
      throw new ManualAstraHandoffValidationError("duplicate_filename", v.expectedFilename);
    }
    files.add(v.expectedFilename);
  }
}

export function buildManualAstraHandoff(input: {
  sharedVisualPlan: SharedVisualPlan;
  approvedAssetContext?: ManualAstraApprovedAssetContext | null;
  now?: Date;
}): ManualAstraHandoff {
  const nowIso = (input.now ?? new Date()).toISOString();
  const plan = input.sharedVisualPlan;
  const asset = input.approvedAssetContext ?? null;

  const selected = plan.visuals.filter((v) => v.generatedVisualNeeded === true);
  // Preserve SharedVisualPlan order — do not renumber visualIds.
  const visuals: ManualAstraVisualRequest[] = selected.map((visual) => ({
    visualId: visual.visualId,
    role: visual.role,
    visualIntent: visual.visualIntent,
    ...(visual.visualMode ? { visualMode: visual.visualMode } : {}),
    usages: [...visual.usages],
    aspectRatio: resolveAspectRatio(visual.usages),
    compositionGuidance: buildCompositionGuidance(visual),
    textSafeArea: buildTextSafeArea(visual),
    generatedTextAllowed: false,
    logoAllowed: false,
    readableSignageAllowed: false,
    evidenceGuidance: buildEvidenceGuidance({ visual, asset }),
    expectedFilename: expectedFilenameForVisualId(visual.visualId),
  }));

  const withoutCopy: Omit<ManualAstraHandoff, "copyText"> = {
    contract: MANUAL_ASTRA_HANDOFF_CONTRACT,
    sourceAssetId: plan.sourceAssetId,
    sourceAssetVersion: plan.sourceAssetVersion,
    sourceSharedVisualPlanFingerprint: plan.sourceVisualPlanFingerprint,
    generatedAt: nowIso,
    generationMode: "manual_human_in_the_loop",
    providerIntent: "astra",
    visualCount: visuals.length,
    contentTitleKo: asset?.titleKo?.trim() || null,
    editorialArchetype: asset?.editorialArchetype?.trim() || null,
    batchInstructions: {
      consistencyIntent: batchConsistencyIntent(asset?.editorialArchetype),
      textPolicy: "no_generated_text",
      brandingPolicy: "no_generated_branding",
    },
    visuals,
  };

  const handoff: ManualAstraHandoff = {
    ...withoutCopy,
    copyText: formatManualAstraCopyText({ handoff: withoutCopy }),
  };
  validateHandoff(handoff);
  return handoff;
}

export function isManualAstraHandoffStale(input: {
  handoff: Pick<
    ManualAstraHandoff,
    "sourceAssetId" | "sourceAssetVersion" | "sourceSharedVisualPlanFingerprint"
  >;
  sharedVisualPlan: Pick<
    SharedVisualPlan,
    "sourceAssetId" | "sourceAssetVersion" | "sourceVisualPlanFingerprint"
  >;
}): boolean {
  const { handoff, sharedVisualPlan: plan } = input;
  if (handoff.sourceAssetId !== plan.sourceAssetId) return true;
  if (handoff.sourceAssetVersion !== plan.sourceAssetVersion) return true;
  if (handoff.sourceSharedVisualPlanFingerprint !== plan.sourceVisualPlanFingerprint) return true;
  return false;
}
