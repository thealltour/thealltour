import type { ModelDefinition } from "@/ai-runtime/domain/model";
import type {
  QuotaCapacity,
  QuotaReservationRequest,
  QuotaReservationResult,
} from "@/ai-runtime/domain/quota";
import { RuntimeError } from "@/ai-runtime/domain/error";
import { createDefaultAiRuntimeRegistry } from "@/ai-runtime/registry/registry";
import {
  DEFAULT_RESERVATION_TTL_MS,
} from "@/ai-runtime/quota/constants";
import type {
  QuotaBroker,
  QuotaReservation,
  QuotaReservationActualUsage,
  QuotaReservationFilter,
  QuotaReservationOptions,
  QuotaReservationReleaseReason,
  QuotaReservationSnapshot,
} from "@/ai-runtime/quota/broker-types";
import { reservationMatchesRequest } from "@/ai-runtime/quota/broker-types";
import {
  evaluateReservationCapacity,
  limitsFromModel,
  type CapacityUsageSnapshot,
} from "@/ai-runtime/quota/reservation-policy";
import {
  createInMemoryReservationStore,
  type ReservationStore,
} from "@/ai-runtime/quota/reservation-store";
import { buildModelQuotaState } from "@/ai-runtime/quota/quota-state";
import type { UsageLedgerAggregation } from "@/ai-runtime/quota/usage-ledger";
import { getDefaultUsageLedger } from "@/ai-runtime/quota/usage-ledger";

export type CreateInMemoryQuotaBrokerOptions = {
  now?: () => Date;
  ledger: UsageLedgerAggregation;
  store?: ReservationStore;
  reservationTtlMs?: number;
  /** Test hook: override configured limits without mutating registry. */
  configuredLimitsOverride?: (model: ModelDefinition) => QuotaCapacity | undefined;
};

function rejectResult(
  reason: NonNullable<Extract<QuotaReservationResult, { accepted: false }>["reason"]>,
  retryAfterMs?: number,
): QuotaReservationResult {
  return retryAfterMs != null
    ? { accepted: false, reason, retryAfterMs }
    : { accepted: false, reason };
}

export class InMemoryQuotaBroker implements QuotaBroker {
  private readonly nowFn: () => Date;
  private readonly ledger: UsageLedgerAggregation;
  private readonly store: ReservationStore;
  private readonly reservationTtlMs: number;
  private readonly configuredLimitsOverride?: (model: ModelDefinition) => QuotaCapacity | undefined;
  private readonly registry = createDefaultAiRuntimeRegistry();

  constructor(options: CreateInMemoryQuotaBrokerOptions) {
    this.nowFn = options.now ?? (() => new Date());
    this.ledger = options.ledger;
    this.store = options.store ?? createInMemoryReservationStore({ now: this.nowFn });
    this.reservationTtlMs = options.reservationTtlMs ?? DEFAULT_RESERVATION_TTL_MS;
    this.configuredLimitsOverride = options.configuredLimitsOverride;
  }

  private now(): Date {
    return this.nowFn();
  }

  private validateRequest(request: QuotaReservationRequest): {
    model: NonNullable<ReturnType<typeof this.registry.getModelById>>;
  } {
    const model = this.registry.getModelById(request.modelId);
    if (!model) {
      throw new RuntimeError("INVALID_REQUEST", `Unknown model "${request.modelId}"`, false);
    }
    if (model.providerId !== request.providerId) {
      throw new RuntimeError(
        "INVALID_REQUEST",
        `Model "${request.modelId}" does not belong to provider "${request.providerId}"`,
        false,
      );
    }
    if (!model.routing.enabled) {
      throw new RuntimeError(
        "INVALID_REQUEST",
        `Model "${request.modelId}" routing is disabled`,
        false,
      );
    }

    if (
      !Number.isFinite(request.estimatedInputTokens) ||
      !Number.isFinite(request.estimatedOutputTokens) ||
      request.estimatedInputTokens < 0 ||
      request.estimatedOutputTokens < 0
    ) {
      throw new RuntimeError(
        "INVALID_REQUEST",
        "estimatedInputTokens and estimatedOutputTokens must be non-negative numbers",
        false,
      );
    }

    return { model };
  }

  private buildCapacitySnapshot(
    request: QuotaReservationRequest,
    model: NonNullable<ReturnType<typeof this.registry.getModelById>>,
  ): CapacityUsageSnapshot {
    const now = this.now();
    const filter = { providerId: request.providerId, modelId: request.modelId };
    const quotaState = buildModelQuotaState(request.providerId, request.modelId, {
      ledger: this.ledger,
      now: () => now,
    });

    return {
      minute: this.ledger.aggregateMinute(filter, now),
      day: this.ledger.aggregateDay(filter, now),
      active: this.store.snapshotActive(filter),
      quotaState,
      configured: this.configuredLimitsOverride?.(model) ?? limitsFromModel(model),
    };
  }

  async reserve(
    request: QuotaReservationRequest,
    options: QuotaReservationOptions = {},
  ): Promise<QuotaReservationResult> {
    const now = options.now ?? this.now();
    this.store.expireStale(now);
    this.store.pruneTerminal(now);

    const existing = this.store.findActiveByRequestId(request.requestId);
    if (existing) {
      if (reservationMatchesRequest(existing, request)) {
        return {
          accepted: true,
          reservationId: existing.id,
          expiresAt: existing.expiresAt,
        };
      }
      throw new RuntimeError(
        "INVALID_REQUEST",
        `Active reservation already exists for requestId "${request.requestId}" with different parameters`,
        false,
      );
    }

    const provider = this.registry.getProviderById(request.providerId);
    if (!provider) {
      throw new RuntimeError(
        "INVALID_REQUEST",
        `Unknown provider "${request.providerId}"`,
        false,
      );
    }
    if (!provider.enabled) {
      return rejectResult("provider_blocked");
    }

    const { model } = this.validateRequest(request);
    const capacity = this.buildCapacitySnapshot(request, model);
    const decision = evaluateReservationCapacity(request, capacity, now);
    if (!decision.allowed) {
      return rejectResult(decision.reason ?? "unknown", decision.retryAfterMs);
    }

    const expiresAt = new Date(now.getTime() + (options.ttlMs ?? this.reservationTtlMs)).toISOString();
    const reservation = this.store.create({
      id: `res-${request.requestId}-${now.getTime()}`,
      requestId: request.requestId,
      correlationId: options.correlationId,
      providerId: request.providerId,
      modelId: request.modelId,
      reservedRequests: 1,
      reservedInputTokens: request.estimatedInputTokens,
      reservedOutputTokens: request.estimatedOutputTokens,
      reservedTotalTokens: request.estimatedInputTokens + request.estimatedOutputTokens,
      createdAt: now.toISOString(),
      expiresAt,
    });

    return {
      accepted: true,
      reservationId: reservation.id,
      expiresAt: reservation.expiresAt,
    };
  }

  async reconcile(reservationId: string, actual: QuotaReservationActualUsage): Promise<void> {
    const now = this.now();
    this.store.expireStale(now);

    const reservation = this.store.get(reservationId);
    if (!reservation) {
      throw new RuntimeError("INVALID_REQUEST", `Reservation "${reservationId}" not found`, false);
    }
    if (reservation.status !== "active") return;

    const actualInput = actual.usageMissing ? undefined : actual.inputTokens;
    const actualOutput = actual.usageMissing ? undefined : actual.outputTokens;
    const actualTotal =
      actual.usageMissing
        ? undefined
        : actual.totalTokens ?? (actualInput ?? 0) + (actualOutput ?? 0);

    const tokenOverage =
      actualTotal != null && actualTotal > reservation.reservedTotalTokens
        ? actualTotal - reservation.reservedTotalTokens
        : undefined;

    this.store.update(reservationId, {
      status: "reconciled",
      reconciledAt: now.toISOString(),
      reconciledInputTokens: actualInput,
      reconciledOutputTokens: actualOutput,
      reconciledTotalTokens: actualTotal,
      tokenOverage,
    });
  }

  async release(
    reservationId: string,
    reason: QuotaReservationReleaseReason = "other",
  ): Promise<void> {
    const now = this.now();
    const reservation = this.store.get(reservationId);
    if (!reservation || reservation.status !== "active") return;

    this.store.update(reservationId, {
      status: "released",
      releasedAt: now.toISOString(),
      releaseReason: reason,
    });
  }

  getReservation(reservationId: string): QuotaReservation | undefined {
    this.store.expireStale(this.now());
    return this.store.get(reservationId);
  }

  listActiveReservations(filter?: QuotaReservationFilter): QuotaReservation[] {
    return this.store.listActive(filter);
  }

  getReservationSnapshot(filter?: QuotaReservationFilter): QuotaReservationSnapshot {
    return this.store.snapshotActive(filter);
  }
}

let defaultBroker: InMemoryQuotaBroker | null = null;

export function createInMemoryQuotaBroker(
  options: CreateInMemoryQuotaBrokerOptions,
): InMemoryQuotaBroker {
  return new InMemoryQuotaBroker(options);
}

export function getDefaultQuotaBroker(ledger?: UsageLedgerAggregation): InMemoryQuotaBroker {
  if (!defaultBroker) {
    defaultBroker = createInMemoryQuotaBroker({
      ledger: ledger ?? getDefaultUsageLedger(),
    });
  }
  return defaultBroker;
}

export function resetDefaultQuotaBrokerForTests(): void {
  defaultBroker = null;
}
