/**
 * Deterministic fingerprint of Manual Astra Handoff generation-relevant fields.
 * Additive helper — does not require rewriting persisted handoff contracts.
 */

import { createHash } from "node:crypto";

import type { ManualAstraHandoff } from "@/lib/marketing/publishable/manualAstraHandoff/contracts";

export function computeManualAstraHandoffFingerprint(handoff: ManualAstraHandoff): string {
  const payload = {
    sourceAssetId: handoff.sourceAssetId,
    sourceAssetVersion: handoff.sourceAssetVersion,
    sourceSharedVisualPlanFingerprint: handoff.sourceSharedVisualPlanFingerprint,
    visualCount: handoff.visualCount,
    visuals: handoff.visuals.map((v) => ({
      visualId: v.visualId,
      role: v.role,
      visualIntent: v.visualIntent,
      visualMode: v.visualMode ?? null,
      aspectRatio: v.aspectRatio,
      expectedFilename: v.expectedFilename,
      usages: v.usages,
      compositionGuidance: v.compositionGuidance,
      textSafeArea: v.textSafeArea,
      evidenceGuidance: v.evidenceGuidance,
    })),
    batchInstructions: handoff.batchInstructions,
    copyText: handoff.copyText,
  };
  return createHash("sha256").update(JSON.stringify(payload), "utf8").digest("hex").slice(0, 32);
}
