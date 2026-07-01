"use client";

import {
  createContext,
  useCallback,
  useContext,
  useRef,
  useState,
  type ReactNode,
} from "react";
import type { QuoteResult } from "@/lib/pricing/calcQuote";
import type { SelectedDeparture } from "@/lib/products/buildProductInquiryPrefill";
import type { SelectedOptions } from "@/types/product";

export type { SelectedDeparture };

type ProductQuoteContextValue = {
  quoteSummary: QuoteResult | null;
  selectedOptions: SelectedOptions | null;
  selectedDeparture: SelectedDeparture | null;
  requiredGroupsMissing: boolean;
  departureRequired: boolean;
  departureSelectionMissing: boolean;
  setQuoteSummary: (q: QuoteResult | null) => void;
  setSelectedOptions: (s: SelectedOptions | null) => void;
  setSelectedDeparture: (d: SelectedDeparture | null) => void;
  setRequiredGroupsMissing: (v: boolean) => void;
  setDepartureRequired: (v: boolean) => void;
  setDepartureSelectionMissing: (v: boolean) => void;
  registerScrollToBooking: (fn: () => void) => void;
  scrollToBooking: () => void;
  /** @deprecated use scrollToBooking */
  registerScrollToOptions: (fn: () => void) => void;
  /** @deprecated use scrollToBooking */
  scrollToOptions: () => void;
};

const ProductQuoteContext = createContext<ProductQuoteContextValue | null>(null);

const noop = () => {};

export function useProductQuote() {
  const ctx = useContext(ProductQuoteContext);
  if (!ctx) {
    return {
      quoteSummary: null,
      selectedOptions: null,
      selectedDeparture: null,
      requiredGroupsMissing: false,
      departureRequired: false,
      departureSelectionMissing: false,
      setQuoteSummary: noop,
      setSelectedOptions: noop,
      setSelectedDeparture: noop,
      setRequiredGroupsMissing: noop,
      setDepartureRequired: noop,
      setDepartureSelectionMissing: noop,
      registerScrollToBooking: noop,
      scrollToBooking: noop,
      registerScrollToOptions: noop,
      scrollToOptions: noop,
    };
  }
  return ctx;
}

export function ProductQuoteProvider({ children }: { children: ReactNode }) {
  const [quoteSummary, setQuoteSummary] = useState<QuoteResult | null>(null);
  const [selectedOptions, setSelectedOptions] = useState<SelectedOptions | null>(null);
  const [selectedDeparture, setSelectedDeparture] = useState<SelectedDeparture | null>(null);
  const [requiredGroupsMissing, setRequiredGroupsMissing] = useState(false);
  const [departureRequired, setDepartureRequired] = useState(false);
  const [departureSelectionMissing, setDepartureSelectionMissing] = useState(false);
  const scrollToBookingRef = useRef<(() => void) | null>(null);

  const registerScrollToBooking = useCallback((fn: () => void) => {
    scrollToBookingRef.current = fn;
  }, []);

  const scrollToBooking = useCallback(() => {
    scrollToBookingRef.current?.();
  }, []);

  const value: ProductQuoteContextValue = {
    quoteSummary,
    selectedOptions,
    selectedDeparture,
    requiredGroupsMissing,
    departureRequired,
    departureSelectionMissing,
    setQuoteSummary,
    setSelectedOptions,
    setSelectedDeparture,
    setRequiredGroupsMissing,
    setDepartureRequired,
    setDepartureSelectionMissing,
    registerScrollToBooking,
    scrollToBooking,
    registerScrollToOptions: registerScrollToBooking,
    scrollToOptions: scrollToBooking,
  };

  return (
    <ProductQuoteContext.Provider value={value}>
      {children}
    </ProductQuoteContext.Provider>
  );
}
