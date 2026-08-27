import type { ModelDefinition } from "@/ai-runtime/domain/model";
import type { QuotaCapacity, QuotaReservationRequest } from "@/ai-runtime/domain/quota";
import {
  MINUTE_WINDOW_MS,
  OBSERVED_QUOTA_MAX_AGE_MS,
  UNKNOWN_QUOTA_ALLOWS_RESERVATION,
} from "@/ai-runtime/quota/constants";
import type { ReservationCapacityCheck, QuotaReservationSnapshot } from "@/ai-runtime/quota/broker-types";
import type { ObservedQuotaSnapshot, RuntimeQuotaState } from "@/ai-runtime/quota/types";
import type { UsageWindowAggregation } from "@/ai-runtime/quota/types";
import { getSeoulCalendarDayEnd, getSeoulCalendarDayStart } from "@/ai-runtime/quota/time";

export type CapacityUsageSnapshot = {
  minute: UsageWindowAggregation;
  day: UsageWindowAggregation;
  active: QuotaReservationSnapshot;
  quotaState: RuntimeQuotaState;
  configured?: QuotaCapacity;
};

function observedIsFresh(observed: ObservedQuotaSnapshot | undefined, now: Date): boolean {
  if (!observed?.observedAt) return false;
  return now.getTime() - Date.parse(observed.observedAt) <= OBSERVED_QUOTA_MAX_AGE_MS;
}

function retryAfterFromBlocked(blockedUntil: string | undefined, now: Date): number | undefined {
  if (!blockedUntil) return undefined;
  const remaining = Date.parse(blockedUntil) - now.getTime();
  return remaining > 0 ? remaining : undefined;
}

function retryAfterForMinuteWindow(): number {
  return MINUTE_WINDOW_MS;
}

function retryAfterForDayWindow(now: Date): number {
  const dayEnd = getSeoulCalendarDayEnd(getSeoulCalendarDayStart(now));
  return Math.max(1_000, dayEnd.getTime() - now.getTime());
}

function checkObservedRequests(
  observed: ObservedQuotaSnapshot | undefined,
  incomingRequests: number,
  now: Date,
): ReservationCapacityCheck | undefined {
  if (!observedIsFresh(observed, now)) return undefined;
  if (observed?.limitRequests == null || observed.remainingRequests == null) return undefined;
  if (incomingRequests > observed.remainingRequests) {
    return {
      allowed: false,
      reason: "rpm",
      retryAfterMs: observed.retryAfterMs ?? retryAfterForMinuteWindow(),
      detail: "observed remainingRequests exceeded",
    };
  }
  return undefined;
}

function checkObservedTokens(
  observed: ObservedQuotaSnapshot | undefined,
  incomingTotalTokens: number,
  now: Date,
): ReservationCapacityCheck | undefined {
  if (!observedIsFresh(observed, now)) return undefined;
  if (observed?.limitTokens == null || observed.remainingTokens == null) return undefined;
  if (incomingTotalTokens > observed.remainingTokens) {
    return {
      allowed: false,
      reason: "tpm",
      retryAfterMs: observed.retryAfterMs ?? retryAfterForMinuteWindow(),
      detail: "observed remainingTokens exceeded",
    };
  }
  return undefined;
}

/**
 * Evaluates whether a new reservation fits configured/observed/blocked quota state.
 * Unknown configured capacity allows reservation unless provider is actively blocked.
 */
export function evaluateReservationCapacity(
  request: QuotaReservationRequest,
  usage: CapacityUsageSnapshot,
  now: Date,
): ReservationCapacityCheck {
  const blockedRetry = retryAfterFromBlocked(usage.quotaState.blockedUntil, now);
  if (blockedRetry != null) {
    return {
      allowed: false,
      reason: "provider_blocked",
      retryAfterMs: blockedRetry,
      detail: "provider blockedUntil active",
    };
  }

  const incomingRequests = 1;
  const incomingInput = request.estimatedInputTokens;
  const incomingOutput = request.estimatedOutputTokens;
  const incomingTotal = incomingInput + incomingOutput;

  const minuteRequests =
    usage.minute.requestCount + usage.active.reservedRequests + incomingRequests;
  const minuteInputTokens =
    usage.minute.inputTokens + usage.active.reservedInputTokens + incomingInput;
  const minuteOutputTokens =
    usage.minute.outputTokens + usage.active.reservedOutputTokens + incomingOutput;
  const minuteTotalTokens =
    usage.minute.totalTokens + usage.active.reservedTotalTokens + incomingTotal;

  const dayRequests = usage.day.requestCount + usage.active.reservedRequests + incomingRequests;
  const dayTotalTokens = usage.day.totalTokens + usage.active.reservedTotalTokens + incomingTotal;

  const configured = usage.configured;

  if (configured?.rpm != null && minuteRequests > configured.rpm) {
    return {
      allowed: false,
      reason: "rpm",
      retryAfterMs: retryAfterForMinuteWindow(),
      detail: "configured rpm exceeded",
    };
  }

  if (configured?.tpm != null && minuteTotalTokens > configured.tpm) {
    return {
      allowed: false,
      reason: "tpm",
      retryAfterMs: retryAfterForMinuteWindow(),
      detail: "configured tpm exceeded",
    };
  }

  if (configured?.inputTpm != null && minuteInputTokens > configured.inputTpm) {
    return {
      allowed: false,
      reason: "tpm",
      retryAfterMs: retryAfterForMinuteWindow(),
      detail: "configured inputTpm exceeded",
    };
  }

  if (configured?.outputTpm != null && minuteOutputTokens > configured.outputTpm) {
    return {
      allowed: false,
      reason: "tpm",
      retryAfterMs: retryAfterForMinuteWindow(),
      detail: "configured outputTpm exceeded",
    };
  }

  if (configured?.rpd != null && dayRequests > configured.rpd) {
    return {
      allowed: false,
      reason: "rpd",
      retryAfterMs: retryAfterForDayWindow(now),
      detail: "configured rpd exceeded",
    };
  }

  if (configured?.tpd != null && dayTotalTokens > configured.tpd) {
    return {
      allowed: false,
      reason: "tpd",
      retryAfterMs: retryAfterForDayWindow(now),
      detail: "configured tpd exceeded",
    };
  }

  const observed = usage.quotaState.observed;
  const observedRequestCheck = checkObservedRequests(observed, incomingRequests, now);
  if (observedRequestCheck) return observedRequestCheck;

  const observedTokenCheck = checkObservedTokens(observed, incomingTotal, now);
  if (observedTokenCheck) return observedTokenCheck;

  if (!UNKNOWN_QUOTA_ALLOWS_RESERVATION) {
    return { allowed: false, reason: "unknown", detail: "unknown quota policy disabled" };
  }

  return { allowed: true };
}

export function limitsFromModel(model: ModelDefinition): QuotaCapacity | undefined {
  const limits = model.limits;
  const configured: QuotaCapacity = {
    rpm: limits.rpm,
    tpm: limits.tpm,
    rpd: limits.rpd,
    tpd: limits.tpd,
    inputTpm: limits.inputTpm,
    outputTpm: limits.outputTpm,
  };
  return Object.values(configured).some((value) => value != null) ? configured : undefined;
}
