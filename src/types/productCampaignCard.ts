/**
 * PR3: 상품 카드 대표 배지용 캠페인 해석 결과 (taxonomy + fallback).
 */

export type CampaignBadgeTone = "primary" | "highlight" | "neutral";

export type ProductCampaignCardMeta = {
  /** taxonomy 행 id (문자열 토큰만 있을 때는 없음) */
  taxonomyId?: string;
  /** DB name (관리용) */
  name: string;
  /** 카드에 그릴 라벨 */
  displayLabel: string;
  badge_priority: number;
  badge_visible: boolean;
  badge_tone: CampaignBadgeTone;
  /** 카드 피치 1줄. 없으면 레거시 라벨 fallback 가능 */
  description?: string;
  /** campaign taxonomy slug=promotion (시즌/특가) */
  isPromotionCampaign?: boolean;
};
