/**
 * 카카오싱크 성과 API/클라이언트 공유 모델
 */

import type { KakaoMomentAnalyticsBlock } from "@/lib/adminLandings/kakaoMomentModels";

export type KakaoSyncAnalyticsRange = "7d" | "30d" | "all";

export type KakaoSyncAnalyticsSummary = {
  landingViews: number;
  ctaClicks: number;
  ctr: number;
  oauthStarts: number;
  newSignups: number;
  welcomeGrants: number;
  channelAdded: number;
  channelKnown: number;
  channelAddRate: number;
  productClicks: number;
  bizboardLeads: number;
  oauthToSignupRate: number;
  viewToSignupRate: number;
};

export type KakaoSyncAnalyticsTrendPoint = {
  date: string;
  views: number;
  clicks: number;
  oauthStarts: number;
  signups: number;
};

export type KakaoSyncAnalyticsCampaignRow = {
  key: string;
  label: string;
  templateType: string;
  views: number;
  clicks: number;
  ctr: number;
  signups: number;
};

export type KakaoSyncAnalyticsResponse = {
  summary: KakaoSyncAnalyticsSummary;
  trend: KakaoSyncAnalyticsTrendPoint[];
  campaigns: KakaoSyncAnalyticsCampaignRow[];
  /** 월간 Moment CSV 임포트 기준 광고 효율 (없으면 null) */
  moment: KakaoMomentAnalyticsBlock | null;
};

export function parseKakaoSyncAnalyticsRangeParam(v: string | null): KakaoSyncAnalyticsRange {
  if (v === "7d" || v === "30d" || v === "all") return v;
  return "30d";
}

export function formatKakaoSyncRate(rate: number, digits = 1): string {
  if (!Number.isFinite(rate) || rate <= 0) return "0%";
  return `${(rate * 100).toFixed(digits)}%`;
}
