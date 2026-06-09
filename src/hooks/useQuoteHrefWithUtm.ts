"use client";

import { useEffect, useState } from "react";
import { appendUtmParamsFromSearch } from "@/lib/analytics/utmPropagation";

/** 랜딩·상품 CTA 등 내부 quote 링크에 현재 UTM을 이어붙입니다. */
export function useQuoteHrefWithUtm(baseHref: string): string {
  const [href, setHref] = useState(baseHref);
  useEffect(() => {
    setHref(appendUtmParamsFromSearch(baseHref));
  }, [baseHref]);
  return href;
}
