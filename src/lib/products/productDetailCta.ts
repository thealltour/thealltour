/**
 * 상품 상세 CTA 문구 — getProductCtaLabel과 동일 정책(PR-E)
 */

import { getProductCtaLabel, type ProductCtaStatus } from "@/lib/products/getProductCtaLabel";

export type ProductDetailStatusTag = ProductCtaStatus;

export function getProductDetailCtaLabel(status: ProductDetailStatusTag | undefined): string {
  return getProductCtaLabel(status);
}
