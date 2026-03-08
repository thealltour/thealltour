/**
 * PR27: variant 전환 lift 비교 (control 대비).
 * 통계적 유의성 검정은 제외.
 */
import type { ReviewVariantConversionSummary } from "@/types/reviewConversionAnalytics";

export interface VariantLiftResult {
  experimentKey?: string;
  variant?: string;
  controlConversionRate: number;
  variantConversionRate: number;
  liftPercent: number;
  impressions: number;
  conversions: number;
}

/**
 * variant별 전환율과 control 대비 lift 계산.
 */
export function compareVariantConversionLift(
  variantSummaries: ReviewVariantConversionSummary[],
): VariantLiftResult[] {
  const byExperiment = new Map<string, ReviewVariantConversionSummary[]>();
  for (const s of variantSummaries) {
    const key = s.experimentKey ?? "default";
    let list = byExperiment.get(key);
    if (!list) {
      list = [];
      byExperiment.set(key, list);
    }
    list.push(s);
  }
  const results: VariantLiftResult[] = [];
  for (const list of byExperiment.values()) {
    const control = getControlSummaryForExperiment(list);
    const controlRate = control ? control.conversionRate : 0;
    for (const s of list) {
      if (s.variant === "control") continue;
      const lift = calculateRateLift(controlRate, s.conversionRate);
      results.push({
        experimentKey: s.experimentKey,
        variant: s.variant,
        controlConversionRate: controlRate,
        variantConversionRate: s.conversionRate,
        liftPercent: lift,
        impressions: s.impressions,
        conversions: s.conversions,
      });
    }
  }
  return results;
}

/**
 * 실험 내 control variant 요약.
 */
export function getControlSummaryForExperiment(
  variantSummaries: ReviewVariantConversionSummary[],
): ReviewVariantConversionSummary | null {
  return (
    variantSummaries.find((s) => s.variant === "control") ?? variantSummaries[0] ?? null
  );
}

/**
 * base 대비 target 전환율 상대 변화 (%). base가 0이면 0 반환.
 */
export function calculateRateLift(baseRate: number, targetRate: number): number {
  if (baseRate <= 0) return 0;
  return Math.round(((targetRate - baseRate) / baseRate) * 100);
}
