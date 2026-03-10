/**
 * 상품 상세 CTA 문구 (상태별 전환 유도)
 */

export type ProductDetailStatusTag =
  | "AVAILABLE"
  | "LIMITED"
  | "SOLD_OUT"
  | "CONSULT_REQUIRED";

export function getProductDetailCtaLabel(status: ProductDetailStatusTag | undefined): string {
  if (!status) return "상담 문의하기";
  switch (status) {
    case "AVAILABLE":
      return "예약 상담하기";
    case "LIMITED":
      return "잔여 확인 문의";
    case "SOLD_OUT":
      return "대기 문의하기";
    case "CONSULT_REQUIRED":
      return "견적 문의하기";
    default:
      return "상담 문의하기";
  }
}
