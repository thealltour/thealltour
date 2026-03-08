/**
 * PR28: 인사이트 기반 운영 제안·개선 우선순위·경고 생성.
 * 순수 함수, UI 의존 없음.
 */
import type { ProductReviewInsightReport } from "@/types/reviewProductInsights";
import type { ReviewForInsight } from "./reviewInsightSelectors";
import type { ReviewAnomalyResult } from "@/types/reviewAnomalies";

export interface InsightWarningsResult {
  trustWarnings: string[];
  anomalyWarnings: string[];
  moderationWarnings: string[];
}

/**
 * 인사이트 리포트 기반 운영 액션 제안 생성.
 */
export function buildOperationalSuggestions(report: ProductReviewInsightReport): string[] {
  const out: string[] = [];
  if (report.topStrengths.length > 0) {
    out.push("상품 상세 페이지에서 강점(일정·가이드·만족도)을 더 전면에 노출해보세요.");
  }
  if (report.recurringComplaints.length > 0) {
    out.push("반복 불만이 있으므로 일정 설명·안내 문구 보강이 필요합니다.");
  }
  if (report.recommendationDrivers.length > 0) {
    out.push("추천 포인트(가족 여행·초보 친화 등)를 대표 후기 영역에 우선 노출하는 것을 검토하세요.");
  }
  if (report.reviewHealth === "risk") {
    out.push("리뷰 품질·이상 신호를 점검하고 필요 시 개선 조치를 진행하세요.");
  }
  if (report.conversionDrivers.length > 0 && !report.conversionDrivers[0].includes("충분하지 않습니다")) {
    out.push("전환에 기여하는 리뷰 특성을 상품 메시지에 반영해보세요.");
  }
  return out.slice(0, 5);
}

/**
 * 실제 상품 개선 우선순위 항목 도출.
 */
export function buildImprovementPriorities(report: ProductReviewInsightReport): string[] {
  const out: string[] = [];
  for (const c of report.recurringComplaints) {
    if (c.includes("대기")) out.push("대기 시간 체감 완화");
    else if (c.includes("식사")) out.push("식사 만족도 개선");
    else if (c.includes("자유시간")) out.push("자유시간 부족 안내 보강");
    else if (c.includes("동선") || c.includes("이동")) out.push("동선 부담에 대한 사전 고지 강화");
    else if (c.includes("일정") && c.includes("빠듯")) out.push("일정 여유 확보 검토");
    else out.push(c.replace(/에 대한 불만이 있습니다\.?$/, "").trim() || "고객 불만 항목 개선");
  }
  if (report.anomalyWarnings.length > 0) {
    out.push("이상 감지 항목 점검 및 대응");
  }
  if (report.moderationWarnings.length > 0) {
    out.push("검토 대상 리뷰 처리 및 정리");
  }
  return [...new Set(out)].slice(0, 7);
}

/**
 * anomaly / moderation / trust 관련 경고 섹션 생성.
 */
export function buildInsightWarnings(sourceData: {
  reviews?: ReviewForInsight[];
  anomalyData?: ReviewAnomalyResult | null;
  moderationData?: { flaggedCount: number; underReviewCount: number };
  trustAggregates?: { lowTrustRatio: number };
}): InsightWarningsResult {
  const trustWarnings: string[] = [];
  const anomalyWarnings: string[] = [];
  const moderationWarnings: string[] = [];

  if (sourceData.trustAggregates && sourceData.trustAggregates.lowTrustRatio > 0.3) {
    trustWarnings.push("신뢰도 낮은 리뷰 비중이 증가하고 있습니다.");
  }
  if (sourceData.trustAggregates && sourceData.trustAggregates.lowTrustRatio > 0.5) {
    trustWarnings.push("전체 리뷰 중 저신뢰 비율이 높아 점검이 필요합니다.");
  }

  if (sourceData.anomalyData) {
    const a = sourceData.anomalyData;
    if (a.ratingDropProducts?.length > 0) {
      anomalyWarnings.push("최근 평점 급락 신호가 감지되었습니다.");
    }
    if (a.suspiciousReviews?.length >= 2) {
      anomalyWarnings.push("스팸/어뷰징 의심 리뷰가 다수 감지되었습니다.");
    }
    if (a.surgeProducts?.length > 0) {
      anomalyWarnings.push("리뷰 급증 상품이 있어 정상 여부 확인이 필요합니다.");
    }
  }

  if (sourceData.moderationData) {
    if (sourceData.moderationData.flaggedCount >= 1) {
      moderationWarnings.push("신고 누적으로 플래그된 리뷰가 있습니다.");
    }
    if (sourceData.moderationData.underReviewCount >= 2) {
      moderationWarnings.push("운영 검토 대상 리뷰가 누적되고 있습니다.");
    }
  }

  return { trustWarnings, anomalyWarnings, moderationWarnings };
}
