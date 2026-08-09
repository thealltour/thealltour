import {
  isGolfChannelProduct,
  isGolfProductLineTaxonomy,
} from "@/lib/products/golfChannel";
import type { Product } from "@/types/product";

export type CheckoutBenefitMode = "golf_coupon" | "package_points";

export type CheckoutBenefitProduct = {
  id?: string | null;
  title?: string | null;
  category?: string | null;
  product_line_id?: string | null;
};

/** 골프투어=쿠폰팩(인원할인), 일반 패키지=포인트 */
export function resolveCheckoutBenefitMode(
  product: CheckoutBenefitProduct,
  taxonomyNameMap: Record<string, string> = {},
): CheckoutBenefitMode {
  const asProduct = {
    id: product.id ?? "unknown",
    title: product.title ?? "",
    category: product.category ?? null,
    product_line_id: product.product_line_id ?? null,
  } as Product;

  if (isGolfChannelProduct(asProduct, taxonomyNameMap)) {
    return "golf_coupon";
  }

  // 클라이언트 등 taxonomy map이 비어 있을 때 category 문자열로 2차 판정
  if (isGolfProductLineTaxonomy({ name: product.category ?? "" })) {
    return "golf_coupon";
  }

  return "package_points";
}

export function isGolfCouponBenefitMode(mode: CheckoutBenefitMode): boolean {
  return mode === "golf_coupon";
}
