/**
 * PR29: 리뷰 시스템 도메인 이벤트 생성.
 * anomaly / moderation / report / trust / conversion / insight / experiment → ReviewSystemEvent[]
 */
import type { ReviewSystemEvent } from "@/types/reviewNotifications";
import type { ReviewNotificationSeverity } from "@/types/reviewNotifications";
import type { ReviewAnomalyResult } from "@/types/reviewAnomalies";
import {
  REVIEW_ANOMALY_ALERT_MIN_REVIEWS,
  REVIEW_CRITICAL_RISK_SCORE_THRESHOLD,
  REVIEW_CRITICAL_REPORT_THRESHOLD,
  REVIEW_CONVERSION_DROP_ALERT_THRESHOLD,
  REVIEW_INSIGHT_RECURRING_COMPLAINT_WARNING,
  REVIEW_MODERATION_FLAGGED_WARNING_COUNT,
  REVIEW_MODERATION_UNDER_REVIEW_WARNING_COUNT,
} from "./reviewNotificationConstants";

export interface ReviewSystemEventSourceData {
  anomalyResults?: ReviewAnomalyResult | null;
  moderationQueue?: Array<{ product_id?: string | null; status?: string; report_count?: number; id: string }>;
  reportSummaries?: Array<{ reviewId: string; productId?: string; reportCount: number }>;
  trustSignals?: { lowTrustRatioByProduct?: Map<string, number>; highRiskReviewIds?: string[] };
  conversionSummaries?: Array<{ productId: string; reviewAssistRate?: number; reviewInteractions?: number }>;
  insightReports?: Array<{ productId: string; reviewHealth: string; recurringComplaintsCount: number }>;
  experimentSummaries?: Array<{ experimentKey: string; variant: string; conversionRate: number; conversionLift?: number }>;
}

const now = () => new Date().toISOString();

function event(
  eventKey: string,
  category: ReviewSystemEvent["category"],
  severity: ReviewNotificationSeverity,
  title: string,
  message: string,
  opts: { productId?: string; reviewId?: string; reasons?: string[]; metadata?: Record<string, unknown> } = {},
): ReviewSystemEvent {
  return {
    eventKey,
    category,
    severity,
    title,
    message,
    occurredAt: now(),
    ...opts,
  };
}

/**
 * anomaly 결과 → 운영 이벤트.
 */
export function buildAnomalyEvents(anomalyResults: ReviewAnomalyResult | null | undefined): ReviewSystemEvent[] {
  const out: ReviewSystemEvent[] = [];
  if (!anomalyResults) return out;

  for (const p of anomalyResults.ratingDropProducts ?? []) {
    if (p.previousCount < REVIEW_ANOMALY_ALERT_MIN_REVIEWS || p.recentCount < REVIEW_ANOMALY_ALERT_MIN_REVIEWS)
      continue;
    const severity: ReviewNotificationSeverity = p.ratingDelta <= -1.5 ? "critical" : p.ratingDelta <= -1 ? "warning" : "info";
    out.push(
      event(
        "anomaly_rating_drop",
        "anomaly",
        severity,
        "평점 급락 상품 감지",
        `상품 ${p.productId}의 최근 평균 평점이 ${p.ratingDelta}점 하락했습니다. (최근 ${p.recentAverageRating}, 이전 ${p.previousAverageRating})`,
        { productId: p.productId, reasons: [`ratingDelta=${p.ratingDelta}`] },
      ),
    );
  }

  for (const p of anomalyResults.surgeProducts ?? []) {
    const severity: ReviewNotificationSeverity = p.surgeRatio >= 3 ? "warning" : "info";
    out.push(
      event(
        "anomaly_review_surge",
        "anomaly",
        severity,
        "리뷰 급증 상품 감지",
        `상품 ${p.productId} 최근 7일 리뷰 ${p.recent7dCount}건 (이전 대비 ${p.surgeRatio}배)`,
        { productId: p.productId },
      ),
    );
  }

  for (const r of anomalyResults.suspiciousReviews ?? []) {
    if (r.riskScore < 3) continue;
    const severity: ReviewNotificationSeverity =
      r.riskScore >= REVIEW_CRITICAL_RISK_SCORE_THRESHOLD ? "critical" : r.riskScore >= 5 ? "warning" : "info";
    out.push(
      event(
        "anomaly_suspicious_review",
        "anomaly",
        severity,
        "의심 리뷰 감지",
        `리뷰 ${r.id}: ${r.reasons?.slice(0, 2).join(", ") ?? "위험 점수 " + r.riskScore}`,
        { productId: r.productId, reviewId: r.id, reasons: r.reasons },
      ),
    );
  }
  return out;
}

/**
 * 검토 대기열 → 운영 이벤트.
 */
export function buildModerationEvents(
  moderationQueue: Array<{ product_id?: string | null; status?: string; report_count?: number; id: string }> | null | undefined,
): ReviewSystemEvent[] {
  const out: ReviewSystemEvent[] = [];
  if (!moderationQueue?.length) return out;
  const flagged = moderationQueue.filter((r) => r.status === "flagged");
  const underReview = moderationQueue.filter((r) => r.status !== "submitted" || (r.report_count ?? 0) > 0);
  if (flagged.length >= REVIEW_MODERATION_FLAGGED_WARNING_COUNT) {
    out.push(
      event(
        "moderation_flagged_accumulated",
        "moderation",
        flagged.length >= 5 ? "critical" : "warning",
        "플래그 리뷰 누적",
        `검토 대상 중 플래그된 리뷰가 ${flagged.length}건입니다.`,
        { metadata: { flaggedCount: flagged.length } },
      ),
    );
  }
  if (underReview.length >= REVIEW_MODERATION_UNDER_REVIEW_WARNING_COUNT) {
    out.push(
      event(
        "moderation_under_review_accumulated",
        "moderation",
        "warning",
        "검토 대기 누적",
        `검토/신고 대상 리뷰가 ${underReview.length}건입니다.`,
        { metadata: { underReviewCount: underReview.length } },
      ),
    );
  }
  return out;
}

/**
 * 신고 요약 → 운영 이벤트.
 */
export function buildReportEvents(
  reportSummaries: Array<{ reviewId: string; productId?: string; reportCount: number }> | null | undefined,
): ReviewSystemEvent[] {
  const out: ReviewSystemEvent[] = [];
  if (!reportSummaries?.length) return out;
  for (const s of reportSummaries) {
    if (s.reportCount < REVIEW_CRITICAL_REPORT_THRESHOLD) continue;
    out.push(
      event(
        "report_threshold_exceeded",
        "report",
        s.reportCount >= 10 ? "critical" : "warning",
        "리뷰 신고 누적",
        `리뷰 ${s.reviewId} 신고 ${s.reportCount}건으로 임계치를 초과했습니다.`,
        { reviewId: s.reviewId, productId: s.productId, reasons: [`reportCount=${s.reportCount}`] },
      ),
    );
  }
  return out;
}

/**
 * trust 신호 → 운영 이벤트.
 */
export function buildTrustEvents(trustSignals: {
  lowTrustRatioByProduct?: Map<string, number>;
  highRiskReviewIds?: string[];
} | null | undefined): ReviewSystemEvent[] {
  const out: ReviewSystemEvent[] = [];
  if (!trustSignals) return out;
  if (trustSignals.lowTrustRatioByProduct) {
    for (const [productId, ratio] of trustSignals.lowTrustRatioByProduct) {
      if (ratio < 0.2) continue;
      const severity: ReviewNotificationSeverity =
        ratio >= 0.5 ? "critical" : ratio >= 0.3 ? "warning" : "info";
      out.push(
        event(
          "trust_low_ratio",
          "trust",
          severity,
          "저신뢰 리뷰 비율 증가",
          `상품 ${productId}의 저신뢰 리뷰 비율이 ${(ratio * 100).toFixed(0)}%입니다.`,
          { productId, metadata: { lowTrustRatio: ratio } },
        ),
      );
    }
  }
  if (trustSignals.highRiskReviewIds?.length && trustSignals.highRiskReviewIds.length >= 2) {
    out.push(
      event(
        "trust_high_risk_reviews",
        "trust",
        "warning",
        "고위험 리뷰 다수",
        `Trust Score 고위험 리뷰 ${trustSignals.highRiskReviewIds.length}건이 감지되었습니다.`,
        { metadata: { reviewIds: trustSignals.highRiskReviewIds.slice(0, 5) } },
      ),
    );
  }
  return out;
}

/**
 * 전환 요약 → 운영 이벤트.
 */
export function buildConversionEvents(
  conversionSummaries: Array<{ productId: string; reviewAssistRate?: number; reviewInteractions?: number }> | null | undefined,
): ReviewSystemEvent[] {
  const out: ReviewSystemEvent[] = [];
  if (!conversionSummaries?.length) return out;
  for (const s of conversionSummaries) {
    if ((s.reviewInteractions ?? 0) < 20) continue;
    const rate = s.reviewAssistRate ?? 0;
    if (rate >= REVIEW_CONVERSION_DROP_ALERT_THRESHOLD) continue;
    if (rate < 0.01) {
      out.push(
        event(
          "conversion_low_assist",
          "conversion",
          "warning",
          "리뷰 전환 기여 저조",
          `상품 ${s.productId}의 리뷰 상호작용 대비 전환 기여율이 매우 낮습니다.`,
          { productId: s.productId, metadata: { reviewAssistRate: rate } },
        ),
      );
    }
  }
  return out;
}

/**
 * 인사이트 리포트 → 운영 이벤트.
 */
export function buildInsightEvents(
  insightReports: Array<{ productId: string; reviewHealth: string; recurringComplaintsCount: number }> | null | undefined,
): ReviewSystemEvent[] {
  const out: ReviewSystemEvent[] = [];
  if (!insightReports?.length) return out;
  for (const r of insightReports) {
    if (r.reviewHealth === "risk") {
      out.push(
        event(
          "insight_risk_product",
          "insight",
          "critical",
          "인사이트: Risk 상품",
          `상품 ${r.productId}가 리뷰 인사이트 기준 Risk로 분류되었습니다.`,
          { productId: r.productId },
        ),
      );
    }
    if (r.recurringComplaintsCount >= REVIEW_INSIGHT_RECURRING_COMPLAINT_WARNING) {
      out.push(
        event(
          "insight_recurring_complaints",
          "insight",
          "warning",
          "반복 불만 누적",
          `상품 ${r.productId}에서 반복 불만 ${r.recurringComplaintsCount}건이 감지되었습니다.`,
          { productId: r.productId, metadata: { recurringComplaintsCount: r.recurringComplaintsCount } },
        ),
      );
    }
  }
  return out;
}

/**
 * 실험 요약 → 운영 이벤트.
 */
export function buildExperimentEvents(
  experimentSummaries: Array<{ experimentKey: string; variant: string; conversionRate: number; conversionLift?: number }> | null | undefined,
): ReviewSystemEvent[] {
  const out: ReviewSystemEvent[] = [];
  if (!experimentSummaries?.length) return out;
  for (const s of experimentSummaries) {
    const lift = s.conversionLift ?? 0;
    if (lift <= -20) {
      out.push(
        event(
          "experiment_variant_underperforming",
          "experiment",
          lift <= -40 ? "warning" : "info",
          "실험 variant 성과 저조",
          `실험 ${s.experimentKey} variant ${s.variant}가 control 대비 전환율이 ${lift}% 낮습니다.`,
          { metadata: { experimentKey: s.experimentKey, variant: s.variant, conversionLift: lift } },
        ),
      );
    }
  }
  return out;
}

/**
 * 전체 소스 데이터 → 표준 이벤트 배열.
 */
export function buildReviewSystemEvents(sourceData: ReviewSystemEventSourceData): ReviewSystemEvent[] {
  const anomaly = buildAnomalyEvents(sourceData.anomalyResults);
  const moderation = buildModerationEvents(sourceData.moderationQueue);
  const report = buildReportEvents(sourceData.reportSummaries);
  const trust = buildTrustEvents(sourceData.trustSignals);
  const conversion = buildConversionEvents(sourceData.conversionSummaries);
  const insight = buildInsightEvents(sourceData.insightReports);
  const experiment = buildExperimentEvents(sourceData.experimentSummaries);
  return [
    ...anomaly,
    ...moderation,
    ...report,
    ...trust,
    ...conversion,
    ...insight,
    ...experiment,
  ];
}
