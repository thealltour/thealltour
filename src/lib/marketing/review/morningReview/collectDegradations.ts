/**
 * Surface silent pipeline degradations to the operator.
 *
 * These signals already existed in run metadata and channel warnings, but nothing
 * rendered them: a `deterministic_fallback` slate or a fallback-generated channel
 * body looked identical to a healthy run in the review UI.
 */

import type { DailyMarketingRun } from "@/lib/marketing/cron/daily/types";
import type {
  MorningChannelReviewView,
  MorningReviewDegradation,
} from "@/lib/marketing/review/morningReview/types";

const DEGRADED_WARNING_PREFIX = "degraded:";

function readCurationMode(run: DailyMarketingRun | null): string | null {
  const raw = run?.metadata?.curationMode;
  return typeof raw === "string" && raw.trim() ? raw.trim() : null;
}

function readSemanticMode(run: DailyMarketingRun | null): string | null {
  const meta = run?.metadata?.semanticSoftDemotion;
  if (typeof meta !== "object" || meta === null) return null;
  const mode = (meta as { mode?: unknown }).mode;
  return typeof mode === "string" && mode.trim() ? mode.trim() : null;
}

/**
 * Ordered worst-first so the UI can render the list as-is.
 */
export function collectMorningReviewDegradations(input: {
  run: DailyMarketingRun | null;
  channelReviews: MorningChannelReviewView[];
  researchLimitations: string[];
}): MorningReviewDegradation[] {
  const out: MorningReviewDegradation[] = [];

  const curationMode = readCurationMode(input.run);
  if (curationMode === "deterministic_fallback") {
    out.push({
      code: "manager_deterministic_fallback",
      severity: "critical",
      message:
        "Marketing Manager 큐레이션이 실패해 결정론적 fallback으로 아젠다가 생성되었습니다. 주제 선정에 전략 판단이 반영되지 않았습니다.",
      detail: `curationMode=${curationMode}`,
    });
  }

  const degradedChannels = input.channelReviews.filter((view) =>
    (view.validationWarnings ?? []).some((warning) => warning.startsWith(DEGRADED_WARNING_PREFIX)),
  );
  if (degradedChannels.length > 0) {
    out.push({
      code: "channel_composer_fallback",
      severity: "critical",
      message: `채널 ${degradedChannels.length}개가 LLM 생성에 실패해 fallback/검증 실패 상태입니다. 승인 전 재생성이 필요합니다.`,
      detail: degradedChannels
        .map(
          (view) =>
            `${view.label}: ${
              (view.validationWarnings ?? []).find((w) => w.startsWith(DEGRADED_WARNING_PREFIX)) ??
              DEGRADED_WARNING_PREFIX
            }`,
        )
        .join(" · "),
    });
  }

  const weakValueChannels = input.channelReviews.filter(
    (view) =>
      view.marketingValue?.verdict === "reject" ||
      view.marketingValue?.verdict === "needs_improvement",
  );
  if (weakValueChannels.length > 0) {
    out.push({
      code: "channel_value_weak",
      severity: "warning",
      message: `채널 ${weakValueChannels.length}개가 마케팅 가치 게이트를 통과하지 못했습니다 (사실 부족 또는 CTA 불일치).`,
      detail: weakValueChannels
        .map((view) => `${view.label}: ${view.marketingValue?.verdict}`)
        .join(" · "),
    });
  }

  if (input.researchLimitations.length > 0) {
    out.push({
      code: "research_limited",
      severity: "warning",
      message:
        "리서치 수집이 제한된 상태로 본문이 생성되었습니다. 구체적 사실이 부족하면 '공식 경로 확인' 류의 일반 조언으로 흐릅니다.",
      detail: input.researchLimitations.slice(0, 4).join(" · "),
    });
  }

  if (input.run?.degraded) {
    out.push({
      code: "run_degraded",
      severity: "warning",
      message: "파이프라인이 degraded 상태로 완료되었습니다. 의존 서비스 일부가 이용 불가였습니다.",
      detail: `runStatus=${input.run.status}; researchStatus=${input.run.researchStatus ?? "none"}`,
    });
  }

  const semanticMode = readSemanticMode(input.run);
  if (semanticMode && semanticMode !== "applied") {
    out.push({
      code: "semantic_infra_degraded",
      severity: "warning",
      message:
        "의미 기반 중복 감지가 완전히 적용되지 않았습니다. 과거 콘텐츠와 유사할 수 있으니 직접 확인하세요.",
      detail: `semanticSoftDemotion.mode=${semanticMode}`,
    });
  }

  return out;
}
