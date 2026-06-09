"use client";

import Link from "next/link";
import { trackLandingCtaClick } from "@/lib/analytics/trackLandingQuoteFunnel";
import { useQuoteHrefWithUtm } from "@/hooks/useQuoteHrefWithUtm";
import type { AdminLandingDetail } from "@/types/adminLanding";
import { LANDING_RECOMMENDED_PRODUCTS_ANCHOR_ID } from "@/components/landings/sections/LandingRecommendedProductsSection";

type LandingHeroActionsProps = {
  landing: AdminLandingDetail;
  sourcePath: string;
  quoteHref: string;
  showScrollToProducts: boolean;
};

export default function LandingHeroActions({
  landing,
  sourcePath,
  quoteHref,
  showScrollToProducts,
}: LandingHeroActionsProps) {
  const href = useQuoteHrefWithUtm(quoteHref);
  return (
    <div className="flex flex-wrap gap-2.5 sm:gap-3">
      {showScrollToProducts ? (
        <a
          href={`#${LANDING_RECOMMENDED_PRODUCTS_ANCHOR_ID}`}
          className="inline-flex items-center rounded-lg border-2 border-white/90 bg-white/95 px-4 py-2 text-sm font-semibold text-[var(--text-primary)] shadow-sm hover:bg-white"
        >
          추천 상품 보기
        </a>
      ) : null}
      <Link
        href={href}
        onClick={() => {
          trackLandingCtaClick(landing, sourcePath);
        }}
        className="inline-flex items-center rounded-lg border border-white/70 bg-white/10 px-4 py-2 text-sm font-semibold text-white backdrop-blur-sm hover:bg-white/20"
      >
        맞춤 상담 요청하기
      </Link>
    </div>
  );
}
