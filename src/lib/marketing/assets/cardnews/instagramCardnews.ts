/**
 * Instagram cardnews render step.
 *
 * Deliberately separate from the production queue: sharp rasterization is the
 * heaviest job in the marketing pipeline on the Pi, and a slow render must never
 * delay the copy human review is waiting for. This step only reads artifacts an
 * export already persisted, and renders solely for candidates where Instagram
 * was actually selected and produced a publishable caption.
 */

import { existsSync, readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";

import type { MediaBrief } from "@/lib/marketing/assets/contracts";
import type { CardNewsAspectRatio } from "@/lib/marketing/assets/cardnews/brand";
import {
  INSTAGRAM_CARDNEWS_ASPECT_RATIOS,
  resolveInstagramCardnewsSkip,
  type InstagramCardnewsSkipReason,
} from "@/lib/marketing/assets/cardnews/instagramCards";
import {
  renderCardNewsPackage,
  type RenderCardNewsPackageResult,
} from "@/lib/marketing/assets/cardnews/renderCardNewsPackage";
import { parseMediaBrief } from "@/lib/marketing/assets/parse";
import { splitBusinessDateParts } from "@/lib/marketing/assets/paths";
import {
  PUBLISHABLE_CONTENT_BUNDLE_CONTRACT,
  type PublishableContentBundle,
} from "@/lib/marketing/publishable/contracts";
import { PUBLISHABLE_CONTENT_RELATIVE_PATH } from "@/lib/marketing/publishable/paths";
import { buildInstagramRendererVisualMapSafe } from "@/lib/marketing/publishable/sharedVisualDelivery";
import { getSharedVisualRenderCacheDir } from "@/lib/marketing/publishable/sharedVisualDelivery/normalizeImageForRenderer";
import { readSharedVisualAssetsManifest } from "@/lib/marketing/publishable/sharedVisualAssets";
import { readSharedVisualPlan } from "@/lib/marketing/publishable/sharedVisualPlan";

export function readPackagePublishableBundle(
  packageRoot: string,
): PublishableContentBundle | null {
  const path = join(packageRoot, PUBLISHABLE_CONTENT_RELATIVE_PATH);
  if (!existsSync(path)) return null;
  try {
    const raw = JSON.parse(readFileSync(path, "utf8")) as PublishableContentBundle;
    return raw?.contract === PUBLISHABLE_CONTENT_BUNDLE_CONTRACT ? raw : null;
  } catch {
    return null;
  }
}

export function readPackageMediaBrief(packageRoot: string): MediaBrief | null {
  const path = join(packageRoot, "context/media-brief.json");
  if (!existsSync(path)) return null;
  try {
    return parseMediaBrief(JSON.parse(readFileSync(path, "utf8")) as unknown);
  } catch {
    return null;
  }
}

export type RenderInstagramCardnewsResult = {
  status: "rendered" | "skipped";
  skipReason?: InstagramCardnewsSkipReason | "package_incomplete" | "cardnews_not_in_brief";
  candidateId: string | null;
  packageRoot: string;
  aspectRatios: CardNewsAspectRatio[];
  cardCount: number;
  renders: RenderCardNewsPackageResult[];
  /** Shared visual injection provenance (additive; render still succeeds without uploads). */
  sharedVisualInjection?: {
    injected: boolean;
    stale: boolean;
    cardIds: string[];
    warnings: string[];
    skippedReason?: string;
  };
};

/**
 * Renders from the persisted brief as-is. The export step is what turns the
 * Instagram selection into `cardnews.enabled` + cards, so rendering never
 * rewrites `context/media-brief.json` and never trips the artifact sha guard.
 */
export async function renderInstagramCardnewsForPackage(input: {
  packageRoot: string;
  assetRoot?: string | null;
  aspectRatios?: CardNewsAspectRatio[];
  dryRun?: boolean;
  graphicOnly?: boolean;
  now?: Date;
}): Promise<RenderInstagramCardnewsResult> {
  const bundle = readPackagePublishableBundle(input.packageRoot);
  const brief = readPackageMediaBrief(input.packageRoot);
  const base = { packageRoot: input.packageRoot, aspectRatios: [], cardCount: 0, renders: [] };

  if (!bundle || !brief) {
    return {
      status: "skipped",
      skipReason: "package_incomplete",
      candidateId: bundle?.candidateId ?? brief?.candidateId ?? null,
      ...base,
    };
  }

  const skip = resolveInstagramCardnewsSkip(bundle);
  if (skip) {
    return { status: "skipped", skipReason: skip, candidateId: bundle.candidateId, ...base };
  }
  if (!brief.formats.cardnews.enabled || brief.formats.cardnews.cards.length === 0) {
    return {
      status: "skipped",
      skipReason: "cardnews_not_in_brief",
      candidateId: bundle.candidateId,
      ...base,
    };
  }

  const aspectRatios = input.aspectRatios?.length
    ? input.aspectRatios
    : INSTAGRAM_CARDNEWS_ASPECT_RATIOS;

  // Shared Visual Plan + Manifest → cardId → local PNG path (read-only).
  // Stale / missing / ambiguous → empty visuals; geometric fallback still works.
  const sharedVisualPlan = readSharedVisualPlan(input.packageRoot);
  const sharedVisualManifest = readSharedVisualAssetsManifest(input.packageRoot);
  const visualMap = input.graphicOnly
    ? {
        visuals: {} as Record<string, string>,
        injected: false,
        stale: false,
        warnings: ["graphic_only"],
        skippedReason: "none_uploaded" as const,
      }
    : await buildInstagramRendererVisualMapSafe({
        packageRoot: input.packageRoot,
        sharedVisualPlan,
        manifest: sharedVisualManifest,
      });

  if (visualMap.warnings.length > 0) {
    console.info(
      "[instagram-cardnews] shared visual injection",
      JSON.stringify({
        candidateId: bundle.candidateId,
        injected: visualMap.injected,
        stale: visualMap.stale,
        skippedReason: visualMap.skippedReason ?? null,
        warnings: visualMap.warnings,
        cardIds: Object.keys(visualMap.visuals),
      }),
    );
  }

  const renders: RenderCardNewsPackageResult[] = [];
  for (const aspectRatio of aspectRatios) {
    renders.push(
      await renderCardNewsPackage({
        mediaBrief: brief,
        assetRoot: input.assetRoot ?? null,
        aspectRatio,
        dryRun: input.dryRun,
        graphicOnly: input.graphicOnly,
        visuals: visualMap.visuals,
        allowedVisualRoots: [input.packageRoot, getSharedVisualRenderCacheDir()],
        now: input.now,
      }),
    );
  }

  return {
    status: "rendered",
    candidateId: bundle.candidateId,
    packageRoot: input.packageRoot,
    aspectRatios,
    cardCount: brief.formats.cardnews.cards.length,
    renders,
    sharedVisualInjection: {
      injected: visualMap.injected,
      stale: visualMap.stale,
      cardIds: Object.keys(visualMap.visuals).sort(),
      warnings: visualMap.warnings,
      skippedReason: visualMap.skippedReason,
    },
  };
}

/** Package directories for one business date, oldest candidate id first. */
export function listPackageRootsForBusinessDate(input: {
  assetRoot: string;
  businessDateKst: string;
}): string[] {
  const { year, month, day } = splitBusinessDateParts(input.businessDateKst);
  const dayRoot = join(input.assetRoot, year, month, day);
  if (!existsSync(dayRoot)) return [];
  return readdirSync(dayRoot, { withFileTypes: true })
    .filter((entry) => entry.isDirectory())
    .map((entry) => entry.name)
    .sort((left, right) => left.localeCompare(right))
    .map((candidateId) => join(dayRoot, candidateId));
}

export async function renderInstagramCardnewsForBusinessDate(input: {
  assetRoot: string;
  businessDateKst: string;
  aspectRatios?: CardNewsAspectRatio[];
  dryRun?: boolean;
  graphicOnly?: boolean;
  maxPackages?: number;
  now?: Date;
}): Promise<RenderInstagramCardnewsResult[]> {
  const roots = listPackageRootsForBusinessDate(input);
  const limit = Math.max(1, input.maxPackages ?? Math.max(roots.length, 1));
  const results: RenderInstagramCardnewsResult[] = [];
  for (const packageRoot of roots.slice(0, limit)) {
    results.push(
      await renderInstagramCardnewsForPackage({
        packageRoot,
        assetRoot: input.assetRoot,
        aspectRatios: input.aspectRatios,
        dryRun: input.dryRun,
        graphicOnly: input.graphicOnly,
        now: input.now,
      }),
    );
  }
  return results;
}
