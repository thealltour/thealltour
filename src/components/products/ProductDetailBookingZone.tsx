"use client";

import Link from "next/link";
import { ConnectedProductBookingSelectionPanel } from "@/components/products/ConnectedProductBookingSelectionPanel";
import { ProductStickyCheckoutRail } from "@/components/products/ProductStickyCheckoutRail";
import { ProductConsultCTA } from "@/components/products/ProductConsultCTA";
import { useProductDepartureSiblings } from "@/components/products/ProductDepartureSiblingsContext";
import { useProductQuote } from "@/components/products/ProductQuoteContext";
import { cn } from "@/lib/cn";
import { getProductCtaLabel } from "@/lib/products/getProductCtaLabel";
import { hasProductFixedDeparture } from "@/lib/products/productFixedDeparture";
import { isBookableDepartureYmd } from "@/lib/products/bookableDepartureDates";
import {
  productHasBookingSelection,
  resolveProductBookingUxMode,
} from "@/lib/products/resolveProductBookingUx";
import type { Product, ProductTrust } from "@/types/product";

export type ProductDetailBookingZoneStatus =
  | "AVAILABLE"
  | "LIMITED"
  | "SOLD_OUT"
  | "CONSULT_REQUIRED";

type ProductDetailBookingZoneProps = {
  product?: Product | null;
  productId: string;
  productTitle: string;
  sourcePath: string;
  kakaoHref: string;
  status?: ProductDetailBookingZoneStatus;
  trust?: ProductTrust | null;
  className?: string;
  /** 모바일은 하단 시트·바로 선택하므로 본문 패널은 lg 이상만 */
  visibility?: "always" | "desktopOnly";
};

function buildProductQuoteHref(input: {
  productId: string;
  sourcePath: string;
  desiredDepartureYmd?: string | null;
}): string {
  const params = new URLSearchParams();
  params.set("product_id", input.productId);
  if (input.sourcePath.trim()) params.set("source_path", input.sourcePath.trim());
  const ymd = input.desiredDepartureYmd?.trim();
  if (ymd && isBookableDepartureYmd(ymd)) params.set("desired_departure", ymd);
  return `/quote?${params.toString()}`;
}

/**
 * 상세 본문 예약 구역 — 출발일·인원·옵션 + 예약/견적 CTA.
 * 데스크톱 sticky와 선택 UI를 중복하지 않도록 본문에 한 번만 둔다.
 */
export function ProductDetailBookingZone({
  product,
  productId,
  productTitle,
  sourcePath,
  kakaoHref,
  status = "AVAILABLE",
  className,
  visibility = "always",
}: ProductDetailBookingZoneProps) {
  const { selectedDeparture } = useProductQuote();
  const { siblings: departureSiblings } = useProductDepartureSiblings();
  const isSoldOut = status === "SOLD_OUT";
  const bookingUxMode = product ? resolveProductBookingUxMode(product) : "calendar_booking";
  const isConsultQuoteFlow =
    status === "CONSULT_REQUIRED" || bookingUxMode === "seasonal_consult";
  const showSelection =
    productHasBookingSelection(product) || departureSiblings.length > 1;
  const fixedDeparture = hasProductFixedDeparture(product);
  const ctaLabelOptions = fixedDeparture ? { fixedDeparture: true as const } : undefined;
  const quoteHref = buildProductQuoteHref({
    productId,
    sourcePath: sourcePath || `/products/${productId}`,
    desiredDepartureYmd: selectedDeparture?.ymd ?? null,
  });

  return (
    <section
      id="product-booking-zone"
      aria-label="출발일·인원 선택 및 예약"
      className={cn(
        "scroll-mt-[calc(var(--site-header-height,7rem)+1rem)] space-y-4",
        visibility === "desktopOnly" ? "hidden lg:block" : undefined,
        className,
      )}
    >
      <div className="space-y-1">
        <h2 className="text-lg font-bold text-[#0f172a]">출발일 · 인원 · 옵션</h2>
        <p className="text-sm text-slate-500">
          선택한 출발일과 인원이 예상가·예약 금액에 바로 반영됩니다.
        </p>
      </div>

      {showSelection ? (
        <ConnectedProductBookingSelectionPanel
          variant="page"
          product={product}
          productTitle={productTitle}
        />
      ) : null}

      <div className="rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-4 sm:p-5">
        {isSoldOut ? (
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
        ) : isConsultQuoteFlow ? (
          <div className="space-y-3">
            <Link
              href={quoteHref}
              className="inline-flex min-h-[52px] w-full items-center justify-center rounded-xl bg-[var(--accent)] px-4 text-sm font-semibold text-[var(--on-accent)] shadow-[var(--shadow-soft)]"
            >
              이 일정으로 견적 받기
            </Link>
            <p className="text-center text-[11px] leading-snug text-slate-500">
              {selectedDeparture?.ymd
                ? "선택한 출발일이 견적 문의에 자동으로 채워집니다."
                : "출발일을 고르면 견적 문의에 희망일이 채워집니다. 없어도 문의는 가능합니다."}
            </p>
            <ProductConsultCTA
              productId={productId}
              productTitle={productTitle}
              sourcePath={sourcePath}
              kakaoHref={kakaoHref}
              status={status}
              section="top"
              primaryLabel="빠른 문의"
              helperText="카톡·문의로도 바로 상담할 수 있습니다."
            />
          </div>
        ) : (
          <ProductStickyCheckoutRail
            product={product}
            productTitle={productTitle}
            kakaoHref={kakaoHref}
            layout="rail"
            analyticsSection="sidebar"
          />
        )}
      </div>
    </section>
  );
}

export { buildProductQuoteHref };
