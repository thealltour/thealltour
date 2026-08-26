"use client";

import { forwardRef } from "react";
import {
  ProductCheckoutSection,
  type ProductCheckoutHandle,
} from "@/components/products/ProductCheckoutSection";
import { useProductQuote } from "@/components/products/ProductQuoteContext";
import { ENABLE_PRODUCT_OPTIONS } from "@/config/featureFlags";
import { EMPTY_SELECTED_OPTIONS } from "@/lib/pricing/selectedOptions";
import type { Product } from "@/types/product";

export type ConnectedProductCheckoutSectionProps = {
  product?: Product | null;
  productTitle?: string;
  variant?: "default" | "rail";
};

/**
 * 우측 sticky / 시트용 간편 결제.
 * sticky 주황 「결제하기」는 ref.requestPay()로 PortOne V2에 연결한다.
 */
export const ConnectedProductCheckoutSection = forwardRef<
  ProductCheckoutHandle,
  ConnectedProductCheckoutSectionProps
>(function ConnectedProductCheckoutSection({ product, productTitle, variant = "rail" }, ref) {
  const {
    selectedOptions,
    selectedDepartureKey,
    travelerCount,
    requiredGroupsMissing,
    departureRequired,
  } = useProductQuote();

  if (!product?.id) return null;

  const hasOptions =
    ENABLE_PRODUCT_OPTIONS && Boolean(product.options?.groups && product.options.groups.length > 0);

  return (
    <ProductCheckoutSection
      ref={ref}
      productId={product.id}
      productTitle={productTitle?.trim() || product.title || "상품"}
      options={hasOptions ? product.options : undefined}
      selectedOptions={selectedOptions ?? EMPTY_SELECTED_OPTIONS}
      selectedDepartureKey={selectedDepartureKey}
      departureRequired={departureRequired}
      requiredGroupsMissing={requiredGroupsMissing}
      travelerCount={travelerCount}
      variant={variant}
    />
  );
});
