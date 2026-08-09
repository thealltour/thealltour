export type DiscountTier = "WELCOME" | "RETURNING";

export const DISCOUNT_RATES = {
  WELCOME: 50_000,
  RETURNING: 30_000,
} as const;

export type PaxDiscountResult = {
  tier: DiscountTier;
  unitDiscount: number;
  totalDiscount: number;
  label: string;
};

function buildLabel(tier: DiscountTier, pax: number, unitDiscount: number): string {
  const manWon = Math.round(unitDiscount / 10_000);
  return tier === "WELCOME"
    ? `[웰컴 혜택] 1인당 ${manWon}만원 × ${pax}명 할인`
    : `[회원 혜택] 1인당 ${manWon}만원 × ${pax}명 할인`;
}

/** 유저의 확정 예약 이력 기반 할인 단가 및 총 할인액 계산 (순수 함수) */
export function calculatePaxDiscount(params: {
  travelerCount: number;
  hasPreviousBooking: boolean;
}): PaxDiscountResult {
  const pax = Math.max(1, Math.floor(params.travelerCount || 1));
  const tier: DiscountTier = params.hasPreviousBooking ? "RETURNING" : "WELCOME";
  const unitDiscount = DISCOUNT_RATES[tier];
  const totalDiscount = unitDiscount * pax;

  return {
    tier,
    unitDiscount,
    totalDiscount,
    label: buildLabel(tier, pax, unitDiscount),
  };
}

/** 보유 쿠폰팩 단가 기준 할인 (체크아웃 진실 소스) */
export function calculatePaxDiscountFromPack(params: {
  travelerCount: number;
  tier: DiscountTier;
  unitAmount: number;
}): PaxDiscountResult {
  const pax = Math.max(1, Math.floor(params.travelerCount || 1));
  const unitDiscount = Math.max(0, Math.floor(params.unitAmount));
  const totalDiscount = unitDiscount * pax;
  return {
    tier: params.tier,
    unitDiscount,
    totalDiscount,
    label: buildLabel(params.tier, pax, unitDiscount),
  };
}

/** 예약금 유지를 위해 프로모션 할인 상한 캡 (포인트와 무관 — 포인트는 promo 이후에 적용) */
export function capPaxDiscountAmount(params: {
  quoteTotal: number;
  rawPaxDiscount: number;
  depositAmount: number;
}): number {
  const { quoteTotal, rawPaxDiscount, depositAmount } = params;
  const maxDiscount = Math.max(0, quoteTotal - depositAmount);
  return Math.min(Math.max(0, rawPaxDiscount), maxDiscount);
}
