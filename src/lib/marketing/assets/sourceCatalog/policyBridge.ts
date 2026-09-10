/**
 * Map catalog rows into SV-1 auto-delete eligibility inputs (judgment only).
 */

import type { AutoDeleteEligibilityInput } from "@/lib/marketing/assets/shortform/storagePolicy";
import type { MarketingMediaSourceRecord } from "@/lib/marketing/assets/sourceCatalog/types";

export function marketingMediaSourceToAutoDeleteInput(
  source: MarketingMediaSourceRecord,
  params: {
    nowMs: number;
    createdAtMs?: number;
    ephemeralOutcome?: AutoDeleteEligibilityInput["ephemeralOutcome"];
    previewOutcome?: AutoDeleteEligibilityInput["previewOutcome"];
    generatedUsedInContent?: boolean;
  },
): AutoDeleteEligibilityInput {
  const createdAtMs =
    params.createdAtMs ?? Date.parse(source.createdAt);
  return {
    storageClass: source.storageClass,
    sourceKind: source.sourceKind,
    disposition: source.disposition,
    pinned: source.isPinned || source.disposition === "pin",
    createdAtMs: Number.isFinite(createdAtMs) ? createdAtMs : 0,
    nowMs: params.nowMs,
    ephemeralOutcome: params.ephemeralOutcome,
    previewOutcome: params.previewOutcome,
    generatedUsedInContent: params.generatedUsedInContent,
  };
}
