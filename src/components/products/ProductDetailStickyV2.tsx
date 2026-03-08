"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { useConsultModal } from "@/components/ConsultModal";
import { Button } from "@/components/ui/Button";
import TrustSignals from "@/components/products/TrustSignals";
import { ThemeChartCard } from "@/components/products/ThemeChartCard";
import { useProductQuote } from "@/components/products/ProductQuoteContext";
import { formatPriceKR } from "@/lib/pricing/calcQuote";
import { parseMetaTitleAsHashtags } from "@/lib/products/parseMetaTitleAsHashtags";
import { mapProductToOverview } from "@/lib/products/mapProductToOverview";
import { trackReviewConversionCtaClick } from "@/lib/reviewExperimentTracking";
import type { Product, ProductTrust } from "@/types/product";

export type ProductDetailStickyV2Status =
  | "AVAILABLE"
  | "LIMITED"
  | "SOLD_OUT"
  | "CONSULT_REQUIRED";

type ProductDetailStickyV2Props = {
  priceFormatted: string | null;
  productId: string;
  productTitle: string;
  sourcePath: string;
  kakaoHref: string;
  status?: ProductDetailStickyV2Status;
  trust?: ProductTrust | null;
  /** 웹에서 예상가 위에 차트 표시용 */
  product?: Product | null;
  /** PR27: 리뷰 전환 attribution용 실험 컨텍스트 */
  experimentKey?: string;
  variant?: string;
};

export function ProductDetailStickyV2Desktop({
  priceFormatted,
  productId,
  productTitle,
  sourcePath,
  kakaoHref,
  status = "AVAILABLE",
  trust,
  product,
  experimentKey,
  variant,
}: ProductDetailStickyV2Props) {
  const { openModal } = useConsultModal();
  const { quoteSummary, requiredGroupsMissing, scrollToOptions } = useProductQuote();
  const isSoldOut = status === "SOLD_OUT";

  const chart = useMemo(() => {
    if (!product) return null;
    const overview = mapProductToOverview(product);
    return overview.chart?.items?.length ? overview.chart : null;
  }, [product]);
  const seoHashtags = useMemo(
    () => parseMetaTitleAsHashtags(product?.meta_title),
    [product?.meta_title],
  );

  const displayPrice = quoteSummary?.total != null
    ? formatPriceKR(quoteSummary.total)
    : priceFormatted;

  const handlePrimaryClick = () => {
    if (requiredGroupsMissing) {
      scrollToOptions();
      return;
    }
    if (isSoldOut && typeof window !== "undefined") {
      window.alert("마감된 상품입니다. 대기 문의를 남겨 주시면 다음 일정 시 안내드립니다.");
    }
    trackReviewConversionCtaClick(productId, { experimentKey, variant });
    openModal({ productId, productTitle, sourcePath });
  };

  return (
    <aside
      className="hidden md:block sticky top-24 w-full max-w-[300px] shrink-0 space-y-4"
      aria-label="상품 요약"
    >
      <Link
        href="/products"
        className="inline-flex items-center gap-1 rounded-lg border border-slate-300 bg-white px-4 py-2 text-sm font-medium text-slate-700 transition hover:bg-slate-50"
      >
        ← 상품 목록으로
      </Link>
      {seoHashtags.length > 0 && (
        <div className="rounded-2xl border border-[#dbeafe] bg-white p-4 shadow-lg ring-1 ring-[#dbeafe]">
          <p className="mb-2 text-xs font-semibold text-slate-500">핵심 키워드</p>
          <div className="flex flex-wrap gap-1.5">
            {seoHashtags.map((tag, index) => (
              <span
                key={`detail-seo-${tag}-${index}`}
                className="inline-flex shrink-0 items-center rounded-full border border-slate-200 bg-white px-2.5 py-1 text-[11px] font-semibold text-slate-600"
              >
                #{tag}
              </span>
            ))}
          </div>
        </div>
      )}
      {/* 웹: 예상가 위에 일정 테마 구성비 차트 */}
      {chart && (
        <div className="rounded-2xl border border-[#dbeafe] bg-white p-4 shadow-lg ring-1 ring-[#dbeafe]">
          <ThemeChartCard items={chart.items} />
        </div>
      )}
      <div className="rounded-2xl border border-[#dbeafe] bg-white p-5 shadow-lg ring-1 ring-[#dbeafe]">
      <p className="text-sm font-semibold text-slate-500">예상가</p>
      {displayPrice ? (
        <p className="font-price-strong mt-1 text-xl font-bold text-[#1E3A8A]">
          ₩{displayPrice}~
        </p>
      ) : (
        <p className="mt-1 text-base font-semibold text-slate-600">상담 후 안내</p>
      )}
      {product && (
        <div className="mt-2 space-y-0.5">
          {(product.duration || product.price_meta) && (
            <p className="text-xs text-slate-500">
              {[product.duration, product.price_meta || "1인 기준"].filter(Boolean).join(" · ")}
            </p>
          )}
          {typeof product.fuel_included === "boolean" && (
            <p className="text-xs text-slate-500">
              {product.fuel_included ? "유류할증료 포함" : "유류할증료 별도"}
            </p>
          )}
          <p className="text-xs text-slate-500">유류할증료는 상담 시 안내</p>
        </div>
      )}
      <TrustSignals trust={trust} className="mt-3" />
      <div className="mt-4 flex flex-col gap-2">
        <Button variant="primary" size="md" onClick={handlePrimaryClick}>
          {isSoldOut ? "대기 문의" : "상담 문의하기"}
        </Button>
        <a href={kakaoHref} target="_blank" rel="noopener noreferrer">
          <Button variant="outline" size="md" className="w-full">
            카톡 상담
          </Button>
        </a>
      </div>
      </div>
    </aside>
  );
}

export function ProductDetailStickyV2Mobile({
  priceFormatted,
  productId,
  productTitle,
  sourcePath,
  kakaoHref,
  status = "AVAILABLE",
  experimentKey,
  variant,
}: ProductDetailStickyV2Props) {
  const { openModal } = useConsultModal();
  const { quoteSummary, requiredGroupsMissing, scrollToOptions } = useProductQuote();
  const isSoldOut = status === "SOLD_OUT";
  const [compact, setCompact] = useState(false);
  const lastScrollYRef = useRef(0);
  const idleTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const displayPrice = quoteSummary?.total != null
    ? formatPriceKR(quoteSummary.total)
    : priceFormatted;

  useEffect(() => {
    lastScrollYRef.current = window.scrollY;
    const onScroll = () => {
      const currentY = window.scrollY;
      const delta = currentY - lastScrollYRef.current;
      if (delta > 6) {
        setCompact(true);
      } else if (delta < -4) {
        setCompact(false);
      }
      lastScrollYRef.current = currentY;
      if (idleTimerRef.current) clearTimeout(idleTimerRef.current);
      idleTimerRef.current = setTimeout(() => setCompact(false), 240);
    };

    window.addEventListener("scroll", onScroll, { passive: true });
    return () => {
      window.removeEventListener("scroll", onScroll);
      if (idleTimerRef.current) clearTimeout(idleTimerRef.current);
    };
  }, []);

  useEffect(() => {
    const nextHeight = compact ? 44 : 56;
    document.documentElement.setAttribute("data-mobile-cta", "on");
    document.documentElement.style.setProperty("--cta-h", `${nextHeight}px`);
    return () => {
      document.documentElement.removeAttribute("data-mobile-cta");
      document.documentElement.style.setProperty("--cta-h", "0px");
    };
  }, [compact]);

  const handlePrimaryClick = () => {
    if (requiredGroupsMissing) {
      scrollToOptions();
      return;
    }
    if (isSoldOut && typeof window !== "undefined") {
      window.alert("마감된 상품입니다. 대기 문의를 남겨 주시면 다음 일정 시 안내드립니다.");
    }
    trackReviewConversionCtaClick(productId, { experimentKey, variant });
    openModal({ productId, productTitle, sourcePath });
  };

  return (
    <div
      className="fixed inset-x-0 bottom-0 z-30 flex items-center gap-3 border-t border-[var(--divider)] bg-[var(--glass-surface)] px-3 backdrop-blur transition-all duration-200 md:hidden"
      style={{
        paddingTop: compact ? "8px" : "12px",
        paddingBottom: compact ? "max(8px, env(safe-area-inset-bottom))" : "max(12px, env(safe-area-inset-bottom))",
      }}
    >
      {displayPrice ? (
        <span className="font-price-strong text-sm font-bold text-[#1E3A8A]">
          ₩{displayPrice}~
        </span>
      ) : (
        <span className="text-sm font-semibold text-slate-600">상담 후 안내</span>
      )}
      <div className="flex flex-1 gap-2">
        <Button variant="primary" size="md" onClick={handlePrimaryClick} className="flex-1">
          {compact ? (isSoldOut ? "대기" : "상담") : isSoldOut ? "대기 문의" : "상담 문의"}
        </Button>
        <a href={kakaoHref} target="_blank" rel="noopener noreferrer">
          <Button variant="outline" size="md">
            카톡
          </Button>
        </a>
      </div>
    </div>
  );
}
