import type { ShortVideoSceneRequirement } from "@/lib/marketing/assets/shortVideoBrief/contracts";
import {
  SHORTFORM_RESOLVER_AUTO_PICK_MIN_SCORE,
  SHORTFORM_RESOLVER_FINAL_CANDIDATE_LIMIT,
  SHORTFORM_RESOLVER_PROVIDER_RAW_LIMIT,
  SHORTFORM_RESOLVER_REVIEW_MIN_SCORE,
} from "@/lib/marketing/assets/shortform/resolver/constants";
import type {
  ShortformProviderAttempt,
  ShortformSceneSourceResolution,
  ShortformSourceCandidate,
} from "@/lib/marketing/assets/shortform/resolver/contracts";
import { candidateKeyForHit, dedupeSourceCandidates } from "@/lib/marketing/assets/shortform/resolver/dedupe";
import { hardRejectReasons, inferFactualMatch } from "@/lib/marketing/assets/shortform/resolver/gates";
import type {
  ShortformNormalizedHit,
  ShortformSourceProvider,
} from "@/lib/marketing/assets/shortform/resolver/provider";
import { createGeneratedVideoPlanProvider } from "@/lib/marketing/assets/shortform/resolver/providers/generatedPlan";
import { createPhotoMotionSourceProvider } from "@/lib/marketing/assets/shortform/resolver/providers/photoMotion";
import { applyEligibilityFlags, scoreNormalizedHit } from "@/lib/marketing/assets/shortform/resolver/scoring";

function hitToCandidate(input: {
  hit: ShortformNormalizedHit;
  scene: ShortVideoSceneRequirement;
}): ShortformSourceCandidate | null {
  const hard = hardRejectReasons(input);
  if (hard.length > 0) return null;

  const factualMatch = inferFactualMatch(input);
  const { score, breakdown } = scoreNormalizedHit({
    hit: input.hit,
    scene: input.scene,
    factualMatch,
  });

  const base = {
    candidateKey: candidateKeyForHit(input.hit),
    origin: input.hit.origin,
    catalogSourceId: input.hit.catalogSourceId,
    provider: input.hit.provider,
    providerAssetId: input.hit.providerAssetId,
    mediaType: input.hit.mediaType,
    sourcePageUrl: input.hit.sourcePageUrl,
    remoteAssetUrl: input.hit.remoteAssetUrl,
    remoteAssetUrlExpiresAt: input.hit.remoteAssetUrlExpiresAt,
    previewUrl: input.hit.previewUrl,
    width: input.hit.width,
    height: input.hit.height,
    durationMs: input.hit.durationMs,
    orientation: input.hit.orientation,
    creatorName: input.hit.creatorName,
    rightsKind: input.hit.rightsKind,
    licenseName: input.hit.licenseName,
    licenseUrl: input.hit.licenseUrl,
    attributionText: input.hit.attributionText,
    sha256: input.hit.sha256,
    score,
    scoreBreakdown: breakdown,
    factualMatch,
    rejectionReasons: [] as string[],
    ...(input.hit.origin === "generated_video_plan"
      ? {
          generationIntent: {
            subject: input.scene.visual.subject,
            durationMs: input.scene.targetDurationMs,
            provider: "fal" as const,
          },
        }
      : {}),
  };

  return applyEligibilityFlags({ candidate: base, scene: input.scene });
}

function sortCandidates(candidates: ShortformSourceCandidate[]): ShortformSourceCandidate[] {
  return [...candidates].sort((a, b) => {
    if (b.score !== a.score) return b.score - a.score;
    if (a.origin === "internal_catalog" && b.origin !== "internal_catalog") return -1;
    if (b.origin === "internal_catalog" && a.origin !== "internal_catalog") return 1;
    return a.candidateKey.localeCompare(b.candidateKey);
  });
}

function decideStatus(candidates: ShortformSourceCandidate[]): {
  status: ShortformSceneSourceResolution["status"];
  recommended: ShortformSourceCandidate | null;
  reason: string;
} {
  const top = candidates[0] ?? null;

  if (top?.origin === "generated_video_plan") {
    return {
      status: "generation_fallback_available",
      recommended: top,
      reason: "generation_plan_only",
    };
  }

  if (top?.autoPickEligible && top.score >= SHORTFORM_RESOLVER_AUTO_PICK_MIN_SCORE) {
    return { status: "resolved", recommended: top, reason: "high_confidence_recommendation" };
  }

  if (top && top.score >= SHORTFORM_RESOLVER_REVIEW_MIN_SCORE) {
    return {
      status: "review_required",
      recommended: top,
      reason: top.rejectionReasons.join(",") || "review_required",
    };
  }

  const gen = candidates.find((c) => c.origin === "generated_video_plan");
  if (gen) {
    return {
      status: "generation_fallback_available",
      recommended: gen,
      reason: "generation_plan_only",
    };
  }

  return {
    status: "unresolved",
    recommended: null,
    reason: top ? "below_review_threshold" : "no_viable_candidates",
  };
}

export type ResolveSceneSourcesInput = {
  scene: ShortVideoSceneRequirement;
  providers: {
    internal: ShortformSourceProvider;
    pexels?: ShortformSourceProvider | null;
    pixabay?: ShortformSourceProvider | null;
  };
  shortCircuitOnInternalAutoPick?: boolean;
};

/**
 * Side-effect free scene resolution.
 * Does NOT write catalog rows or usage PICK records.
 */
export async function resolveSceneSources(
  input: ResolveSceneSourcesInput,
): Promise<ShortformSceneSourceResolution> {
  const scene = input.scene;
  const queries =
    scene.visual.searchQueries.length > 0 ? scene.visual.searchQueries : [scene.visual.subject];
  const attempted: ShortformProviderAttempt[] = [];
  const accumulated: ShortformNormalizedHit[] = [];
  const imagePool: ShortformNormalizedHit[] = [];

  const runProvider = async (provider: ShortformSourceProvider | null | undefined) => {
    if (!provider) return;
    const result = await provider.search({
      scene,
      queries,
      limit: SHORTFORM_RESOLVER_PROVIDER_RAW_LIMIT,
    });
    attempted.push({
      providerId: result.providerId,
      status: result.status,
      candidateCount: result.hits.length,
      message: result.message,
    });
    for (const hit of result.hits) {
      accumulated.push(hit);
      if (hit.mediaType === "image" && hit.origin !== "photo_motion") {
        imagePool.push(hit);
      }
    }
  };

  await runProvider(input.providers.internal);

  const earlyInternal = sortCandidates(
    accumulated
      .map((hit) => hitToCandidate({ hit, scene }))
      .filter((c): c is ShortformSourceCandidate => c != null),
  );

  const shortCircuit =
    input.shortCircuitOnInternalAutoPick !== false &&
    earlyInternal.some((c) => c.autoPickEligible);

  if (!shortCircuit) {
    await runProvider(input.providers.pexels ?? null);
    await runProvider(input.providers.pixabay ?? null);

    const photoMotion = createPhotoMotionSourceProvider({ imageHits: imagePool });
    await runProvider(photoMotion);

    const hasStrongReal = accumulated.some((hit) => {
      if (hit.origin === "generated_video_plan") return false;
      return hardRejectReasons({ hit, scene }).length === 0;
    });
    if (!hasStrongReal) {
      await runProvider(createGeneratedVideoPlanProvider());
    }
  } else {
    attempted.push({
      providerId: "pexels",
      status: "skipped",
      candidateCount: 0,
      message: "short_circuited_by_internal_auto_pick",
    });
    attempted.push({
      providerId: "pixabay",
      status: "skipped",
      candidateCount: 0,
      message: "short_circuited_by_internal_auto_pick",
    });
  }

  const scored = accumulated
    .map((hit) => hitToCandidate({ hit, scene }))
    .filter((c): c is ShortformSourceCandidate => c != null);

  const ranked = sortCandidates(dedupeSourceCandidates(scored)).slice(
    0,
    SHORTFORM_RESOLVER_FINAL_CANDIDATE_LIMIT,
  );
  const decision = decideStatus(ranked);

  return {
    sceneId: scene.sceneId,
    status: decision.status,
    recommendedCandidate: decision.recommended,
    candidates: ranked,
    attemptedSources: attempted,
    reason: decision.reason,
  };
}
