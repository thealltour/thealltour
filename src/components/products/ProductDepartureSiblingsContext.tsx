"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
  useTransition,
  type ReactNode,
} from "react";
import { useRouter } from "next/navigation";
import { useProductQuote } from "@/components/products/ProductQuoteContext";
import {
  buildDepartureSwitchHref,
  resolveCarriedDeparture,
  type ProductDepartureSibling,
} from "@/lib/products/departureSiblings";
import type { ProductDepartureDateSource } from "@/lib/products/productDepartureDates";

type ProductDepartureSiblingsValue = {
  /** 현재 상품 포함. 2개 미만이면 빈 배열 */
  siblings: ProductDepartureSibling[];
  current: ProductDepartureSibling | null;
  /** 다른 출발지에서 넘어온 출발일이 이 상품에 없을 때 그 날짜(YYYY-MM-DD) */
  missingCarriedYmd: string | null;
  /** 이동 중인 형제 상품 id. 항공 섹션·예약 영역 칩이 같은 값을 본다 */
  pendingSiblingId: string | null;
  switchTo: (siblingId: string) => void;
};

const EMPTY_VALUE: ProductDepartureSiblingsValue = {
  siblings: [],
  current: null,
  missingCarriedYmd: null,
  pendingSiblingId: null,
  switchTo: () => {},
};

const ProductDepartureSiblingsContext = createContext<ProductDepartureSiblingsValue>(EMPTY_VALUE);

export function useProductDepartureSiblings(): ProductDepartureSiblingsValue {
  return useContext(ProductDepartureSiblingsContext);
}

/**
 * ProductQuoteProvider 안쪽에 둔다.
 * 선택된 출발지는 곧 지금 보고 있는 상품이므로, 출발지 전환은 형제 상품으로의 이동이다.
 * 이동할 때 출발일·인원을 쿼리로 넘기고, 넘어온 출발일(?date=)은 여기서 복원한다.
 */
export function ProductDepartureSiblingsProvider({
  siblings,
  departureSource,
  initialDepartureYmd,
  children,
}: {
  siblings: ProductDepartureSibling[];
  departureSource: ProductDepartureDateSource;
  initialDepartureYmd?: string | null;
  children: ReactNode;
}) {
  const router = useRouter();
  const { selectedDeparture, selectedDepartureKey, travelerCount, setDepartureSelection } =
    useProductQuote();
  const [carriedDeparture] = useState(() =>
    initialDepartureYmd ? resolveCarriedDeparture(departureSource, initialDepartureYmd) : null,
  );
  const carriedMissingYmd =
    initialDepartureYmd && !carriedDeparture && siblings.length > 0 ? initialDepartureYmd : null;
  const missingCarriedYmd = selectedDepartureKey ? null : carriedMissingYmd;
  const [pendingTargetId, setPendingTargetId] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();
  const pendingSiblingId = isPending ? pendingTargetId : null;
  const restoredRef = useRef(false);

  useEffect(() => {
    if (restoredRef.current || !carriedDeparture) return;
    restoredRef.current = true;
    setDepartureSelection(carriedDeparture.departure, carriedDeparture.key);
  }, [carriedDeparture, setDepartureSelection]);

  const switchTo = useCallback(
    (siblingId: string) => {
      const target = siblings.find((sibling) => sibling.id === siblingId);
      if (!target || target.isCurrent || pendingSiblingId) return;
      setPendingTargetId(siblingId);
      const href = buildDepartureSwitchHref(siblingId, {
        ymd: selectedDepartureKey ? selectedDeparture?.ymd : null,
        travelerCount,
      });
      startTransition(() => {
        router.push(href, { scroll: false });
      });
    },
    [siblings, pendingSiblingId, selectedDepartureKey, selectedDeparture?.ymd, travelerCount, router],
  );

  const value: ProductDepartureSiblingsValue = {
    siblings,
    current: siblings.find((sibling) => sibling.isCurrent) ?? null,
    missingCarriedYmd,
    pendingSiblingId,
    switchTo,
  };

  return (
    <ProductDepartureSiblingsContext.Provider value={value}>
      {children}
    </ProductDepartureSiblingsContext.Provider>
  );
}
