/**
 * 카카오싱크 성과 API/클라이언트 공유 모델
 */

import type {
  KakaoOAuthFailureBreakdownRow,
  KakaoOAuthFailureRecentRow,
} from "@/lib/adminLandings/kakaoOAuthFailureStats";
import type { KakaoMomentAnalyticsBlock } from "@/lib/adminLandings/kakaoMomentModels";

export type KakaoSyncAnalyticsRange = "7d" | "30d" | "all";

export type {
  KakaoOAuthFailureBreakdownRow,
  KakaoOAuthFailureRecentRow,
};

export type KakaoSyncAnalyticsSummary = {
  landingViews: number;
  ctaClicks: number;
  ctr: number;
  oauthStarts: number;
  /** 콜백 성공(신규·기존·계정연결 대기 포함) */
  oauthSuccess: number;
  /** 동의 취소·state 오류·서버 예외 등 */
  oauthFailed: number;
  /** 기존 회원 OAuth 로그인 완료 */
  loginReturning: number;
  /** 로컬 계정 연결 대기(link_account) */
  oauthNeedsLink: number;
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
  /** 기존 로그인 — 차트 보조 시리즈 */
  returning: number;
  /** OAuth 실패 — 차트 보조 시리즈 */
  oauthFailed: number;
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
  /** OAuth 실패 reason/oauthError 집계 */
  oauthFailureBreakdown: KakaoOAuthFailureBreakdownRow[];
  /** 최근 OAuth 실패 샘플 (최신순) */
  oauthFailureRecent: KakaoOAuthFailureRecentRow[];
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
