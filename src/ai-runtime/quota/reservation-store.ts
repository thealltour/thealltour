import {
  DEFAULT_RESERVATION_TTL_MS,
  TERMINAL_RESERVATION_MAX_COUNT,
  TERMINAL_RESERVATION_RETENTION_MS,
} from "@/ai-runtime/quota/constants";
import type {
  QuotaReservation,
  QuotaReservationFilter,
  QuotaReservationSnapshot,
} from "@/ai-runtime/quota/broker-types";

export type CreateReservationInput = Omit<
  QuotaReservation,
  "status" | "reconciledAt" | "releasedAt" | "releaseReason"
>;

export interface ReservationStore {
  create(reservation: CreateReservationInput): QuotaReservation;
  get(id: string): QuotaReservation | undefined;
  update(id: string, patch: Partial<QuotaReservation>): QuotaReservation | undefined;
  list(filter?: QuotaReservationFilter): QuotaReservation[];
  listActive(filter?: QuotaReservationFilter): QuotaReservation[];
  findActiveByRequestId(requestId: string): QuotaReservation | undefined;
  expireStale(now: Date): number;
  pruneTerminal(now: Date): number;
  clear(): void;
  snapshotActive(filter?: QuotaReservationFilter): QuotaReservationSnapshot;
}

export type CreateInMemoryReservationStoreOptions = {
  now?: () => Date;
  reservationTtlMs?: number;
};

function matchesFilter(reservation: QuotaReservation, filter?: QuotaReservationFilter): boolean {
  if (!filter) return true;
  if (filter.providerId && reservation.providerId !== filter.providerId) return false;
  if (filter.modelId && reservation.modelId !== filter.modelId) return false;
  if (filter.correlationId && reservation.correlationId !== filter.correlationId) return false;
  if (filter.status && reservation.status !== filter.status) return false;
  return true;
}

function isActive(reservation: QuotaReservation, nowMs: number): boolean {
  if (reservation.status !== "active") return false;
  return Date.parse(reservation.expiresAt) > nowMs;
}

export function createInMemoryReservationStore(
  options: CreateInMemoryReservationStoreOptions = {},
): ReservationStore {
  const nowFn = options.now ?? (() => new Date());
  const reservations = new Map<string, QuotaReservation>();

  function expireStale(now: Date): number {
    const nowMs = now.getTime();
    let expired = 0;
    for (const reservation of reservations.values()) {
      if (reservation.status !== "active") continue;
      if (Date.parse(reservation.expiresAt) <= nowMs) {
        reservations.set(reservation.id, {
          ...reservation,
          status: "expired",
        });
        expired += 1;
      }
    }
    return expired;
  }

  function pruneTerminal(now: Date): number {
    const cutoff = now.getTime() - TERMINAL_RESERVATION_RETENTION_MS;
    const terminal: QuotaReservation[] = [];
    for (const reservation of reservations.values()) {
      if (reservation.status === "active") continue;
      terminal.push(reservation);
    }
    terminal.sort((a, b) => Date.parse(a.createdAt) - Date.parse(b.createdAt));

    let removed = 0;
    while (terminal.length > TERMINAL_RESERVATION_MAX_COUNT) {
      const oldest = terminal.shift();
      if (!oldest) break;
      reservations.delete(oldest.id);
      removed += 1;
    }

    for (const reservation of [...reservations.values()]) {
      if (reservation.status === "active") continue;
      const terminalAt =
        reservation.reconciledAt ?? reservation.releasedAt ?? reservation.createdAt;
      if (Date.parse(terminalAt) < cutoff) {
        reservations.delete(reservation.id);
        removed += 1;
      }
    }
    return removed;
  }

  return {
    create(input: CreateReservationInput): QuotaReservation {
      const reservation: QuotaReservation = { ...input, status: "active" };
      reservations.set(reservation.id, reservation);
      return reservation;
    },

    get(id: string): QuotaReservation | undefined {
      return reservations.get(id);
    },

    update(id: string, patch: Partial<QuotaReservation>): QuotaReservation | undefined {
      const current = reservations.get(id);
      if (!current) return undefined;
      const updated = { ...current, ...patch };
      reservations.set(id, updated);
      return updated;
    },

    list(filter?: QuotaReservationFilter): QuotaReservation[] {
      return [...reservations.values()].filter((reservation) => matchesFilter(reservation, filter));
    },

    listActive(filter?: QuotaReservationFilter): QuotaReservation[] {
      const nowMs = nowFn().getTime();
      expireStale(nowFn());
      return [...reservations.values()].filter(
        (reservation) => isActive(reservation, nowMs) && matchesFilter(reservation, filter),
      );
    },

    findActiveByRequestId(requestId: string): QuotaReservation | undefined {
      const nowMs = nowFn().getTime();
      expireStale(nowFn());
      return [...reservations.values()].find(
        (reservation) => reservation.requestId === requestId && isActive(reservation, nowMs),
      );
    },

    expireStale,

    pruneTerminal,

    clear(): void {
      reservations.clear();
    },

    snapshotActive(filter?: QuotaReservationFilter): QuotaReservationSnapshot {
      const active = this.listActive(filter);
      return {
        activeReservations: active.length,
        reservedRequests: active.reduce((sum, item) => sum + item.reservedRequests, 0),
        reservedInputTokens: active.reduce((sum, item) => sum + item.reservedInputTokens, 0),
        reservedOutputTokens: active.reduce((sum, item) => sum + item.reservedOutputTokens, 0),
        reservedTotalTokens: active.reduce((sum, item) => sum + item.reservedTotalTokens, 0),
      };
    },
  };
}

export function createReservationRecord(
  input: CreateReservationInput,
  store: ReservationStore,
): QuotaReservation {
  return store.create(input);
}

export { DEFAULT_RESERVATION_TTL_MS };
