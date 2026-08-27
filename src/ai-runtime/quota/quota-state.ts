import type { ModelLimits } from "@/ai-runtime/domain/model";
import type { QuotaCapacity } from "@/ai-runtime/domain/quota";
import { createDefaultAiRuntimeRegistry } from "@/ai-runtime/registry/registry";
import { evaluateQuotaHealth } from "@/ai-runtime/quota/health";
import type { UsageLedgerAggregation } from "@/ai-runtime/quota/usage-ledger";
import type { RuntimeQuotaState } from "@/ai-runtime/quota/types";

export type BuildQuotaStateOptions = {
  now?: () => Date;
  ledger: UsageLedgerAggregation;
};

function limitsToCapacity(limits: ModelLimits | undefined): QuotaCapacity | undefined {
  if (!limits) return undefined;
  const configured: QuotaCapacity = {
    rpm: limits.rpm,
    tpm: limits.tpm,
    rpd: limits.rpd,
    tpd: limits.tpd,
    inputTpm: limits.inputTpm,
    outputTpm: limits.outputTpm,
  };
  const hasAny = Object.values(configured).some((value) => value != null);
  return hasAny ? configured : undefined;
}

function tokensFromAggregation(
  aggregation: ReturnType<UsageLedgerAggregation["aggregateMinute"]>,
): { tokens?: number; tokensKnown: boolean } {
  if (aggregation.knownTokenEventCount === 0) {
    return { tokensKnown: false };
  }
  return { tokens: aggregation.totalTokens, tokensKnown: true };
}

export function buildModelQuotaState(
  providerId: string,
  modelId: string,
  options: BuildQuotaStateOptions,
): RuntimeQuotaState {
  const now = options.now?.() ?? new Date();
  const filter = { providerId, modelId };
  const minuteAgg = options.ledger.aggregateMinute(filter, now);
  const dayAgg = options.ledger.aggregateDay(filter, now);
  const observed = options.ledger.getLatestObservedRateLimit(filter);
  const lastSuccessAt = options.ledger.getLatestSuccessAt(filter);
  const recentEvents = options.ledger.listRecentEvents(filter, 50);

  const registry = createDefaultAiRuntimeRegistry();
  const model = registry.getModelById(modelId);
  const configured = model?.providerId === providerId ? limitsToCapacity(model.limits) : undefined;

  const healthEval = evaluateQuotaHealth({
    now,
    minute: minuteAgg,
    day: dayAgg,
    configured,
    observed,
    recentEvents,
    lastSuccessAt,
  });

  const minuteTokens = tokensFromAggregation(minuteAgg);
  const dayTokens = tokensFromAggregation(dayAgg);

  return {
    providerId,
    modelId,
    health: healthEval.health,
    minute: {
      requests: minuteAgg.requestCount,
      tokens: minuteTokens.tokens,
      tokensKnown: minuteTokens.tokensKnown,
    },
    day: {
      requests: dayAgg.requestCount,
      tokens: dayTokens.tokens,
      tokensKnown: dayTokens.tokensKnown,
    },
    configured,
    observed,
    retryAfterMs: healthEval.retryAfterMs,
    blockedUntil: healthEval.blockedUntil,
    lastUpdatedAt: now.toISOString(),
  };
}

export function buildProviderQuotaState(
  providerId: string,
  options: BuildQuotaStateOptions,
): RuntimeQuotaState {
  const now = options.now?.() ?? new Date();
  const filter = { providerId };
  const minuteAgg = options.ledger.aggregateMinute(filter, now);
  const dayAgg = options.ledger.aggregateDay(filter, now);
  const observed = options.ledger.getLatestObservedRateLimit(filter);
  const lastSuccessAt = options.ledger.getLatestSuccessAt(filter);
  const recentEvents = options.ledger.listRecentEvents(filter, 50);

  const healthEval = evaluateQuotaHealth({
    now,
    minute: minuteAgg,
    day: dayAgg,
    configured: undefined,
    observed,
    recentEvents,
    lastSuccessAt,
  });

  const minuteTokens = tokensFromAggregation(minuteAgg);
  const dayTokens = tokensFromAggregation(dayAgg);

  return {
    providerId,
    health: healthEval.health,
    minute: {
      requests: minuteAgg.requestCount,
      tokens: minuteTokens.tokens,
      tokensKnown: minuteTokens.tokensKnown,
    },
    day: {
      requests: dayAgg.requestCount,
      tokens: dayTokens.tokens,
      tokensKnown: dayTokens.tokensKnown,
    },
    observed,
    retryAfterMs: healthEval.retryAfterMs,
    blockedUntil: healthEval.blockedUntil,
    lastUpdatedAt: now.toISOString(),
  };
}
