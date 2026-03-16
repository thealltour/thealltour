"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import TrustSignals from "@/components/products/TrustSignals";
import { ProductConsultCTA } from "@/components/products/ProductConsultCTA";
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
  const MAX_KEYWORDS_STICKY = 5;
  const displayKeywords = seoHashtags.slice(0, MAX_KEYWORDS_STICKY);
  const keywordOverflowCount = Math.max(0, seoHashtags.length - MAX_KEYWORDS_STICKY);

  const displayPrice = quoteSummary?.total != null
    ? formatPriceKR(quoteSummary.total)
    : priceFormatted;

  /** Desktop Sticky 전용: 행동 유도형 primary CTA 문구 (문의/예약 흐름 명확화) */
  const desktopPrimaryLabel =
    status === "AVAILABLE"
      ? "일정/가격 문의하기"
      : status === "LIMITED"
        ? "잔여 좌석 문의하기"
        : status === "SOLD_OUT"
          ? "대기 문의하기"
          : status === "CONSULT_REQUIRED"
            ? "견적 문의하기"
            : "상담 문의하기";

  /** PR23: 데스크톱 sticky 헤더 충돌 방지 — SiteHeader(유틸바 h-10 + 메인 h-72~76) + 여백 반영 */
  const desktopStickyTop = 128;
  const desktopStickyMaxHeight = `calc(100vh - ${desktopStickyTop}px - 16px)`;

  return (
    <aside
      className="hidden lg:block sticky w-full max-w-[300px] shrink-0 overflow-auto"
      style={{
        top: `${desktopStickyTop}px`,
        maxHeight: desktopStickyMaxHeight,
      }}
      aria-label="상품 요약"
    >
      {/* 전환 핵심 그룹: 예상가 + CTA. 스크롤 위치와 무관하게 카드/버튼 UI 일관 유지 */}
      <div className="rounded-2xl border-2 border-[#93c5fd] bg-white p-5 shadow-lg ring-1 ring-[#bfdbfe]">
        <div className="space-y-3">
          <div>
            <p className="text-xs font-medium text-slate-500">예상가</p>
            {displayPrice ? (
              <p className="font-price-strong mt-1 text-2xl font-bold leading-tight text-[#1E3A8A]">
                ₩{displayPrice}~
              </p>
            ) : (
              <p className="mt-1 text-lg font-semibold text-slate-600">상담 후 안내</p>
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
          </div>
          {/* 가격/전환 신뢰도 마이크로카피: 기준·포함·문의 안내 */}
          <ul className="mt-3 list-none space-y-1 border-t border-slate-100 pt-3 text-xs leading-relaxed text-slate-500" aria-label="가격 및 예약 안내">
            <li>최종 금액은 일정과 인원 기준으로 안내됩니다.</li>
            <li>포함사항과 옵션 내용은 상세 정보에서 확인 가능합니다.</li>
            <li>상담 후 예약 가능 여부와 예상 비용을 안내해드립니다.</li>
          </ul>
          <TrustSignals trust={trust} />
          <div className="flex flex-col gap-2 pt-0.5 rounded-xl">
            <ProductConsultCTA
              productId={productId}
              productTitle={productTitle}
              sourcePath={sourcePath}
              status={status}
              kakaoHref={kakaoHref}
              section="top"
              requiredGroupsMissing={requiredGroupsMissing}
              scrollToOptions={scrollToOptions}
              isSoldOut={isSoldOut}
              onPrimaryClick={() => trackReviewConversionCtaClick(productId, { experimentKey, variant })}
              primaryLabel={desktopPrimaryLabel}
              helperText="문의를 남기시면 가능 일정과 예상 비용을 안내해드립니다."
            />
          </div>
        </div>
      </div>

      {/* 보조 정보 그룹: 키워드 / 차트 / 목록 링크 (탐색 보조, CTA 방해 최소화) */}
      <div className="sticky-supporting-info mt-5 space-y-3 border-t border-slate-200 pt-5" aria-label="보조 정보">
        {displayKeywords.length > 0 && (
          <div className="rounded-lg border border-slate-100 bg-slate-50/60 p-2.5">
            <p className="mb-1 text-[10px] font-medium uppercase tracking-wide text-slate-400">핵심 키워드</p>
            <div className="flex flex-wrap items-center gap-1">
              {displayKeywords.map((tag, index) => (
                <span
                  key={`detail-seo-${tag}-${index}`}
                  className="inline-flex shrink-0 items-center rounded-full border border-slate-200 bg-white px-1.5 py-0.5 text-[10px] font-medium text-slate-500"
                >
                  #{tag}
                </span>
              ))}
              {keywordOverflowCount > 0 && (
                <span className="inline-flex shrink-0 items-center text-[10px] font-medium text-slate-400">
                  +{keywordOverflowCount}
                </span>
              )}
            </div>
          </div>
        )}
        {chart && (
          <div className="rounded-lg border border-slate-100 bg-slate-50/60 p-2.5">
            <ThemeChartCard items={chart.items} />
          </div>
        )}
        <Link
          href="/products"
          className="block text-sm text-slate-500 underline decoration-slate-300 underline-offset-2 transition hover:text-slate-700 hover:decoration-slate-500"
        >
          ← 다른 상품 보기
        </Link>
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

  /** CTA 고정 높이 + visualViewport 보정: 주소창/하단 UI 표시 시에도 CTA가 잘리지 않도록 bottom offset 적용 */
  const PADDING_TOP = 12;
  const PADDING_BOTTOM_BASE = 12;

  useEffect(() => {
    const updateViewportOffset = () => {
      if (typeof window === "undefined") return;
      const vv = window.visualViewport;
      if (!vv) {
        document.documentElement.style.setProperty("--mobile-cta-viewport-offset", "0px");
        return;
      }
      const viewportBottom = vv.offsetTop + vv.height;
      const gap = window.innerHeight - viewportBottom;
      const offsetPx = Math.max(0, gap);
      document.documentElement.style.setProperty("--mobile-cta-viewport-offset", `${offsetPx}px`);
    };

    updateViewportOffset();

    const vv = typeof window !== "undefined" ? window.visualViewport : null;
    if (vv) {
      vv.addEventListener("resize", updateViewportOffset);
      vv.addEventListener("scroll", updateViewportOffset);
    }
    window.addEventListener("resize", updateViewportOffset);
    window.addEventListener("orientationchange", updateViewportOffset);

    return () => {
      if (vv) {
        vv.removeEventListener("resize", updateViewportOffset);
        vv.removeEventListener("scroll", updateViewportOffset);
      }
      window.removeEventListener("resize", updateViewportOffset);
      window.removeEventListener("orientationchange", updateViewportOffset);
      document.documentElement.style.setProperty("--mobile-cta-viewport-offset", "0px");
    };
  }, []);

  return (
    <div
      role="banner"
      aria-label="상품 예약 상담"
      className="fixed left-0 right-0 z-50 box-border w-full border-t border-[var(--divider)] bg-white shadow-[0_-2px_8px_rgba(0,0,0,0.06)] md:hidden"
      style={{
        bottom: "var(--mobile-cta-viewport-offset, 0px)",
        paddingTop: `${PADDING_TOP}px`,
        paddingBottom: `calc(${PADDING_BOTTOM_BASE}px + env(safe-area-inset-bottom, 0px))`,
        paddingLeft: "max(12px, env(safe-area-inset-left, 0px))",
        paddingRight: "max(12px, env(safe-area-inset-right, 0px))",
      }}
    >
      <div className="mx-auto flex min-h-[44px] w-full max-w-[100%] items-center gap-3">
        <ProductConsultCTA
          productId={productId}
          productTitle={productTitle}
          sourcePath={sourcePath}
          status={status}
          kakaoHref={kakaoHref}
          section="sticky"
          priceFormatted={displayPrice}
          requiredGroupsMissing={requiredGroupsMissing}
          scrollToOptions={scrollToOptions}
          isSoldOut={isSoldOut}
          compact={compact}
          onPrimaryClick={() => trackReviewConversionCtaClick(productId, { experimentKey, variant })}
        />
      </div>
    </div>
  );
}
