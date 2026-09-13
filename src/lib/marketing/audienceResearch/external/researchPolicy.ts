/**
 * MQ-2 — coherent RA-1 external research timeout / budget / cost policy.
 * Single source of truth for orchestrator + OpenRouter provider defaults.
 */

/** Per OpenRouter free-pool search query (orchestrator + provider aligned). */
export const EXTERNAL_SEARCH_PER_QUERY_TIMEOUT_MS = 30_000;

/** Wall-clock budget for the entire external search+fetch phase. */
export const EXTERNAL_RESEARCH_OVERALL_BUDGET_MS = 75_000;

/** Safe document fetch remains tighter than search (unchanged security posture). */
export const EXTERNAL_SAFE_FETCH_TIMEOUT_MS = 12_000;

/** Bounded query concurrency (not all 6 at once). */
export const EXTERNAL_SEARCH_CONCURRENCY = 2;

/** Max planned queries (identity-aware planner; unchanged). */
export const EXTERNAL_SEARCH_MAX_QUERIES = 6;

/** One retry only for clearly transient failures. */
export const EXTERNAL_SEARCH_MAX_RETRY_PER_QUERY = 1;

/**
 * Paid search request cap per agenda run (includes retries).
 * 6 planned + limited retries without unbounded spend.
 */
export const EXTERNAL_SEARCH_MAX_PAID_REQUESTS = 8;

/** Previous orchestrator override that aborted free-pool searches (~12s). */
export const LEGACY_ORCHESTRATOR_SEARCH_TIMEOUT_MS = 12_000;

/** Previous OpenRouter provider default (never reached when orchestrator passed 12s). */
export const LEGACY_OPENROUTER_PROVIDER_TIMEOUT_MS = 90_000;

export const EXTERNAL_SEARCH_STATUSES = [
  "not_attempted",
  "attempted_no_results",
  "partial",
  "sufficient",
  "failed",
] as const;
export type ExternalSearchStatus = (typeof EXTERNAL_SEARCH_STATUSES)[number];

export const SEARCH_FAILURE_CATEGORIES = [
  "timeout",
  "rate_limited",
  "auth",
  "upstream_5xx",
  "network",
  "invalid_response",
  "empty_result",
  "unknown",
] as const;
export type SearchFailureCategory = (typeof SEARCH_FAILURE_CATEGORIES)[number];

export function isTransientSearchFailure(category: SearchFailureCategory): boolean {
  return (
    category === "timeout" ||
    category === "rate_limited" ||
    category === "upstream_5xx" ||
    category === "network"
  );
}

/**
 * Classify search errors into sanitized categories (no secrets / bodies).
 */
export function classifySearchFailure(error: unknown): {
  category: SearchFailureCategory;
  message: string;
} {
  const raw =
    error instanceof Error
      ? error.message
      : typeof error === "string"
        ? error
        : "unknown_error";
  const msg = raw.replace(/keys\/[a-f0-9]{16,}/gi, "keys/<redacted>").slice(0, 120);
  const name = error instanceof Error ? error.name : "";

  if (
    name === "AbortError" ||
    /aborted|abort|timeout|TimeoutError|This operation was aborted/i.test(msg)
  ) {
    return { category: "timeout", message: "search_timeout" };
  }
  if (/rate_limited|429/i.test(msg)) {
    return { category: "rate_limited", message: "rate_limited" };
  }
  if (/401|403|forbidden|unauthorized|api_key|auth/i.test(msg)) {
    return { category: "auth", message: msg.slice(0, 80) };
  }
  if (/http_502|http_503|http_504|502|503|504/i.test(msg)) {
    return { category: "upstream_5xx", message: msg.slice(0, 80) };
  }
  if (/http_400|invalid|schema|parse/i.test(msg)) {
    return { category: "invalid_response", message: msg.slice(0, 80) };
  }
  if (/ECONNRESET|ENOTFOUND|EAI_AGAIN|network|fetch failed|socket/i.test(msg)) {
    return { category: "network", message: msg.slice(0, 80) };
  }
  return { category: "unknown", message: msg.slice(0, 80) };
}

export function resolveExternalSearchStatus(input: {
  attemptedQueryCount: number;
  successfulQueryCount: number;
  failedQueryCount: number;
  usableResultCount: number;
  officialSourceCount: number;
  purposesCovered: Set<string> | string[];
}): ExternalSearchStatus {
  if (input.attemptedQueryCount <= 0) return "not_attempted";
  if (input.usableResultCount <= 0) {
    return input.successfulQueryCount > 0 ? "attempted_no_results" : "failed";
  }
  const purposes = input.purposesCovered instanceof Set
    ? input.purposesCovered
    : new Set(input.purposesCovered);
  const sufficient =
    input.officialSourceCount >= 1 &&
    purposes.has("audience_questions") &&
    purposes.has("competitor_content_gap");
  return sufficient ? "sufficient" : "partial";
}
