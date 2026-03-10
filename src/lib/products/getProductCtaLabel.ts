/**
 * 상품 CTA 문구 (상태별) — PR21 통합
 * 상단 / sticky / 일정 하단 모두 동일 문구 사용
 */

export type ProductCtaStatus =
  | "AVAILABLE"
  | "LIMITED"
  | "SOLD_OUT"
  | "CONSULT_REQUIRED";

export function getProductCtaLabel(status: ProductCtaStatus | undefined): string {
  if (!status) return "상담 문의하기";
  switch (status) {
    case "AVAILABLE":
      return "예약 상담하기";
    case "LIMITED":
      return "잔여 좌석 문의하기";
    case "SOLD_OUT":
      return "대기 문의하기";
    case "CONSULT_REQUIRED":
      return "견적 문의하기";
    default:
      return "상담 문의하기";
  }
}
