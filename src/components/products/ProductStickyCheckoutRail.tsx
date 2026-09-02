"use client";

import { useMemo, useState } from "react";
import { Lock } from "lucide-react";
import { KakaoIcon } from "@/components/auth/AuthProviderIcons";
import { ProductCheckoutModal } from "@/components/products/ProductCheckoutModal";
import { useConsultModal } from "@/components/inquiry/ConsultModal";
import { useProductQuote } from "@/components/products/ProductQuoteContext";
import { ENABLE_PRODUCT_OPTIONS } from "@/config/featureFlags";
import { buildCheckoutQuote } from "@/lib/payments/buildCheckoutQuote";
import { resolveCheckoutDepartureYmd } from "@/lib/payments/resolveCheckoutDepartureYmd";
import { EMPTY_SELECTED_OPTIONS } from "@/lib/pricing/selectedOptions";
import { formatPriceKR } from "@/lib/pricing/calcQuote";
import type { Product } from "@/types/product";
import {
  trackProductCtaClick,
  trackProductDetailCtaClick,
} from "@/lib/analytics/trackProductClick";

export type ProductStickyCheckoutRailProps = {
  product?: Product | null;
  productTitle?: string;
  kakaoHref?: string;
  /** compact = 모바일 하단바용 짧은 CTA만 */
  layout?: "rail" | "bar";
  onOpenSelection?: () => void;
  /** sticky_mobile | sidebar — analytics section */
  analyticsSection?: "sticky_mobile" | "sidebar";
};

/**
 * 사이드바/모바일 CTA용 초경량 결제 진입점.
 * 옵션·금액 요약 + 예약하기 → ProductCheckoutModal.
 */
export function ProductStickyCheckoutRail({
  product,
  productTitle,
  kakaoHref,
  layout = "rail",
  onOpenSelection,
  analyticsSection = "sidebar",
}: ProductStickyCheckoutRailProps) {
  const {
    selectedOptions,
    selectedDeparture,
    selectedDepartureKey,
    travelerCount,
    requiredGroupsMissing,
    departureRequired,
    departureSelectionMissing,
    scrollToBooking,
    setDepartureSelection,
    paxDiscountPreview,
  } = useProductQuote();
  const { openModal: openConsultModal } = useConsultModal();

  const [modalOpen, setModalOpen] = useState(false);

  const options =
    ENABLE_PRODUCT_OPTIONS && product?.options?.groups?.length
      ? product.options
      : undefined;
  const optionsState = selectedOptions ?? EMPTY_SELECTED_OPTIONS;
  const title = productTitle?.trim() || product?.title || "상품";

  const trackBookingCta = (ctaType: "primary" | "kakao") => {
    if (!product?.id) return;
    trackProductDetailCtaClick({
      productId: product.id,
      ctaType,
      section: analyticsSection,
      hasPrice: true,
    });
    trackProductCtaClick({
      productId: product.id,
      ctaType,
      section: "sticky",
    });
  };

  const resolvedDepartureYmd = useMemo(
    () =>
      resolveCheckoutDepartureYmd({
        selectedDeparture,
        selectedDepartureKey,
        product,
      }),
    [selectedDeparture, selectedDepartureKey, product],
  );

  const departureForCheckout = useMemo(() => {
    if (!selectedDeparture) return null;
    if (selectedDeparture.ymd || !resolvedDepartureYmd) return selectedDeparture;
    return { ...selectedDeparture, ymd: resolvedDepartureYmd };
  }, [selectedDeparture, resolvedDepartureYmd]);

  const quotePreview = useMemo(() => {
    return buildCheckoutQuote({
      options,
      selectedOptions: optionsState,
      departure: departureForCheckout
        ? {
            label: departureForCheckout.label,
            inquiryValue: departureForCheckout.inquiryValue,
            ymd: departureForCheckout.ymd,
            price: departureForCheckout.price,
          }
        : null,
      pointsUse: 0,
      travelerCount,
      applyPaxDiscount: false,
    });
  }, [options, optionsState, departureForCheckout, travelerCount]);

  const totalTripPrice = quotePreview.quoteTotal;

  const canReserve =
    Boolean(selectedDepartureKey) &&
    (!departureRequired || Boolean(selectedDeparture)) &&
    !requiredGroupsMissing &&
    Boolean(resolvedDepartureYmd) &&
    totalTripPrice > 0;

  const optionItems = useMemo(
    () =>
      quotePreview.breakdown.map((item) => ({
        id: `${item.groupId}:${item.optionId}`,
        name: `${item.groupLabel} · ${item.optionLabel}`,
        price: item.priceDelta,
      })),
    [quotePreview.breakdown],
  );

  const openCheckout = () => {
    trackBookingCta("primary");
    if (!canReserve) {
      if (onOpenSelection) {
        onOpenSelection();
        return;
      }
      scrollToBooking(
        departureSelectionMissing || !resolvedDepartureYmd
          ? "departure"
          : requiredGroupsMissing
            ? "options"
            : "panel",
      );
      return;
    }
    if (selectedDeparture && !selectedDeparture.ymd && resolvedDepartureYmd) {
      setDepartureSelection(
        { ...selectedDeparture, ymd: resolvedDepartureYmd },
        selectedDepartureKey,
      );
    }
    setModalOpen(true);
  };

  const openKakao = async () => {
    trackBookingCta("kakao");
    if (kakaoHref && typeof window !== "undefined") {
      window.open(kakaoHref, "_blank", "noopener,noreferrer");
      return;
    }
    openConsultModal({
      productId: product?.id,
      productTitle: title,
      sourcePath: product?.id ? `/products/${product.id}` : undefined,
    });
  };

  const reserveLabel = canReserve
    ? `₩${totalTripPrice.toLocaleString("ko-KR")} 예약하기`
    : departureSelectionMissing || !resolvedDepartureYmd
      ? "출발일 선택 후 예약"
      : requiredGroupsMissing
        ? "옵션 선택 후 예약"
        : "예약하기";

  if (layout === "bar") {
    return (
      <>
        <div className="flex min-h-[44px] w-full min-w-0 max-w-full flex-1 items-center gap-2 overflow-hidden">
          <button
            type="button"
            onClick={openCheckout}
            className="inline-flex min-h-[48px] min-w-0 flex-1 items-center justify-center overflow-hidden rounded-xl bg-[var(--accent)] px-3 text-sm font-semibold text-[var(--on-accent)] shadow-[var(--shadow-soft)] sm:px-4"
          >
            <span className="block min-w-0 truncate">{reserveLabel}</span>
          </button>
          <button
            type="button"
            onClick={() => void openKakao()}
            className="inline-flex h-12 w-12 min-h-12 min-w-12 shrink-0 items-center justify-center rounded-xl border border-[var(--theall-kakao-border)] bg-[var(--theall-kakao-bg)] p-0 text-[var(--theall-kakao-text)]"
            aria-label="카톡 상담"
          >
            <KakaoIcon className="h-5 w-5 shrink-0" aria-hidden />
          </button>
        </div>
        {product?.id ? (
          <ProductCheckoutModal
            open={modalOpen}
            onClose={() => setModalOpen(false)}
            productId={product.id}
            productTitle={title}
            selectedDeparture={departureForCheckout}
            travelerCount={travelerCount}
            selectedOptions={optionsState}
            optionItems={optionItems}
            totalTripPrice={totalTripPrice}
            paxDiscountPreview={paxDiscountPreview}
          />
        ) : null}
      </>
    );
  }

  return (
    <>
      <div id="product-checkout" className="space-y-3 scroll-mt-28">
        <dl className="rounded-xl bg-slate-50 px-3 py-2.5 text-xs text-slate-600">
          <div className="flex justify-between gap-2">
            <dt>상품 총액</dt>
            <dd className="font-semibold text-[var(--primary)]">
              ₩{formatPriceKR(totalTripPrice) ?? "0"}
            </dd>
          </div>
          <p className="mt-2 text-[11px] leading-snug text-slate-500">
            출발일·인원 확인 후 상품 총액을 결제합니다.
          </p>
          {paxDiscountPreview && paxDiscountPreview.amount > 0 ? (
            <p className="mt-1 text-[11px] leading-snug text-[var(--success)]">
              골프 회원 혜택 · 보유 쿠폰팩은 예약 단계에서 확인·적용됩니다
            </p>
          ) : null}
        </dl>

        <button
          type="button"
          onClick={openCheckout}
          disabled={!product?.id}
          className="inline-flex min-h-[52px] w-full items-center justify-center rounded-xl bg-[var(--accent)] px-4 text-sm font-semibold text-[var(--on-accent)] shadow-[var(--shadow-soft)] disabled:opacity-50"
        >
          {reserveLabel}
        </button>
        <p className="text-center text-[11px] leading-snug text-slate-500">
          출발일·인원을 확인한 뒤 결제합니다.
        </p>

        <button
          type="button"
          onClick={() => void openKakao()}
          className="inline-flex min-h-[44px] w-full items-center justify-center gap-2 rounded-xl border border-slate-200 bg-white px-4 text-sm font-medium text-slate-700 hover:bg-slate-50"
        >
          <KakaoIcon className="h-4 w-4" />
          카톡 상담
        </button>
        <p className="text-center text-[11px] leading-snug text-slate-500">
          일정·가격이 궁금하신가요? 카톡으로 상담해 보세요.
        </p>

        <p className="flex items-center justify-center gap-1 text-center text-[11px] leading-relaxed text-slate-500">
          <Lock className="h-3 w-3 shrink-0" aria-hidden />
          확정 전 무료 취소 가능
        </p>
      </div>

      {product?.id ? (
        <ProductCheckoutModal
          open={modalOpen}
          onClose={() => setModalOpen(false)}
          productId={product.id}
          productTitle={title}
          selectedDeparture={departureForCheckout}
          travelerCount={travelerCount}
          selectedOptions={optionsState}
          optionItems={optionItems}
          totalTripPrice={totalTripPrice}
          paxDiscountPreview={paxDiscountPreview}
        />
      ) : null}
    </>
  );
}
