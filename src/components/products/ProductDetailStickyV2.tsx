"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { CalendarDays, ChevronUp } from "lucide-react";
import TrustSignals from "@/components/products/TrustSignals";
import { ProductConsultCTA } from "@/components/products/ProductConsultCTA";
import { ConnectedProductBookingSelectionPanel } from "@/components/products/ConnectedProductBookingSelectionPanel";
import { ProductStickyCheckoutRail } from "@/components/products/ProductStickyCheckoutRail";
import { ProductBookingSheet } from "@/components/products/ProductBookingSheet";
import {
  useProductQuote,
  type BookingScrollTarget,
} from "@/components/products/ProductQuoteContext";
import { cn } from "@/lib/cn";
import { formatPriceKR } from "@/lib/pricing/calcQuote";
import type { QuoteResult } from "@/lib/pricing/calcQuote";
import { trackReviewConversionCtaClick } from "@/lib/reviewExperimentTracking";
import type { Product, ProductTrust } from "@/types/product";
import {
  getProductCardSeasonalBandInfo,
  SEASONAL_CARD_SUBLINE,
} from "@/lib/products/productCardSeasonalPriceDisplay";
import { STICKY_SEASONAL_VOLATILITY_HINT } from "@/lib/products/detailSeasonalPriceDisplay";
import { getProductCtaLabel } from "@/lib/products/getProductCtaLabel";
import {
  buildProductStickyMetaLine,
  hasProductFixedDeparture,
} from "@/lib/products/productFixedDeparture";
import {
  getSelectedDepartureStickyDateLabel,
  resolveStickyExpectedAmount,
} from "@/lib/products/stickyExpectedPrice";
import { productHasBookingSelection } from "@/lib/products/resolveProductBookingUx";

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

type StickyPriceParts = {
  digits: string | null;
  prefix: string | undefined;
  subLabel: string | undefined;
  /** 구간가 표시 시 모바일 sticky 두 번째 힌트 */
  seasonalSecondLine: string | undefined;
  mode: "quote" | "seasonal" | "single" | "departure" | "none";
  showTilde: boolean;
};

function getStickyPriceParts(
  priceFormatted: string | null,
  quote: QuoteResult | null | undefined,
  product: Product | null | undefined,
  departurePrice?: number | null,
): StickyPriceParts {
  const resolved = resolveStickyExpectedAmount({
    selectedDeparturePrice: departurePrice,
    quoteTotal: quote?.total,
    quoteBasePrice: quote?.basePrice,
  });
  if (resolved?.fromDeparture) {
    const digits = formatPriceKR(resolved.amount);
    if (digits) {
      return {
        digits,
        prefix: undefined,
        subLabel: "선택 출발일 기준",
        seasonalSecondLine: undefined,
        mode: "departure",
        showTilde: false,
      };
    }
  }
  if (resolved && !resolved.fromDeparture) {
    const digits = formatPriceKR(resolved.amount);
    if (digits) {
      return {
        digits,
        prefix: undefined,
        subLabel: undefined,
        seasonalSecondLine: undefined,
        mode: "quote",
        showTilde: true,
      };
    }
  }
  const seasonalInfo = getProductCardSeasonalBandInfo(product?.seasonal_price_bands ?? null);
  if (seasonalInfo && product?.seasonal_price_bands) {
    const bands = product.seasonal_price_bands;
    const amount = seasonalInfo.hasOffSeason ? bands.offSeason! : seasonalInfo.min;
    const digits = formatPriceKR(amount);
    if (digits) {
      return {
        digits,
        prefix: seasonalInfo.hasOffSeason ? "비수기 기준 " : "최저가 기준 ",
        subLabel: SEASONAL_CARD_SUBLINE,
        seasonalSecondLine: STICKY_SEASONAL_VOLATILITY_HINT,
        mode: "seasonal",
        showTilde: true,
      };
    }
  }
  if (priceFormatted != null && String(priceFormatted).trim() !== "") {
    return {
      digits: priceFormatted,
      prefix: undefined,
      subLabel: undefined,
      seasonalSecondLine: undefined,
      mode: "single",
      showTilde: true,
    };
  }
  return {
    digits: null,
    prefix: undefined,
    subLabel: undefined,
    seasonalSecondLine: undefined,
    mode: "none",
    showTilde: false,
  };
}

function StickyExpectedPriceAmount({ stickyPrice }: { stickyPrice: StickyPriceParts }) {
  return (
    <>
      <p className="text-xs font-medium text-slate-500">예상가</p>
      {stickyPrice.digits ? (
        <>
          <p className="font-price-strong mt-1 text-2xl font-bold leading-tight text-[var(--primary)]">
            {stickyPrice.prefix ?? ""}₩{stickyPrice.digits}
            {stickyPrice.showTilde ? "~" : ""}
          </p>
          {stickyPrice.mode === "seasonal" ? (
            <>
              <p className="mt-0.5 text-xs text-slate-500">{SEASONAL_CARD_SUBLINE}</p>
              <p className="mt-0.5 text-xs text-slate-500">{STICKY_SEASONAL_VOLATILITY_HINT}</p>
            </>
          ) : null}
        </>
      ) : (
        <p className="mt-1 text-lg font-semibold text-slate-600">상담 후 안내</p>
      )}
    </>
  );
}

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
  const { quoteSummary, selectedDeparture } = useProductQuote();
  const isSoldOut = status === "SOLD_OUT";

  const stickyPrice = useMemo(
    () =>
      getStickyPriceParts(
        priceFormatted,
        quoteSummary,
        product,
        selectedDeparture?.price,
      ),
    [priceFormatted, quoteSummary, product, selectedDeparture?.price],
  );
  const fixedDeparture = hasProductFixedDeparture(product);
  const ctaLabelOptions = useMemo(
    () => (fixedDeparture ? { fixedDeparture: true as const } : undefined),
    [fixedDeparture],
  );
  const stickyMetaLine = useMemo(
    () =>
      buildProductStickyMetaLine(product, {
        seasonalMode: stickyPrice.mode === "seasonal",
        includePriceMeta: stickyPrice.mode !== "seasonal",
        selectedDateLabel: getSelectedDepartureStickyDateLabel(selectedDeparture),
      }),
    [product, stickyPrice.mode, selectedDeparture],
  );

  /** PR23: 데스크톱 sticky 헤더 충돌 방지 — SiteHeader(유틸바 40px + 메인 바 64px) + 여백 */
  const desktopStickyTop = 120;
  const desktopStickyMaxHeight = `calc(100vh - ${desktopStickyTop}px - 16px)`;

  return (
    <aside
      className="hidden lg:flex sticky w-[min(100%,22.5rem)] shrink-0 flex-col overflow-hidden"
      style={{
        top: `${desktopStickyTop}px`,
        maxHeight: desktopStickyMaxHeight,
      }}
      aria-label="상품 요약"
    >
      <div className="flex min-h-0 flex-1 flex-col overflow-hidden rounded-2xl border-2 border-[var(--primary-soft)] bg-white shadow-[var(--shadow-soft-strong)]">
        <div className="min-h-0 flex-1 space-y-4 overflow-y-auto overscroll-contain p-5">
          <div>
            <StickyExpectedPriceAmount stickyPrice={stickyPrice} />
            {product && (
              <div className="mt-2 space-y-0.5">
                {stickyMetaLine ? (
                  <p className="text-xs text-slate-500">{stickyMetaLine}</p>
                ) : null}
                {typeof product.fuel_included === "boolean" && (
                  <p className="text-xs text-slate-500">
                    {product.fuel_included ? "유류할증료 포함" : "유류할증료 별도"}
                  </p>
                )}
                {stickyPrice.mode !== "seasonal" ? (
                  <p className="text-xs text-slate-500">유류할증료는 상담 시 안내</p>
                ) : null}
              </div>
            )}
          </div>
          {productHasBookingSelection(product) ? (
            <div className="mt-1">
              <ConnectedProductBookingSelectionPanel
                variant="rail"
                product={product}
                productTitle={productTitle}
              />
            </div>
          ) : null}
          <TrustSignals trust={trust} />
          {!isSoldOut ? (
            <div
              className="border-t border-slate-100 pt-3"
              onClickCapture={() => {
                trackReviewConversionCtaClick(productId, { experimentKey, variant });
              }}
            >
              <ProductStickyCheckoutRail
                product={product}
                productTitle={productTitle}
                kakaoHref={kakaoHref}
                layout="rail"
                analyticsSection="sidebar"
              />
            </div>
          ) : (
            <div className="border-t border-slate-100 pt-3">
              <ProductConsultCTA
                productId={productId}
                productTitle={productTitle}
                sourcePath={sourcePath}
                kakaoHref={kakaoHref}
                status={status}
                section="top"
                isSoldOut
                primaryLabel={getProductCtaLabel(status, ctaLabelOptions)}
                ctaLabelOptions={ctaLabelOptions}
                helperText="일정과 요금은 상담을 통해 개별 안내됩니다."
              />
            </div>
          )}
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
  product,
}: ProductDetailStickyV2Props) {
  const {
    quoteSummary,
    requiredGroupsMissing,
    scrollToBooking,
    selectedDeparture,
    departureSelectionMissing,
    travelerCount,
    registerOpenBookingSheet,
  } = useProductQuote();
  const isSoldOut = status === "SOLD_OUT";
  const [compact, setCompact] = useState(false);
  const [sheetOpen, setSheetOpen] = useState(false);
  const [sheetTarget, setSheetTarget] = useState<BookingScrollTarget>("panel");
  const lastScrollYRef = useRef(0);
  const idleTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const stickyPrice = useMemo(
    () =>
      getStickyPriceParts(
        priceFormatted,
        quoteSummary,
        product,
        selectedDeparture?.price,
      ),
    [priceFormatted, quoteSummary, product, selectedDeparture?.price],
  );
  const fixedDeparture = hasProductFixedDeparture(product);
  const ctaLabelOptions = useMemo(
    () => (fixedDeparture ? { fixedDeparture: true as const } : undefined),
    [fixedDeparture],
  );
  const stickyMetaLine = useMemo(
    () =>
      buildProductStickyMetaLine(product, {
        seasonalMode: stickyPrice.mode === "seasonal",
        includePriceMeta: stickyPrice.mode !== "seasonal",
        selectedDateLabel: getSelectedDepartureStickyDateLabel(selectedDeparture),
      }),
    [product, stickyPrice.mode, selectedDeparture],
  );

  const showBookingSheetTrigger = productHasBookingSelection(product);
  const bookingSummaryLabel = useMemo(() => {
    const dateLabel = getSelectedDepartureStickyDateLabel(selectedDeparture);
    if (dateLabel) return `${dateLabel} · ${travelerCount}명`;
    if (selectedDeparture?.label) return `${selectedDeparture.label} · ${travelerCount}명`;
    return "출발일·인원 선택";
  }, [selectedDeparture, travelerCount]);

  useEffect(() => {
    registerOpenBookingSheet((target = "panel") => {
      setSheetTarget(target);
      setSheetOpen(true);
    });
  }, [registerOpenBookingSheet]);

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
      className="fixed left-0 right-0 z-50 box-border w-full border-t border-[var(--divider)] glass-chrome glass-chrome-bottom lg:hidden"
      style={{
        bottom: "var(--mobile-cta-viewport-offset, 0px)",
        paddingTop: `${PADDING_TOP}px`,
        paddingBottom: `calc(${PADDING_BOTTOM_BASE}px + env(safe-area-inset-bottom, 0px))`,
        paddingLeft: "max(12px, env(safe-area-inset-left, 0px))",
        paddingRight: "max(12px, env(safe-area-inset-right, 0px))",
      }}
    >
      <div className="mx-auto flex w-full max-w-[100%] flex-col gap-2">
        {showBookingSheetTrigger ? (
          <button
            type="button"
            aria-expanded={sheetOpen}
            onClick={() => {
              setSheetTarget("panel");
              setSheetOpen(true);
            }}
            className={cn(
              "flex min-h-12 w-full items-center gap-2 rounded-xl px-3 py-2.5 text-left text-sm font-medium",
              departureSelectionMissing || requiredGroupsMissing
                ? "border-2 border-[var(--accent)] bg-[var(--accent-soft)] text-[var(--warning)]"
                : "border border-[var(--border)] bg-[var(--surface)] text-[var(--text-primary)]",
            )}
          >
            <CalendarDays className="h-4 w-4 shrink-0" aria-hidden />
            <span className="min-w-0 flex-1 truncate">{bookingSummaryLabel}</span>
            <span
              className={cn(
                "shrink-0 text-sm font-semibold",
                departureSelectionMissing || requiredGroupsMissing
                  ? "text-[var(--accent)]"
                  : "text-[var(--primary)]",
              )}
            >
              {departureSelectionMissing || requiredGroupsMissing ? "선택하기" : "변경"}
            </span>
            <ChevronUp
              className={cn("h-4 w-4 shrink-0 text-[var(--text-secondary)]", sheetOpen && "rotate-180")}
              aria-hidden
            />
          </button>
        ) : null}
        <div className="flex min-h-[44px] items-center gap-3">
          {isSoldOut ? (
            <ProductConsultCTA
              productId={productId}
              productTitle={productTitle}
              sourcePath={sourcePath}
              status={status}
              kakaoHref={kakaoHref}
              section="sticky"
              priceFormatted={stickyPrice.digits}
              stickyPricePrefix={stickyPrice.prefix}
              stickyPriceSubLabel={
                stickyMetaLine ||
                (stickyPrice.mode === "seasonal" ? product?.duration?.trim() : undefined) ||
                stickyPrice.subLabel
              }
              stickyPriceSecondLine={stickyPrice.seasonalSecondLine}
              stickyShowRangeSuffix={stickyPrice.showTilde}
              ctaLabelOptions={ctaLabelOptions}
              requiredGroupsMissing={requiredGroupsMissing}
              departureSelectionMissing={departureSelectionMissing}
              scrollToBooking={scrollToBooking}
              isSoldOut
              compact={compact}
            />
          ) : (
            <div
              className="flex min-h-[44px] flex-1 items-center gap-2"
              onClickCapture={() => {
                trackReviewConversionCtaClick(productId, { experimentKey, variant });
              }}
            >
              <ProductStickyCheckoutRail
                product={product}
                productTitle={productTitle}
                kakaoHref={kakaoHref}
                layout="bar"
                analyticsSection="sticky_mobile"
                onOpenSelection={() => {
                  setSheetTarget(
                    departureSelectionMissing
                      ? "departure"
                      : requiredGroupsMissing
                        ? "options"
                        : "panel",
                  );
                  setSheetOpen(true);
                }}
              />
            </div>
          )}
        </div>
      </div>
      <ProductBookingSheet
        open={sheetOpen}
        onClose={() => setSheetOpen(false)}
        product={product}
        productTitle={productTitle}
        focusTarget={sheetTarget}
        kakaoHref={kakaoHref}
      />
    </div>
  );
}
