/**
 * PR26: 리뷰 실험 이벤트 집계 및 관리자 요약.
 */
import "server-only";
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import type {
  ReviewExperimentKey,
  ReviewExperimentVariant,
  ReviewExperimentResultSummary,
  ReviewExperimentExposureEvent,
} from "@/types/reviewExperiment";

export type ReviewExperimentEventRow = {
  id: string;
  experiment_key: string;
  variant: string;
  product_id: string;
  event_type: string;
  review_id: string | null;
  occurred_at: string;
};

/**
 * 원시 이벤트 배열을 experiment_key + variant 별로 집계.
 */
export function aggregateReviewExperimentEvents(
  events: ReviewExperimentExposureEvent[],
): ReviewExperimentResultSummary[] {
  const byKey = new Map<string, ReviewExperimentResultSummary>();
  const key = (ek: string, v: string) => `${ek}\t${v}`;

  for (const e of events) {
    const k = key(e.experimentKey, e.variant);
    let sum = byKey.get(k);
    if (!sum) {
      sum = {
        experimentKey: e.experimentKey as ReviewExperimentKey,
        variant: e.variant as ReviewExperimentVariant,
        impressions: 0,
        clicks: 0,
        expands: 0,
        helpfulClicks: 0,
        conversions: 0,
        ctr: 0,
        expandRate: 0,
        conversionRate: 0,
      };
      byKey.set(k, sum);
    }
    switch (e.eventType) {
      case "impression":
        sum.impressions++;
        break;
      case "click_review":
        sum.clicks++;
        break;
      case "expand_review":
        sum.expands++;
        break;
      case "click_helpful":
        sum.helpfulClicks++;
        break;
      case "conversion":
        sum.conversions++;
        break;
      default:
        break;
    }
  }

  const result: ReviewExperimentResultSummary[] = [];
  for (const sum of byKey.values()) {
    sum.ctr = sum.impressions > 0 ? Math.round((sum.clicks / sum.impressions) * 10000) / 100 : 0;
    sum.expandRate = sum.impressions > 0 ? Math.round((sum.expands / sum.impressions) * 10000) / 100 : 0;
    sum.conversionRate = sum.impressions > 0 ? Math.round((sum.conversions / sum.impressions) * 10000) / 100 : 0;
    result.push(sum);
  }
  return result.sort((a, b) => {
    const c = a.experimentKey.localeCompare(b.experimentKey);
    if (c !== 0) return c;
    return b.impressions - a.impressions;
  });
}

/**
 * DB에서 이벤트 조회 후 variant 별 요약 반환.
 */
export async function getReviewExperimentEventsSummary(options?: {
  experimentKey?: ReviewExperimentKey;
  since?: string;
  limit?: number;
}): Promise<ReviewExperimentResultSummary[]> {
  let query = supabaseAdmin
    .from("review_experiment_events")
    .select("experiment_key, variant, product_id, event_type, occurred_at")
    .order("occurred_at", { ascending: false });

  if (options?.experimentKey) {
    query = query.eq("experiment_key", options.experimentKey);
  }
  if (options?.since) {
    query = query.gte("occurred_at", options.since);
  }
  const limit = Math.min(options?.limit ?? 5000, 50000);
  const { data, error } = await query.limit(limit);

  if (error || !data?.length) {
    return [];
  }

  const events: ReviewExperimentExposureEvent[] = (data as ReviewExperimentEventRow[]).map((row) => ({
    experimentKey: row.experiment_key as ReviewExperimentKey,
    variant: row.variant as ReviewExperimentVariant,
    productId: row.product_id,
    reviewId: row.review_id ?? undefined,
    eventType: row.event_type as ReviewExperimentExposureEvent["eventType"],
    createdAt: row.occurred_at,
  }));

  return aggregateReviewExperimentEvents(events);
}

/**
 * control 대비 상대 성과 비교.
 */
export function compareExperimentVariants(
  summaries: ReviewExperimentResultSummary[],
): Array<ReviewExperimentResultSummary & { ctrLift?: number; conversionLift?: number; expandLift?: number }> {
  const byExp = new Map<string, ReviewExperimentResultSummary[]>();
  for (const s of summaries) {
    const list = byExp.get(s.experimentKey) ?? [];
    list.push(s);
    byExp.set(s.experimentKey, list);
  }

  const result: Array<ReviewExperimentResultSummary & { ctrLift?: number; conversionLift?: number; expandLift?: number }> = [];
  for (const list of byExp.values()) {
    const control = list.find((s) => s.variant === "control");
    const ctrBase = control?.ctr ?? 0;
    const convBase = control?.conversionRate ?? 0;
    const expandBase = control?.expandRate ?? 0;
    for (const s of list) {
      const lift: { ctrLift?: number; conversionLift?: number; expandLift?: number } = {};
      if (ctrBase > 0 && s.variant !== "control") {
        lift.ctrLift = Math.round(((s.ctr - ctrBase) / ctrBase) * 10000) / 100;
      }
      if (convBase > 0 && s.variant !== "control") {
        lift.conversionLift = Math.round(((s.conversionRate - convBase) / convBase) * 10000) / 100;
      }
      if (expandBase > 0 && s.variant !== "control") {
        lift.expandLift = Math.round(((s.expandRate - expandBase) / expandBase) * 10000) / 100;
      }
      result.push({ ...s, ...lift });
    }
  }
  return result.sort((a, b) => {
    const c = a.experimentKey.localeCompare(b.experimentKey);
    if (c !== 0) return c;
    return b.impressions - a.impressions;
  });
}
