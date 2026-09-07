import type { AffiliateCategory } from "@/lib/affiliate/planner/types";

export function affiliateCtaLabel(category: AffiliateCategory): string {
  switch (category) {
    case "flight":
      return "항공권 비교하기";
    case "hotel":
      return "숙소 찾아보기";
    case "activity":
      return "이 장소의 투어·티켓 보기";
    case "esim":
      return "여행용 eSIM 보기";
    case "transfer":
      return "공항 이동수단 보기";
    case "rental_car":
      return "렌터카 보기";
    case "insurance":
      return "여행자보험 보기";
    case "travel_goods":
      return "여행 준비물 보기";
    default:
      return "자세히 보기";
  }
}

export function affiliateDefaultTitle(
  category: AffiliateCategory,
  destinationLabel: string | null,
): string {
  const dest = destinationLabel?.trim() || "여행지";
  switch (category) {
    case "flight":
      return `${dest} 항공권`;
    case "hotel":
      return `${dest} 숙소`;
    case "activity":
      return `${dest} 투어·티켓`;
    case "esim":
      return `${dest} 여행용 eSIM`;
    case "transfer":
      return `${dest} 공항 이동`;
    case "rental_car":
      return `${dest} 렌터카`;
    case "insurance":
      return "여행자보험";
    case "travel_goods":
      return "여행 준비물";
    default:
      return dest;
  }
}

export const AFFILIATE_DISCLOSURE_KO =
  "일부 링크를 통해 예약·구매 시 더올투어가 수수료를 받을 수 있습니다.";
