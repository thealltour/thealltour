export interface QuotaCapacity {
  rpm?: number;
  tpm?: number;
  rpd?: number;
  tpd?: number;
  inputTpm?: number;
  outputTpm?: number;
}

export interface QuotaUsageSnapshot {
  providerId: string;
  modelId?: string;
  windowStartedAt: string;
  requestCount: number;
  inputTokens: number;
  outputTokens: number;
  totalTokens: number;
}

export const QUOTA_HEALTH_STATES = ["green", "yellow", "red", "blocked", "unknown"] as const;

export type QuotaHealth = (typeof QUOTA_HEALTH_STATES)[number];

export interface QuotaReservationRequest {
  requestId: string;
  providerId: string;
  modelId: string;
  estimatedInputTokens: number;
  estimatedOutputTokens: number;
}

export const QUOTA_REJECTION_REASONS = [
  "rpm",
  "tpm",
  "rpd",
  "tpd",
  "provider_blocked",
  "unknown",
] as const;

export type QuotaRejectionReason = (typeof QUOTA_REJECTION_REASONS)[number];

export type QuotaReservationResult =
  | {
      accepted: true;
      reservationId: string;
      expiresAt: string;
    }
  | {
      accepted: false;
      reason: QuotaRejectionReason;
      retryAfterMs?: number;
    };
