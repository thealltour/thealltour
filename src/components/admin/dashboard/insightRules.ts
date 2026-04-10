/**
 * 대시보드 자동 인사이트 규칙 (휴리스틱, 외부 API/ML 없음).
 */
import type { AdminAnalyticsOverview } from "@/lib/adminAnalytics";
import type { AdminNotificationItem } from "@/lib/adminNotifications";
import type { DashboardAdminCounts } from "./useDashboardData";
import type { FunnelConversionRates } from "./useFunnelData";

export type InsightSeverity = "high" | "medium" | "low";

export type DashboardInsight = {
  id: string;
  type: string;
  message: string;
  severity: InsightSeverity;
};

export const INSIGHT_THRESHOLDS = {
  /** 전일 대비 문의 증감 % (절대값) */
  inquiryDeltaPercent: 30,
  /** 문의 대비 예약 전환율(%)이 이 값 미만이면 위험 */
  reservationRateFromInquiriesPercent: 5,
  /** 위 전환율 규칙을 적용하기 위한 최소 누적 문의 */
  minInquiriesForReservationRule: 8,
  /** 검색 무결과 건수 절대값 */
  searchNoResultAbsolute: 20,
  /** 검색 무결과 / 검색 실행 비율 */
  searchNoResultRatio: 0.28,
  /** 미읽음 알림 */
  unreadNotifications: 12,
  /** 플래그 리뷰 건수 */
  flaggedReviews: 2,
  /** 고우선 검토 리뷰 */
  highPriorityReviews: 3,
} as const;

export type InsightRuleContext = {
  counts: DashboardAdminCounts | undefined;
  analytics: AdminAnalyticsOverview | null | undefined;
  funnelConversionRates: FunnelConversionRates;
  unreadNotificationCount: number;
  flaggedCount: number;
  highPriorityCount: number;
  recentNotifications: AdminNotificationItem[];
};

function safeSummary(a: AdminAnalyticsOverview | null | undefined) {
  const s = a?.summary;
  return {
    searchSubmits: typeof s?.searchSubmits === "number" ? s.searchSubmits : 0,
    searchNoResultCount: typeof s?.searchNoResultCount === "number" ? s.searchNoResultCount : 0,
  };
}

function ruleDelayedInquiries(ctx: InsightRuleContext): DashboardInsight | null {
  const n = ctx.counts?.delayedInquiries ?? 0;
  if (n <= 0) return null;
  return {
    id: "delayed_inquiries",
    type: "operations",
    severity: "high",
    message: `24시간 이상 지연된 미처리 문의가 ${n}건 있습니다. 우선 확인이 필요합니다.`,
  };
}

function ruleReviewRisk(ctx: InsightRuleContext): DashboardInsight | null {
  const f = ctx.flaggedCount;
  const h = ctx.highPriorityCount;
  if (f >= INSIGHT_THRESHOLDS.flaggedReviews) {
    return {
      id: "review_flagged",
      type: "reviews",
      severity: "high",
      message: `신고·플래그된 리뷰가 ${f}건입니다. 검토 큐를 확인해 주세요.`,
    };
  }
  if (h >= INSIGHT_THRESHOLDS.highPriorityReviews) {
    return {
      id: "review_high_priority",
      type: "reviews",
      severity: "high",
      message: `우선 검토가 필요한 리뷰가 ${h}건 대기 중입니다.`,
    };
  }
  return null;
}

function ruleReservationFunnelDrop(ctx: InsightRuleContext): DashboardInsight | null {
  const inquiries = ctx.counts?.totalInquiries ?? 0;
  const rate = ctx.funnelConversionRates.inquiriesToReserved;
  if (rate === null || inquiries < INSIGHT_THRESHOLDS.minInquiriesForReservationRule) return null;
  if (rate < INSIGHT_THRESHOLDS.reservationRateFromInquiriesPercent) {
    return {
      id: "reservation_rate_low",
      type: "funnel",
      severity: "high",
      message: `누적 문의 대비 예약 확정 전환율이 ${rate}%로 낮습니다. 상담·견적 단계를 점검해 보세요.`,
    };
  }
  return null;
}

function ruleInquirySurge(ctx: InsightRuleContext): DashboardInsight | null {
  const d = ctx.counts?.totalInquiriesDeltaPercent;
  if (typeof d !== "number") return null;
  if (d > INSIGHT_THRESHOLDS.inquiryDeltaPercent) {
    return {
      id: "inquiry_surge",
      type: "inquiries",
      severity: "medium",
      message: `오늘 문의가 전일 대비 약 ${d}% 증가했습니다. 응대 리소스를 확인해 주세요.`,
    };
  }
  return null;
}

function ruleInquiryDrop(ctx: InsightRuleContext): DashboardInsight | null {
  const d = ctx.counts?.totalInquiriesDeltaPercent;
  if (typeof d !== "number") return null;
  if (d < -INSIGHT_THRESHOLDS.inquiryDeltaPercent) {
    return {
      id: "inquiry_drop",
      type: "inquiries",
      severity: "medium",
      message: `오늘 문의가 전일 대비 약 ${Math.abs(d)}% 감소했습니다. 유입·캠페인 변화를 함께 보세요.`,
    };
  }
  return null;
}

function ruleSearchNoResults(ctx: InsightRuleContext): DashboardInsight | null {
  const { searchSubmits, searchNoResultCount } = safeSummary(ctx.analytics);
  if (searchNoResultCount <= 0) return null;
  const ratio = searchSubmits > 0 ? searchNoResultCount / searchSubmits : 1;
  if (
    searchNoResultCount >= INSIGHT_THRESHOLDS.searchNoResultAbsolute ||
    (searchSubmits >= 5 && ratio >= INSIGHT_THRESHOLDS.searchNoResultRatio)
  ) {
    return {
      id: "search_no_result",
      type: "search",
      severity: "medium",
      message: `검색 무결과 이벤트가 ${searchNoResultCount}건입니다. 인기 키워드·상품 매칭을 점검해 보세요.`,
    };
  }
  return null;
}

function ruleUnreadBurst(ctx: InsightRuleContext): DashboardInsight | null {
  const n = ctx.unreadNotificationCount;
  if (n < INSIGHT_THRESHOLDS.unreadNotifications) return null;
  return {
    id: "unread_notifications",
    type: "notifications",
    severity: "medium",
    message: `미읽음 알림이 ${n}건입니다. 알림 센터를 정리하면 놓치는 이슈를 줄일 수 있습니다.`,
  };
}

function rulePendingBacklog(ctx: InsightRuleContext): DashboardInsight | null {
  const p = ctx.counts?.pendingInquiries ?? 0;
  if (p < 25) return null;
  return {
    id: "pending_backlog",
    type: "operations",
    severity: "low",
    message: `미처리 문의가 ${p}건입니다. 우선순위 패널과 함께 처리 계획을 세워 보세요.`,
  };
}

function ruleDelayedTrend(ctx: InsightRuleContext): DashboardInsight | null {
  const d = ctx.counts?.delayedInquiriesDeltaPercent;
  if (typeof d !== "number" || d <= 40) return null;
  return {
    id: "delayed_surge_today",
    type: "operations",
    severity: "medium",
    message: `오늘 기준 지연 문의 건수가 전일 대비 ${d}% 이상 늘었습니다.`,
  };
}

const RULES: Array<(ctx: InsightRuleContext) => DashboardInsight | null> = [
  ruleDelayedInquiries,
  ruleReviewRisk,
  ruleReservationFunnelDrop,
  ruleInquirySurge,
  ruleInquiryDrop,
  ruleSearchNoResults,
  ruleUnreadBurst,
  ruleDelayedTrend,
  rulePendingBacklog,
];

const SEVERITY_ORDER: Record<InsightSeverity, number> = {
  high: 0,
  medium: 1,
  low: 2,
};

/**
 * 규칙을 모두 실행하고 중요도·안정적 순서로 정렬한 뒤 상한만큼 반환합니다.
 */
export function collectDashboardInsights(ctx: InsightRuleContext, maxItems = 5): DashboardInsight[] {
  const seen = new Set<string>();
  const out: DashboardInsight[] = [];
  for (const run of RULES) {
    const item = run(ctx);
    if (item && !seen.has(item.id)) {
      seen.add(item.id);
      out.push(item);
    }
  }
  out.sort((a, b) => {
    const s = SEVERITY_ORDER[a.severity] - SEVERITY_ORDER[b.severity];
    if (s !== 0) return s;
    return a.id.localeCompare(b.id);
  });
  return out.slice(0, maxItems);
}
