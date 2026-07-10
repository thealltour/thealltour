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

export type BookingScrollTarget = "panel" | "departure" | "options";

export const DEFAULT_TRAVELER_COUNT = 2;
export const MIN_TRAVELER_COUNT = 1;
export const MAX_TRAVELER_COUNT = 20;

export function clampTravelerCount(value: number): number {
  if (!Number.isFinite(value)) return DEFAULT_TRAVELER_COUNT;
  return Math.min(MAX_TRAVELER_COUNT, Math.max(MIN_TRAVELER_COUNT, Math.round(value)));
}

type ProductQuoteContextValue = {
  quoteSummary: QuoteResult | null;
  selectedOptions: SelectedOptions | null;
  selectedDeparture: SelectedDeparture | null;
  travelerCount: number;
  requiredGroupsMissing: boolean;
  departureRequired: boolean;
  departureSelectionMissing: boolean;
  setQuoteSummary: (q: QuoteResult | null) => void;
  setSelectedOptions: (s: SelectedOptions | null) => void;
  setSelectedDeparture: (d: SelectedDeparture | null) => void;
  setTravelerCount: (n: number) => void;
  setRequiredGroupsMissing: (v: boolean) => void;
  setDepartureRequired: (v: boolean) => void;
  setDepartureSelectionMissing: (v: boolean) => void;
  registerScrollToBooking: (fn: (target?: BookingScrollTarget) => void) => void;
  scrollToBooking: (target?: BookingScrollTarget) => void;
  /** @deprecated use scrollToBooking */
  registerScrollToOptions: (fn: (target?: BookingScrollTarget) => void) => void;
  /** @deprecated use scrollToBooking */
  scrollToOptions: (target?: BookingScrollTarget) => void;
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
      travelerCount: DEFAULT_TRAVELER_COUNT,
      requiredGroupsMissing: false,
      departureRequired: false,
      departureSelectionMissing: false,
      setQuoteSummary: noop,
      setSelectedOptions: noop,
      setSelectedDeparture: noop,
      setTravelerCount: noop,
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
  const [travelerCount, setTravelerCountState] = useState(DEFAULT_TRAVELER_COUNT);
  const [requiredGroupsMissing, setRequiredGroupsMissing] = useState(false);
  const [departureRequired, setDepartureRequired] = useState(false);
  const [departureSelectionMissing, setDepartureSelectionMissing] = useState(false);
  const scrollToBookingRef = useRef<((target?: BookingScrollTarget) => void) | null>(null);

  const setTravelerCount = useCallback((n: number) => {
    setTravelerCountState(clampTravelerCount(n));
  }, []);

  const registerScrollToBooking = useCallback((fn: (target?: BookingScrollTarget) => void) => {
    scrollToBookingRef.current = fn;
  }, []);

  const scrollToBooking = useCallback((target?: BookingScrollTarget) => {
    scrollToBookingRef.current?.(target);
  }, []);

  const value: ProductQuoteContextValue = {
    quoteSummary,
    selectedOptions,
    selectedDeparture,
    travelerCount,
    requiredGroupsMissing,
    departureRequired,
    departureSelectionMissing,
    setQuoteSummary,
    setSelectedOptions,
    setSelectedDeparture,
    setTravelerCount,
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
