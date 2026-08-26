export const RUNTIME_ERROR_CODES = [
  "RATE_LIMIT",
  "QUOTA_EXHAUSTED",
  "AUTH_ERROR",
  "MODEL_UNAVAILABLE",
  "TIMEOUT",
  "CONTEXT_TOO_LARGE",
  "INVALID_REQUEST",
  "PROVIDER_ERROR",
  "RUNTIME_ERROR",
] as const;

export type RuntimeErrorCode = (typeof RUNTIME_ERROR_CODES)[number];

/**
 * Normalized runtime failure. Provider-specific errors map into these codes later.
 * Target is ES2017 — `cause` is an explicit public field (not ErrorOptions).
 */
export class RuntimeError extends Error {
  readonly code: RuntimeErrorCode;
  readonly retryable: boolean;
  readonly retryAfterMs?: number;
  readonly cause?: unknown;

  constructor(
    code: RuntimeErrorCode,
    message: string,
    retryable: boolean,
    retryAfterMs?: number,
    cause?: unknown,
  ) {
    super(message);
    this.name = "RuntimeError";
    this.code = code;
    this.retryable = retryable;
    this.retryAfterMs = retryAfterMs;
    this.cause = cause;
  }
}
