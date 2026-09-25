/**
 * Instagram CardNews: SharedVisualPlan + Manifest → visuals[cardId] = local PNG path.
 */

import type { SharedVisualPlan } from "@/lib/marketing/publishable/sharedVisualPlan/contracts";
import type { SharedVisualAssetsManifest } from "@/lib/marketing/publishable/sharedVisualAssets/contracts";
import { instagramCardIdAliases } from "@/lib/marketing/publishable/sharedVisualDelivery/cardIdAliases";
import { normalizeSharedVisualToPngPath } from "@/lib/marketing/publishable/sharedVisualDelivery/normalizeImageForRenderer";
import { readSafeSharedVisualBytes } from "@/lib/marketing/publishable/sharedVisualDelivery/pathSafety";
import { isSharedVisualAssetsManifestStaleVsPlan } from "@/lib/marketing/publishable/sharedVisualDelivery/stale";

export class SharedVisualInstagramMapError extends Error {
  readonly code: string;
  constructor(code: string, message: string) {
    super(message);
    this.name = "SharedVisualInstagramMapError";
    this.code = code;
  }
}

export type InstagramRendererVisualMapResult = {
  /** cardId → absolute local PNG path (renderer-ready). */
  visuals: Record<string, string>;
  injected: boolean;
  stale: boolean;
  warnings: string[];
  skippedReason?:
    | "missing_plan"
    | "missing_manifest"
    | "stale"
    | "duplicate_card_mapping"
    | "none_uploaded";
};

/**
 * Build Record<cardId, localPngPath> for renderCardNewsPackage.
 * Missing uploads are omitted (renderer falls back to geometric background).
 * Stale manifest → empty map (no injection).
 * Duplicate cardId from different visualIds → refuse all injection (ambiguous).
 */
export async function buildInstagramRendererVisualMap(input: {
  packageRoot: string;
  sharedVisualPlan: SharedVisualPlan | null;
  manifest: SharedVisualAssetsManifest | null;
}): Promise<InstagramRendererVisualMapResult> {
  const warnings: string[] = [];

  if (!input.sharedVisualPlan) {
    return {
      visuals: {},
      injected: false,
      stale: false,
      warnings: ["shared_visual_plan_missing"],
      skippedReason: "missing_plan",
    };
  }
  if (!input.manifest) {
    return {
      visuals: {},
      injected: false,
      stale: false,
      warnings: ["shared_visual_assets_missing"],
      skippedReason: "missing_manifest",
    };
  }

  const stale = isSharedVisualAssetsManifestStaleVsPlan({
    manifest: input.manifest,
    sharedVisualPlan: input.sharedVisualPlan,
  });
  if (stale) {
    return {
      visuals: {},
      injected: false,
      stale: true,
      warnings: [
        "shared_visual_assets_stale: refusing to inject uploaded visuals into Instagram renderer",
      ],
      skippedReason: "stale",
    };
  }

  const assetById = new Map(
    input.manifest.assets
      .filter((a) => a.status === "uploaded")
      .map((a) => [a.visualId, a] as const),
  );

  /** cardId → visualId claimed (detect ambiguity before path resolve). */
  const cardOwner = new Map<string, string>();
  type Pending = { cardId: string; visualId: string; storedPath: string };
  const pending: Pending[] = [];

  for (const visual of input.sharedVisualPlan.visuals) {
    const asset = assetById.get(visual.visualId);
    if (!asset) continue;

    for (const usage of visual.usages) {
      if (usage.channel !== "instagram") continue;
      const cardId = usage.cardId.trim();
      if (!cardId) continue;

      const existingOwner = cardOwner.get(cardId);
      if (existingOwner && existingOwner !== visual.visualId) {
        throw new SharedVisualInstagramMapError(
          "duplicate_card_mapping",
          `Ambiguous Instagram cardId "${cardId}": claimed by ${existingOwner} and ${visual.visualId}`,
        );
      }
      if (existingOwner === visual.visualId) {
        // Same visual listed twice for same card — ignore duplicate usage row.
        continue;
      }
      cardOwner.set(cardId, visual.visualId);
      pending.push({
        cardId,
        visualId: visual.visualId,
        storedPath: asset.storedPath,
      });
    }
  }

  if (pending.length === 0) {
    return {
      visuals: {},
      injected: false,
      stale: false,
      warnings,
      skippedReason: "none_uploaded",
    };
  }

  // Sort by cardId for deterministic resolve order.
  pending.sort((a, b) => a.cardId.localeCompare(b.cardId));

  const visuals: Record<string, string> = {};
  for (const row of pending) {
    try {
      const { absolutePath, bytes } = readSafeSharedVisualBytes({
        packageRoot: input.packageRoot,
        storedPath: row.storedPath,
      });
      const normalized = await normalizeSharedVisualToPngPath({
        absoluteSourcePath: absolutePath,
        sourceBytes: bytes,
        visualId: row.visualId,
      });
      // Emit dash + underscore aliases so media-brief `card_1` matches SVP `card-01`.
      for (const alias of instagramCardIdAliases(row.cardId)) {
        visuals[alias] = normalized.pngPath;
      }
      if (normalized.normalized) {
        warnings.push(
          `normalized_${row.visualId}_from_${normalized.mimeType}_for_${row.cardId}`,
        );
      }
    } catch (error) {
      warnings.push(
        `skip_${row.cardId}_${row.visualId}: ${
          error instanceof Error ? error.message : "path_or_normalize_failed"
        }`,
      );
      // omit this card — degrade gracefully
    }
  }

  return {
    visuals,
    injected: Object.keys(visuals).length > 0,
    stale: false,
    warnings,
    skippedReason: Object.keys(visuals).length === 0 ? "none_uploaded" : undefined,
  };
}

/**
 * Safe wrapper: duplicate mapping → empty injection + warning (never silent overwrite).
 */
export async function buildInstagramRendererVisualMapSafe(
  input: Parameters<typeof buildInstagramRendererVisualMap>[0],
): Promise<InstagramRendererVisualMapResult> {
  try {
    return await buildInstagramRendererVisualMap(input);
  } catch (error) {
    if (error instanceof SharedVisualInstagramMapError && error.code === "duplicate_card_mapping") {
      return {
        visuals: {},
        injected: false,
        stale: false,
        warnings: [error.message],
        skippedReason: "duplicate_card_mapping",
      };
    }
    throw error;
  }
}
