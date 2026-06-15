/**
 * 상품 CTA 문구 (상태별) — PR21 통합, PR-E 전환·일정 강조
 */

export type ProductCtaStatus =
  | "AVAILABLE"
  | "LIMITED"
  | "SOLD_OUT"
  | "CONSULT_REQUIRED";

export type ProductCtaLabelOptions = {
  /** 출발일이 특정 날짜로 고정된 상품이면 AVAILABLE 시 「빠른 문의」 */
  fixedDeparture?: boolean;
};

/** 본문·데스크톱 등 여유 있는 영역 */
export function getProductCtaLabel(
  status: ProductCtaStatus | undefined,
  options?: ProductCtaLabelOptions,
): string {
  if (options?.fixedDeparture && (!status || status === "AVAILABLE")) {
    return "빠른 문의";
  }
  if (!status) return "일정·요금 문의하기";
  switch (status) {
    case "AVAILABLE":
      return "출발일별 정확한 요금 문의";
    case "LIMITED":
      return "잔여 좌석·일정 문의하기";
    case "SOLD_OUT":
      return "대기 문의하기";
    case "CONSULT_REQUIRED":
      return "맞춤 견적 문의하기";
    default:
      return "일정·요금 문의하기";
  }
}

/** 하단 고정(sticky) 등 좁은 폭 — 의미는 동일, 표기만 축약 */
export function getProductCtaStickyPrimaryLabel(
  status: ProductCtaStatus | undefined,
  options?: ProductCtaLabelOptions,
): string {
  if (options?.fixedDeparture && (!status || status === "AVAILABLE")) {
    return "빠른 문의";
  }
  if (!status) return "일정·요금 문의";
  switch (status) {
    case "AVAILABLE":
      return "출발일별 요금 문의";
    case "LIMITED":
      return "잔여·일정 문의";
    case "SOLD_OUT":
      return "대기 문의";
    case "CONSULT_REQUIRED":
      return "맞춤 견적 문의";
    default:
      return "일정·요금 문의";
  }
}
