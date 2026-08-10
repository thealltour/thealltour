import {
  KAKAO_SYNC_COIN_BENEFIT_WON,
  KAKAO_SYNC_TEAM_DISCOUNT_WON,
  KAKAO_SYNC_TEAM_PAX,
} from "@/lib/hardcodedLandings/kakaoSyncGolf/config";

export type TeamCouponBenefitPrices = {
  listTeamWon: number;
  memberTeamWon: number;
  discountWon: number;
  pax: number;
};

/** 1인 정가 → 4인 팀 정가/쿠폰적용가 (카카오싱크 상품 카드) */
export function buildTeamCouponBenefitPrices(listPricePerPersonWon: number): TeamCouponBenefitPrices {
  const listTeamWon = Math.max(0, Math.round(listPricePerPersonWon) * KAKAO_SYNC_TEAM_PAX);
  const discountWon = KAKAO_SYNC_TEAM_DISCOUNT_WON;
  const memberTeamWon = Math.max(0, listTeamWon - discountWon);
  return {
    listTeamWon,
    memberTeamWon,
    discountWon,
    pax: KAKAO_SYNC_TEAM_PAX,
  };
}

export { KAKAO_SYNC_COIN_BENEFIT_WON, KAKAO_SYNC_TEAM_DISCOUNT_WON, KAKAO_SYNC_TEAM_PAX };
