import { existsSync, mkdirSync, readFileSync, rmSync } from "node:fs";
import { join } from "node:path";
import { atomicWriteFile } from "@/lib/marketing/assets/atomicWrite";
import type { ResolverFetchImpl } from "@/lib/marketing/assets/shortform/resolver/http";
import { cacheKeyForSearch, createFileSourceSearchCache, createMemorySourceSearchCache, type SourceSearchCache } from "@/lib/marketing/assets/shortform/resolver/searchCache";
import { SHORTFORM_PIXABAY_SEARCH_CACHE_TTL_MS, SHORTFORM_RESOLVER_HTTP_TIMEOUT_MS } from "@/lib/marketing/assets/shortform/resolver/constants";
import { PEXELS_VIDEO_SEARCH_URL } from "@/lib/marketing/assets/shortform/resolver/providers/pexels";
import { PIXABAY_VIDEO_SEARCH_URL } from "@/lib/marketing/assets/shortform/resolver/providers/pixabay";
import type { SearchAttempt, StockProvider, StockRendition } from "./contracts";

/** Pexels: GET /v1/videos/videos/:id (official docs). Pixabay looks a video up with the same search endpoint and `id`. */
export const PEXELS_VIDEO_LOOKUP_URL = "https://api.pexels.com/v1/videos/videos/" as const;
export const PROVIDER_TERMS: Record<StockProvider, { providerTermsUrl: string; apiTermsUrl: string }> = {
  pexels: { providerTermsUrl: "https://www.pexels.com/license/", apiTermsUrl: "https://www.pexels.com/api/documentation/" },
  pixabay: { providerTermsUrl: "https://pixabay.com/service/license-summary/", apiTermsUrl: "https://pixabay.com/api/docs/" },
};
/**
 * Pexels documents 200 requests/hour; Pixabay 100 requests/60s, asks for 24h caching and no mass automated queries.
 * Our own caps stay well below both, and every response is cached for 24h.
 */
export const STOCK_SEARCH_LIMITS = { perPage: { pexels: 15, pixabay: 20 }, maxPages: 3, callsPerHour: { pexels: 60, pixabay: 60 }, cacheTtlMs: SHORTFORM_PIXABAY_SEARCH_CACHE_TTL_MS } as const;
export const STOCK_ENV_KEYS: Record<StockProvider, "PEXELS_API_KEY" | "PIXABAY_API_KEY"> = { pexels: "PEXELS_API_KEY", pixabay: "PIXABAY_API_KEY" };

export type RawStockVideo = {
  provider: StockProvider; videoId: string; pageUrl: string; creatorName: string | null; creatorUrl: string | null;
  declaredDurationMs: number; width: number | null; height: number | null; posterUrl: string | null;
  renditions: StockRendition[]; tags: string[];
};
type Env = NodeJS.ProcessEnv | Record<string, string | undefined>;
const https = (value: unknown) => typeof value === "string" && value.startsWith("https://") && value.length <= 2000 ? value : null;
const positiveInt = (value: unknown) => typeof value === "number" && Number.isInteger(value) && value > 0 ? value : null;

type PexelsFile = { id?: number; file_type?: string; width?: number; height?: number; fps?: number; link?: string };
type PexelsVideo = { id?: number; width?: number; height?: number; url?: string; image?: string; duration?: number; user?: { name?: string; url?: string }; video_files?: PexelsFile[] };
function pexelsVideo(video: PexelsVideo): RawStockVideo | null {
  const pageUrl = https(video.url); const duration = positiveInt(video.duration);
  if (typeof video.id !== "number" || !Number.isSafeInteger(video.id) || !pageUrl || !duration) return null;
  const renditions = (video.video_files ?? []).flatMap(file => {
    const url = https(file.link); const width = positiveInt(file.width); const height = positiveInt(file.height);
    if (!url || !width || !height || typeof file.id !== "number" || (file.file_type && file.file_type !== "video/mp4")) return [];
    return [{ fileKey: String(file.id), url, width, height, fps: typeof file.fps === "number" && file.fps > 0 ? file.fps : null }];
  });
  return { provider: "pexels", videoId: String(video.id), pageUrl, creatorName: typeof video.user?.name === "string" ? video.user.name.slice(0, 200) : null,
    creatorUrl: https(video.user?.url), declaredDurationMs: duration * 1000, width: positiveInt(video.width), height: positiveInt(video.height),
    posterUrl: https(video.image), renditions, tags: [] };
}
export function parsePexelsVideos(body: unknown): RawStockVideo[] {
  const videos = (body as { videos?: unknown } | null)?.videos;
  if (!Array.isArray(videos)) throw new Error("malformed_pexels_response");
  return videos.flatMap(video => { const parsed = video && typeof video === "object" ? pexelsVideo(video as PexelsVideo) : null; return parsed ? [parsed] : []; });
}
type PixabaySize = { url?: string; width?: number; height?: number; thumbnail?: string };
type PixabayHit = { id?: number; pageURL?: string; tags?: string; duration?: number; user?: string; user_id?: number; videos?: Record<string, PixabaySize | undefined> };
const PIXABAY_SIZES = ["tiny", "small", "medium", "large"] as const;
function pixabayHit(hit: PixabayHit): RawStockVideo | null {
  const pageUrl = https(hit.pageURL); const duration = positiveInt(hit.duration);
  if (typeof hit.id !== "number" || !Number.isSafeInteger(hit.id) || !pageUrl || !duration) return null;
  // An unavailable "large" rendition is returned with an empty URL and zero size.
  const renditions = PIXABAY_SIZES.flatMap(key => {
    const size = hit.videos?.[key]; const url = https(size?.url); const width = positiveInt(size?.width); const height = positiveInt(size?.height);
    return url && width && height ? [{ fileKey: key, url, width, height, fps: null }] : [];
  });
  const user = typeof hit.user === "string" && hit.user.trim() ? hit.user.trim().slice(0, 200) : null;
  const largest = [...renditions].sort((a, b) => b.width * b.height - a.width * a.height)[0];
  return { provider: "pixabay", videoId: String(hit.id), pageUrl, creatorName: user,
    creatorUrl: user && positiveInt(hit.user_id) ? `https://pixabay.com/users/${encodeURIComponent(user)}-${hit.user_id}/` : null,
    declaredDurationMs: duration * 1000, width: largest?.width ?? null, height: largest?.height ?? null,
    posterUrl: https(hit.videos?.medium?.thumbnail) ?? https(hit.videos?.small?.thumbnail),
    renditions, tags: typeof hit.tags === "string" ? hit.tags.split(",").map(t => t.trim().slice(0, 80)).filter(Boolean).slice(0, 40) : [] };
}
export function parsePixabayVideos(body: unknown): RawStockVideo[] {
  const hits = (body as { hits?: unknown } | null)?.hits;
  if (!Array.isArray(hits)) throw new Error("malformed_pixabay_response");
  return hits.flatMap(hit => { const parsed = hit && typeof hit === "object" ? pixabayHit(hit as PixabayHit) : null; return parsed ? [parsed] : []; });
}

export function stockStateDirectory(env: Env = process.env) { return env.NARRATION_STOCK_STATE_DIR?.trim() || join(process.cwd(), "data/narration-stock-search"); }
let defaultCache: SourceSearchCache | null = null;
export function stockSearchCache(env: Env = process.env) {
  return defaultCache ??= createFileSourceSearchCache({ rootDir: env.NARRATION_STOCK_SEARCH_CACHE_DIR?.trim() || join(stockStateDirectory(env), "cache") });
}
/** Rolling one-hour call ledger shared by the Next server and the worker. Cache hits do not count. */
function reserveProviderCall(provider: StockProvider, env: Env) {
  const directory = stockStateDirectory(env); mkdirSync(directory, { recursive: true });
  const lock = join(directory, ".usage-lock"); const path = join(directory, "usage.json");
  try { mkdirSync(lock); } catch { return false; }
  try {
    const now = Date.now(); let usage: Partial<Record<StockProvider, number[]>> = {};
    try { usage = existsSync(path) ? JSON.parse(readFileSync(path, "utf8")) as typeof usage : {}; } catch { usage = {}; }
    const recent = (usage[provider] ?? []).filter(t => typeof t === "number" && now - t < 3_600_000);
    if (recent.length >= STOCK_SEARCH_LIMITS.callsPerHour[provider]) return false;
    usage[provider] = [...recent, now]; atomicWriteFile(path, JSON.stringify(usage), 0o600); return true;
  } finally { rmSync(lock, { recursive: true, force: true }); }
}
export function stockProviderConfigured(provider: StockProvider, env: Env = process.env) { return !!env[STOCK_ENV_KEYS[provider]]?.trim(); }

/** One request per reserved call: a 429 is reported, not retried, so the local ledger matches what the provider saw. */
async function providerGet(url: string, headers: Record<string, string>, fetchImpl: ResolverFetchImpl) {
  try {
    const response = await fetchImpl(url, { method: "GET", headers: { Accept: "application/json", ...headers }, signal: AbortSignal.timeout(SHORTFORM_RESOLVER_HTTP_TIMEOUT_MS), cache: "no-store" });
    return { ok: response.ok, status: response.status, body: await response.text(), code: "http_error" };
  } catch (error) {
    return { ok: false, status: null, body: "", code: error instanceof Error && (error.name === "TimeoutError" || error.name === "AbortError") ? "timeout" : "network" };
  }
}
type ProviderRequest = { provider: StockProvider; params: Record<string, string>; env?: Env; fetchImpl?: ResolverFetchImpl; cache?: SourceSearchCache; url?: string; parse?: (body: unknown) => RawStockVideo[] };
/** networkRequests: requests actually sent (0 for a missing key, cache hit or local cap; 1 otherwise, since nothing is retried). */
export type ProviderResponse = { status: SearchAttempt["status"]; videos: RawStockVideo[]; message: string | null; networkRequests: 0 | 1 };
/** Raw provider responses are cached for 24h; keys never include the API key. Messages are fixed codes, never URLs. */
async function providerRequest(input: ProviderRequest): Promise<ProviderResponse> {
  const env = input.env ?? process.env; const apiKey = env[STOCK_ENV_KEYS[input.provider]]?.trim();
  if (!apiKey) return { status: "disabled", videos: [], message: `${STOCK_ENV_KEYS[input.provider]}_absent`, networkRequests: 0 };
  const endpoint = input.url ?? (input.provider === "pexels" ? PEXELS_VIDEO_SEARCH_URL : PIXABAY_VIDEO_SEARCH_URL);
  const parse = input.parse ?? (input.provider === "pexels" ? parsePexelsVideos : parsePixabayVideos);
  const cache = input.cache ?? stockSearchCache(env);
  const cacheKey = cacheKeyForSearch({ provider: input.provider, endpoint, ...input.params });
  const cached = await cache.get(cacheKey);
  if (cached) { try { return { status: "cache_hit", videos: parse(JSON.parse(cached)), message: null, networkRequests: 0 }; } catch { /* Refetch an unreadable entry. */ } }
  if (!reserveProviderCall(input.provider, env)) return { status: "cap_reached", videos: [], message: "local_hourly_cap", networkRequests: 0 };
  const url = new URL(endpoint);
  for (const [key, value] of Object.entries(input.params)) url.searchParams.set(key, value);
  if (input.provider === "pixabay") url.searchParams.set("key", apiKey);
  const response = await providerGet(url.toString(), input.provider === "pexels" ? { Authorization: apiKey } : {}, input.fetchImpl ?? fetch);
  if (!response.ok) {
    if (response.status === 401 || response.status === 403) return { status: "auth_failed", videos: [], message: `http_${response.status}`, networkRequests: 1 };
    if (response.status === 429) return { status: "rate_limited", videos: [], message: "http_429", networkRequests: 1 };
    return { status: "error", videos: [], message: response.code === "http_error" ? `http_${response.status}` : response.code, networkRequests: 1 };
  }
  try {
    const videos = parse(JSON.parse(response.body));
    await cache.set(cacheKey, response.body, STOCK_SEARCH_LIMITS.cacheTtlMs);
    return { status: videos.length ? "ok" : "empty", videos, message: null, networkRequests: 1 };
  } catch { return { status: "error", videos: [], message: "malformed_response", networkRequests: 1 }; }
}
/**
 * Pexels: orientation=portrait and size=small (minimum HD) are documented filters.
 * Pixabay has no orientation filter for videos; min_width/min_height and video_type=film narrow results, the rest is checked locally.
 */
export function searchStockPage(input: { provider: StockProvider; query: string; page: number; env?: Env; fetchImpl?: ResolverFetchImpl; cache?: SourceSearchCache }): Promise<ProviderResponse> {
  const params: Record<string, string> = input.provider === "pexels"
    ? { query: input.query, orientation: "portrait", size: "small", per_page: String(STOCK_SEARCH_LIMITS.perPage.pexels), page: String(input.page) }
    : { q: input.query, video_type: "film", safesearch: "true", min_width: "720", min_height: "1280", per_page: String(STOCK_SEARCH_LIMITS.perPage.pixabay), page: String(input.page) };
  return providerRequest({ ...input, params });
}
/**
 * Used only to refresh an expired download URL; the caller must check provider/videoId/fileKey/size again.
 * Pexels lookups skip the disk cache to obtain a current link. Pixabay lookups keep the mandatory 24h cache.
 */
export async function lookupStockVideo(input: { provider: StockProvider; videoId: string; env?: Env; fetchImpl?: ResolverFetchImpl; cache?: SourceSearchCache }) {
  const result = input.provider === "pexels"
    ? await providerRequest({ ...input, url: `${PEXELS_VIDEO_LOOKUP_URL}${input.videoId}`, params: {}, cache: input.cache ?? createMemorySourceSearchCache(),
      parse: body => { if (!body || typeof body !== "object") throw new Error("malformed_pexels_response"); const video = pexelsVideo(body as PexelsVideo); return video ? [video] : []; } }).catch(() => null)
    : await providerRequest({ ...input, params: { id: input.videoId } }).catch(() => null);
  return result?.videos.find(video => video.provider === input.provider && video.videoId === input.videoId) ?? null;
}
