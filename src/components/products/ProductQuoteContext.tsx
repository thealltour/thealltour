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
import type { SelectedOptions } from "@/types/product";

type ProductQuoteContextValue = {
  quoteSummary: QuoteResult | null;
  selectedOptions: SelectedOptions | null;
  requiredGroupsMissing: boolean;
  setQuoteSummary: (q: QuoteResult | null) => void;
  setSelectedOptions: (s: SelectedOptions | null) => void;
  setRequiredGroupsMissing: (v: boolean) => void;
  registerScrollToOptions: (fn: () => void) => void;
  scrollToOptions: () => void;
};

const ProductQuoteContext = createContext<ProductQuoteContextValue | null>(null);

export function useProductQuote() {
  const ctx = useContext(ProductQuoteContext);
  if (!ctx) {
    return {
      quoteSummary: null,
      selectedOptions: null,
      requiredGroupsMissing: false,
      setQuoteSummary: () => {},
      setSelectedOptions: () => {},
      setRequiredGroupsMissing: () => {},
      registerScrollToOptions: () => {},
      scrollToOptions: () => {},
    };
  }
  return ctx;
}

export function ProductQuoteProvider({ children }: { children: ReactNode }) {
  const [quoteSummary, setQuoteSummary] = useState<QuoteResult | null>(null);
  const [selectedOptions, setSelectedOptions] = useState<SelectedOptions | null>(null);
  const [requiredGroupsMissing, setRequiredGroupsMissing] = useState(false);
  const scrollToOptionsRef = useRef<(() => void) | null>(null);

  const registerScrollToOptions = useCallback((fn: () => void) => {
    scrollToOptionsRef.current = fn;
  }, []);

  const scrollToOptions = useCallback(() => {
    scrollToOptionsRef.current?.();
  }, []);

  const value: ProductQuoteContextValue = {
    quoteSummary,
    selectedOptions,
    requiredGroupsMissing,
    setQuoteSummary,
    setSelectedOptions,
    setRequiredGroupsMissing,
    registerScrollToOptions,
    scrollToOptions,
  };

  return (
    <ProductQuoteContext.Provider value={value}>
      {children}
    </ProductQuoteContext.Provider>
  );
}
