"use client";

import { useConsultModal } from "@/components/inquiry/ConsultModal";
import { ProductBookingSelectionPanel } from "@/components/products/ProductBookingSelectionPanel";
import { useProductQuote } from "@/components/products/ProductQuoteContext";
import { ENABLE_PRODUCT_OPTIONS } from "@/config/featureFlags";
import {
  EMPTY_SELECTED_OPTIONS,
  setSingleOptionSelection,
  toggleMultiOption,
} from "@/lib/pricing/selectedOptions";
import { resolveDepartureUiForProduct } from "@/lib/products/resolveProductBookingUx";
import type { Product } from "@/types/product";

export type ConnectedProductBookingSelectionPanelProps = {
  product?: Product | null;
  productTitle?: string;
  variant: "rail" | "sheet";
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
  const optionsState = selectedOptions ?? EMPTY_SELECTED_OPTIONS;

  return (
    <ProductBookingSelectionPanel
      variant={variant}
      product={product}
      departureUi={departureUi}
      schedules={product?.departureSchedules}
      departures={product?.departures}
      options={hasOptions ? product?.options ?? null : null}
      selectedDepartureKey={selectedDepartureKey}
      selectedOptions={optionsState}
      travelerCount={travelerCount}
      onTravelerCountChange={setTravelerCount}
      paxDiscountPreview={paxDiscountPreview}
      onDepartureChange={setDepartureSelection}
      onOptionSingleChange={(groupKey, itemValue) =>
        setSelectedOptions(setSingleOptionSelection(groupKey, itemValue, optionsState))
      }
      onOptionMultiToggle={(groupKey, itemValue) =>
        setSelectedOptions(toggleMultiOption(groupKey, itemValue, optionsState))
      }
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
