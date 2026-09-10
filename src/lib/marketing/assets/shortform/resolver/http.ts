import { SHORTFORM_RESOLVER_HTTP_TIMEOUT_MS } from "@/lib/marketing/assets/shortform/resolver/constants";

export type ResolverHttpResult =
  | { ok: true; status: number; body: string; headers: Headers }
  | {
      ok: false;
      status: number | null;
      code: "timeout" | "http_error" | "network" | "aborted";
      message: string;
      headers: Headers | null;
    };

export type ResolverFetchImpl = (
  input: string,
  init?: RequestInit,
) => Promise<Response>;

/**
 * Bounded GET for provider search. At most one 429 backoff (Retry-After / X-RateLimit-Reset).
 * No aggressive retry loops. Does not download media binaries.
 */
export async function resolverHttpGet(input: {
  url: string;
  headers?: Record<string, string>;
  timeoutMs?: number;
  fetchImpl?: ResolverFetchImpl;
}): Promise<ResolverHttpResult> {
  const fetchImpl = input.fetchImpl ?? fetch;
  const timeoutMs = input.timeoutMs ?? SHORTFORM_RESOLVER_HTTP_TIMEOUT_MS;

  const attempt = async (): Promise<ResolverHttpResult> => {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeoutMs);
    try {
      const response = await fetchImpl(input.url, {
        method: "GET",
        headers: {
          Accept: "application/json",
          ...(input.headers ?? {}),
        },
        signal: controller.signal,
        cache: "no-store",
      });
      const body = await response.text();
      if (!response.ok) {
        return {
          ok: false,
          status: response.status,
          code: "http_error",
          message: `HTTP ${response.status}`,
          headers: response.headers,
        };
      }
      return { ok: true, status: response.status, body, headers: response.headers };
    } catch (error) {
      const name = error instanceof Error ? error.name : "";
      const message = error instanceof Error ? error.message : "network_error";
      if (name === "AbortError") {
        return { ok: false, status: null, code: "timeout", message: "request_timeout", headers: null };
      }
      return { ok: false, status: null, code: "network", message, headers: null };
    } finally {
      clearTimeout(timer);
    }
  };

  const first = await attempt();
  if (first.ok) return first;
  if (first.status === 429) {
    const retryAfterRaw =
      first.headers?.get("retry-after") ?? first.headers?.get("x-ratelimit-reset") ?? "1";
    const retryAfterSec = Math.min(5, Math.max(1, Number(retryAfterRaw) || 1));
    await new Promise((resolve) => setTimeout(resolve, retryAfterSec * 1000));
    return attempt();
  }
  return first;
}
