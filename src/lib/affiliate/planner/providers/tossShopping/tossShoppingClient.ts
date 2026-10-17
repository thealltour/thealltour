import "server-only";

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
  TOSS_SHARELINK_TTL_MS,
  TOSS_SHOPPING_PROXY_BASE_URL,
  TOSS_SHOPPING_TIMEOUT_MS,
} from "@/lib/affiliate/planner/providers/tossShopping/tossShoppingTypes";
import {
  safeHostnameFromUrl,
  validateGeneratedAffiliateUrl,
} from "@/lib/affiliate/travelpayouts/urlPolicy";
import type { EnvBag } from "@/lib/envBag";

export type TossShoppingClientDeps = {
  fetchImpl?: typeof fetch;
  cache?: TossShoppingCacheStore;
  timeoutMs?: number;
  env?: EnvBag;
  /** Test / override: proxy shared secret (default: THEALLTOUR_PROXY_SECRET). */
  proxySecret?: string;
  /** Test / override: proxy origin (default: TOSS_SHOPPING_PROXY_BASE_URL). */
  proxyBaseUrl?: string;
  /** When false, skip one Retry-After retry on 429 (default: allow a single retry). */
  retryOn429?: boolean;
};

type ApiResult<T> =
  | { ok: true; data: T }
  | { ok: false; errorCode: string };

function proxySecretFromEnv(env: EnvBag): string | null {
  const secret = env.THEALLTOUR_PROXY_SECRET?.trim() ?? "";
  return secret || null;
}

function resolveProxyBaseUrl(deps: TossShoppingClientDeps): string {
  const raw = deps.proxyBaseUrl?.trim() || TOSS_SHOPPING_PROXY_BASE_URL;
  return raw.replace(/\/+$/, "");
}

async function tossProxyFetch(params: {
  path: string;
  method: "GET" | "POST";
  body?: unknown;
  deps: TossShoppingClientDeps;
  retried?: boolean;
  /** /health is unauthenticated on the proxy. */
  requireAuth?: boolean;
}): Promise<ApiResult<unknown>> {
  const requireAuth = params.requireAuth !== false;
  let secret: string | null = null;
  if (requireAuth) {
    secret =
      params.deps.proxySecret?.trim() ||
      proxySecretFromEnv(params.deps.env ?? process.env);
    if (!secret) return { ok: false, errorCode: "proxy_auth_missing" };
  }

  const timeoutMs = params.deps.timeoutMs ?? TOSS_SHOPPING_TIMEOUT_MS;
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const fetchImpl = params.deps.fetchImpl ?? fetch;
    const base = resolveProxyBaseUrl(params.deps);
    const res = await fetchImpl(`${base}${params.path}`, {
      method: params.method,
      headers: {
        Accept: "application/json",
        ...(secret ? { Authorization: `Bearer ${secret}` } : {}),
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
      return tossProxyFetch({ ...params, retried: true });
    }

    if (!res.ok) {
      return { ok: false, errorCode: `http_${res.status}` };
    }

    const json = (await res.json()) as unknown;
    return { ok: true, data: json };
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

  const result = await tossProxyFetch({
    path: `/v1/category-best/${categoryId}?size=${TOSS_CATEGORY_BEST_SIZE}`,
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

  const result = await tossProxyFetch({
    path: "/v1/products/detail",
    method: "POST",
    body: { tacaItemIds: ids.map(String) },
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
 * Issue or reuse a PRODUCT Sharelink via the fixed-IP proxy.
 * Prefer proxy targetUrl when host-allowlisted. Never returns productUrl (non-affiliate).
 * Caches by tacaItemId (publisher lives on VPS only).
 */
export async function createOrReuseTossSharelink(
  tacaItemId: number,
  deps: TossShoppingClientDeps = {},
): Promise<TossSharelinkResult | null> {
  const cache = deps.cache ?? getDefaultTossShoppingCache();
  const cacheKey = tossSharelinkCacheKey(tacaItemId);
  const cachedUrl = await cache.readSharelink(cacheKey);
  if (cachedUrl) {
    const validated = validateTossSharelinkUrl(cachedUrl);
    if (validated) {
      return { shortUrl: cachedUrl, originUrl: null, targetUrl: validated };
    }
  }

  const result = await tossProxyFetch({
    path: "/v1/sharelinks",
    method: "POST",
    body: { tacaItemId },
    deps,
  });
  if (!result.ok) {
    console.info("[toss_shopping] sharelink_failed", {
      providerId: "toss_shopping",
      errorCode: result.errorCode,
    });
    return null;
  }

  const success = result.data as {
    shortUrl?: unknown;
    originUrl?: unknown;
    targetUrl?: unknown;
  };
  const shortUrl = asString(success.shortUrl);
  const originUrl = asString(success.originUrl);
  const proxyTarget = asString(success.targetUrl);
  const targetUrl =
    (proxyTarget && validateTossSharelinkUrl(proxyTarget)) ||
    (shortUrl && validateTossSharelinkUrl(shortUrl)) ||
    (originUrl && validateTossSharelinkUrl(originUrl)) ||
    null;
  if (!targetUrl) {
    console.info("[toss_shopping] sharelink_invalid_host", {
      providerId: "toss_shopping",
      errorCode: "host_not_allowed",
      shortHost: shortUrl ? safeHostnameFromUrl(shortUrl) : null,
      originHost: originUrl ? safeHostnameFromUrl(originUrl) : null,
      targetHost: proxyTarget ? safeHostnameFromUrl(proxyTarget) : null,
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

/** Diagnostic only — not a hard dependency of offer build. */
export async function fetchTossHealth(deps: TossShoppingClientDeps = {}): Promise<boolean> {
  const result = await tossProxyFetch({
    path: "/health",
    method: "GET",
    deps,
    requireAuth: false,
  });
  if (!result.ok) return false;
  const body = result.data as { status?: unknown };
  return body?.status === "ok";
}
