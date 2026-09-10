import type {
  ShortformNormalizedHit,
  ShortformProviderSearchInput,
  ShortformProviderSearchResult,
  ShortformSourceProvider,
} from "@/lib/marketing/assets/shortform/resolver/provider";

/**
 * Fal FastWan is NOT called. Returns a planning-only candidate.
 */
export function createGeneratedVideoPlanProvider(): ShortformSourceProvider {
  return {
    providerId: "generated_video_plan",
    async search(params: ShortformProviderSearchInput): Promise<ShortformProviderSearchResult> {
      if (params.scene.visual.factualVisualRequired) {
        return {
          providerId: "generated_video_plan",
          status: "skipped",
          hits: [],
          message: "forbidden_for_factual_scene",
        };
      }
      if (!params.scene.visual.generatedVideoAllowed) {
        return {
          providerId: "generated_video_plan",
          status: "skipped",
          hits: [],
          message: "generated_not_allowed",
        };
      }

      const hit: ShortformNormalizedHit = {
        origin: "generated_video_plan",
        catalogSourceId: null,
        provider: "fal",
        providerAssetId: null,
        mediaType: "generated_video_plan",
        sourcePageUrl: null,
        remoteAssetUrl: null,
        remoteAssetUrlExpiresAt: null,
        previewUrl: null,
        width: 1080,
        height: 1920,
        durationMs: params.scene.targetDurationMs,
        orientation: "portrait",
        creatorName: null,
        rightsKind: "generated",
        licenseName: null,
        licenseUrl: null,
        attributionText: null,
        sha256: null,
        tags: [params.scene.visual.subject],
        titleOrSubject: params.scene.visual.subject,
        storageClassHint: "generated_source",
        factualMatchHint: "generic",
      };

      return {
        providerId: "generated_video_plan",
        status: "success",
        hits: [hit],
        message: "plan_only_no_fal_call",
      };
    },
  };
}
