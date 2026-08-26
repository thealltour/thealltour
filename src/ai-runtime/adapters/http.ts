import { RuntimeError, type RuntimeErrorCode } from "@/ai-runtime/domain/error";
import type { ProviderRateLimitMetadata } from "@/ai-runtime/adapters/types";
import { safeErrorMessage } from "@/ai-runtime/adapters/redaction";

const RATE_LIMIT_HEADER_KEYS = [
  "retry-after",
  "x-ratelimit-limit-requests",
  "x-ratelimit-remaining-requests",
  "x-ratelimit-limit-tokens",
  "x-ratelimit-remaining-tokens",
  "x-ratelimit-reset-requests",
  "x-ratelimit-reset-tokens",
  "x-ratelimit-limit",
  "x-ratelimit-remaining",
  "x-ratelimit-reset",
] as const;

export function extractRateLimitMetadata(headers: Headers): ProviderRateLimitMetadata {
  const raw: Record<string, string> = {};
  for (const key of RATE_LIMIT_HEADER_KEYS) {
    const value = headers.get(key);
    if (value) raw[key] = value;
  }

  const retryAfter = headers.get("retry-after");
  let retryAfterMs: number | undefined;
  if (retryAfter) {
    const asSeconds = Number(retryAfter);
    if (Number.isFinite(asSeconds)) {
      retryAfterMs = Math.max(0, Math.round(asSeconds * 1000));
    } else {
      const asDate = Date.parse(retryAfter);
      if (Number.isFinite(asDate)) {
        retryAfterMs = Math.max(0, asDate - Date.now());
      }
    }
  }

  const num = (key: string) => {
    const value = headers.get(key);
    if (value == null) return undefined;
    const n = Number(value);
    return Number.isFinite(n) ? n : undefined;
  };

  return {
    limitRequests: num("x-ratelimit-limit-requests") ?? num("x-ratelimit-limit"),
    remainingRequests: num("x-ratelimit-remaining-requests") ?? num("x-ratelimit-remaining"),
    limitTokens: num("x-ratelimit-limit-tokens"),
    remainingTokens: num("x-ratelimit-remaining-tokens"),
    resetRequestsAt: headers.get("x-ratelimit-reset-requests") ?? undefined,
    resetTokensAt: headers.get("x-ratelimit-reset-tokens") ?? undefined,
    retryAfterMs,
    raw: Object.keys(raw).length > 0 ? raw : undefined,
  };
}

function bodyHintsQuota(bodyText: string): boolean {
  return /quota|insufficient.?credits|credit.?limit|billing|key limit exceeded|tpd|rpd exceeded/i.test(
    bodyText,
  );
}

function bodyHintsContext(bodyText: string): boolean {
  return /context.?length|maximum.?context|too many tokens|token.?limit|prompt.?too.?long/i.test(
    bodyText,
  );
}

export function mapHttpStatusToRuntimeError(input: {
  status: number;
  bodyText: string;
  rateLimit?: ProviderRateLimitMetadata;
  secrets?: string[];
}): RuntimeError {
  const secrets = input.secrets ?? [];
  const message = safeErrorMessage(`HTTP ${input.status}: ${input.bodyText || "empty body"}`, secrets);
  const retryAfterMs = input.rateLimit?.retryAfterMs;

  if (input.status === 429) {
    if (bodyHintsQuota(input.bodyText)) {
      return new RuntimeError("QUOTA_EXHAUSTED", message, true, retryAfterMs);
    }
    return new RuntimeError("RATE_LIMIT", message, true, retryAfterMs);
  }

  if (input.status === 401 || input.status === 403) {
    if (bodyHintsQuota(input.bodyText)) {
      return new RuntimeError("QUOTA_EXHAUSTED", message, false, retryAfterMs);
    }
    return new RuntimeError("AUTH_ERROR", message, false);
  }

  if (input.status === 404) {
    return new RuntimeError("MODEL_UNAVAILABLE", message, false);
  }

  if (input.status === 400 || input.status === 422) {
    if (bodyHintsContext(input.bodyText)) {
      return new RuntimeError("CONTEXT_TOO_LARGE", message, false);
    }
    return new RuntimeError("INVALID_REQUEST", message, false);
  }

  if (input.status >= 500) {
    return new RuntimeError("PROVIDER_ERROR", message, true, retryAfterMs);
  }

  const code: RuntimeErrorCode = "PROVIDER_ERROR";
  return new RuntimeError(code, message, input.status >= 500, retryAfterMs);
}

export function isAbortError(error: unknown): boolean {
  if (!error || typeof error !== "object") return false;
  const name = (error as { name?: string }).name;
  return name === "AbortError" || name === "TimeoutError";
}
