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

export type PaxDiscountPreview = { label: string; amount: number };

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
  selectedDepartureKey: string | null;
  travelerCount: number;
  requiredGroupsMissing: boolean;
  departureRequired: boolean;
  departureSelectionMissing: boolean;
  paxDiscountPreview: PaxDiscountPreview | null;
  setQuoteSummary: (q: QuoteResult | null) => void;
  setSelectedOptions: (s: SelectedOptions | null) => void;
  setSelectedDeparture: (d: SelectedDeparture | null) => void;
  setSelectedDepartureKey: (key: string | null) => void;
  setDepartureSelection: (departure: SelectedDeparture | null, key: string | null) => void;
  setTravelerCount: (n: number) => void;
  setRequiredGroupsMissing: (v: boolean) => void;
  setDepartureRequired: (v: boolean) => void;
  setDepartureSelectionMissing: (v: boolean) => void;
  setPaxDiscountPreview: (v: PaxDiscountPreview | null) => void;
  registerScrollToBooking: (fn: (target?: BookingScrollTarget) => void) => void;
  scrollToBooking: (target?: BookingScrollTarget) => void;
  registerOpenBookingSheet: (fn: (target?: BookingScrollTarget) => void) => void;
  openBookingSheet: (target?: BookingScrollTarget) => void;
  /** @deprecated use scrollToBooking */
  registerScrollToOptions: (fn: (target?: BookingScrollTarget) => void) => void;
  /** @deprecated use scrollToBooking */
  scrollToOptions: (target?: BookingScrollTarget) => void;
};

const ProductQuoteContext = createContext<ProductQuoteContextValue | null>(null);

const noop = () => {};

const FALLBACK_QUOTE: ProductQuoteContextValue = {
  quoteSummary: null,
  selectedOptions: null,
  selectedDeparture: null,
  selectedDepartureKey: null,
  travelerCount: DEFAULT_TRAVELER_COUNT,
  requiredGroupsMissing: false,
  departureRequired: false,
  departureSelectionMissing: false,
  paxDiscountPreview: null,
  setQuoteSummary: noop,
  setSelectedOptions: noop,
  setSelectedDeparture: noop,
  setSelectedDepartureKey: noop,
  setDepartureSelection: noop,
  setTravelerCount: noop,
  setRequiredGroupsMissing: noop,
  setDepartureRequired: noop,
  setDepartureSelectionMissing: noop,
  setPaxDiscountPreview: noop,
  registerScrollToBooking: noop,
  scrollToBooking: noop,
  registerOpenBookingSheet: noop,
  openBookingSheet: noop,
  registerScrollToOptions: noop,
  scrollToOptions: noop,
};

export function useProductQuote() {
  const ctx = useContext(ProductQuoteContext);
  return ctx ?? FALLBACK_QUOTE;
}

export function ProductQuoteProvider({ children }: { children: ReactNode }) {
  const [quoteSummary, setQuoteSummary] = useState<QuoteResult | null>(null);
  const [selectedOptions, setSelectedOptions] = useState<SelectedOptions | null>(null);
  const [selectedDeparture, setSelectedDeparture] = useState<SelectedDeparture | null>(null);
  const [selectedDepartureKey, setSelectedDepartureKey] = useState<string | null>(null);
  const [travelerCount, setTravelerCountState] = useState(DEFAULT_TRAVELER_COUNT);
  const [requiredGroupsMissing, setRequiredGroupsMissing] = useState(false);
  const [departureRequired, setDepartureRequired] = useState(false);
  const [departureSelectionMissing, setDepartureSelectionMissing] = useState(false);
  const [paxDiscountPreview, setPaxDiscountPreview] = useState<PaxDiscountPreview | null>(null);
  const scrollToBookingRef = useRef<((target?: BookingScrollTarget) => void) | null>(null);
  const openBookingSheetRef = useRef<((target?: BookingScrollTarget) => void) | null>(null);

  const setTravelerCount = useCallback((n: number) => {
    setTravelerCountState(clampTravelerCount(n));
  }, []);

  const setDepartureSelection = useCallback(
    (departure: SelectedDeparture | null, key: string | null) => {
      setSelectedDeparture(departure);
      setSelectedDepartureKey(key);
    },
    [],
  );

  const registerScrollToBooking = useCallback((fn: (target?: BookingScrollTarget) => void) => {
    scrollToBookingRef.current = fn;
  }, []);

  const scrollToBooking = useCallback((target?: BookingScrollTarget) => {
    scrollToBookingRef.current?.(target);
  }, []);

  const registerOpenBookingSheet = useCallback((fn: (target?: BookingScrollTarget) => void) => {
    openBookingSheetRef.current = fn;
  }, []);

  const openBookingSheet = useCallback((target?: BookingScrollTarget) => {
    openBookingSheetRef.current?.(target);
  }, []);

  const value: ProductQuoteContextValue = {
    quoteSummary,
    selectedOptions,
    selectedDeparture,
    selectedDepartureKey,
    travelerCount,
    requiredGroupsMissing,
    departureRequired,
    departureSelectionMissing,
    paxDiscountPreview,
    setQuoteSummary,
    setSelectedOptions,
    setSelectedDeparture,
    setSelectedDepartureKey,
    setDepartureSelection,
    setTravelerCount,
    setRequiredGroupsMissing,
    setDepartureRequired,
    setDepartureSelectionMissing,
    setPaxDiscountPreview,
    registerScrollToBooking,
    scrollToBooking,
    registerOpenBookingSheet,
    openBookingSheet,
    registerScrollToOptions: registerScrollToBooking,
    scrollToOptions: scrollToBooking,
  };

  return (
    <ProductQuoteContext.Provider value={value}>
      {children}
    </ProductQuoteContext.Provider>
  );
}
