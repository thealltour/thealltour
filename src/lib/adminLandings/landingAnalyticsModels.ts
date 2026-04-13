/**
 * 랜딩 성과 API/클라이언트 공유 모델 (server-only 의존 없음).
 * 클라이언트 컴포넌트는 이 파일만 import 하세요.
 */

export type LandingAnalyticsRange = "7d" | "30d" | "all";

export type LandingAnalyticsSort = "submits" | "ctr";

export type LandingAnalyticsItem = {
  landingSlug: string;
  landingId: string | null;
  title: string;
  templateType: string;
  taxonomyType: string | null;
  views: number;
  clicks: number;
  submits: number;
  ctr: number;
  cvr: number;
};

export type LandingAnalyticsSummary = {
  totalViews: number;
  totalClicks: number;
  totalSubmits: number;
  avgCTR: number;
  avgCVR: number;
};

export type LandingAnalyticsTrendPoint = {
  date: string;
  views: number;
  clicks: number;
  submits: number;
  ctr: number;
  cvr: number;
};

export type LandingAnalyticsTopPerformers = {
  bySubmits: LandingAnalyticsItem[];
  byCTR: LandingAnalyticsItem[];
  byCVR: LandingAnalyticsItem[];
};

export type LandingAnalyticsResponse = {
  summary: LandingAnalyticsSummary;
  items: LandingAnalyticsItem[];
  trend: LandingAnalyticsTrendPoint[];
  topPerformers: LandingAnalyticsTopPerformers;
};

export function parseLandingAnalyticsRangeParam(v: string | null): LandingAnalyticsRange {
  if (v === "7d" || v === "30d" || v === "all") return v;
  return "30d";
}

export function parseLandingAnalyticsSortParam(v: string | null): LandingAnalyticsSort {
  if (v === "ctr") return "ctr";
  return "submits";
}
