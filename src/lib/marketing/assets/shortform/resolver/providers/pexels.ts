/**
 * Pexels Video Search adapter — SEARCH ONLY.
 * Official contract: GET https://api.pexels.com/v1/videos/search
 * Auth: Authorization: <API_KEY>
 */

import {
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

export const PEXELS_VIDEO_SEARCH_URL = "https://api.pexels.com/v1/videos/search" as const;

type PexelsVideoFile = {
  id?: number;
  quality?: string;
  file_type?: string;
  width?: number;
  height?: number;
  link?: string;
};

type PexelsVideo = {
  id?: number;
  width?: number;
  height?: number;
  url?: string;
  image?: string;
  duration?: number;
  user?: { id?: number; name?: string; url?: string };
  video_files?: PexelsVideoFile[];
};

type PexelsSearchResponse = {
  page?: number;
  per_page?: number;
  total_results?: number;
  videos?: PexelsVideo[];
};

function pickRemoteFile(files: PexelsVideoFile[] | undefined): PexelsVideoFile | null {
  if (!files || files.length === 0) return null;
  const hd = files.find((f) => f.quality === "hd" && typeof f.link === "string");
  if (hd) return hd;
  const sd = files.find((f) => f.quality === "sd" && typeof f.link === "string");
  if (sd) return sd;
  return files.find((f) => typeof f.link === "string") ?? null;
}

export function normalizePexelsVideoSearchResponse(body: unknown): ShortformNormalizedHit[] {
  if (!body || typeof body !== "object" || Array.isArray(body)) {
    throw new Error("malformed_pexels_response");
  }
  const payload = body as PexelsSearchResponse;
  if (!Array.isArray(payload.videos)) {
    throw new Error("malformed_pexels_response");
  }
  const hits: ShortformNormalizedHit[] = [];
  for (const video of payload.videos) {
    if (typeof video.id !== "number") continue;
    const file = pickRemoteFile(video.video_files);
    const width = typeof video.width === "number" ? video.width : file?.width ?? null;
    const height = typeof video.height === "number" ? video.height : file?.height ?? null;
    hits.push({
      origin: "pexels",
      catalogSourceId: null,
      provider: "pexels",
      providerAssetId: String(video.id),
      mediaType: "video",
      sourcePageUrl: typeof video.url === "string" ? video.url : null,
      remoteAssetUrl: typeof file?.link === "string" ? file.link : null,
      remoteAssetUrlExpiresAt: null,
      previewUrl: typeof video.image === "string" ? video.image : null,
      width,
      height,
      durationMs:
        typeof video.duration === "number" && Number.isFinite(video.duration)
          ? Math.round(video.duration * 1000)
          : null,
      orientation: inferOrientation(width, height),
      creatorName: typeof video.user?.name === "string" ? video.user.name : null,
      rightsKind: "provider_license",
      licenseName: "Pexels License",
      licenseUrl: "https://www.pexels.com/license/",
      attributionText: typeof video.user?.name === "string" ? `Video by ${video.user.name} on Pexels` : null,
      sha256: null,
      tags: [],
      titleOrSubject: null,
      storageClassHint: "external_ref",
      factualMatchHint: null,
    });
  }
  return hits;
}

export function createPexelsSourceProvider(input: {
  apiKey?: string | null;
  fetchImpl?: ResolverFetchImpl;
  enabled?: boolean;
}): ShortformSourceProvider {
  const apiKey = input.apiKey?.trim() || "";
  const enabled = input.enabled ?? Boolean(apiKey);

  return {
    providerId: "pexels",
    async search(params: ShortformProviderSearchInput): Promise<ShortformProviderSearchResult> {
      if (!enabled || !apiKey) {
        return {
          providerId: "pexels",
          status: "disabled",
          hits: [],
          message: "PEXELS_API_KEY absent",
        };
      }

      const query = (params.queries[0] ?? params.scene.visual.searchQueries[0] ?? params.scene.visual.subject)
        .trim()
        .slice(0, 200);
      if (!query) {
        return { providerId: "pexels", status: "empty", hits: [], message: "empty_query" };
      }

      const perPage = Math.min(
        SHORTFORM_RESOLVER_PROVIDER_RAW_LIMIT,
        Math.max(1, params.limit || SHORTFORM_RESOLVER_PROVIDER_RAW_LIMIT),
      );
      const url = new URL(PEXELS_VIDEO_SEARCH_URL);
      url.searchParams.set("query", query);
      url.searchParams.set("orientation", "portrait");
      url.searchParams.set("per_page", String(perPage));
      url.searchParams.set("page", "1");

      const response = await resolverHttpGet({
        url: url.toString(),
        headers: { Authorization: apiKey },
        fetchImpl: input.fetchImpl,
      });

      if (!response.ok) {
        if (response.status === 401 || response.status === 403) {
          return {
            providerId: "pexels",
            status: "error",
            hits: [],
            message: `auth_failed_${response.status}`,
          };
        }
        if (response.status === 429) {
          return { providerId: "pexels", status: "unavailable", hits: [], message: "rate_limited" };
        }
        if (response.code === "timeout") {
          return { providerId: "pexels", status: "unavailable", hits: [], message: "timeout" };
        }
        return {
          providerId: "pexels",
          status: "error",
          hits: [],
          message: response.message,
        };
      }

      try {
        const parsed = JSON.parse(response.body) as unknown;
        const hits = normalizePexelsVideoSearchResponse(parsed).slice(0, perPage);
        return {
          providerId: "pexels",
          status: hits.length > 0 ? "success" : "empty",
          hits,
          message: null,
        };
      } catch {
        return {
          providerId: "pexels",
          status: "error",
          hits: [],
          message: "malformed_response",
        };
      }
    },
  };
}
