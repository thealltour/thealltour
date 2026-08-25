import "server-only";

import {
  MEMORY_RETRIEVAL_FAILED_ITEM,
  assertSafePerformanceBrief,
  type DailyPerformanceBriefArtifact,
} from "@/lib/marketing/cron/performanceBriefArtifact";
import { stripForbiddenBotData } from "@/lib/marketing/bot/sanitize";
import type {
  GetPerformanceEvidenceInput,
  GetPerformanceEvidenceResult,
  MarketingBotDeps,
} from "@/lib/marketing/bot/types";

export const PERFORMANCE_EVIDENCE_CONTRACT = "daily-performance-brief-v1" as const;

export async function getPerformanceEvidenceTool(
  input: GetPerformanceEvidenceInput = {},
  deps: MarketingBotDeps = {},
): Promise<GetPerformanceEvidenceResult> {
  const productId = input.productId?.trim() || null;
  const channel = input.channel?.trim() || null;
  const build =
    deps.buildPerformanceEvidence ??
    (await import("@/lib/marketing/cron/buildDailyPerformanceBrief")).buildDailyPerformanceBrief;
  const brief = await build({
    productId,
    channel,
    now: deps.now,
  });
  const safe = assertSafePerformanceBrief(brief);
  return stripForbiddenBotData({
    ...safe,
    contract: PERFORMANCE_EVIDENCE_CONTRACT,
    memoryStatus: memoryStatusFromBrief(safe),
  });
}

export function memoryStatusFromBrief(
  brief: Pick<DailyPerformanceBriefArtifact, "missingItems">,
): GetPerformanceEvidenceResult["memoryStatus"] {
  return brief.missingItems.includes(MEMORY_RETRIEVAL_FAILED_ITEM) ? "unavailable" : "ok";
}
