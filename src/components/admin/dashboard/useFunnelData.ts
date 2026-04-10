"use client";

import { useMemo } from "react";
import type { AdminAnalyticsOverview } from "@/lib/adminAnalytics";
import type { DashboardAdminCounts } from "./useDashboardData";

export type FunnelStepId = "landing" | "clicks" | "search" | "inquiries" | "reserved" | "completed";

export type FunnelStep = {
  id: FunnelStepId;
  label: string;
  value: number;
};

export type FunnelConversion = {
  fromId: FunnelStepId;
  toId: FunnelStepId;
  /** 0~100, 분모 0이면 null */
  percent: number | null;
};

export type FunnelConversionRates = {
  landingToClicks: number | null;
  clicksToSearch: number | null;
  searchToInquiries: number | null;
  inquiriesToReserved: number | null;
  reservedToCompleted: number | null;
};

export type FunnelModel = {
  steps: FunnelStep[];
  conversions: FunnelConversion[];
  conversionRates: FunnelConversionRates;
};

function safeSummary(analytics: AdminAnalyticsOverview | null | undefined) {
  const s = analytics?.summary;
  return {
    landingViews: typeof s?.landingViews === "number" ? s.landingViews : 0,
    productCardClicks: typeof s?.productCardClicks === "number" ? s.productCardClicks : 0,
    searchSubmits: typeof s?.searchSubmits === "number" ? s.searchSubmits : 0,
  };
}

function pct(numerator: number, denominator: number): number | null {
  if (denominator <= 0) return null;
  return Math.round((numerator / denominator) * 1000) / 10;
}

/**
 * analytics.summary(선택 기간) + counts(운영 누적)로 퍼널 단계·단계 간 전환율을 만듭니다.
 */
export function buildFunnelModel(
  analytics: AdminAnalyticsOverview | null | undefined,
  counts: DashboardAdminCounts | undefined,
): FunnelModel {
  const { landingViews, productCardClicks, searchSubmits } = safeSummary(analytics);
  const totalInquiries = counts?.totalInquiries ?? 0;
  const reservedInquiries = counts?.reservedInquiries ?? 0;
  const completedInquiries = counts?.completedInquiries ?? 0;

  const steps: FunnelStep[] = [
    { id: "landing", label: "랜딩 조회", value: landingViews },
    { id: "clicks", label: "상품 카드 클릭", value: productCardClicks },
    { id: "search", label: "검색 실행", value: searchSubmits },
    { id: "inquiries", label: "문의(누적)", value: totalInquiries },
    { id: "reserved", label: "예약 확정", value: reservedInquiries },
    { id: "completed", label: "여행 완료", value: completedInquiries },
  ];

  const c0 = pct(productCardClicks, landingViews);
  const c1 = pct(searchSubmits, productCardClicks);
  const c2 = pct(totalInquiries, searchSubmits);
  const c3 = pct(reservedInquiries, totalInquiries);
  const c4 = pct(completedInquiries, reservedInquiries);

  const conversions: FunnelConversion[] = [
    { fromId: "landing", toId: "clicks", percent: c0 },
    { fromId: "clicks", toId: "search", percent: c1 },
    { fromId: "search", toId: "inquiries", percent: c2 },
    { fromId: "inquiries", toId: "reserved", percent: c3 },
    { fromId: "reserved", toId: "completed", percent: c4 },
  ];

  const conversionRates: FunnelConversionRates = {
    landingToClicks: c0,
    clicksToSearch: c1,
    searchToInquiries: c2,
    inquiriesToReserved: c3,
    reservedToCompleted: c4,
  };

  return { steps, conversions, conversionRates };
}

export function useFunnelModel(
  analytics: AdminAnalyticsOverview | null | undefined,
  counts: DashboardAdminCounts | undefined,
): FunnelModel {
  return useMemo(() => buildFunnelModel(analytics, counts), [analytics, counts]);
}
