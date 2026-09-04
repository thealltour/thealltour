import { buildLogicalDailyRunKey } from "@/lib/marketing/cron/daily/kstBusinessDate";
import {
  isHistoricalDailyLogicalRunKey,
  isProductionLogicalRunKey,
} from "@/lib/marketing/cron/daily/agendaSlate/productionLogicalRunKey";
import { DAILY_MARKETING_ROUTINE_ID } from "@/lib/marketing/cron/daily/types";

/** Explicit namespace required for manual acceptance slate idempotency keys. */
export const ACCEPTANCE_LOGICAL_RUN_KEY_MARKER = "acceptance";

export const ACCEPTANCE_LOGICAL_RUN_KEY_PREFIX =
  `${DAILY_MARKETING_ROUTINE_ID}:${ACCEPTANCE_LOGICAL_RUN_KEY_MARKER}:` as const;

export const MAX_ACCEPTANCE_LOGICAL_RUN_KEY_LENGTH = 128;

/**
 * Safe acceptance keys only, e.g.
 *   daily-marketing-plan:acceptance:2026-09-04:agenda-v1
 *
 * Rejects production daily keys and per-agenda production keys.
 */
const ACCEPTANCE_LOGICAL_RUN_KEY_RE =
  /^daily-marketing-plan:acceptance:[A-Za-z0-9][A-Za-z0-9:_./-]{0,96}$/;

export function assertAcceptanceLogicalRunKey(value: string): string {
  const trimmed = value.trim();
  if (!trimmed) {
    throw new Error("acceptance run key must be a non-empty string");
  }
  if (trimmed.length > MAX_ACCEPTANCE_LOGICAL_RUN_KEY_LENGTH) {
    throw new Error(
      `acceptance run key exceeds ${MAX_ACCEPTANCE_LOGICAL_RUN_KEY_LENGTH} characters`,
    );
  }
  if (isHistoricalDailyLogicalRunKey(trimmed)) {
    throw new Error(
      "acceptance run key must not impersonate the production daily logicalRunKey",
    );
  }
  if (isProductionLogicalRunKey(trimmed)) {
    throw new Error(
      "acceptance run key must not impersonate a production selection logicalRunKey",
    );
  }
  if (!trimmed.startsWith(ACCEPTANCE_LOGICAL_RUN_KEY_PREFIX)) {
    throw new Error(
      `acceptance run key must start with "${ACCEPTANCE_LOGICAL_RUN_KEY_PREFIX}"`,
    );
  }
  if (!ACCEPTANCE_LOGICAL_RUN_KEY_RE.test(trimmed)) {
    throw new Error(
      "acceptance run key has invalid characters or shape (allowed: A-Z a-z 0-9 : _ . / -)",
    );
  }
  return trimmed;
}

/**
 * Default cron: daily-marketing-plan:<businessDateKst>
 * Manual acceptance override: caller-supplied validated acceptance key.
 */
export function resolveAgendaSlateLogicalRunKey(input: {
  businessDateKst: string;
  logicalRunKey?: string | null;
}): string {
  const override = input.logicalRunKey?.trim();
  if (override) {
    return assertAcceptanceLogicalRunKey(override);
  }
  return buildLogicalDailyRunKey({
    routineId: DAILY_MARKETING_ROUTINE_ID,
    businessDateKst: input.businessDateKst,
  });
}
