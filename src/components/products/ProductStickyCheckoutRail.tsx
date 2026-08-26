"use client";

import { useMemo, useState } from "react";
import { Lock } from "lucide-react";
import { KakaoIcon } from "@/components/auth/AuthProviderIcons";
import { ProductCheckoutModal } from "@/components/products/ProductCheckoutModal";
import { useConsultModal } from "@/components/inquiry/ConsultModal";
import { useProductQuote } from "@/components/products/ProductQuoteContext";
import { ENABLE_PRODUCT_OPTIONS } from "@/config/featureFlags";
import {
  buildCheckoutQuote,
  CHECKOUT_DEPOSIT_PER_PERSON,
} from "@/lib/payments/buildCheckoutQuote";
import type { CheckoutPaymentType } from "@/lib/payments/bookingPaymentPayload";
import { resolveCheckoutDepartureYmd } from "@/lib/payments/resolveCheckoutDepartureYmd";
import { resolveCheckoutPayAmounts } from "@/lib/payments/resolveCheckoutPayAmounts";
import { EMPTY_SELECTED_OPTIONS } from "@/lib/pricing/selectedOptions";
import { formatPriceKR } from "@/lib/pricing/calcQuote";
import { cn } from "@/lib/cn";
import type { Product } from "@/types/product";

export type ProductStickyCheckoutRailProps = {
  product?: Product | null;
  productTitle?: string;
  kakaoHref?: string;
  /** compact = 모바일 하단바용 짧은 CTA만 */
  layout?: "rail" | "bar";
  onOpenSelection?: () => void;
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
  } = useProductQuote();
  const { openModal: openConsultModal } = useConsultModal();

  const [paymentType, setPaymentType] = useState<CheckoutPaymentType>("deposit");
  const [modalOpen, setModalOpen] = useState(false);

  const options =
    ENABLE_PRODUCT_OPTIONS && product?.options?.groups?.length
      ? product.options
      : undefined;
  const optionsState = selectedOptions ?? EMPTY_SELECTED_OPTIONS;
  const title = productTitle?.trim() || product?.title || "상품";

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
      depositPerPerson: CHECKOUT_DEPOSIT_PER_PERSON,
    });
  }, [options, optionsState, departureForCheckout, travelerCount]);

  const payAmounts = useMemo(
    () =>
      resolveCheckoutPayAmounts({
        paymentType,
        totalTripPrice: quotePreview.quoteTotal,
        depositTotal: quotePreview.depositAmount,
      }),
    [paymentType, quotePreview.quoteTotal, quotePreview.depositAmount],
  );

  const canReserve =
    Boolean(selectedDepartureKey) &&
    (!departureRequired || Boolean(selectedDeparture)) &&
    !requiredGroupsMissing &&
    Boolean(resolvedDepartureYmd) &&
    payAmounts.payAmount > 0;

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
    // sticky에서 예전에 선택한 칩에 ymd가 없으면 복구해 컨텍스트에 반영
    if (selectedDeparture && !selectedDeparture.ymd && resolvedDepartureYmd) {
      setDepartureSelection(
        { ...selectedDeparture, ymd: resolvedDepartureYmd },
        selectedDepartureKey,
      );
    }
    setModalOpen(true);
  };

  const openKakao = async () => {
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
    ? `₩${payAmounts.payAmount.toLocaleString("ko-KR")}원 예약하기`
    : departureSelectionMissing || !resolvedDepartureYmd
      ? "출발일 선택 후 예약"
      : requiredGroupsMissing
        ? "옵션 선택 후 예약"
        : "예약하기";

  if (layout === "bar") {
    return (
      <>
        <div className="flex min-h-[44px] flex-1 items-center gap-2">
          <button
            type="button"
            onClick={openCheckout}
            className="inline-flex min-h-[48px] flex-1 items-center justify-center rounded-xl bg-[var(--accent)] px-4 text-sm font-semibold text-[var(--on-accent)] shadow-[var(--shadow-soft)]"
          >
            {reserveLabel}
          </button>
          <button
            type="button"
            onClick={() => void openKakao()}
            className="inline-flex min-h-[48px] shrink-0 items-center justify-center gap-1.5 rounded-xl border border-[var(--theall-kakao-border)] bg-[var(--theall-kakao-bg)] px-3 text-xs font-semibold text-[var(--theall-kakao-text)]"
            aria-label="카톡 상담"
          >
            <KakaoIcon className="h-4 w-4" />
            카톡
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
            paymentType={paymentType}
            onPaymentTypeChange={setPaymentType}
            totalTripPrice={quotePreview.quoteTotal}
            depositTotal={quotePreview.depositAmount}
            payAmount={payAmounts.payAmount}
            remainingBalance={payAmounts.remainingBalance}
          />
        ) : null}
      </>
    );
  }

  return (
    <>
      <div id="product-checkout" className="space-y-3 scroll-mt-28">
        <div>
          <p className="text-xs font-semibold text-slate-700">결제 방식</p>
          <div className="mt-2 grid grid-cols-1 gap-2">
            <MiniPayCard
              selected={paymentType === "deposit"}
              onSelect={() => setPaymentType("deposit")}
              title="예약금"
              badge="추천"
              amount={quotePreview.depositAmount}
            />
            <MiniPayCard
              selected={paymentType === "full"}
              onSelect={() => setPaymentType("full")}
              title="전액"
              amount={quotePreview.quoteTotal}
            />
          </div>
        </div>

        <dl className="rounded-xl bg-slate-50 px-3 py-2.5 text-xs text-slate-600">
          <div className="flex justify-between gap-2">
            <dt>총 여행 금액</dt>
            <dd className="font-medium text-slate-800">
              ₩{formatPriceKR(quotePreview.quoteTotal) ?? "0"}
            </dd>
          </div>
          <div className="mt-1 flex justify-between gap-2">
            <dt>오늘 결제</dt>
            <dd className="font-semibold text-[var(--primary)]">
              ₩{formatPriceKR(payAmounts.payAmount) ?? "0"}
            </dd>
          </div>
        </dl>

        <button
          type="button"
          onClick={openCheckout}
          disabled={!product?.id}
          className="inline-flex min-h-[52px] w-full items-center justify-center rounded-xl bg-[var(--accent)] px-4 text-sm font-semibold text-[var(--on-accent)] shadow-[var(--shadow-soft)] disabled:opacity-50"
        >
          {reserveLabel}
        </button>

        <button
          type="button"
          onClick={() => void openKakao()}
          className="inline-flex min-h-[44px] w-full items-center justify-center gap-2 rounded-xl border border-slate-200 bg-white px-4 text-sm font-medium text-slate-700 hover:bg-slate-50"
        >
          <KakaoIcon className="h-4 w-4" />
          카톡 상담
        </button>

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
          paymentType={paymentType}
          onPaymentTypeChange={setPaymentType}
          totalTripPrice={quotePreview.quoteTotal}
          depositTotal={quotePreview.depositAmount}
          payAmount={payAmounts.payAmount}
          remainingBalance={payAmounts.remainingBalance}
        />
      ) : null}
    </>
  );
}

function MiniPayCard({
  selected,
  onSelect,
  title,
  amount,
  badge,
}: {
  selected: boolean;
  onSelect: () => void;
  title: string;
  amount: number;
  badge?: string;
}) {
  return (
    <button
      type="button"
      onClick={onSelect}
      className={cn(
        "relative flex items-center justify-between rounded-xl border px-3 py-2.5 text-left transition",
        selected
          ? "border-[var(--primary)] bg-[var(--primary)]/5 ring-1 ring-[var(--primary)]"
          : "border-slate-200 bg-white hover:border-slate-300",
      )}
    >
      <span className="flex items-center gap-2">
        <span
          className={cn(
            "flex h-4 w-4 items-center justify-center rounded-full border",
            selected ? "border-[var(--primary)]" : "border-slate-300",
          )}
        >
          {selected ? <span className="h-2 w-2 rounded-full bg-[var(--primary)]" /> : null}
        </span>
        <span className="text-sm font-semibold text-slate-900">{title}</span>
        {badge ? (
          <span className="rounded bg-[var(--primary)] px-1.5 py-0.5 text-[10px] font-bold text-[var(--on-primary)]">
            {badge}
          </span>
        ) : null}
      </span>
      <span className="text-sm font-bold text-[var(--primary)]">
        ₩{formatPriceKR(amount) ?? "0"}
      </span>
    </button>
  );
}
