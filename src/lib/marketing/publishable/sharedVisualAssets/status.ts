/**
 * Upload completeness + stale helpers for Shared Visual Assets.
 */

import type { ManualAstraHandoff } from "@/lib/marketing/publishable/manualAstraHandoff/contracts";
import type { SharedVisualPlan } from "@/lib/marketing/publishable/sharedVisualPlan/contracts";
import type {
  SharedVisualAssetsManifest,
  SharedVisualUploadStatus,
} from "@/lib/marketing/publishable/sharedVisualAssets/contracts";
import { computeManualAstraHandoffFingerprint } from "@/lib/marketing/publishable/sharedVisualAssets/handoffFingerprint";
import { formatUsageLine } from "@/lib/marketing/publishable/manualAstraHandoff/formatCopyText";

export function isSharedVisualAssetsStale(input: {
  manifest: Pick<
    SharedVisualAssetsManifest,
    | "sourceAssetId"
    | "sourceAssetVersion"
    | "sourceSharedVisualPlanFingerprint"
    | "sourceManualAstraHandoffFingerprint"
  >;
  handoff: ManualAstraHandoff;
  sharedVisualPlan?: Pick<
    SharedVisualPlan,
    "sourceAssetId" | "sourceAssetVersion" | "sourceVisualPlanFingerprint"
  > | null;
}): boolean {
  const { manifest, handoff, sharedVisualPlan } = input;
  if (manifest.sourceAssetId !== handoff.sourceAssetId) return true;
  if (manifest.sourceAssetVersion !== handoff.sourceAssetVersion) return true;
  if (manifest.sourceSharedVisualPlanFingerprint !== handoff.sourceSharedVisualPlanFingerprint) {
    return true;
  }
  if (
    manifest.sourceManualAstraHandoffFingerprint !==
    computeManualAstraHandoffFingerprint(handoff)
  ) {
    return true;
  }
  if (sharedVisualPlan) {
    if (manifest.sourceAssetId !== sharedVisualPlan.sourceAssetId) return true;
    if (manifest.sourceAssetVersion !== sharedVisualPlan.sourceAssetVersion) return true;
    if (manifest.sourceSharedVisualPlanFingerprint !== sharedVisualPlan.sourceVisualPlanFingerprint) {
      return true;
    }
  }
  return false;
}

export function isManualAstraHandoffSourceStale(input: {
  handoff: ManualAstraHandoff;
  sharedVisualPlan: Pick<
    SharedVisualPlan,
    "sourceAssetId" | "sourceAssetVersion" | "sourceVisualPlanFingerprint"
  > | null;
}): boolean {
  const plan = input.sharedVisualPlan;
  if (!plan) return true;
  if (input.handoff.sourceAssetId !== plan.sourceAssetId) return true;
  if (input.handoff.sourceAssetVersion !== plan.sourceAssetVersion) return true;
  if (input.handoff.sourceSharedVisualPlanFingerprint !== plan.sourceVisualPlanFingerprint) {
    return true;
  }
  return false;
}

export function getSharedVisualUploadStatus(input: {
  handoff: ManualAstraHandoff;
  manifest: SharedVisualAssetsManifest | null;
  sharedVisualPlan?: SharedVisualPlan | null;
}): SharedVisualUploadStatus {
  const requiredIds = input.handoff.visuals.map((v) => v.visualId);
  const uploadedSet = new Set(
    (input.manifest?.assets ?? [])
      .filter((a) => a.status === "uploaded")
      .map((a) => a.visualId),
  );
  const missingVisualIds = requiredIds.filter((id) => !uploadedSet.has(id));
  const uploaded = requiredIds.length - missingVisualIds.length;
  const stale = input.manifest
    ? isSharedVisualAssetsStale({
        manifest: input.manifest,
        handoff: input.handoff,
        sharedVisualPlan: input.sharedVisualPlan ?? null,
      })
    : false;
  // Also treat handoff↔plan mismatch as stale for UI (upload disabled).
  const handoffStale = isManualAstraHandoffSourceStale({
    handoff: input.handoff,
    sharedVisualPlan: input.sharedVisualPlan ?? null,
  });
  return {
    required: requiredIds.length,
    uploaded,
    complete: missingVisualIds.length === 0 && requiredIds.length > 0,
    missingVisualIds,
    stale: stale || handoffStale,
  };
}

export { formatUsageLine };
