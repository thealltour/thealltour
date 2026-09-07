export type TravelpayoutsErrorCode =
  | "config_missing"
  | "invalid_source_url"
  | "source_host_not_allowed"
  | "network_failed"
  | "timeout"
  | "rate_limited"
  | "provider_rejected"
  | "invalid_response"
  | "invalid_affiliate_url";

export class TravelpayoutsError extends Error {
  readonly code: TravelpayoutsErrorCode;
  readonly retryAfterSeconds: number | null;

  constructor(
    code: TravelpayoutsErrorCode,
    message: string,
    options?: { retryAfterSeconds?: number | null; cause?: unknown },
  ) {
    super(message, options?.cause !== undefined ? { cause: options.cause } : undefined);
    this.name = "TravelpayoutsError";
    this.code = code;
    this.retryAfterSeconds = options?.retryAfterSeconds ?? null;
  }
}

/** Safe operational log fields — never include secrets or full URLs. */
export function travelpayoutsSafeLogMeta(params: {
  providerId?: string;
  hostname?: string | null;
  errorCode?: TravelpayoutsErrorCode | string;
}): Record<string, string> {
  const out: Record<string, string> = {};
  if (params.providerId) out.providerId = params.providerId;
  if (params.hostname) out.hostname = params.hostname;
  if (params.errorCode) out.errorCode = params.errorCode;
  return out;
}
