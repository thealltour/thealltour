/**
 * 카카오모먼트 CSV 임포트 — API/클라이언트 공유 모델
 */

export type KakaoMomentCreativeRow = {
  creativeName: string;
  creativeId: string | null;
  status: string | null;
  adGroupName: string | null;
  adGroupId: string | null;
  campaignName: string | null;
  campaignId: string | null;
  cost: number;
  impressions: number;
  clicks: number;
  ctr: number;
  reach: number;
  cpc: number;
};

export type KakaoMomentParseSummary = {
  rowCount: number;
  totalCost: number;
  totalImpressions: number;
  totalClicks: number;
  avgCtr: number;
  avgCpc: number;
  totalReach: number;
};

export type KakaoMomentParseResult = {
  rows: KakaoMomentCreativeRow[];
  summary: KakaoMomentParseSummary;
  warnings: string[];
};

export type KakaoMomentImportListItem = {
  id: string;
  periodStart: string;
  periodEnd: string;
  filename: string;
  uploadedBy: string | null;
  createdAt: string;
  creativeCount: number;
  totalCost: number;
  totalClicks: number;
  totalImpressions: number;
};

export type KakaoMomentCampaignRankRow = {
  key: string;
  label: string;
  cost: number;
  impressions: number;
  clicks: number;
  ctr: number;
  cpc: number;
};

export type KakaoMomentCreativeRankRow = {
  key: string;
  creativeName: string;
  campaignName: string;
  cost: number;
  impressions: number;
  clicks: number;
  ctr: number;
  cpc: number;
};

/** kakao-sync analytics에 붙는 Moment 블록 */
export type KakaoMomentAnalyticsBlock = {
  importId: string;
  periodStart: string;
  periodEnd: string;
  filename: string;
  summary: {
    cost: number;
    impressions: number;
    clicks: number;
    ctr: number;
    cpc: number;
    reach: number;
    bizboardLeadsInPeriod: number;
    newSignupsInPeriod: number;
    cpaLead: number | null;
    cpaSignup: number | null;
  };
  campaigns: KakaoMomentCampaignRankRow[];
  creatives: KakaoMomentCreativeRankRow[];
};

export function formatWon(n: number): string {
  if (!Number.isFinite(n)) return "—";
  return `${Math.round(n).toLocaleString("ko-KR")}원`;
}

export function formatMomentRate(rate: number, digits = 2): string {
  if (!Number.isFinite(rate) || rate <= 0) return "0%";
  return `${(rate * 100).toFixed(digits)}%`;
}
