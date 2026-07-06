"use client";

import { useEffect, useMemo, useState } from "react";
import { MobileGolfAdPage } from "@/components/mobile-golf-ads/MobileGolfAdPage";
import { collectGolfProductRailNodes, type MobileGolfAdBodyDoc } from "@/lib/adminMobileGolfAds/bodyDoc";
import type { MobileGolfAdLanding } from "@/lib/adminMobileGolfAds/types";
import type { Product } from "@/types/product";

export type MobileGolfAdLivePreviewProps = {
  draft: {
    title: string;
    slug: string;
    heroImageUrl: string;
    bodyDoc: MobileGolfAdBodyDoc;
  };
};

export function MobileGolfAdLivePreview({ draft }: MobileGolfAdLivePreviewProps) {
  const [homeGolfProducts, setHomeGolfProducts] = useState<Product[]>([]);
  const [customProducts, setCustomProducts] = useState<Product[]>([]);

  const customIds = useMemo(() => {
    const ids = new Set<string>();
    for (const rail of collectGolfProductRailNodes(draft.bodyDoc)) {
      if (rail.attrs.source === "custom") {
        for (const id of rail.attrs.productIds) ids.add(id);
      }
    }
    return [...ids];
  }, [draft.bodyDoc]);

  const needsHomeProducts = useMemo(
    () =>
      collectGolfProductRailNodes(draft.bodyDoc).some(
        (rail) => rail.attrs.source === "home_default",
      ),
    [draft.bodyDoc],
  );

  useEffect(() => {
    if (!needsHomeProducts) {
      setHomeGolfProducts([]);
      return;
    }
    void fetch("/api/admin/landings/mobile-golf-ads/preview-products?source=home_default", {
      cache: "no-store",
    })
      .then((res) => res.json())
      .then((data: { products?: Product[] }) => setHomeGolfProducts(data.products ?? []))
      .catch(() => setHomeGolfProducts([]));
  }, [needsHomeProducts]);

  useEffect(() => {
    if (customIds.length === 0) {
      setCustomProducts([]);
      return;
    }
    const timer = setTimeout(() => {
      void fetch(
        `/api/admin/landings/mobile-golf-ads/preview-products?ids=${encodeURIComponent(customIds.join(","))}`,
        { cache: "no-store" },
      )
        .then((res) => res.json())
        .then((data: { products?: Product[] }) => setCustomProducts(data.products ?? []))
        .catch(() => setCustomProducts([]));
    }, 300);
    return () => clearTimeout(timer);
  }, [customIds]);

  const productsById = useMemo(() => {
    const map = new Map<string, Product>();
    for (const p of customProducts) map.set(p.id, p);
    return map;
  }, [customProducts]);

  const landing: MobileGolfAdLanding = {
    id: "preview",
    title: draft.title || "미리보기",
    slug: draft.slug || "preview",
    heroImageUrl: draft.heroImageUrl,
    bodyDoc: draft.bodyDoc,
    benefitText: "",
    trustActionText: "",
    isPublished: false,
    seoTitle: null,
    seoDescription: null,
    styleConfig: {
      benefit: { fontSize: "md", accentColor: "#0f172a", roundBox: false },
      trust: { fontSize: "sm", accentColor: "#334155", roundBox: false },
    },
    createdAt: "",
    updatedAt: "",
  };

  return (
    <div className="flex flex-col items-center">
      <p className="mb-2 text-xs font-semibold text-[var(--text-muted)]">모바일 미리보기</p>
      <div className="relative w-full max-w-[390px] overflow-hidden rounded-[1.75rem] border-4 border-slate-800 bg-white shadow-xl">
        <div className="max-h-[min(72vh,720px)] overflow-y-auto overscroll-contain pb-20">
          <MobileGolfAdPage
            landing={landing}
            productsById={productsById}
            homeGolfProducts={homeGolfProducts}
            previewMode
          />
        </div>
      </div>
    </div>
  );
}
