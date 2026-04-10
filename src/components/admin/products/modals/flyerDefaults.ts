/**
 * 유인물 초안 기본 문구 (운영 가이드용 placeholder)
 * 이후 PR: 템플릿·DB에서 주입 가능하도록 분리
 */

import type { Product } from "@/types/product";

export const FLYER_DEFAULT_BAGGAGE_TITLE = "수하물·기내 반입 안내";
export const FLYER_DEFAULT_PREPARATION_TITLE = "준비물 체크";
export const FLYER_DEFAULT_INCLUDED_TITLE = "포함 사항";
export const FLYER_DEFAULT_EXCLUDED_TITLE = "불포함 사항";
export const FLYER_DEFAULT_WEATHER_TITLE = "현지 예상 날씨";
export const FLYER_DEFAULT_FOOTER_BRAND = "THE ALL TOUR";
export const FLYER_DEFAULT_MEETING_PLACEHOLDER =
  "미팅 장소·시간은 출발 전 별도 안내 예정입니다.";
export const FLYER_DEFAULT_NOTICE =
  "여행 일정 및 현지 사정에 따라 일정·방문 순서가 조정될 수 있습니다. 현지 안전 수칙과 가이드 안내를 반드시 확인해 주세요.";
export const FLYER_DEFAULT_WEATHER_SUMMARY =
  "계절 및 현지 기상에 맞는 복장과 소지품을 준비해 주세요.";
export const FLYER_DEFAULT_FOOTER_INFO = "문의: 010-2534-7454";
export const FLYER_DEFAULT_BAGGAGE_LINES = [
  "위탁·기내 수하물 허용량·중량은 항공사 규정을 따릅니다. 초과 시 추가 요금이 발생할 수 있습니다.",
  "액체류(100ml 초과)·날카로운 물품·보조배터리 등 기내 반입 제한 품목을 사전에 확인해 주세요.",
  "귀중품은 위탁하지 말고 기내에 휴대하는 것을 권장합니다.",
];
export const FLYER_DEFAULT_PREPARATION_LINES = [
  "여권·신분증 (유효기간·서명 여부 확인)",
  "개인 상비약·필요 시 의사 소견서 등 서류",
  "편한 복장·걷기 좋은 신발",
  "보조배터리·충전기 (기내 휴대 규정 준수)",
];

/** 상품 메타를 보고 유의사항 문구만 살짝 가늠 (완전 룰 엔진 아님) */
export function defaultNoticeForProduct(product: Product): string {
  const blob = [
    product.category?.trim(),
    product.overview_region?.trim(),
    product.theme?.trim(),
    product.title?.trim(),
  ]
    .filter(Boolean)
    .join(" ")
    .toLowerCase();

  const seaLike = /해외|바다|해변|스노클|다이빙|몰디브|발리|괌|사이판|하와이|동남아|푸켓|세부/.test(blob);
  if (seaLike) {
    return `${FLYER_DEFAULT_NOTICE}\n\n해수욕·수상 레저 참여 시 안전요원 지시를 따라 주시고, 자외선·모기 방어용품을 준비해 주세요.`;
  }
  return FLYER_DEFAULT_NOTICE;
}
