import { createHash } from "node:crypto";

import { researchIdentitySeedForCandidate } from "@/lib/marketing/cron/daily/agendaSlate/agendaSlateActions";

export const DAILY_MARKETING_PRODUCTION_ROUTINE_PREFIX = "daily-marketing-production";

/**
 * Per-selected-agenda production identity.
 * Same selection → same key; different agenda → different key.
 * Historical daily runs keep `daily-marketing-plan:YYYY-MM-DD`.
 */
export function buildProductionLogicalRunKey(input: {
  businessDateKst: string;
  agendaCandidateId?: string | null;
  researchBriefId?: string | null;
  title: string;
  canonicalArticleIds?: string[];
}): string {
  const hash = createHash("sha256")
    .update(researchIdentitySeedForCandidate(input))
    .digest("hex")
    .slice(0, 24);
  return `${DAILY_MARKETING_PRODUCTION_ROUTINE_PREFIX}:${input.businessDateKst}:${hash}`;
}

export function isHistoricalDailyLogicalRunKey(logicalRunKey: string): boolean {
  return /^daily-marketing-plan:\d{4}-\d{2}-\d{2}$/.test(logicalRunKey);
}

export function isProductionLogicalRunKey(logicalRunKey: string): boolean {
  return /^daily-marketing-production:\d{4}-\d{2}-\d{2}:[a-f0-9]{24}$/i.test(logicalRunKey);
}
