/**
 * Threads package-side resolver — ordered local uploaded visuals by slotIndex.
 * Does NOT publish, host public URLs, or mutate PublicationRequest.
 */

import type { SharedVisualPlan } from "@/lib/marketing/publishable/sharedVisualPlan/contracts";
import type { SharedVisualAssetsManifest } from "@/lib/marketing/publishable/sharedVisualAssets/contracts";
import { resolveSafeSharedVisualAbsolutePath } from "@/lib/marketing/publishable/sharedVisualDelivery/pathSafety";
import { isSharedVisualAssetsManifestStaleVsPlan } from "@/lib/marketing/publishable/sharedVisualDelivery/stale";

export type ResolvedThreadsSharedVisual = {
  visualId: string;
  slotIndex: number;
  /** Package-relative path from manifest. */
  storedPath: string;
  /** Absolute path under packageRoot (path-validated). */
  absolutePath: string;
  mimeType: string;
};

export type ThreadsSharedVisualResolveResult = {
  stale: boolean;
  visuals: ResolvedThreadsSharedVisual[];
  /**
   * First uploaded visual by lowest slotIndex (preserves original slotIndex).
   * If slot 0 missing but slot 1 present → primary = slot 1 entry.
   */
  primaryVisual: ResolvedThreadsSharedVisual | null;
  warnings: string[];
};

/**
 * Resolve Threads usages with uploaded assets, sorted by slotIndex ascending.
 * Sparse slots keep original indices (no renumbering).
 * Stale manifest → empty list + stale:true.
 */
export function resolveThreadsSharedVisualAssets(input: {
  packageRoot: string;
  sharedVisualPlan: SharedVisualPlan | null;
  manifest: SharedVisualAssetsManifest | null;
}): ThreadsSharedVisualResolveResult {
  const warnings: string[] = [];

  if (!input.sharedVisualPlan || !input.manifest) {
    return {
      stale: false,
      visuals: [],
      primaryVisual: null,
      warnings: [
        !input.sharedVisualPlan ? "shared_visual_plan_missing" : "shared_visual_assets_missing",
      ],
    };
  }

  const stale = isSharedVisualAssetsManifestStaleVsPlan({
    manifest: input.manifest,
    sharedVisualPlan: input.sharedVisualPlan,
  });
  if (stale) {
    return {
      stale: true,
      visuals: [],
      primaryVisual: null,
      warnings: ["shared_visual_assets_stale: refusing Threads visual resolution"],
    };
  }

  const assetById = new Map(
    input.manifest.assets
      .filter((a) => a.status === "uploaded")
      .map((a) => [a.visualId, a] as const),
  );

  const resolved: ResolvedThreadsSharedVisual[] = [];

  for (const visual of input.sharedVisualPlan.visuals) {
    const asset = assetById.get(visual.visualId);
    if (!asset) continue;

    for (const usage of visual.usages) {
      if (usage.channel !== "threads") continue;
      const slotIndex = usage.slotIndex;
      if (!Number.isInteger(slotIndex) || slotIndex < 0) {
        warnings.push(`invalid_slot_${visual.visualId}`);
        continue;
      }

      try {
        const absolutePath = resolveSafeSharedVisualAbsolutePath({
          packageRoot: input.packageRoot,
          storedPath: asset.storedPath,
        });
        resolved.push({
          visualId: visual.visualId,
          slotIndex,
          storedPath: asset.storedPath,
          absolutePath,
          mimeType: asset.mimeType,
        });
      } catch (error) {
        warnings.push(
          `skip_slot_${slotIndex}_${visual.visualId}: ${
            error instanceof Error ? error.message : "path_failed"
          }`,
        );
      }
    }
  }

  resolved.sort((a, b) => {
    if (a.slotIndex !== b.slotIndex) return a.slotIndex - b.slotIndex;
    return a.visualId.localeCompare(b.visualId);
  });

  // Deduplicate same slotIndex from conflicting visuals — keep first (lowest visualId after sort).
  const seenSlots = new Set<number>();
  const unique: ResolvedThreadsSharedVisual[] = [];
  for (const row of resolved) {
    if (seenSlots.has(row.slotIndex)) {
      warnings.push(
        `duplicate_slot_${row.slotIndex}_skipped_${row.visualId}`,
      );
      continue;
    }
    seenSlots.add(row.slotIndex);
    unique.push(row);
  }

  return {
    stale: false,
    visuals: unique,
    primaryVisual: unique[0] ?? null,
    warnings,
  };
}
