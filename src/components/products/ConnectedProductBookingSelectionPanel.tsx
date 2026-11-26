"use client";

import { useEffect, useMemo } from "react";
import { useConsultModal } from "@/components/inquiry/ConsultModal";
import { ProductBookingSelectionPanel } from "@/components/products/ProductBookingSelectionPanel";
import { useProductQuote } from "@/components/products/ProductQuoteContext";
import { ENABLE_PRODUCT_OPTIONS } from "@/config/featureFlags";
import {
  EMPTY_SELECTED_OPTIONS,
  setSingleOptionSelection,
  toggleMultiOption,
} from "@/lib/pricing/selectedOptions";
import {
  isConsultOnlyProductOption,
  stripConsultOnlySelections,
} from "@/lib/products/optionCurrency";
import { resolveDepartureUiForProduct } from "@/lib/products/resolveProductBookingUx";
import type { Product } from "@/types/product";

export type ConnectedProductBookingSelectionPanelProps = {
  product?: Product | null;
  productTitle?: string;
  variant: "page" | "rail" | "sheet";
};

export function ConnectedProductBookingSelectionPanel({
  product,
  productTitle,
  variant,
}: ConnectedProductBookingSelectionPanelProps) {
  const {
    selectedDepartureKey,
    selectedOptions,
    travelerCount,
    setTravelerCount,
    setSelectedOptions,
    setDepartureSelection,
    paxDiscountPreview,
  } = useProductQuote();
  const { openModal: openConsultModal } = useConsultModal();

  const departureUi = product ? resolveDepartureUiForProduct(product) : "chips";
  const hasOptions =
    ENABLE_PRODUCT_OPTIONS && Boolean(product?.options?.groups && product.options.groups.length > 0);
  const productOptions = hasOptions ? product?.options ?? null : null;
  const optionsState = useMemo(() => {
    const raw = selectedOptions ?? EMPTY_SELECTED_OPTIONS;
    return productOptions ? stripConsultOnlySelections(productOptions, raw) : raw;
  }, [productOptions, selectedOptions]);

  useEffect(() => {
    if (!productOptions || !selectedOptions) return;
    const cleaned = stripConsultOnlySelections(productOptions, selectedOptions);
    if (JSON.stringify(cleaned) !== JSON.stringify(selectedOptions)) {
      setSelectedOptions(Object.keys(cleaned).length ? cleaned : null);
    }
  }, [productOptions, selectedOptions, setSelectedOptions]);

  return (
    <ProductBookingSelectionPanel
      variant={variant}
      product={product}
      departureUi={departureUi}
      schedules={product?.departureSchedules}
      departures={product?.departures}
      options={productOptions}
      selectedDepartureKey={selectedDepartureKey}
      selectedOptions={optionsState}
      travelerCount={travelerCount}
      onTravelerCountChange={setTravelerCount}
      paxDiscountPreview={paxDiscountPreview}
      onDepartureChange={setDepartureSelection}
      onOptionSingleChange={(groupKey, itemValue) => {
        const item = productOptions?.groups
          ?.flatMap((group) => group.items)
          .find((entry) => entry.value === itemValue);
        if (item && isConsultOnlyProductOption(item)) return;
        setSelectedOptions(setSingleOptionSelection(groupKey, itemValue, optionsState));
      }}
      onOptionMultiToggle={(groupKey, itemValue) => {
        const item = productOptions?.groups
          ?.flatMap((group) => group.items)
          .find((entry) => entry.value === itemValue);
        if (item && isConsultOnlyProductOption(item)) return;
        setSelectedOptions(toggleMultiOption(groupKey, itemValue, optionsState));
      }}
      onConsultClick={() =>
        openConsultModal({
          productId: product?.id,
          productTitle,
          sourcePath: product?.id ? `/products/${product.id}` : undefined,
        })
      }
    />
  );
}
