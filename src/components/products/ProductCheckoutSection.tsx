"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { PortOneCheckoutButton } from "@/components/payments/PortOneCheckoutButton";
import { useConsultModal } from "@/components/inquiry/ConsultModal";
import { useProductQuote } from "@/components/products/ProductQuoteContext";
import { formatPriceKR } from "@/lib/pricing/calcQuote";
import {
  buildCheckoutQuote,
  CHECKOUT_DEPOSIT_AMOUNT,
} from "@/lib/payments/buildCheckoutQuote";
import {
  normalizePointsUseRequested,
  validateInquiryPointsUse,
} from "@/lib/inquiry/inquiryPointsUse";
import type { ProductOptions, SelectedOptions } from "@/types/product";
import type { PortOneCheckoutParams } from "@/components/payments/PortOneCheckoutButton";

export type ProductCheckoutSectionProps = {
  productId: string;
  productTitle: string;
  options?: ProductOptions | null;
  selectedOptions: SelectedOptions;
  selectedDepartureKey: string | null;
  departureRequired: boolean;
  requiredGroupsMissing: boolean;
  travelerCount: number;
  /** 골프=쿠폰팩, 패키지=포인트. 기본 package_points */
  benefitMode?: "golf_coupon" | "package_points";
};

type PrepareResponse = {
  booking_id: string;
  booking_number: string;
  portone: PortOneCheckoutParams;
};

export function ProductCheckoutSection({
  productId,
  productTitle,
  options,
  selectedOptions,
  selectedDepartureKey,
  departureRequired,
  requiredGroupsMissing,
  travelerCount,
  benefitMode = "package_points",
}: ProductCheckoutSectionProps) {
  const router = useRouter();
  const { openModal: openConsultModal } = useConsultModal();
  const { selectedDeparture } = useProductQuote();
  const [pointBalance, setPointBalance] = useState<number | null>(null);
  const [pointsUse, setPointsUse] = useState(0);
  const [loggedIn, setLoggedIn] = useState<boolean | null>(null);
  const [hasPreviousBooking, setHasPreviousBooking] = useState(false);
  const [availableCoupon, setAvailableCoupon] = useState<{
    tier: "WELCOME" | "RETURNING";
    unitAmount: number;
    name: string;
  } | null>(null);
  const [message, setMessage] = useState("");
  const [prepareResult, setPrepareResult] = useState<PrepareResponse | null>(null);
  const [preparing, setPreparing] = useState(false);

  const isGolfCoupon = benefitMode === "golf_coupon";

  useEffect(() => {
    void (async () => {
      const res = await fetch("/api/me/points", { cache: "no-store" });
      if (res.status === 401) {
        setLoggedIn(false);
        setHasPreviousBooking(false);
        setAvailableCoupon(null);
        return;
      }
      if (!res.ok) return;
      setLoggedIn(true);
      const data = (await res.json()) as {
        balance?: number;
        hasPreviousBooking?: boolean;
      };
      const balance = Number(data.balance ?? 0);
      setPointBalance(balance);
      setHasPreviousBooking(Boolean(data.hasPreviousBooking));
    })();
  }, []);

  useEffect(() => {
    if (!isGolfCoupon || loggedIn !== true) {
      setAvailableCoupon(null);
      return;
    }
    void (async () => {
      const res = await fetch("/api/me/coupons", { cache: "no-store" });
      if (!res.ok) return;
      const data = (await res.json()) as {
        packs?: Array<{ tier?: string; unit_amount?: number; status?: string }>;
      };
      const pack = (data.packs ?? []).find((p) => p.status === "AVAILABLE");
      if (!pack) {
        setAvailableCoupon(null);
        return;
      }
      const tier = pack.tier === "RETURNING" ? "RETURNING" : "WELCOME";
      setAvailableCoupon({
        tier,
        unitAmount: Number(pack.unit_amount ?? 0),
        name: tier === "RETURNING" ? "3만원 쿠폰팩" : "5만원 쿠폰팩",
      });
    })();
  }, [isGolfCoupon, loggedIn]);

  useEffect(() => {
    if (isGolfCoupon) setPointsUse(0);
  }, [isGolfCoupon]);

  const applyPaxDiscount = isGolfCoupon && loggedIn === true && availableCoupon != null;
  const effectivePointsUse = isGolfCoupon ? 0 : pointsUse;

  const quotePreview = useMemo(() => {
    return buildCheckoutQuote({
      options,
      selectedOptions,
      departure: selectedDeparture
        ? {
            label: selectedDeparture.label,
            inquiryValue: selectedDeparture.inquiryValue,
            price: selectedDeparture.price,
          }
        : null,
      pointsUse: effectivePointsUse,
      travelerCount,
      applyPaxDiscount,
      hasPreviousBooking: applyPaxDiscount ? hasPreviousBooking : false,
      couponPack: availableCoupon
        ? { tier: availableCoupon.tier, unitAmount: availableCoupon.unitAmount }
        : null,
    });
  }, [
    options,
    selectedOptions,
    selectedDeparture,
    effectivePointsUse,
    travelerCount,
    applyPaxDiscount,
    hasPreviousBooking,
    availableCoupon,
  ]);

  const canCheckout =
    Boolean(selectedDepartureKey) &&
    (!departureRequired || Boolean(selectedDeparture)) &&
    !requiredGroupsMissing;

  const handlePrepare = useCallback(async () => {
    if (!canCheckout || !selectedDeparture) return;
    setPreparing(true);
    setMessage("");
    try {
      const res = await fetch("/api/bookings/checkout/prepare", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          product_id: productId,
          product_title: productTitle,
          source_path: `/products/${productId}`,
          departure: {
            label: selectedDeparture.label,
            inquiryValue: selectedDeparture.inquiryValue,
            price: selectedDeparture.price,
          },
          selected_options: selectedOptions,
          points_use: effectivePointsUse,
          traveler_count: travelerCount,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        setMessage(data.message ?? "결제 준비에 실패했습니다.");
        return;
      }
      setPrepareResult(data as PrepareResponse);
    } finally {
      setPreparing(false);
    }
  }, [
    canCheckout,
    selectedDeparture,
    productId,
    productTitle,
    selectedOptions,
    effectivePointsUse,
    travelerCount,
  ]);

  const loginHref = `/api/auth/kakao/start?next=${encodeURIComponent(`/products/${productId}`)}`;

  const checkoutBlockedReason = (() => {
    if (requiredGroupsMissing) return "필수 옵션을 모두 선택하면 예약금 결제가 가능합니다.";
    if (departureRequired && !selectedDepartureKey) {
      return "달력에서 출발일을 선택하면 예약금 결제가 가능합니다.";
    }
    if (!selectedDepartureKey) return "출발일을 선택하면 예약금 결제가 가능합니다.";
    return null;
  })();

  return (
    <section className="mt-4 rounded-2xl border border-[var(--border)] bg-[var(--surface-muted)]/40 p-5">
      <h3 className="text-base font-bold text-[#0f172a]">예약금 결제</h3>
      <p className="mt-1 text-xs text-slate-500">
        예약금 {CHECKOUT_DEPOSIT_AMOUNT.toLocaleString("ko-KR")}원 결제 후 마이페이지에서 잔금을
        안내해 드립니다.
      </p>

      {checkoutBlockedReason ? (
        <p className="mt-3 rounded-lg border border-[var(--warning)]/25 bg-[var(--warning-bg)] px-3 py-2 text-sm text-[var(--warning)]">
          {checkoutBlockedReason}
        </p>
      ) : null}

      {canCheckout ? (
        <>
          <dl className="mt-4 space-y-2 text-sm">
            {selectedDeparture ? (
              <div className="flex justify-between gap-3">
                <dt className="text-slate-500">출발일</dt>
                <dd className="font-medium">{selectedDeparture.label}</dd>
              </div>
            ) : null}
            <div className="flex justify-between gap-3">
              <dt className="text-slate-500">인원</dt>
              <dd className="font-medium">{travelerCount}명</dd>
            </div>
            <div className="flex justify-between gap-3">
              <dt className="text-slate-500">견적 합계</dt>
              <dd className="font-semibold">{formatPriceKR(quotePreview.quoteTotal)}</dd>
            </div>
            {quotePreview.paxDiscountAmount > 0 && quotePreview.discountLabel ? (
              <div className="rounded-xl border border-[var(--success)]/25 bg-[var(--success-bg)] px-3 py-2.5">
                <div className="flex justify-between gap-3 text-sm font-bold text-[var(--success)]">
                  <span>{quotePreview.discountLabel}</span>
                  <span className="shrink-0 text-[var(--success)]">
                    -{quotePreview.paxDiscountAmount.toLocaleString("ko-KR")}원
                  </span>
                </div>
                <p className="mt-1 text-[11px] font-medium text-[var(--success)]">
                  동반자 가입 불필요 · 대표 1명 예약 시 전체 인원 자동 할인 적용
                </p>
              </div>
            ) : null}
            {quotePreview.pointsApplied > 0 ? (
              <div className="flex justify-between gap-3 text-[var(--primary)]">
                <dt>포인트 할인</dt>
                <dd>-{quotePreview.pointsApplied.toLocaleString("ko-KR")}P</dd>
              </div>
            ) : null}
            <div className="flex justify-between gap-3">
              <dt className="text-slate-500">예약금 (지금 결제)</dt>
              <dd className="font-semibold">{formatPriceKR(quotePreview.depositAmount)}</dd>
            </div>
            <div className="flex justify-between gap-3">
              <dt className="text-slate-500">잔금 (마이페이지)</dt>
              <dd>{formatPriceKR(quotePreview.balanceDue)}</dd>
            </div>
          </dl>

          {loggedIn === false && isGolfCoupon ? (
            <p className="mt-3 rounded-lg border border-[var(--success)]/25 bg-[var(--success-bg)] px-3 py-2 text-xs text-[var(--success)]">
              로그인(카카오 간편가입) 후 골프투어 쿠폰팩(1인당 5만원~) 할인이 적용됩니다.
            </p>
          ) : null}

          {loggedIn === true && isGolfCoupon && !availableCoupon ? (
            <p className="mt-3 rounded-lg border border-[var(--warning)]/25 bg-[var(--warning-bg)] px-3 py-2 text-xs text-[var(--warning)]">
              사용 가능한 골프투어 쿠폰팩이 없습니다. 쿠폰팩 지급 후 인원 할인이 적용됩니다.
            </p>
          ) : null}

          {loggedIn === true && isGolfCoupon && availableCoupon ? (
            <p className="mt-3 text-xs text-emerald-700">
              적용 예정 쿠폰: {availableCoupon.name}
            </p>
          ) : null}

          {loggedIn && !isGolfCoupon && pointBalance != null && pointBalance > 0 ? (
            <div className="mt-4">
              <label className="block text-xs font-medium text-slate-600" htmlFor="checkout-points-use">
                포인트 사용 (보유 {pointBalance.toLocaleString("ko-KR")}P)
              </label>
              <p className="mt-0.5 text-[11px] text-slate-500">
                일반 패키지 여행에 보유 포인트를 사용할 수 있습니다. (골프투어 쿠폰팩과 별도)
              </p>
              <input
                id="checkout-points-use"
                type="number"
                min={0}
                max={pointBalance}
                value={pointsUse}
                onChange={(e) => setPointsUse(normalizePointsUseRequested(e.target.value))}
                className="mt-1 w-full rounded-lg border border-[var(--border)] px-3 py-2 text-sm"
              />
            </div>
          ) : null}

          {message ? <p className="mt-3 text-sm text-[var(--danger)]">{message}</p> : null}

          <div className="mt-4 flex flex-col gap-2 sm:flex-row">
            {loggedIn === false ? (
              <Link
                href={loginHref}
                className="inline-flex min-h-[48px] flex-1 items-center justify-center rounded-xl bg-[var(--primary)] px-4 py-3 text-sm font-semibold text-[var(--on-primary)]"
              >
                로그인 후 예약금 결제
              </Link>
            ) : prepareResult?.portone ? (
              <PortOneCheckoutButton
                params={{
                  ...prepareResult.portone,
                  redirectUrl: `${window.location.origin}/mypage/bookings/${prepareResult.booking_id}?deposit=1`,
                }}
                className="inline-flex min-h-[48px] flex-1 items-center justify-center rounded-xl bg-[var(--primary)] px-4 py-3 text-sm font-semibold text-[var(--on-primary)] disabled:opacity-60"
                onSuccess={() => {
                  router.push(`/mypage/bookings/${prepareResult.booking_id}?deposit=1`);
                }}
                onError={(err) => setMessage(err)}
              >
                예약금 {CHECKOUT_DEPOSIT_AMOUNT.toLocaleString("ko-KR")}원 결제
              </PortOneCheckoutButton>
            ) : (
              <button
                type="button"
                disabled={preparing || loggedIn !== true}
                onClick={() => void handlePrepare()}
                className="inline-flex min-h-[48px] flex-1 items-center justify-center rounded-xl bg-[var(--primary)] px-4 py-3 text-sm font-semibold text-[var(--on-primary)] disabled:opacity-60"
              >
                {preparing ? "준비 중…" : `예약금 ${CHECKOUT_DEPOSIT_AMOUNT.toLocaleString("ko-KR")}원 결제`}
              </button>
            )}

            <button
              type="button"
              onClick={() =>
                openConsultModal({
                  productId,
                  productTitle,
                  sourcePath: `/products/${productId}`,
                })
              }
              className="inline-flex min-h-[48px] items-center justify-center rounded-xl border border-[var(--border)] bg-white px-4 py-3 text-sm font-semibold"
            >
              빠른 문의
            </button>
          </div>

          {loggedIn && !isGolfCoupon && pointBalance != null && pointsUse > 0 ? (
            (() => {
              const v = validateInquiryPointsUse({ pointsUseRequested: pointsUse, pointBalance });
              if (v.ok) return null;
              return <p className="mt-2 text-xs text-[var(--danger)]">{v.message}</p>;
            })()
          ) : null}
        </>
      ) : (
        <div className="mt-4 flex flex-col gap-2 sm:flex-row">
          <button
            type="button"
            disabled
            className="inline-flex min-h-[48px] flex-1 cursor-not-allowed items-center justify-center rounded-xl bg-[var(--primary)]/50 px-4 py-3 text-sm font-semibold text-[var(--on-primary)]"
          >
            예약금 {CHECKOUT_DEPOSIT_AMOUNT.toLocaleString("ko-KR")}원 결제
          </button>
          {loggedIn === false ? (
            <Link
              href={loginHref}
              className="inline-flex min-h-[48px] items-center justify-center rounded-xl border border-[var(--primary)] px-4 py-3 text-sm font-semibold text-[var(--primary)]"
            >
              로그인 후 결제
            </Link>
          ) : null}
        </div>
      )}

      <div className="mt-3">
        <button
          type="button"
          onClick={() =>
            openConsultModal({
              productId,
              productTitle,
              sourcePath: `/products/${productId}`,
            })
          }
          className="text-sm font-medium text-[var(--primary)] underline-offset-2 hover:underline"
        >
          빠른 문의로 예약하기
        </button>
      </div>
    </section>
  );
}
