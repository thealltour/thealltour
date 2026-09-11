/**
 * CG-3 — Shortform-intended candidates require READY RenderJob + durable final mp4
 * before approve_for_manual_publish.
 */

import "server-only";

import { evaluateShortformRenderReady } from "@/lib/marketing/assets/shortform/renderReady";
import type { ShortformVideoRenderJobRepository } from "@/lib/marketing/assets/shortform/renderJob/repository";
import type { MarketingMediaSourceCatalogRepository } from "@/lib/marketing/assets/sourceCatalog/repository";
import type { CompletedMarketingCandidate } from "@/lib/marketing/cron/daily/types";
import type { DailyMarketingRunRepository } from "@/lib/marketing/cron/daily/repository/createDailyMarketingRunRepository";
import { HumanReviewPolicyError } from "@/lib/marketing/review/transitions";

export async function assertShortformReadyForManualPublish(input: {
  candidateId: string;
  candidate?: CompletedMarketingCandidate | null;
  catalog?: MarketingMediaSourceCatalogRepository;
  jobRepository?: ShortformVideoRenderJobRepository;
  repository?: DailyMarketingRunRepository;
  env?: NodeJS.ProcessEnv | Record<string, string | undefined>;
}): Promise<void> {
  const evaluation = await evaluateShortformRenderReady(input);
  if (!evaluation.shortformIntended) return;

  if (!evaluation.job) {
    throw new HumanReviewPolicyError(
      "숏폼 후보 승인에는 READY RenderJob이 필요합니다. 장면 소스 PICK 후 렌더 완료를 기다리세요.",
    );
  }

  switch (evaluation.job.status) {
    case "QUEUED":
      throw new HumanReviewPolicyError("숏폼 렌더가 대기 중입니다. READY 이후에만 승인할 수 있습니다.");
    case "RUNNING":
      throw new HumanReviewPolicyError("숏폼 렌더가 진행 중입니다. READY 이후에만 승인할 수 있습니다.");
    case "FAILED":
      throw new HumanReviewPolicyError(
        "숏폼 렌더가 실패했습니다. 재시도 후 READY가 되면 승인할 수 있습니다.",
      );
    case "CANCELLED":
      throw new HumanReviewPolicyError("숏폼 렌더가 취소되었습니다. 다시 렌더한 뒤 승인하세요.");
    case "READY":
      break;
    default:
      throw new HumanReviewPolicyError(`숏폼 렌더 상태 ${evaluation.job.status}에서는 승인할 수 없습니다.`);
  }

  if (!evaluation.finalArtifactExists) {
    throw new HumanReviewPolicyError(
      "READY 상태이지만 최종 shortform.mp4 산출물이 없습니다. 렌더 산출물을 확인하세요.",
    );
  }
}
