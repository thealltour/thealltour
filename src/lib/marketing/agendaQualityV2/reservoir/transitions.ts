import type { AgendaReservoirLifecycleStatus } from "@/lib/marketing/agendaQualityV2/contracts";
import type { AgendaReservoirItem } from "@/lib/marketing/agendaQualityV2/reservoir/types";

const ALLOWED: Record<AgendaReservoirLifecycleStatus, AgendaReservoirLifecycleStatus[]> = {
  QUALIFIED: ["PRESENTED", "REJECTED", "EXPIRED", "SUPERSEDED"],
  PRESENTED: ["SELECTED", "DEFERRED", "REJECTED", "EXPIRED", "SUPERSEDED", "PRESENTED"],
  SELECTED: ["SUPERSEDED", "EXPIRED"],
  DEFERRED: ["PRESENTED", "SELECTED", "REJECTED", "EXPIRED", "SUPERSEDED"],
  REJECTED: [],
  EXPIRED: [],
  SUPERSEDED: [],
};

export class AgendaReservoirTransitionError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "AgendaReservoirTransitionError";
  }
}

function assertTransition(
  from: AgendaReservoirLifecycleStatus,
  to: AgendaReservoirLifecycleStatus,
): void {
  if (!ALLOWED[from].includes(to)) {
    throw new AgendaReservoirTransitionError(`Illegal transition ${from} → ${to}`);
  }
}

export function markReservoirPresented(
  item: AgendaReservoirItem,
  nowIso?: string,
): AgendaReservoirItem {
  assertTransition(item.status, "PRESENTED");
  const now = nowIso ?? new Date().toISOString();
  return {
    ...item,
    status: "PRESENTED",
    lastPresentedAt: now,
    lastSlateAt: now,
    presentedCount: item.presentedCount + 1,
    lastSeenAt: now,
    candidate: { ...item.candidate, lifecycleStatus: "PRESENTED", updatedAt: now },
  };
}

/** Not selected today → DEFERRED (still reusable). */
export function markReservoirDeferred(
  item: AgendaReservoirItem,
  nowIso?: string,
): AgendaReservoirItem {
  assertTransition(item.status, "DEFERRED");
  const now = nowIso ?? new Date().toISOString();
  return {
    ...item,
    status: "DEFERRED",
    deferredAt: now,
    candidate: { ...item.candidate, lifecycleStatus: "DEFERRED", updatedAt: now },
  };
}

export function markReservoirSelected(
  item: AgendaReservoirItem,
  nowIso?: string,
): AgendaReservoirItem {
  assertTransition(item.status, "SELECTED");
  const now = nowIso ?? new Date().toISOString();
  return {
    ...item,
    status: "SELECTED",
    selectedAt: now,
    lastSelectedAt: now,
    lastSeenAt: now,
    candidate: { ...item.candidate, lifecycleStatus: "SELECTED", updatedAt: now },
  };
}

export function markReservoirRejected(
  item: AgendaReservoirItem,
  nowIso?: string,
): AgendaReservoirItem {
  assertTransition(item.status, "REJECTED");
  const now = nowIso ?? new Date().toISOString();
  return {
    ...item,
    status: "REJECTED",
    rejectedAt: now,
    lastRejectedAt: now,
    lastSeenAt: now,
    candidate: { ...item.candidate, lifecycleStatus: "REJECTED", updatedAt: now },
  };
}

export function markReservoirExpired(
  item: AgendaReservoirItem,
  nowIso?: string,
): AgendaReservoirItem {
  assertTransition(item.status, "EXPIRED");
  const now = nowIso ?? new Date().toISOString();
  return {
    ...item,
    status: "EXPIRED",
    expiredAt: now,
    candidate: { ...item.candidate, lifecycleStatus: "EXPIRED", updatedAt: now },
  };
}

export function markReservoirSuperseded(
  item: AgendaReservoirItem,
  supersededByAgendaId: string,
  nowIso?: string,
): AgendaReservoirItem {
  assertTransition(item.status, "SUPERSEDED");
  const now = nowIso ?? new Date().toISOString();
  return {
    ...item,
    status: "SUPERSEDED",
    supersededByAgendaId,
    candidate: { ...item.candidate, lifecycleStatus: "SUPERSEDED", updatedAt: now },
  };
}

/** Apply expiry when wall-clock exceeds expiresAt. */
export function applyReservoirExpiryIfNeeded(
  item: AgendaReservoirItem,
  nowIso?: string,
): AgendaReservoirItem {
  if (item.status === "EXPIRED" || item.status === "REJECTED" || item.status === "SUPERSEDED") {
    return item;
  }
  if (!item.expiresAt) return item;
  const now = nowIso ? new Date(nowIso).getTime() : Date.now();
  const exp = new Date(item.expiresAt).getTime();
  if (!Number.isFinite(exp) || exp > now) return item;
  return markReservoirExpired(item, nowIso ?? new Date(now).toISOString());
}
