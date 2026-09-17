import type {
  AgendaFreshnessClass,
  AgendaReservoirLifecycleStatus,
  MarketingAgendaCandidateV2,
} from "@/lib/marketing/agendaQualityV2/contracts";
import {
  buildSemanticFingerprintPlaceholder,
  buildStorySeedFingerprint,
} from "@/lib/marketing/agendaQualityV2/memory/storySeedFingerprint";
import type { AgendaMemorySnapshot } from "@/lib/marketing/agendaQualityV2/memory/reuseDetection";

export type AgendaReservoirMemoryFields = {
  sourceFingerprint: string;
  topicFingerprint: string | null;
  semanticFingerprint: string | null;
  decisionAxisFingerprint: string | null;
  storySeedFingerprint: string | null;
  firstSeenAt: string;
  lastSeenAt: string;
  seenCount: number;
  lastSlateAt: string | null;
  lastSelectedAt: string | null;
  lastRejectedAt: string | null;
};

export type AgendaReservoirItem = {
  agendaId: string;
  /** Payload marker — not a dedicated SQL column; required on every V2 shadow write. */
  qualityVersion: "v2";
  /** Payload marker — observational shadow only; required on every V2 shadow write. */
  shadow: true;
  status: AgendaReservoirLifecycleStatus;
  firstQualifiedAt: string;
  lastPresentedAt: string | null;
  presentedCount: number;
  selectedAt: string | null;
  deferredAt: string | null;
  rejectedAt: string | null;
  expiredAt: string | null;
  supersededByAgendaId: string | null;
  freshnessClass: AgendaFreshnessClass;
  expiresAt: string | null;
  sourceFingerprint: string;
  topicFingerprint: string | null;
  decisionAxisFingerprint: string | null;
  /** Phase 2 memory */
  semanticFingerprint: string | null;
  storySeedFingerprint: string | null;
  firstSeenAt: string;
  lastSeenAt: string;
  seenCount: number;
  lastSlateAt: string | null;
  lastSelectedAt: string | null;
  lastRejectedAt: string | null;
  candidate: MarketingAgendaCandidateV2;
  candidateVersion: number;
};

/** Fail-closed for V2 reservoir writes missing shadow markers. Does not affect V1. */
export function assertAgendaReservoirShadowPayload(item: AgendaReservoirItem): void {
  if (item.qualityVersion !== "v2" || item.shadow !== true) {
    throw new Error(
      `agenda_reservoir_v2_payload_markers_missing: agendaId=${item.agendaId} qualityVersion=${String(item.qualityVersion)} shadow=${String(item.shadow)}`,
    );
  }
}

export function stampAgendaReservoirShadowMarkers(
  item: Omit<AgendaReservoirItem, "qualityVersion" | "shadow"> &
    Partial<Pick<AgendaReservoirItem, "qualityVersion" | "shadow">>,
): AgendaReservoirItem {
  return {
    ...item,
    qualityVersion: "v2",
    shadow: true,
  };
}

export type AgendaReservoirListFilter = {
  status?: AgendaReservoirLifecycleStatus | AgendaReservoirLifecycleStatus[];
  topicFingerprint?: string;
  decisionAxisFingerprint?: string;
  sinceIso?: string;
};

export type AgendaReservoirRepository = {
  get(agendaId: string): AgendaReservoirItem | null;
  upsert(item: AgendaReservoirItem): void;
  list(filter?: AgendaReservoirListFilter): AgendaReservoirItem[];
};

/** Async durable repository for shadow / production-grade persistence. */
export type DurableAgendaReservoirRepository = {
  get(agendaId: string): Promise<AgendaReservoirItem | null>;
  upsert(item: AgendaReservoirItem): Promise<void>;
  list(filter?: AgendaReservoirListFilter): Promise<AgendaReservoirItem[]>;
  listRecent(params?: { sinceIso?: string; limit?: number }): Promise<AgendaReservoirItem[]>;
};

export function createInMemoryAgendaReservoir(): AgendaReservoirRepository {
  const map = new Map<string, AgendaReservoirItem>();
  return {
    get(agendaId) {
      return map.get(agendaId) ?? null;
    },
    upsert(item) {
      assertAgendaReservoirShadowPayload(item);
      map.set(item.agendaId, item);
    },
    list(filter) {
      return filterItems([...map.values()], filter);
    },
  };
}

export function createInMemoryDurableAgendaReservoir(): DurableAgendaReservoirRepository {
  const sync = createInMemoryAgendaReservoir();
  return {
    async get(agendaId) {
      return sync.get(agendaId);
    },
    async upsert(item) {
      sync.upsert(item);
    },
    async list(filter) {
      return sync.list(filter);
    },
    async listRecent(params) {
      let rows = sync.list();
      if (params?.sinceIso) {
        rows = rows.filter((r) => r.lastSeenAt >= params.sinceIso!);
      }
      rows.sort((a, b) => b.lastSeenAt.localeCompare(a.lastSeenAt));
      return rows.slice(0, params?.limit ?? 200);
    },
  };
}

function filterItems(
  all: AgendaReservoirItem[],
  filter?: AgendaReservoirListFilter,
): AgendaReservoirItem[] {
  let rows = all;
  if (filter?.status) {
    const allowed = new Set(
      Array.isArray(filter.status) ? filter.status : [filter.status],
    );
    rows = rows.filter((item) => allowed.has(item.status));
  }
  if (filter?.topicFingerprint) {
    rows = rows.filter((item) => item.topicFingerprint === filter.topicFingerprint);
  }
  if (filter?.decisionAxisFingerprint) {
    rows = rows.filter(
      (item) => item.decisionAxisFingerprint === filter.decisionAxisFingerprint,
    );
  }
  if (filter?.sinceIso) {
    rows = rows.filter((item) => item.lastSeenAt >= filter.sinceIso!);
  }
  return rows;
}

export function createReservoirItemFromQualified(
  candidate: MarketingAgendaCandidateV2,
  nowIso?: string,
  memory?: Partial<AgendaReservoirMemoryFields>,
): AgendaReservoirItem {
  const now = nowIso ?? candidate.createdAt;
  const storySeedFingerprint =
    memory?.storySeedFingerprint ??
    buildStorySeedFingerprint(candidate.editorial.marketingStorySeedKo);
  const semanticFingerprint =
    memory?.semanticFingerprint ??
    buildSemanticFingerprintPlaceholder({
      travelerProblemKo: candidate.traveler.travelerProblemKo,
      decisionAtStakeKo: candidate.traveler.decisionAtStakeKo,
      marketingStorySeedKo: candidate.editorial.marketingStorySeedKo,
    });
  return {
    agendaId: candidate.agendaId,
    qualityVersion: "v2",
    shadow: true,
    status: "QUALIFIED",
    firstQualifiedAt: now,
    lastPresentedAt: null,
    presentedCount: 0,
    selectedAt: null,
    deferredAt: null,
    rejectedAt: null,
    expiredAt: null,
    supersededByAgendaId: null,
    freshnessClass: candidate.signalContext.freshnessClass,
    expiresAt: candidate.expiresAt,
    sourceFingerprint: memory?.sourceFingerprint ?? candidate.provenance.sourceFingerprint,
    topicFingerprint: memory?.topicFingerprint ?? candidate.provenance.topicFingerprint,
    decisionAxisFingerprint:
      memory?.decisionAxisFingerprint ?? candidate.provenance.decisionAxisFingerprint,
    semanticFingerprint,
    storySeedFingerprint,
    firstSeenAt: memory?.firstSeenAt ?? now,
    lastSeenAt: memory?.lastSeenAt ?? now,
    seenCount: memory?.seenCount ?? 1,
    lastSlateAt: memory?.lastSlateAt ?? null,
    lastSelectedAt: memory?.lastSelectedAt ?? null,
    lastRejectedAt: memory?.lastRejectedAt ?? null,
    candidate: { ...candidate, lifecycleStatus: "QUALIFIED" },
    candidateVersion: candidate.version,
  };
}

/** Strong agendas not selected today remain eligible (DEFERRED ≠ REJECTED). */
export const RESERVOIR_SLATE_ELIGIBLE_STATUSES: AgendaReservoirLifecycleStatus[] = [
  "QUALIFIED",
  "DEFERRED",
  "PRESENTED",
];

export const RESERVOIR_VERSION_INCOMPATIBLE_REASON =
  "version_incompatible_historical" as const;

/**
 * Phase 5: old prompt-v1 / transform-v1 reservoir rows remain historical
 * but are ineligible for carryover into the new editorial-objective validation.
 * Do NOT mark them REJECTED merely because the version changed.
 */
export function isAgendaReservoirVersionCompatible(
  candidate: MarketingAgendaCandidateV2,
  expected: {
    transformRevision: string;
    promptVersion: string;
    editorialObjectiveVersion: string;
  },
): boolean {
  const p = candidate.provenance;
  if (p.transformRevision !== expected.transformRevision) return false;
  if ((p.promptVersion ?? "") !== expected.promptVersion) return false;
  if ((p.editorialObjectiveVersion ?? "") !== expected.editorialObjectiveVersion) {
    return false;
  }
  return true;
}

export function isReservoirEligibleForFutureSlate(
  item: AgendaReservoirItem,
  nowIso?: string,
): boolean {
  if (item.status === "SELECTED" || item.status === "REJECTED" || item.status === "EXPIRED" || item.status === "SUPERSEDED") {
    return false;
  }
  if (!RESERVOIR_SLATE_ELIGIBLE_STATUSES.includes(item.status) && item.status !== "PRESENTED") {
    return false;
  }
  // PRESENTED without decision → treat as carryover-eligible (will typically move to DEFERRED)
  if (!["QUALIFIED", "DEFERRED", "PRESENTED"].includes(item.status)) return false;
  if (!item.expiresAt) return true;
  const now = nowIso ? new Date(nowIso).getTime() : Date.now();
  const exp = new Date(item.expiresAt).getTime();
  return Number.isFinite(exp) ? exp > now : true;
}

export function toMemorySnapshot(item: AgendaReservoirItem): AgendaMemorySnapshot {
  return {
    agendaId: item.agendaId,
    status: item.status,
    sourceFingerprint: item.sourceFingerprint,
    topicFingerprint: item.topicFingerprint,
    decisionAxisFingerprint: item.decisionAxisFingerprint,
    storySeedFingerprint: item.storySeedFingerprint,
    semanticFingerprint: item.semanticFingerprint,
    firstSeenAt: item.firstSeenAt,
    lastSeenAt: item.lastSeenAt,
    seenCount: item.seenCount,
    lastSlateAt: item.lastSlateAt,
    lastSelectedAt: item.lastSelectedAt,
    lastRejectedAt: item.lastRejectedAt,
    presentedCount: item.presentedCount,
    signalSummaryKo: item.candidate.signalContext.signalSummaryKo,
    whyNowKo: item.candidate.editorial.whyNowKo,
  };
}

export function touchReservoirSeen(
  item: AgendaReservoirItem,
  nowIso: string,
): AgendaReservoirItem {
  return {
    ...item,
    lastSeenAt: nowIso,
    seenCount: item.seenCount + 1,
  };
}
