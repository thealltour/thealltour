import "server-only";

import { getTossSharelinkAccessToken } from "@/lib/affiliate/planner/providers/tossShopping/tossShoppingAuth";
import {
  getDefaultTossShoppingCache,
  tossSharelinkCacheKey,
  type TossShoppingCacheStore,
} from "@/lib/affiliate/planner/providers/tossShopping/tossShoppingCache";
import type {
  TossCategoryBestProduct,
  TossProductDetail,
  TossSharelinkResult,
} from "@/lib/affiliate/planner/providers/tossShopping/tossShoppingTypes";
import {
  TOSS_CATEGORY_BEST_SIZE,
  TOSS_CATEGORY_BEST_TTL_MS,
  TOSS_SHARELINK_ALLOWED_HOSTS,
  TOSS_SHARELINK_BASE_URL,
  TOSS_SHARELINK_TTL_MS,
  TOSS_SHOPPING_TIMEOUT_MS,
} from "@/lib/affiliate/planner/providers/tossShopping/tossShoppingTypes";
import {
  safeHostnameFromUrl,
  validateGeneratedAffiliateUrl,
} from "@/lib/affiliate/travelpayouts/urlPolicy";
import type { EnvBag } from "@/lib/envBag";

export type TossShoppingClientDeps = {
  fetchImpl?: typeof fetch;
  getAccessToken?: () => Promise<string | null>;
  cache?: TossShoppingCacheStore;
  timeoutMs?: number;
  env?: EnvBag;
  /** When false, skip one Retry-After retry on 429 (default: allow a single retry). */
  retryOn429?: boolean;
};

type ApiResult<T> =
  | { ok: true; data: T }
  | { ok: false; errorCode: string };

function publisherIdFromEnv(env: EnvBag): string | null {
  const id = env.TOSS_SHARELINK_PUBLISHER_ID?.trim() ?? "";
  return id || null;
}

async function tossFetch(params: {
  path: string;
  method: "GET" | "POST";
  body?: unknown;
  deps: TossShoppingClientDeps;
  retried?: boolean;
}): Promise<ApiResult<unknown>> {
  const getToken = params.deps.getAccessToken ?? getTossSharelinkAccessToken;
  const token = await getToken();
  if (!token) return { ok: false, errorCode: "auth_failed" };

  const timeoutMs = params.deps.timeoutMs ?? TOSS_SHOPPING_TIMEOUT_MS;
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const fetchImpl = params.deps.fetchImpl ?? fetch;
    const res = await fetchImpl(`${TOSS_SHARELINK_BASE_URL}${params.path}`, {
      method: params.method,
      headers: {
        Authorization: `Bearer ${token}`,
        Accept: "application/json",
        ...(params.body != null ? { "Content-Type": "application/json" } : {}),
      },
      body: params.body != null ? JSON.stringify(params.body) : undefined,
      signal: controller.signal,
      cache: "no-store",
    });

    if (res.status === 429 && params.deps.retryOn429 !== false && !params.retried) {
      const retryAfterRaw = res.headers.get("retry-after");
      const retryAfterSec = retryAfterRaw && /^\d+$/.test(retryAfterRaw) ? Number(retryAfterRaw) : 0;
      // Cap wait inside a Planner request — never stall for long Retry-After values.
      const waitMs = Math.min(Math.max(retryAfterSec, 0) * 1000, 500);
      if (waitMs > 0) await new Promise((r) => setTimeout(r, waitMs));
      return tossFetch({ ...params, retried: true });
    }

    if (!res.ok) {
      return { ok: false, errorCode: `http_${res.status}` };
    }

    const json = (await res.json()) as {
      resultType?: unknown;
      success?: unknown;
      error?: { errorCode?: unknown };
    };
    if (json.resultType === "FAIL") {
      const code =
        json.error && typeof json.error === "object" && typeof json.error.errorCode === "string"
          ? json.error.errorCode
          : "api_fail";
      return { ok: false, errorCode: code };
    }
    return { ok: true, data: json.success ?? json };
  } catch (error) {
    const code =
      error instanceof Error && error.name === "AbortError" ? "timeout" : "network_failed";
    return { ok: false, errorCode: code };
  } finally {
    clearTimeout(timer);
  }
}

function asNumber(value: unknown): number | null {
  if (typeof value === "number" && Number.isFinite(value)) return value;
  if (typeof value === "string" && /^-?\d+(\.\d+)?$/.test(value)) return Number(value);
  return null;
}

function asString(value: unknown): string | null {
  return typeof value === "string" && value.trim() ? value.trim() : null;
}

function parseCategoryBestItem(raw: unknown): TossCategoryBestProduct | null {
  if (!raw || typeof raw !== "object") return null;
  const row = raw as Record<string, unknown>;
  const tacaItemId = asNumber(row.tacaItemId);
  const displayName = asString(row.displayName);
  if (tacaItemId == null || !displayName) return null;
  const rank = asNumber(row.rank) ?? Number.MAX_SAFE_INTEGER;
  return {
    tacaItemId,
    displayName,
    rank,
    displayPrice: asNumber(row.displayPrice),
    originalPrice: asNumber(row.originalPrice),
    discountRate: asNumber(row.discountRate),
    isSoldOut: row.isSoldOut === true,
    thumbnailUrl: asString(row.thumbnailUrl),
    reviewScore: asNumber(row.reviewScore),
    reviewCount: asNumber(row.reviewCount),
    categoryIds: Array.isArray(row.categoryIds)
      ? row.categoryIds.map(asNumber).filter((n): n is number => n != null)
      : [],
    productUrl: asString(row.productUrl),
  };
}

function parseDetailItem(raw: unknown): TossProductDetail | null {
  if (!raw || typeof raw !== "object") return null;
  const row = raw as Record<string, unknown>;
  const tacaItemId = asNumber(row.tacaItemId);
  const displayName = asString(row.displayName);
  if (tacaItemId == null || !displayName) return null;
  return {
    tacaItemId,
    displayName,
    isSoldOut: row.isSoldOut === true,
    thumbnailUrl: asString(row.thumbnailUrl),
    reviewScore: asNumber(row.reviewScore),
    reviewCount: asNumber(row.reviewCount),
    displayPrice: asNumber(row.displayPrice),
    originalPrice: asNumber(row.originalPrice),
    discountRate: asNumber(row.discountRate),
  };
}

export async function fetchTossCategoryBest(
  categoryId: number,
  deps: TossShoppingClientDeps = {},
): Promise<TossCategoryBestProduct[] | null> {
  const cache = deps.cache ?? getDefaultTossShoppingCache();
  const cached = await cache.readCategoryBest(categoryId);
  if (cached) return cached;

  const result = await tossFetch({
    path: `/products/best-categories/${categoryId}?size=${TOSS_CATEGORY_BEST_SIZE}`,
    method: "GET",
    deps,
  });
  if (!result.ok) {
    console.info("[toss_shopping] category_best_failed", {
      providerId: "toss_shopping",
      errorCode: result.errorCode,
      categoryId,
    });
    return null;
  }

  const success = result.data as { items?: unknown };
  const items = Array.isArray(success.items) ? success.items : [];
  const products = items
    .map(parseCategoryBestItem)
    .filter((p): p is TossCategoryBestProduct => p != null);
  await cache.writeCategoryBest(categoryId, products, TOSS_CATEGORY_BEST_TTL_MS);
  return products;
}

export async function fetchTossProductDetails(
  tacaItemIds: number[],
  deps: TossShoppingClientDeps = {},
): Promise<TossProductDetail[] | null> {
  const ids = [...new Set(tacaItemIds.filter((id) => Number.isFinite(id) && id > 0))].slice(0, 30);
  if (ids.length === 0) return [];

  const result = await tossFetch({
    path: `/products/detail?tacaItemIds=${ids.join(",")}`,
    method: "GET",
    deps,
  });
  if (!result.ok) {
    console.info("[toss_shopping] detail_failed", {
      providerId: "toss_shopping",
      errorCode: result.errorCode,
    });
    return null;
  }

  const success = result.data as { items?: unknown };
  const items = Array.isArray(success.items) ? success.items : [];
  return items.map(parseDetailItem).filter((p): p is TossProductDetail => p != null);
}

/**
 * Issue or reuse a PRODUCT Sharelink. Prefer shortUrl when host-allowlisted.
 * Never returns productUrl (non-affiliate). Caches by tacaItemId+publisherId.
 */
export async function createOrReuseTossSharelink(
  tacaItemId: number,
  deps: TossShoppingClientDeps = {},
): Promise<TossSharelinkResult | null> {
  const env = deps.env ?? process.env;
  const publisherId = publisherIdFromEnv(env);
  if (!publisherId) {
    console.info("[toss_shopping] sharelink_skipped", {
      providerId: "toss_shopping",
      errorCode: "missing_publisher_id",
    });
    return null;
  }

  const cache = deps.cache ?? getDefaultTossShoppingCache();
  const cacheKey = tossSharelinkCacheKey(tacaItemId, publisherId);
  const cachedUrl = await cache.readSharelink(cacheKey);
  if (cachedUrl) {
    const validated = validateTossSharelinkUrl(cachedUrl);
    if (validated) {
      return { shortUrl: cachedUrl, originUrl: null, targetUrl: validated };
    }
  }

  const result = await tossFetch({
    path: "/links",
    method: "POST",
    body: {
      landingType: "PRODUCT",
      tacaItemId,
      publisherId,
    },
    deps,
  });
  if (!result.ok) {
    console.info("[toss_shopping] sharelink_failed", {
      providerId: "toss_shopping",
      errorCode: result.errorCode,
    });
    return null;
  }

  const success = result.data as { shortUrl?: unknown; originUrl?: unknown };
  const shortUrl = asString(success.shortUrl);
  const originUrl = asString(success.originUrl);
  const targetUrl =
    (shortUrl && validateTossSharelinkUrl(shortUrl)) ||
    (originUrl && validateTossSharelinkUrl(originUrl)) ||
    null;
  if (!targetUrl) {
    console.info("[toss_shopping] sharelink_invalid_host", {
      providerId: "toss_shopping",
      errorCode: "host_not_allowed",
      shortHost: shortUrl ? safeHostnameFromUrl(shortUrl) : null,
      originHost: originUrl ? safeHostnameFromUrl(originUrl) : null,
    });
    return null;
  }

  await cache.writeSharelink(cacheKey, targetUrl, TOSS_SHARELINK_TTL_MS);
  return { shortUrl, originUrl, targetUrl };
}

export function validateTossSharelinkUrl(raw: string): string | null {
  const validated = validateGeneratedAffiliateUrl(raw, {
    allowedHosts: [...TOSS_SHARELINK_ALLOWED_HOSTS],
    httpsOnly: true,
  });
  return validated.ok ? validated.url.toString() : null;
}

export async function fetchTossHealth(deps: TossShoppingClientDeps = {}): Promise<boolean> {
  const result = await tossFetch({ path: "/health", method: "GET", deps });
  return result.ok;
}
