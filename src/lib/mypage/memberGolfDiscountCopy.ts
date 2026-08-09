import {
  DISCOUNT_RATES,
  type DiscountTier,
} from "@/lib/payments/calculatePaxDiscount";

export type MemberGolfDiscountCopy = {
  tier: DiscountTier;
  unitAmount: number;
  headline: string;
  subline: string;
  badgeLabel: string;
};

/** 마이페이지용 골프투어 1인당 할인 카피 (체크아웃 티어와 동일 단가) */
export function getMemberGolfDiscountCopy(hasPreviousBooking: boolean): MemberGolfDiscountCopy {
  const tier: DiscountTier = hasPreviousBooking ? "RETURNING" : "WELCOME";
  const unitAmount = DISCOUNT_RATES[tier];
  const manWon = Math.round(unitAmount / 10_000);

  return {
    tier,
    unitAmount,
    headline: `1인당 ${manWon}만원 할인`,
    subline: "골프투어 예약 시 인원만큼 자동 적용",
    badgeLabel: "골프투어 혜택",
  };
}
