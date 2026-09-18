/**
 * Plan-only stale check for SharedVisualAssetsManifest (no handoff required).
 * Used by delivery adapters that inject visuals into renderers/resolvers.
 */

import type { SharedVisualPlan } from "@/lib/marketing/publishable/sharedVisualPlan/contracts";
import type { SharedVisualAssetsManifest } from "@/lib/marketing/publishable/sharedVisualAssets/contracts";

export function isSharedVisualAssetsManifestStaleVsPlan(input: {
  manifest: Pick<
    SharedVisualAssetsManifest,
    "sourceAssetId" | "sourceAssetVersion" | "sourceSharedVisualPlanFingerprint"
  >;
  sharedVisualPlan: Pick<
    SharedVisualPlan,
    "sourceAssetId" | "sourceAssetVersion" | "sourceVisualPlanFingerprint"
  >;
}): boolean {
  const { manifest, sharedVisualPlan } = input;
  if (manifest.sourceAssetId !== sharedVisualPlan.sourceAssetId) return true;
  if (manifest.sourceAssetVersion !== sharedVisualPlan.sourceAssetVersion) return true;
  if (manifest.sourceSharedVisualPlanFingerprint !== sharedVisualPlan.sourceVisualPlanFingerprint) {
    return true;
  }
  return false;
}
