"use client";

import { useMemo, useRef, useState, type FormEvent } from "react";
import { useConsultModal } from "@/components/inquiry/ConsultModal";
import { useProductQuote } from "@/components/products/ProductQuoteContext";
import {
  createOrderId,
  type BookingPaymentPayload,
  type CheckoutPaymentType,
} from "@/lib/payments/bookingPaymentPayload";
import {
  buildCheckoutQuote,
  CHECKOUT_DEPOSIT_PER_PERSON,
} from "@/lib/payments/buildCheckoutQuote";
import {
  firstCheckoutFormErrorKey,
  formatPhoneInput,
  validateCheckoutForm,
  type CheckoutFormErrors,
  type CheckoutFormValues,
} from "@/lib/payments/checkoutFormValidation";
import { resolveCheckoutPayAmounts } from "@/lib/payments/resolveCheckoutPayAmounts";
import { submitPayment } from "@/lib/payments/submitPayment";
import { formatPriceKR } from "@/lib/pricing/calcQuote";
import type { ProductOptions, SelectedOptions } from "@/types/product";

export type ProductCheckoutSectionProps = {
  productId: string;
  productTitle: string;
  options?: ProductOptions | null;
  selectedOptions: SelectedOptions;
  selectedDepartureKey: string | null;
  departureRequired: boolean;
  requiredGroupsMissing: boolean;
  travelerCount: number;
  /** 엔진 호환용. 간편 주문서 UI에서는 포인트/쿠폰 미적용 */
  benefitMode?: "golf_coupon" | "package_points";
};

const EMPTY_FORM: CheckoutFormValues = {
  name: "",
  phone: "",
  email: "",
  specialRequest: "",
  agreeTerms: false,
  agreePrivacy: false,
  agreeRefund: false,
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
}: ProductCheckoutSectionProps) {
  const { openModal: openConsultModal } = useConsultModal();
  const { selectedDeparture } = useProductQuote();

  const [paymentType, setPaymentType] = useState<CheckoutPaymentType>("deposit");
  const [form, setForm] = useState<CheckoutFormValues>(EMPTY_FORM);
  const [errors, setErrors] = useState<CheckoutFormErrors>({});
  const [message, setMessage] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const nameRef = useRef<HTMLInputElement>(null);
  const phoneRef = useRef<HTMLInputElement>(null);
  const emailRef = useRef<HTMLInputElement>(null);
  const agreeTermsRef = useRef<HTMLInputElement>(null);
  const agreePrivacyRef = useRef<HTMLInputElement>(null);
  const agreeRefundRef = useRef<HTMLInputElement>(null);

  /** 간편 주문서: 포인트·쿠폰 미적용 — 총 여행 금액 + 인당×인원 예약금만 */
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
      pointsUse: 0,
      travelerCount,
      applyPaxDiscount: false,
    });
  }, [options, selectedOptions, selectedDeparture, travelerCount]);

  const payAmounts = useMemo(
    () =>
      resolveCheckoutPayAmounts({
        paymentType,
        totalTripPrice: quotePreview.quoteTotal,
        depositTotal: quotePreview.depositAmount,
      }),
    [paymentType, quotePreview.quoteTotal, quotePreview.depositAmount],
  );

  const canCheckout =
    Boolean(selectedDepartureKey) &&
    (!departureRequired || Boolean(selectedDeparture)) &&
    !requiredGroupsMissing &&
    quotePreview.quoteTotal > 0;

  const checkoutBlockedReason = (() => {
    if (requiredGroupsMissing) return "필수 옵션을 모두 선택하면 결제가 가능합니다.";
    if (departureRequired && !selectedDepartureKey) {
      return "달력에서 출발일을 선택하면 결제가 가능합니다.";
    }
    if (!selectedDepartureKey) return "출발일을 선택하면 결제가 가능합니다.";
    if (quotePreview.quoteTotal <= 0) {
      return "견적 금액을 계산할 수 없습니다. 출발일·옵션을 확인해 주세요.";
    }
    return null;
  })();

  const setField = <K extends keyof CheckoutFormValues>(key: K, value: CheckoutFormValues[K]) => {
    setForm((prev) => ({ ...prev, [key]: value }));
    setErrors((prev) => {
      if (!prev[key]) return prev;
      const next = { ...prev };
      delete next[key];
      return next;
    });
  };

  const focusFirstError = (nextErrors: CheckoutFormErrors) => {
    const key = firstCheckoutFormErrorKey(nextErrors);
    const map = {
      name: nameRef,
      phone: phoneRef,
      email: emailRef,
      agreeTerms: agreeTermsRef,
      agreePrivacy: agreePrivacyRef,
      agreeRefund: agreeRefundRef,
      specialRequest: null,
    } as const;
    if (!key) return;
    const ref = map[key];
    ref?.current?.focus();
  };

  const buildPayload = (): BookingPaymentPayload => {
    const optionItems = quotePreview.breakdown.map((item) => ({
      id: `${item.groupId}:${item.optionId}`,
      name: `${item.groupLabel} · ${item.optionLabel}`,
      price: item.priceDelta,
    }));

    return {
      orderId: createOrderId(),
      productId,
      productName: productTitle,
      selectedDate: selectedDeparture?.inquiryValue ?? selectedDeparture?.label ?? "",
      headcount: travelerCount,
      selectedOptions: optionItems,
      paymentType,
      totalTripPrice: payAmounts.totalTripPrice,
      payAmount: payAmounts.payAmount,
      remainingBalance: payAmounts.remainingBalance,
      customer: {
        name: form.name.trim(),
        phone: form.phone.trim(),
        email: form.email.trim(),
      },
      specialRequest: form.specialRequest.trim() || undefined,
    };
  };

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    if (!canCheckout || submitting) return;

    const nextErrors = validateCheckoutForm(form);
    setErrors(nextErrors);
    if (Object.keys(nextErrors).length > 0) {
      focusFirstError(nextErrors);
      return;
    }

    setSubmitting(true);
    setMessage("");
    try {
      const result = await submitPayment(buildPayload());
      if (!result.ok) {
        setMessage(result.message);
      }
    } catch {
      setMessage("결제 요청 중 오류가 발생했습니다. 잠시 후 다시 시도해 주세요.");
    } finally {
      setSubmitting(false);
    }
  };

  const agreeAll =
    form.agreeTerms && form.agreePrivacy && form.agreeRefund;

  const toggleAgreeAll = (checked: boolean) => {
    setForm((prev) => ({
      ...prev,
      agreeTerms: checked,
      agreePrivacy: checked,
      agreeRefund: checked,
    }));
    if (checked) {
      setErrors((prev) => {
        const next = { ...prev };
        delete next.agreeTerms;
        delete next.agreePrivacy;
        delete next.agreeRefund;
        return next;
      });
    }
  };

  return (
    <section className="mt-4 rounded-2xl border border-[var(--border)] bg-[var(--surface-muted)]/40 p-5">
      <h3 className="text-base font-bold text-[#0f172a]">간편 예약 · 결제</h3>
      <p className="mt-1 text-xs text-slate-500">
        인당 예약금 {CHECKOUT_DEPOSIT_PER_PERSON.toLocaleString("ko-KR")}원 × 인원으로 계산됩니다.
        전액 결제도 선택할 수 있습니다.
      </p>

      {checkoutBlockedReason ? (
        <p className="mt-3 rounded-lg border border-[var(--warning)]/25 bg-[var(--warning-bg)] px-3 py-2 text-sm text-[var(--warning)]">
          {checkoutBlockedReason}
        </p>
      ) : null}

      <form onSubmit={(e) => void handleSubmit(e)} className="mt-4 space-y-5" noValidate>
        {/* 결제 방식 */}
        <fieldset disabled={!canCheckout}>
          <legend className="text-sm font-semibold text-[#0f172a]">결제 방식</legend>
          <div className="mt-2 grid gap-2 sm:grid-cols-2">
            <PaymentTypeCard
              selected={paymentType === "deposit"}
              onSelect={() => setPaymentType("deposit")}
              title="예약금 결제"
              badge="추천"
              description={`인원 × ${CHECKOUT_DEPOSIT_PER_PERSON.toLocaleString("ko-KR")}원. 잔금은 마이페이지에서 안내드립니다.`}
              amountLabel={formatPriceKR(quotePreview.depositAmount)}
            />
            <PaymentTypeCard
              selected={paymentType === "full"}
              onSelect={() => setPaymentType("full")}
              title="전액 결제"
              description="총 여행 금액을 한 번에 결제합니다."
              amountLabel={formatPriceKR(quotePreview.quoteTotal)}
            />
          </div>
        </fieldset>

        {/* 주문자 */}
        <fieldset disabled={!canCheckout} className="space-y-3">
          <legend className="text-sm font-semibold text-[#0f172a]">예약자 정보</legend>

          <div>
            <label className="block text-xs font-medium text-slate-600" htmlFor="checkout-name">
              성함 <span className="text-[var(--danger)]">*</span>
            </label>
            <input
              ref={nameRef}
              id="checkout-name"
              name="name"
              type="text"
              autoComplete="name"
              value={form.name}
              onChange={(e) => setField("name", e.target.value)}
              className="mt-1 w-full rounded-lg border border-[var(--border)] bg-white px-3 py-2 text-sm"
              aria-invalid={Boolean(errors.name)}
            />
            {errors.name ? <p className="mt-1 text-xs text-[var(--danger)]">{errors.name}</p> : null}
          </div>

          <div>
            <label className="block text-xs font-medium text-slate-600" htmlFor="checkout-phone">
              휴대폰 <span className="text-[var(--danger)]">*</span>
            </label>
            <input
              ref={phoneRef}
              id="checkout-phone"
              name="phone"
              type="tel"
              inputMode="numeric"
              autoComplete="tel"
              placeholder="010-0000-0000"
              value={form.phone}
              onChange={(e) => setField("phone", formatPhoneInput(e.target.value))}
              className="mt-1 w-full rounded-lg border border-[var(--border)] bg-white px-3 py-2 text-sm"
              aria-invalid={Boolean(errors.phone)}
            />
            {errors.phone ? <p className="mt-1 text-xs text-[var(--danger)]">{errors.phone}</p> : null}
          </div>

          <div>
            <label className="block text-xs font-medium text-slate-600" htmlFor="checkout-email">
              이메일 <span className="text-[var(--danger)]">*</span>
            </label>
            <input
              ref={emailRef}
              id="checkout-email"
              name="email"
              type="email"
              autoComplete="email"
              value={form.email}
              onChange={(e) => setField("email", e.target.value)}
              className="mt-1 w-full rounded-lg border border-[var(--border)] bg-white px-3 py-2 text-sm"
              aria-invalid={Boolean(errors.email)}
            />
            {errors.email ? <p className="mt-1 text-xs text-[var(--danger)]">{errors.email}</p> : null}
          </div>

          <div>
            <label className="block text-xs font-medium text-slate-600" htmlFor="checkout-request">
              요청사항
            </label>
            <textarea
              id="checkout-request"
              name="specialRequest"
              rows={3}
              value={form.specialRequest}
              onChange={(e) => setField("specialRequest", e.target.value)}
              className="mt-1 w-full resize-y rounded-lg border border-[var(--border)] bg-white px-3 py-2 text-sm"
              placeholder="좌석·식사·픽업 등 요청사항을 적어 주세요."
            />
          </div>

          <div className="space-y-2 rounded-xl border border-[var(--border)] bg-white px-3 py-3">
            <label className="flex items-start gap-2 text-sm font-medium text-[#0f172a]">
              <input
                type="checkbox"
                checked={agreeAll}
                onChange={(e) => toggleAgreeAll(e.target.checked)}
                className="mt-0.5"
              />
              약관 전체 동의
            </label>
            <label className="flex items-start gap-2 text-xs text-slate-600">
              <input
                ref={agreeTermsRef}
                type="checkbox"
                checked={form.agreeTerms}
                onChange={(e) => setField("agreeTerms", e.target.checked)}
                className="mt-0.5"
              />
              (필수) 여행 표준약관 동의
            </label>
            {errors.agreeTerms ? (
              <p className="pl-6 text-xs text-[var(--danger)]">{errors.agreeTerms}</p>
            ) : null}
            <label className="flex items-start gap-2 text-xs text-slate-600">
              <input
                ref={agreePrivacyRef}
                type="checkbox"
                checked={form.agreePrivacy}
                onChange={(e) => setField("agreePrivacy", e.target.checked)}
                className="mt-0.5"
              />
              (필수) 개인정보 수집·이용 동의
            </label>
            {errors.agreePrivacy ? (
              <p className="pl-6 text-xs text-[var(--danger)]">{errors.agreePrivacy}</p>
            ) : null}
            <label className="flex items-start gap-2 text-xs text-slate-600">
              <input
                ref={agreeRefundRef}
                type="checkbox"
                checked={form.agreeRefund}
                onChange={(e) => setField("agreeRefund", e.target.checked)}
                className="mt-0.5"
              />
              (필수) 취소·환불 규정 확인
            </label>
            {errors.agreeRefund ? (
              <p className="pl-6 text-xs text-[var(--danger)]">{errors.agreeRefund}</p>
            ) : null}
          </div>
        </fieldset>

        {/* 요약 */}
        <dl className="space-y-2 rounded-xl border border-[var(--border)] bg-white px-4 py-3 text-sm">
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
            <dt className="text-slate-500">총 여행 금액</dt>
            <dd className="font-semibold">{formatPriceKR(quotePreview.quoteTotal)}</dd>
          </div>
          <div className="flex justify-between gap-3">
            <dt className="text-slate-500">결제 방식</dt>
            <dd className="font-medium">{paymentType === "deposit" ? "예약금" : "전액"}</dd>
          </div>
          <div className="flex justify-between gap-3 border-t border-[var(--border)] pt-2">
            <dt className="font-semibold text-[#0f172a]">오늘 결제 금액</dt>
            <dd className="font-bold text-[var(--primary)]">{formatPriceKR(payAmounts.payAmount)}</dd>
          </div>
          {payAmounts.remainingBalance > 0 ? (
            <div className="flex justify-between gap-3">
              <dt className="text-slate-500">잔금 (마이페이지 안내)</dt>
              <dd>{formatPriceKR(payAmounts.remainingBalance)}</dd>
            </div>
          ) : (
            <p className="text-xs text-slate-500">잔금 없음 · 전액 결제</p>
          )}
        </dl>

        {message ? <p className="text-sm text-[var(--danger)]">{message}</p> : null}

        <div className="flex flex-col gap-2 sm:flex-row">
          <button
            type="submit"
            disabled={!canCheckout || submitting}
            className="inline-flex min-h-[48px] flex-1 items-center justify-center rounded-xl bg-[var(--primary)] px-4 py-3 text-sm font-semibold text-[var(--on-primary)] disabled:cursor-not-allowed disabled:opacity-50"
          >
            {submitting
              ? "처리 중…"
              : `₩${payAmounts.payAmount.toLocaleString("ko-KR")}원 결제하기`}
          </button>
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
      </form>
    </section>
  );
}

function PaymentTypeCard({
  selected,
  onSelect,
  title,
  description,
  amountLabel,
  badge,
}: {
  selected: boolean;
  onSelect: () => void;
  title: string;
  description: string;
  amountLabel: string;
  badge?: string;
}) {
  return (
    <button
      type="button"
      onClick={onSelect}
      className={`relative rounded-xl border px-3 py-3 text-left transition ${
        selected
          ? "border-[var(--primary)] bg-[var(--primary)]/5 ring-1 ring-[var(--primary)]"
          : "border-[var(--border)] bg-white hover:border-slate-300"
      }`}
    >
      {badge ? (
        <span className="absolute right-2 top-2 rounded bg-[var(--primary)] px-1.5 py-0.5 text-[10px] font-bold text-[var(--on-primary)]">
          {badge}
        </span>
      ) : null}
      <span className="block text-sm font-semibold text-[#0f172a]">{title}</span>
      <span className="mt-1 block text-xs text-slate-500">{description}</span>
      <span className="mt-2 block text-sm font-bold text-[var(--primary)]">{amountLabel}</span>
    </button>
  );
}
