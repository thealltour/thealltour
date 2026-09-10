import type {
  ShortformNormalizedHit,
  ShortformProviderSearchInput,
  ShortformProviderSearchResult,
  ShortformSourceProvider,
} from "@/lib/marketing/assets/shortform/resolver/provider";

/**
 * Photo-motion is a resolution mode over an image hit — not a renderer.
 * Converts eligible image hits into photo_motion origin candidates.
 */
export function toPhotoMotionHit(imageHit: ShortformNormalizedHit): ShortformNormalizedHit {
  return {
    ...imageHit,
    origin: "photo_motion",
    mediaType: "image",
  };
}

export function createPhotoMotionSourceProvider(input: {
  imageHits?: ShortformNormalizedHit[];
}): ShortformSourceProvider {
  return {
    providerId: "photo_motion",
    async search(params: ShortformProviderSearchInput): Promise<ShortformProviderSearchResult> {
      if (!params.scene.visual.photoMotionAllowed) {
        return {
          providerId: "photo_motion",
          status: "skipped",
          hits: [],
          message: "photo_motion_not_allowed",
        };
      }
      const images = (input.imageHits ?? []).filter((hit) => hit.mediaType === "image");
      const hits = images.map(toPhotoMotionHit).slice(0, params.limit);
      return {
        providerId: "photo_motion",
        status: hits.length > 0 ? "success" : "empty",
        hits,
        message: hits.length > 0 ? null : "no_image_hits",
      };
    },
  };
}
