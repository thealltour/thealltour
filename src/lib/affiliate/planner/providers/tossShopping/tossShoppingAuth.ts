import "server-only";

import {
  TOSS_AUTH_REFRESH_SKEW_MS,
  TOSS_OAUTH_SCOPE,
  TOSS_OAUTH_TOKEN_URL,
  TOSS_SHOPPING_TIMEOUT_MS,
} from "@/lib/affiliate/planner/providers/tossShopping/tossShoppingTypes";
import type { EnvBag } from "@/lib/envBag";

type AuthCache = {
  accessToken: string;
  expiresAt: number;
};

type AuthDeps = {
  fetchImpl?: typeof fetch;
  now?: () => number;
  env?: EnvBag;
};

let cachedAuth: AuthCache | null = null;
let inflight: Promise<string> | null = null;

/** Test-only: clear module auth cache + single-flight. */
export function __resetTossShoppingAuthForTests(): void {
  cachedAuth = null;
  inflight = null;
}

/** Test-only: inspect cache without exposing token in production logs. */
export function __peekTossShoppingAuthForTests(): AuthCache | null {
  return cachedAuth ? { ...cachedAuth } : null;
}

function readCredentials(env: EnvBag): {
  accessKey: string;
  secretKey: string;
} | null {
  const accessKey = env.TOSS_SHARELINK_ACCESS_KEY?.trim() ?? "";
  const secretKey = env.TOSS_SHARELINK_SECRET_KEY?.trim() ?? "";
  if (!accessKey || !secretKey) return null;
  return { accessKey, secretKey };
}

function isUsable(cache: AuthCache | null, nowMs: number): cache is AuthCache {
  if (!cache?.accessToken) return false;
  return cache.expiresAt - TOSS_AUTH_REFRESH_SKEW_MS > nowMs;
}

/**
 * Returns a Bearer access token. Reuses memory cache until ~90s before expiry.
 * Concurrent callers share a single refresh (single-flight). Never logs secrets/tokens.
 * Failed refresh does not fall back to an expired cached token.
 */
export async function getTossSharelinkAccessToken(deps: AuthDeps = {}): Promise<string | null> {
  const now = deps.now ?? Date.now;
  const env = deps.env ?? process.env;
  const nowMs = now();

  if (isUsable(cachedAuth, nowMs)) {
    return cachedAuth.accessToken;
  }

  if (inflight) return inflight;

  inflight = (async () => {
    const creds = readCredentials(env);
    if (!creds) {
      console.info("[toss_shopping] auth_skipped", {
        providerId: "toss_shopping",
        errorCode: "missing_credentials",
      });
      throw new Error("missing_credentials");
    }

    const token = await fetchAccessToken({
      accessKey: creds.accessKey,
      secretKey: creds.secretKey,
      fetchImpl: deps.fetchImpl,
      timeoutMs: TOSS_SHOPPING_TIMEOUT_MS,
      now,
    });
    cachedAuth = token;
    return token.accessToken;
  })()
    .catch((error) => {
      cachedAuth = null;
      const code =
        error instanceof Error && error.message === "missing_credentials"
          ? "missing_credentials"
          : "auth_failed";
      console.info("[toss_shopping] auth_failed", {
        providerId: "toss_shopping",
        errorCode: code,
      });
      throw error;
    })
    .finally(() => {
      inflight = null;
    });

  try {
    return await inflight;
  } catch {
    return null;
  }
}

async function fetchAccessToken(params: {
  accessKey: string;
  secretKey: string;
  fetchImpl?: typeof fetch;
  timeoutMs: number;
  now: () => number;
}): Promise<AuthCache> {
  const body = new URLSearchParams({
    grant_type: "client_credentials",
    client_id: params.accessKey,
    client_secret: params.secretKey,
    scope: TOSS_OAUTH_SCOPE,
  });

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), params.timeoutMs);
  try {
    const fetchImpl = params.fetchImpl ?? fetch;
    const res = await fetchImpl(TOSS_OAUTH_TOKEN_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/x-www-form-urlencoded",
        Accept: "application/json",
      },
      body,
      signal: controller.signal,
      cache: "no-store",
    });
    if (!res.ok) {
      throw new Error(`http_${res.status}`);
    }
    const json = (await res.json()) as {
      access_token?: unknown;
      expires_in?: unknown;
    };
    const accessToken =
      typeof json.access_token === "string" ? json.access_token.trim() : "";
    const expiresIn =
      typeof json.expires_in === "number" && Number.isFinite(json.expires_in)
        ? json.expires_in
        : typeof json.expires_in === "string" && /^\d+$/.test(json.expires_in)
          ? Number(json.expires_in)
          : NaN;
    if (!accessToken || !Number.isFinite(expiresIn) || expiresIn <= 0) {
      throw new Error("invalid_token_response");
    }
    return {
      accessToken,
      expiresAt: params.now() + expiresIn * 1000,
    };
  } finally {
    clearTimeout(timer);
  }
}
