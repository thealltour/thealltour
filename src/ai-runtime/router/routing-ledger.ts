import {
  ROUTING_LEDGER_MAX_ENTRIES,
  ROUTING_LEDGER_RECENT_LIMIT,
  ROUTING_LEDGER_RETENTION_MS,
} from "@/ai-runtime/router/policies";
import type { RoutingLedgerEntry, RoutingLedgerSnapshot } from "@/ai-runtime/router/types";

export type RoutingLedger = {
  record(entry: RoutingLedgerEntry): void;
  snapshot(now?: Date): RoutingLedgerSnapshot;
  clear(): void;
};

export function createInMemoryRoutingLedger(nowFn: () => Date = () => new Date()): RoutingLedger {
  const entries: RoutingLedgerEntry[] = [];

  function prune(now: Date): void {
    const cutoff = now.getTime() - ROUTING_LEDGER_RETENTION_MS;
    while (entries.length > 0 && Date.parse(entries[0]!.timestamp) < cutoff) {
      entries.shift();
    }
    while (entries.length > ROUTING_LEDGER_MAX_ENTRIES) {
      entries.shift();
    }
  }

  return {
    record(entry: RoutingLedgerEntry): void {
      entries.push(entry);
      entries.sort((a, b) => Date.parse(a.timestamp) - Date.parse(b.timestamp));
      prune(nowFn());
    },

    snapshot(now = nowFn()): RoutingLedgerSnapshot {
      prune(now);
      const hourAgo = now.getTime() - 60 * 60 * 1000;
      const lastHour = entries.filter((entry) => Date.parse(entry.timestamp) >= hourAgo);
      const fallbackCount = lastHour.filter((entry) => entry.fallbackUsed).length;
      const providerSelections: Record<string, number> = {};

      for (const entry of lastHour) {
        if (!entry.selectedProviderId || entry.finalStatus !== "success") continue;
        providerSelections[entry.selectedProviderId] =
          (providerSelections[entry.selectedProviderId] ?? 0) + 1;
      }

      return {
        lastHourRequests: lastHour.length,
        fallbackCount,
        fallbackRate: lastHour.length > 0 ? fallbackCount / lastHour.length : 0,
        providerSelections,
        recent: [...entries]
          .reverse()
          .slice(0, ROUTING_LEDGER_RECENT_LIMIT)
          .map((entry) => ({
            timestamp: entry.timestamp,
            workload: entry.workload,
            selectedProviderId: entry.selectedProviderId,
            selectedModelId: entry.selectedModelId,
            attemptCount: entry.attemptCount,
            fallbackUsed: entry.fallbackUsed,
            finalStatus: entry.finalStatus,
          })),
      };
    },

    clear(): void {
      entries.length = 0;
    },
  };
}

let defaultRoutingLedger: RoutingLedger | null = null;

export function getDefaultRoutingLedger(): RoutingLedger {
  if (!defaultRoutingLedger) {
    defaultRoutingLedger = createInMemoryRoutingLedger();
  }
  return defaultRoutingLedger;
}

export function resetDefaultRoutingLedgerForTests(): void {
  defaultRoutingLedger?.clear();
  defaultRoutingLedger = null;
}
