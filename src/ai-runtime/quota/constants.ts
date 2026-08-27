/** Max events retained in the in-memory ledger (newest kept). */
export const USAGE_LEDGER_MAX_EVENTS = 10_000;

/** Drop events older than this window on each record. */
export const USAGE_LEDGER_RETENTION_MS = 48 * 60 * 60 * 1000;

/** Rolling minute window length. */
export const MINUTE_WINDOW_MS = 60_000;

/** Project timezone for calendar-day aggregation. Internal timestamps stay UTC ISO. */
export const RUNTIME_QUOTA_TIMEZONE = "Asia/Seoul" as const;

/** Usage ratio thresholds when configured or observed capacity is known. */
export const QUOTA_YELLOW_THRESHOLD = 0.65;
export const QUOTA_RED_THRESHOLD = 0.85;

/**
 * When a rate-limit/quota error has no retry-after, do not mark blocked permanently.
 * Instead surface red health only (blocked state requires an explicit expiry).
 */
export const BLOCKED_REQUIRES_RETRY_AFTER = true;

/** Active reservation TTL before lazy expiration. */
export const DEFAULT_RESERVATION_TTL_MS = 90_000;

/** Terminal reservations retained for debugging (reconciled/released/expired). */
export const TERMINAL_RESERVATION_RETENTION_MS = 24 * 60 * 60 * 1000;

export const TERMINAL_RESERVATION_MAX_COUNT = 5_000;

/**
 * Observed provider rate-limit metadata older than this is not used for hard enforcement.
 */
export const OBSERVED_QUOTA_MAX_AGE_MS = 5 * 60 * 1000;

/**
 * Unknown configured quota capacity policy:
 * - unknown != unlimited
 * - unknown != blocked
 * - allow reservation unless active provider block (blockedUntil / retry-after)
 */
export const UNKNOWN_QUOTA_ALLOWS_RESERVATION = true;
