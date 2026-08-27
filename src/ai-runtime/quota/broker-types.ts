import type { QuotaRejectionReason, QuotaReservationRequest, QuotaReservationResult } from "@/ai-runtime/domain/quota";

export type QuotaReservationStatus = "active" | "reconciled" | "released" | "expired";

export type QuotaReservationReleaseReason =
  | "cancelled"
  | "failed_before_provider_call"
  | "provider_error"
  | "other";

export interface QuotaReservation {
  id: string;
  requestId: string;
  correlationId?: string;
  providerId: string;
  modelId: string;
  reservedRequests: number;
  reservedInputTokens: number;
  reservedOutputTokens: number;
  reservedTotalTokens: number;
  createdAt: string;
  expiresAt: string;
  status: QuotaReservationStatus;
  reconciledAt?: string;
  releasedAt?: string;
  releaseReason?: QuotaReservationReleaseReason;
  reconciledInputTokens?: number;
  reconciledOutputTokens?: number;
  reconciledTotalTokens?: number;
  tokenOverage?: number;
}

export interface QuotaReservationActualUsage {
  inputTokens?: number;
  outputTokens?: number;
  totalTokens?: number;
  usageMissing?: boolean;
}

export interface QuotaReservationOptions {
  correlationId?: string;
  ttlMs?: number;
  now?: Date;
}

export interface QuotaReservationFilter {
  providerId?: string;
  modelId?: string;
  correlationId?: string;
  status?: QuotaReservationStatus;
}

export interface QuotaReservationSnapshot {
  activeReservations: number;
  reservedRequests: number;
  reservedInputTokens: number;
  reservedOutputTokens: number;
  reservedTotalTokens: number;
}

export interface QuotaBroker {
  reserve(
    request: QuotaReservationRequest,
    options?: QuotaReservationOptions,
  ): Promise<QuotaReservationResult>;

  reconcile(reservationId: string, actual: QuotaReservationActualUsage): Promise<void>;

  release(reservationId: string, reason?: QuotaReservationReleaseReason): Promise<void>;

  getReservation(reservationId: string): QuotaReservation | undefined;

  listActiveReservations(filter?: QuotaReservationFilter): QuotaReservation[];

  getReservationSnapshot(filter?: QuotaReservationFilter): QuotaReservationSnapshot;
}

export type ReservationCapacityCheck = {
  allowed: boolean;
  reason?: QuotaRejectionReason;
  retryAfterMs?: number;
  detail?: string;
};

export function reservationMatchesRequest(
  reservation: QuotaReservation,
  request: QuotaReservationRequest,
): boolean {
  return (
    reservation.providerId === request.providerId &&
    reservation.modelId === request.modelId &&
    reservation.reservedInputTokens === request.estimatedInputTokens &&
    reservation.reservedOutputTokens === request.estimatedOutputTokens
  );
}
