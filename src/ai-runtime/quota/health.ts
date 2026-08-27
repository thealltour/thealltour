import type { QuotaCapacity, QuotaHealth } from "@/ai-runtime/domain/quota";
import {
  BLOCKED_REQUIRES_RETRY_AFTER,
  QUOTA_RED_THRESHOLD,
  QUOTA_YELLOW_THRESHOLD,
} from "@/ai-runtime/quota/constants";
import type {
  ObservedQuotaSnapshot,
  RuntimeUsageEvent,
  UsageWindowAggregation,
} from "@/ai-runtime/quota/types";

export type QuotaHealthInput = {
  now: Date;
  minute: UsageWindowAggregation;
  day: UsageWindowAggregation;
  configured?: QuotaCapacity;
  observed?: ObservedQuotaSnapshot;
  recentEvents: RuntimeUsageEvent[];
  lastSuccessAt?: string;
};

export type QuotaHealthEvaluation = {
  health: QuotaHealth;
  blockedUntil?: string;
  retryAfterMs?: number;
};

function usageRatio(used: number, capacity: number | undefined): number | undefined {
  if (capacity == null || capacity <= 0) return undefined;
  return used / capacity;
}

function remainingRatio(remaining: number | undefined, limit: number | undefined): number | undefined {
  if (remaining == null || limit == null || limit <= 0) return undefined;
  return remaining / limit;
}

function healthFromUsageRatio(ratio: number | undefined): QuotaHealth | undefined {
  if (ratio == null) return undefined;
  if (ratio >= QUOTA_RED_THRESHOLD) return "red";
  if (ratio >= QUOTA_YELLOW_THRESHOLD) return "yellow";
  return "green";
}

function healthFromRemainingRatio(ratio: number | undefined): QuotaHealth | undefined {
  if (ratio == null) return undefined;
  if (ratio <= 1 - QUOTA_RED_THRESHOLD) return "red";
  if (ratio <= 1 - QUOTA_YELLOW_THRESHOLD) return "yellow";
  return "green";
}

function pickStrictestHealth(candidates: Array<QuotaHealth | undefined>): QuotaHealth | undefined {
  const order: QuotaHealth[] = ["blocked", "red", "yellow", "green", "unknown"];
  let best: QuotaHealth | undefined;
  for (const candidate of candidates) {
    if (!candidate) continue;
    if (!best || order.indexOf(candidate) < order.indexOf(best)) {
      best = candidate;
    }
  }
  return best;
}

function findActiveBlock(input: QuotaHealthInput): QuotaHealthEvaluation | undefined {
  const limitEvents = input.recentEvents
    .filter((event) => event.result === "rate_limited" || event.result === "quota_exhausted")
    .sort((a, b) => Date.parse(b.completedAt) - Date.parse(a.completedAt));

  for (const event of limitEvents) {
    const retryAfterMs = event.retryAfterMs ?? event.rateLimit?.retryAfterMs;
    if (BLOCKED_REQUIRES_RETRY_AFTER && (retryAfterMs == null || retryAfterMs <= 0)) {
      continue;
    }

    const blockedUntilMs = Date.parse(event.completedAt) + (retryAfterMs ?? 0);
    if (blockedUntilMs <= input.now.getTime()) continue;

    if (input.lastSuccessAt && Date.parse(input.lastSuccessAt) > Date.parse(event.completedAt)) {
      continue;
    }

    return {
      health: "blocked",
      blockedUntil: new Date(blockedUntilMs).toISOString(),
      retryAfterMs,
    };
  }

  return undefined;
}

/**
 * Computes quota health from aggregated usage and known capacity only.
 * Returns unknown when capacity cannot be determined — never infers unlimited.
 */
export function evaluateQuotaHealth(input: QuotaHealthInput): QuotaHealthEvaluation {
  const activeBlock = findActiveBlock(input);
  if (activeBlock) return activeBlock;

  const configuredCandidates: Array<QuotaHealth | undefined> = [];

  const minuteRequestRatio = usageRatio(input.minute.requestCount, input.configured?.rpm);
  const dayRequestRatio = usageRatio(input.day.requestCount, input.configured?.rpd);
  configuredCandidates.push(healthFromUsageRatio(minuteRequestRatio));
  configuredCandidates.push(healthFromUsageRatio(dayRequestRatio));

  if (input.minute.knownTokenEventCount > 0 && input.configured?.tpm != null) {
    configuredCandidates.push(
      healthFromUsageRatio(usageRatio(input.minute.totalTokens, input.configured.tpm)),
    );
  }
  if (input.day.knownTokenEventCount > 0 && input.configured?.tpd != null) {
    configuredCandidates.push(
      healthFromUsageRatio(usageRatio(input.day.totalTokens, input.configured.tpd)),
    );
  }

  const observedCandidates: Array<QuotaHealth | undefined> = [];
  if (input.observed) {
    observedCandidates.push(
      healthFromRemainingRatio(
        remainingRatio(input.observed.remainingRequests, input.observed.limitRequests),
      ),
    );
    observedCandidates.push(
      healthFromRemainingRatio(
        remainingRatio(input.observed.remainingTokens, input.observed.limitTokens),
      ),
    );
  }

  const configuredHealth = pickStrictestHealth(configuredCandidates);
  const observedHealth = pickStrictestHealth(observedCandidates);

  const health = observedHealth ?? configuredHealth ?? "unknown";

  const latestLimitEvent = input.recentEvents.find(
    (event) => event.result === "rate_limited" || event.result === "quota_exhausted",
  );

  return {
    health,
    retryAfterMs: latestLimitEvent?.retryAfterMs ?? input.observed?.retryAfterMs,
  };
}
