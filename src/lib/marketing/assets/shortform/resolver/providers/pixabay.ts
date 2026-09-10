/**
 * Pixabay Video Search adapter — SEARCH ONLY.
 * Official: GET https://pixabay.com/api/videos/
 * Policy: responses MUST be cached ≥ 24 hours. Runtime requires SourceSearchCache.
 */

import {
  SHORTFORM_PIXABAY_SEARCH_CACHE_TTL_MS,
  SHORTFORM_RESOLVER_PROVIDER_RAW_LIMIT,
} from "@/lib/marketing/assets/shortform/resolver/constants";
import { resolverHttpGet, type ResolverFetchImpl } from "@/lib/marketing/assets/shortform/resolver/http";
import type {
  ShortformNormalizedHit,
  ShortformProviderSearchInput,
  ShortformProviderSearchResult,
  ShortformSourceProvider,
} from "@/lib/marketing/assets/shortform/resolver/provider";
import { inferOrientation } from "@/lib/marketing/assets/shortform/resolver/scoring";
import {
  cacheKeyForSearch,
  type SourceSearchCache,
} from "@/lib/marketing/assets/shortform/resolver/searchCache";

export const PIXABAY_VIDEO_SEARCH_URL = "https://pixabay.com/api/videos/" as const;

type PixabayVideoSize = {
  url?: string;
  width?: number;
  height?: number;
  size?: number;
  thumbnail?: string;
};

type PixabayHit = {
  id?: number;
  pageURL?: string;
  type?: string;
  tags?: string;
  duration?: number;
  videos?: {
    large?: PixabayVideoSize;
    medium?: PixabayVideoSize;
    small?: PixabayVideoSize;
    tiny?: PixabayVideoSize;
  };
  user?: string;
};

type PixabaySearchResponse = {
  total?: number;
  totalHits?: number;
  hits?: PixabayHit[];
};

function pickSize(videos: PixabayHit["videos"]): PixabayVideoSize | null {
  if (!videos) return null;
  return videos.medium ?? videos.small ?? videos.large ?? videos.tiny ?? null;
}

export function normalizePixabayVideoSearchResponse(body: unknown): ShortformNormalizedHit[] {
  if (!body || typeof body !== "object" || Array.isArray(body)) {
    throw new Error("malformed_pixabay_response");
  }
  const payload = body as PixabaySearchResponse;
  if (!Array.isArray(payload.hits)) {
    throw new Error("malformed_pixabay_response");
  }
  const hits: ShortformNormalizedHit[] = [];
  for (const hit of payload.hits) {
    if (typeof hit.id !== "number") continue;
    const size = pickSize(hit.videos);
    const width = typeof size?.width === "number" ? size.width : null;
    const height = typeof size?.height === "number" ? size.height : null;
    const tags =
      typeof hit.tags === "string"
        ? hit.tags
            .split(",")
            .map((t) => t.trim())
            .filter(Boolean)
        : [];
    hits.push({
      origin: "pixabay",
      catalogSourceId: null,
      provider: "pixabay",
      providerAssetId: String(hit.id),
      mediaType: "video",
      sourcePageUrl: typeof hit.pageURL === "string" ? hit.pageURL : null,
      remoteAssetUrl: typeof size?.url === "string" ? size.url : null,
      remoteAssetUrlExpiresAt: null,
      previewUrl: typeof size?.thumbnail === "string" ? size.thumbnail : null,
      width,
      height,
      durationMs:
        typeof hit.duration === "number" && Number.isFinite(hit.duration)
          ? Math.round(hit.duration * 1000)
          : null,
      orientation: inferOrientation(width, height),
      creatorName: typeof hit.user === "string" ? hit.user : null,
      rightsKind: "provider_license",
      licenseName: "Pixabay Content License",
      licenseUrl: "https://pixabay.com/service/license-summary/",
      attributionText: typeof hit.user === "string" ? `Video by ${hit.user} on Pixabay` : null,
      sha256: null,
      tags,
      titleOrSubject: tags[0] ?? null,
      storageClassHint: "external_ref",
      factualMatchHint: null,
    });
  }
  return hits;
}

export function createPixabaySourceProvider(input: {
  apiKey?: string | null;
  cache?: SourceSearchCache | null;
  fetchImpl?: ResolverFetchImpl;
  enabled?: boolean;
}): ShortformSourceProvider {
  const apiKey = input.apiKey?.trim() || "";
  const enabled = input.enabled ?? Boolean(apiKey);

  return {
    providerId: "pixabay",
    async search(params: ShortformProviderSearchInput): Promise<ShortformProviderSearchResult> {
      if (!enabled || !apiKey) {
        return {
          providerId: "pixabay",
          status: "disabled",
          hits: [],
          message: "PIXABAY_API_KEY absent",
        };
      }
      if (!input.cache) {
        return {
          providerId: "pixabay",
          status: "disabled",
          message: "pixabay_requires_compliant_search_cache",
          hits: [],
        };
      }

      const query = (params.queries[0] ?? params.scene.visual.searchQueries[0] ?? params.scene.visual.subject)
        .trim()
        .slice(0, 100);
      if (!query) {
        return { providerId: "pixabay", status: "empty", hits: [], message: "empty_query" };
      }

      const perPage = Math.min(
        SHORTFORM_RESOLVER_PROVIDER_RAW_LIMIT,
        Math.max(3, params.limit || SHORTFORM_RESOLVER_PROVIDER_RAW_LIMIT),
      );
      const cacheKey = cacheKeyForSearch({
        provider: "pixabay",
        q: query,
        per_page: String(perPage),
        video_type: "all",
        safesearch: "true",
      });

      const cached = await input.cache.get(cacheKey);
      if (cached) {
        try {
          const hits = normalizePixabayVideoSearchResponse(JSON.parse(cached)).slice(0, perPage);
          return {
            providerId: "pixabay",
            status: hits.length > 0 ? "success" : "empty",
            hits,
            message: "cache_hit",
          };
        } catch {
          // fall through to network
        }
      }

      const url = new URL(PIXABAY_VIDEO_SEARCH_URL);
      url.searchParams.set("key", apiKey);
      url.searchParams.set("q", query);
      url.searchParams.set("per_page", String(perPage));
      url.searchParams.set("safesearch", "true");
      url.searchParams.set("video_type", "all");

      const response = await resolverHttpGet({
        url: url.toString(),
        fetchImpl: input.fetchImpl,
      });

      if (!response.ok) {
        if (response.status === 401 || response.status === 403) {
          return { providerId: "pixabay", status: "error", hits: [], message: `auth_failed_${response.status}` };
        }
        if (response.status === 429) {
          return { providerId: "pixabay", status: "unavailable", hits: [], message: "rate_limited" };
        }
        if (response.code === "timeout") {
          return { providerId: "pixabay", status: "unavailable", hits: [], message: "timeout" };
        }
        return { providerId: "pixabay", status: "error", hits: [], message: response.message };
      }

      try {
        JSON.parse(response.body);
        await input.cache.set(cacheKey, response.body, SHORTFORM_PIXABAY_SEARCH_CACHE_TTL_MS);
        const hits = normalizePixabayVideoSearchResponse(JSON.parse(response.body)).slice(0, perPage);
        return {
          providerId: "pixabay",
          status: hits.length > 0 ? "success" : "empty",
          hits,
          message: null,
        };
      } catch {
        return { providerId: "pixabay", status: "error", hits: [], message: "malformed_response" };
      }
    },
  };
}
