/**
 * Rebuild MediaBrief + ShortVideoBrief from the latest human draft.
 * Used after draft save and before forceRefresh source resolve.
 */

import "server-only";

import { existsSync, readFileSync, unlinkSync } from "node:fs";
import { join } from "node:path";

import { buildMediaBriefFromCandidate } from "@/lib/marketing/assets/buildMediaBriefFromCandidate";
import { loadCompletedMarketingCandidateForAssets } from "@/lib/marketing/assets/candidateAssetPackageService";
import { resolveMarketingAssetRoot } from "@/lib/marketing/assets/config";
import { stableJsonBytes } from "@/lib/marketing/assets/hashing";
import { resolvePackageDirectory } from "@/lib/marketing/assets/paths";
import { MEDIA_BRIEF_RELATIVE_PATH } from "@/lib/marketing/assets/video/paths";
import { overwritePackageArtifact } from "@/lib/marketing/assets/writeArtifact";
import { isShortVideoBriefGenerationApplicable } from "@/lib/marketing/assets/shortVideoBrief/gating";
import { buildShortVideoBrief } from "@/lib/marketing/assets/shortVideoBrief/buildShortVideoBrief";
import { persistShortVideoBrief } from "@/lib/marketing/assets/shortVideoBrief/persist";
import { DAILY_SHORTFORM_COMMITMENT_RELATIVE_PATH } from "@/lib/marketing/assets/shortform/dailyShortformBridge";
import {
  SHORTFORM_SOURCE_RESOLUTION_CONTRACT,
  type ShortformSourceResolutionPlan,
} from "@/lib/marketing/assets/shortform/resolver/contracts";
import { persistShortformSourceResolution } from "@/lib/marketing/assets/shortform/resolver/persist";
import { SHORTFORM_SOURCE_RESOLUTION_RELATIVE_PATH } from "@/lib/marketing/assets/shortform/resolver/paths";
import { createMarketingMediaSourceCatalogRepository } from "@/lib/marketing/assets/sourceCatalog/createSourceCatalogRepository";
import type { CompletedMarketingCandidate } from "@/lib/marketing/cron/daily/types";
import type { HumanReviewDraft } from "@/lib/marketing/review/types";
import { applyPublishableContentToMediaBrief } from "@/lib/marketing/publishable/applyToMediaBrief";
import { ensurePublishableContentSync } from "@/lib/marketing/publishable/ensurePublishableContentSync";
import { looksLikeInternalPlanningBody } from "@/lib/marketing/publishable/validate";
import { persistPublishableContentBundle } from "@/lib/marketing/publishable/persist";
import { buildThreadsPostText } from "@/lib/marketing/publishable/applyToMediaBrief";

export type RebuildShortformBriefsResult =
  | {
      ok: true;
      packageRoot: string;
      sceneCount: number;
      resolutionInvalidated: boolean;
    }
  | {
      ok: false;
      reason:
        | "candidate_not_found"
        | "package_missing"
        | "not_shortform_committed"
        | "brief_not_applicable"
        | "error";
      message?: string;
    };

function mergeDraftIntoCandidate(
  candidate: CompletedMarketingCandidate,
  draft: HumanReviewDraft,
): CompletedMarketingCandidate {
  return {
    ...candidate,
    draft: {
      title: draft.title ?? candidate.draft.title,
      body: draft.body,
      channel: draft.channel || candidate.draft.channel,
    },
  };
}

function readResolutionPlan(packageRoot: string): ShortformSourceResolutionPlan | null {
  const path = join(packageRoot, SHORTFORM_SOURCE_RESOLUTION_RELATIVE_PATH);
  if (!existsSync(path)) return null;
  try {
    const raw = JSON.parse(readFileSync(path, "utf8")) as ShortformSourceResolutionPlan;
    if (raw?.contract !== SHORTFORM_SOURCE_RESOLUTION_CONTRACT) return null;
    return raw;
  } catch {
    return null;
  }
}

/**
 * Drop unpicked scene resolutions so the next resolve re-searches with new queries.
 * Catalog PICKs (usages) are preserved.
 */
async function invalidateUnpickedResolution(input: {
  packageRoot: string;
  candidateId: string;
  nowIso: string;
}): Promise<boolean> {
  const existing = readResolutionPlan(input.packageRoot);
  if (!existing) return false;

  let pickedSceneIds = new Set<string>();
  try {
    const catalog = await createMarketingMediaSourceCatalogRepository();
    const usages = await catalog.listUsagesForCandidate(input.candidateId);
    pickedSceneIds = new Set(
      usages.map((u) => u.sceneKey?.trim()).filter((key): key is string => Boolean(key)),
    );
  } catch {
    pickedSceneIds = new Set();
  }

  const keptScenes = existing.scenes.filter((scene) => pickedSceneIds.has(scene.sceneId));
  if (keptScenes.length === 0) {
    try {
      unlinkSync(join(input.packageRoot, SHORTFORM_SOURCE_RESOLUTION_RELATIVE_PATH));
    } catch {
      /* ignore */
    }
    return true;
  }

  if (keptScenes.length === existing.scenes.length) {
    return false;
  }

  persistShortformSourceResolution({
    packageRoot: input.packageRoot,
    plan: {
      ...existing,
      scenes: keptScenes,
      createdAt: input.nowIso,
    },
    createdAt: input.nowIso,
    overwrite: true,
  });
  return true;
}

/**
 * Rebuild shortform briefs from the latest draft when a shortform package exists.
 */
export async function rebuildShortformBriefsFromDraft(input: {
  candidateId: string;
  draft: HumanReviewDraft;
  candidate?: CompletedMarketingCandidate | null;
  invalidateUnpickedResolution?: boolean;
  now?: Date;
}): Promise<RebuildShortformBriefsResult> {
  const nowIso = (input.now ?? new Date()).toISOString();
  try {
    const candidate =
      input.candidate ?? (await loadCompletedMarketingCandidateForAssets(input.candidateId));
    if (!candidate) {
      return { ok: false, reason: "candidate_not_found" };
    }

    const assetRoot = resolveMarketingAssetRoot({});
    const packageRoot = resolvePackageDirectory({
      assetRoot,
      businessDateKst: candidate.businessDateKst,
      candidateId: candidate.candidateId,
    });
    if (!existsSync(packageRoot)) {
      return { ok: false, reason: "package_missing" };
    }
    if (!existsSync(join(packageRoot, DAILY_SHORTFORM_COMMITMENT_RELATIVE_PATH))) {
      return { ok: false, reason: "not_shortform_committed" };
    }

    const merged = mergeDraftIntoCandidate(candidate, input.draft);
    const humanEdited = !looksLikeInternalPlanningBody(input.draft.body);
    const publishable = ensurePublishableContentSync({
      candidate: merged,
      packageRoot,
      humanDraft: input.draft,
      humanEditedAfterGovernance: humanEdited,
      forceRegenerate: true,
      now: input.now,
    });
    persistPublishableContentBundle({
      packageRoot,
      bundle: publishable,
      createdAt: nowIso,
    });
    overwritePackageArtifact({
      packageRoot,
      planned: {
        relativePath: "copy/post.txt",
        content: Buffer.from(buildThreadsPostText(publishable), "utf8"),
        kind: "copy",
        origin: "candidate_copy",
        mediaType: "text/plain; charset=utf-8",
      },
      createdAt: nowIso,
    });

    const mediaBrief = applyPublishableContentToMediaBrief(
      buildMediaBriefFromCandidate(merged),
      publishable,
    );
    if (!isShortVideoBriefGenerationApplicable(mediaBrief)) {
      return { ok: false, reason: "brief_not_applicable" };
    }

    overwritePackageArtifact({
      packageRoot,
      planned: {
        relativePath: MEDIA_BRIEF_RELATIVE_PATH,
        content: stableJsonBytes(mediaBrief),
        kind: "media_brief",
        origin: "media_brief",
        mediaType: "application/json",
      },
      createdAt: nowIso,
    });

    const shortVideoBrief = buildShortVideoBrief({
      mediaBrief,
      destinations: merged.selectedAgenda.destinations,
      entities: merged.selectedAgenda.entities,
      hook: merged.contentPlan?.hook ?? merged.selectedAgenda.title,
    });
    persistShortVideoBrief({
      packageRoot,
      brief: shortVideoBrief,
      createdAt: nowIso,
      overwrite: true,
    });

    let resolutionInvalidated = false;
    if (input.invalidateUnpickedResolution !== false) {
      resolutionInvalidated = await invalidateUnpickedResolution({
        packageRoot,
        candidateId: candidate.candidateId,
        nowIso,
      });
    }

    return {
      ok: true,
      packageRoot,
      sceneCount: shortVideoBrief.scenes.length,
      resolutionInvalidated,
    };
  } catch (error) {
    return {
      ok: false,
      reason: "error",
      message: error instanceof Error ? error.message : String(error),
    };
  }
}
