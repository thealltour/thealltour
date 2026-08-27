import {
  USAGE_LEDGER_MAX_EVENTS,
  USAGE_LEDGER_RETENTION_MS,
} from "@/ai-runtime/quota/constants";
import { isWithinRollingMinute, isWithinSeoulCalendarDay } from "@/ai-runtime/quota/time";
import type {
  CorrelationUsageSummary,
  ObservedQuotaSnapshot,
  RuntimeUsageEvent,
  UsageLedgerSnapshot,
  UsageWindowAggregation,
} from "@/ai-runtime/quota/types";

export type UsageLedgerListFilter = {
  providerId?: string;
  modelId?: string;
  correlationId?: string;
  since?: string;
  until?: string;
};

export interface UsageLedger {
  record(event: RuntimeUsageEvent): void;
  list(filter?: UsageLedgerListFilter): RuntimeUsageEvent[];
  clear(): void;
  snapshot(): UsageLedgerSnapshot;
}

export type UsageAggregationFilter = {
  providerId?: string;
  modelId?: string;
};

export interface UsageLedgerAggregation extends UsageLedger {
  aggregateMinute(filter?: UsageAggregationFilter, now?: Date): UsageWindowAggregation;
  aggregateDay(filter?: UsageAggregationFilter, now?: Date): UsageWindowAggregation;
  getLatestObservedRateLimit(filter: UsageAggregationFilter): ObservedQuotaSnapshot | undefined;
  getLatestSuccessAt(filter: UsageAggregationFilter): string | undefined;
  getCorrelationSummary(correlationId: string): CorrelationUsageSummary | undefined;
  listRecentEvents(filter: UsageAggregationFilter, limit?: number): RuntimeUsageEvent[];
}

export type CreateInMemoryUsageLedgerOptions = {
  now?: () => Date;
  maxEvents?: number;
  retentionMs?: number;
};

function emptyAggregation(): UsageWindowAggregation {
  return {
    requestCount: 0,
    successCount: 0,
    errorCount: 0,
    rateLimitedCount: 0,
    quotaExhaustedCount: 0,
    inputTokens: 0,
    outputTokens: 0,
    totalTokens: 0,
    knownTokenEventCount: 0,
    usageMissingCount: 0,
  };
}

function matchesFilter(event: RuntimeUsageEvent, filter?: UsageAggregationFilter): boolean {
  if (!filter) return true;
  if (filter.providerId && event.providerId !== filter.providerId) return false;
  if (filter.modelId && event.modelId !== filter.modelId) return false;
  return true;
}

function aggregateEvents(events: RuntimeUsageEvent[]): UsageWindowAggregation {
  const result = emptyAggregation();
  for (const event of events) {
    result.requestCount += 1;
    if (event.result === "success") result.successCount += 1;
    else result.errorCount += 1;
    if (event.result === "rate_limited") result.rateLimitedCount += 1;
    if (event.result === "quota_exhausted") result.quotaExhaustedCount += 1;

    if (event.usageMissing) {
      result.usageMissingCount += 1;
      continue;
    }

    if (
      event.inputTokens != null ||
      event.outputTokens != null ||
      event.totalTokens != null
    ) {
      result.knownTokenEventCount += 1;
      result.inputTokens += event.inputTokens ?? 0;
      result.outputTokens += event.outputTokens ?? 0;
      result.totalTokens += event.totalTokens ?? 0;
    }
  }
  return result;
}

export function createInMemoryUsageLedger(
  options: CreateInMemoryUsageLedgerOptions = {},
): UsageLedgerAggregation {
  const nowFn = options.now ?? (() => new Date());
  const maxEvents = options.maxEvents ?? USAGE_LEDGER_MAX_EVENTS;
  const retentionMs = options.retentionMs ?? USAGE_LEDGER_RETENTION_MS;
  const events: RuntimeUsageEvent[] = [];

  function prune(): void {
    const cutoff = nowFn().getTime() - retentionMs;
    while (events.length > 0 && Date.parse(events[0]!.completedAt) < cutoff) {
      events.shift();
    }
    while (events.length > maxEvents) {
      events.shift();
    }
  }

  function list(filter: UsageLedgerListFilter = {}): RuntimeUsageEvent[] {
    return events.filter((event) => {
      if (filter.providerId && event.providerId !== filter.providerId) return false;
      if (filter.modelId && event.modelId !== filter.modelId) return false;
      if (filter.correlationId && event.correlationId !== filter.correlationId) return false;
      if (filter.since && Date.parse(event.completedAt) < Date.parse(filter.since)) return false;
      if (filter.until && Date.parse(event.completedAt) > Date.parse(filter.until)) return false;
      return true;
    });
  }

  return {
    record(event: RuntimeUsageEvent): void {
      events.push(event);
      events.sort((a, b) => Date.parse(a.completedAt) - Date.parse(b.completedAt));
      prune();
    },

    list,

    clear(): void {
      events.length = 0;
    },

    snapshot(): UsageLedgerSnapshot {
      if (events.length === 0) return { eventCount: 0 };
      return {
        eventCount: events.length,
        oldestEventAt: events[0]?.completedAt,
        newestEventAt: events[events.length - 1]?.completedAt,
      };
    },

    aggregateMinute(filter?: UsageAggregationFilter, now = nowFn()): UsageWindowAggregation {
      const scoped = list(filter).filter(
        (event) => matchesFilter(event, filter) && isWithinRollingMinute(event.completedAt, now),
      );
      return aggregateEvents(scoped);
    },

    aggregateDay(filter?: UsageAggregationFilter, now = nowFn()): UsageWindowAggregation {
      const scoped = list(filter).filter(
        (event) => matchesFilter(event, filter) && isWithinSeoulCalendarDay(event.completedAt, now),
      );
      return aggregateEvents(scoped);
    },

    getLatestObservedRateLimit(filter: UsageAggregationFilter): ObservedQuotaSnapshot | undefined {
      const scoped = list(filter)
        .filter((event) => matchesFilter(event, filter) && event.rateLimit)
        .sort((a, b) => Date.parse(b.completedAt) - Date.parse(a.completedAt));

      const latest = scoped[0];
      if (!latest?.rateLimit) return undefined;

      return {
        limitRequests: latest.rateLimit.limitRequests,
        remainingRequests: latest.rateLimit.remainingRequests,
        limitTokens: latest.rateLimit.limitTokens,
        remainingTokens: latest.rateLimit.remainingTokens,
        resetRequestsAt: latest.rateLimit.resetRequestsAt,
        resetTokensAt: latest.rateLimit.resetTokensAt,
        retryAfterMs: latest.rateLimit.retryAfterMs ?? latest.retryAfterMs,
        observedAt: latest.completedAt,
      };
    },

    getLatestSuccessAt(filter: UsageAggregationFilter): string | undefined {
      const scoped = list(filter)
        .filter((event) => matchesFilter(event, filter) && event.result === "success")
        .sort((a, b) => Date.parse(b.completedAt) - Date.parse(a.completedAt));
      return scoped[0]?.completedAt;
    },

    getCorrelationSummary(correlationId: string): CorrelationUsageSummary | undefined {
      const scoped = list({ correlationId });
      if (scoped.length === 0) return undefined;

      const aggregation = aggregateEvents(scoped);
      return {
        correlationId,
        llmCallCount: aggregation.requestCount,
        inputTokens: aggregation.inputTokens,
        outputTokens: aggregation.outputTokens,
        totalTokens: aggregation.totalTokens,
        knownTokenEventCount: aggregation.knownTokenEventCount,
        usageMissingCount: aggregation.usageMissingCount,
        providerIds: [...new Set(scoped.map((event) => event.providerId))],
        modelIds: [...new Set(scoped.map((event) => event.modelId))],
      };
    },

    listRecentEvents(filter: UsageAggregationFilter, limit = 20): RuntimeUsageEvent[] {
      return list(filter)
        .filter((event) => matchesFilter(event, filter))
        .sort((a, b) => Date.parse(b.completedAt) - Date.parse(a.completedAt))
        .slice(0, limit);
    },
  };
}

let defaultLedger: UsageLedgerAggregation | null = null;

export function getDefaultUsageLedger(): UsageLedgerAggregation {
  if (!defaultLedger) {
    defaultLedger = createInMemoryUsageLedger();
  }
  return defaultLedger;
}

export function resetDefaultUsageLedgerForTests(): void {
  defaultLedger?.clear();
  defaultLedger = null;
}
