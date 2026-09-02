"use client";

import {
  forwardRef,
  useCallback,
  useImperativeHandle,
  useMemo,
  useRef,
  useState,
  type FormEvent,
} from "react";
import { useConsultModal } from "@/components/inquiry/ConsultModal";
import { useProductQuote } from "@/components/products/ProductQuoteContext";
import {
  createOrderId,
  type BookingPaymentPayload,
} from "@/lib/payments/bookingPaymentPayload";
import { buildCheckoutQuote } from "@/lib/payments/buildCheckoutQuote";
import {
  firstCheckoutFormErrorKey,
  formatPhoneInput,
  validateCheckoutForm,
  type CheckoutFormErrors,
  type CheckoutFormValues,
} from "@/lib/payments/checkoutFormValidation";
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
  benefitMode?: "golf_coupon" | "package_points";
  /** rail = 우측 sticky CTA용 컴팩트 레이아웃 */
  variant?: "default" | "rail";
};

export type ProductCheckoutHandle = {
  /** sticky 「결제하기」에서 호출 — PG 어댑터(submitPayment) */
  requestPay: () => Promise<boolean>;
  canCheckout: boolean;
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

export const ProductCheckoutSection = forwardRef<
  ProductCheckoutHandle,
  ProductCheckoutSectionProps
>(function ProductCheckoutSection(
  {
    productId,
    productTitle,
    options,
    selectedOptions,
    selectedDepartureKey,
    departureRequired,
    requiredGroupsMissing,
    travelerCount,
    variant = "default",
  },
  ref,
) {
  const rail = variant === "rail";
  const { openModal: openConsultModal } = useConsultModal();
  const { selectedDeparture } = useProductQuote();

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

  const totalTripPrice = quotePreview.quoteTotal;

  const canCheckout =
    Boolean(selectedDepartureKey) &&
    (!departureRequired || Boolean(selectedDeparture)) &&
    !requiredGroupsMissing &&
    totalTripPrice > 0;

  const checkoutBlockedReason = (() => {
    if (requiredGroupsMissing) return "필수 옵션을 모두 선택하면 결제가 가능합니다.";
    if (departureRequired && !selectedDepartureKey) {
      return "달력에서 출발일을 선택하면 결제가 가능합니다.";
    }
    if (!selectedDepartureKey) return "출발일을 선택하면 결제가 가능합니다.";
    if (totalTripPrice <= 0) {
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
    map[key]?.current?.focus();
  };

  const buildPayload = useCallback((): BookingPaymentPayload => {
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
      selectedOptionsMap: selectedOptions,
      departure: {
        label: selectedDeparture?.label ?? "",
        inquiryValue: selectedDeparture?.inquiryValue ?? "",
        price: selectedDeparture?.price,
      },
      totalTripPrice,
      payAmount: totalTripPrice,
      customer: {
        name: form.name.trim(),
        phone: form.phone.trim(),
        email: form.email.trim(),
      },
      specialRequest: form.specialRequest.trim() || undefined,
    };
  }, [
    quotePreview.breakdown,
    productId,
    productTitle,
    selectedDeparture,
    travelerCount,
    selectedOptions,
    totalTripPrice,
    form.name,
    form.phone,
    form.email,
    form.specialRequest,
  ]);

  const runPay = useCallback(async (): Promise<boolean> => {
    if (!canCheckout || submitting) return false;

    const nextErrors = validateCheckoutForm(form, { requireCustomer: true });
    setErrors(nextErrors);
    if (Object.keys(nextErrors).length > 0) {
      focusFirstError(nextErrors);
      document.getElementById("product-checkout")?.scrollIntoView({
        behavior: "smooth",
        block: "start",
      });
      return false;
    }

    setSubmitting(true);
    setMessage("");
    try {
      const result = await submitPayment(buildPayload());
      if (!result.ok) {
        setMessage(result.message);
        return false;
      }
      return true;
    } catch {
      setMessage("결제 요청 중 오류가 발생했습니다. 잠시 후 다시 시도해 주세요.");
      return false;
    } finally {
      setSubmitting(false);
    }
  }, [canCheckout, submitting, form, buildPayload]);

  useImperativeHandle(
    ref,
    () => ({
      requestPay: runPay,
      canCheckout,
    }),
    [runPay, canCheckout],
  );

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    await runPay();
  };

  const agreeAll = form.agreeTerms && form.agreePrivacy && form.agreeRefund;

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

  const payLabel = `₩${totalTripPrice.toLocaleString("ko-KR")}원 결제하기`;

  return (
    <section
      id="product-checkout"
      className={
        rail
          ? "scroll-mt-28"
          : "mt-4 scroll-mt-28 rounded-2xl border border-[var(--border)] bg-[var(--surface-muted)]/40 p-5"
      }
    >
      <h3 className={`font-bold text-[#0f172a] ${rail ? "text-sm" : "text-base"}`}>
        간편 예약 · 결제
      </h3>
      <p className="mt-1 text-xs text-slate-500">
        상품 총액을 결제하여 예약(좌석 및 티타임) 확정을 진행합니다.
      </p>

      {checkoutBlockedReason ? (
        <p className="mt-3 rounded-lg border border-[var(--warning)]/25 bg-[var(--warning-bg)] px-3 py-2 text-sm text-[var(--warning)]">
          {checkoutBlockedReason}
        </p>
      ) : null}

      <form
        onSubmit={(e) => void handleSubmit(e)}
        className={`mt-4 ${rail ? "space-y-4" : "space-y-5"}`}
        noValidate
      >
        <fieldset disabled={!canCheckout} className="space-y-3">
          <legend className="text-sm font-semibold text-[#0f172a]">예약자 정보</legend>

          <div>
            <label className="block text-xs font-medium text-slate-600" htmlFor="checkout-name">
              예약자명 <span className="text-[var(--danger)]">*</span>
            </label>
            <input
              ref={nameRef}
              id="checkout-name"
              name="name"
              type="text"
              autoComplete="name"
              placeholder="성함을 입력해 주세요"
              value={form.name}
              onChange={(e) => setField("name", e.target.value)}
              className="mt-1 w-full rounded-lg border border-[var(--border)] bg-white px-3 py-2 text-sm"
              aria-invalid={Boolean(errors.name)}
            />
            {errors.name ? <p className="mt-1 text-xs text-[var(--danger)]">{errors.name}</p> : null}
          </div>

          <div>
            <label className="block text-xs font-medium text-slate-600" htmlFor="checkout-phone">
              휴대폰 번호 <span className="text-[var(--danger)]">*</span>
            </label>
            <input
              ref={phoneRef}
              id="checkout-phone"
              name="phone"
              type="tel"
              inputMode="numeric"
              autoComplete="tel"
              placeholder="010-XXXX-XXXX"
              value={form.phone}
              onChange={(e) => setField("phone", formatPhoneInput(e.target.value))}
              className="mt-1 w-full rounded-lg border border-[var(--border)] bg-white px-3 py-2 text-sm"
              aria-invalid={Boolean(errors.phone)}
            />
            {errors.phone ? <p className="mt-1 text-xs text-[var(--danger)]">{errors.phone}</p> : null}
          </div>

          <div>
            <label className="block text-xs font-medium text-slate-600" htmlFor="checkout-email">
              이메일 주소 <span className="text-[var(--danger)]">*</span>
            </label>
            <input
              ref={emailRef}
              id="checkout-email"
              name="email"
              type="email"
              autoComplete="email"
              placeholder="예약 확인서 수신용 이메일"
              value={form.email}
              onChange={(e) => setField("email", e.target.value)}
              className="mt-1 w-full rounded-lg border border-[var(--border)] bg-white px-3 py-2 text-sm"
              aria-invalid={Boolean(errors.email)}
            />
            {errors.email ? <p className="mt-1 text-xs text-[var(--danger)]">{errors.email}</p> : null}
          </div>

          <div>
            <label className="block text-xs font-medium text-slate-600" htmlFor="checkout-request">
              추가 요청사항
            </label>
            <input
              id="checkout-request"
              name="specialRequest"
              type="text"
              value={form.specialRequest}
              onChange={(e) => setField("specialRequest", e.target.value)}
              className="mt-1 w-full rounded-lg border border-[var(--border)] bg-white px-3 py-2 text-sm"
              placeholder="요청사항이 있으시면 입력해 주세요 (선택)"
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
              전체 동의
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
              (필수) 개인정보 수집 및 이용 동의
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
              (필수) 취소 및 환불 규정 확인
            </label>
            {errors.agreeRefund ? (
              <p className="pl-6 text-xs text-[var(--danger)]">{errors.agreeRefund}</p>
            ) : null}
          </div>
        </fieldset>

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
          <div className="flex justify-between gap-3 border-t border-[var(--border)] pt-2">
            <dt className="font-semibold text-[#0f172a]">결제 금액</dt>
            <dd className="text-base font-bold text-[var(--primary)]">
              ₩{formatPriceKR(totalTripPrice) ?? "0"}
            </dd>
          </div>
        </dl>

        {message ? <p className="text-sm text-[var(--danger)]">{message}</p> : null}

        <div className="flex flex-col gap-2 sm:flex-row">
          <button
            type="submit"
            disabled={!canCheckout || submitting}
            className="inline-flex min-h-[48px] flex-1 items-center justify-center rounded-xl bg-[var(--primary)] px-4 py-3 text-sm font-semibold text-[var(--on-primary)] disabled:cursor-not-allowed disabled:opacity-50"
          >
            {submitting ? "처리 중…" : payLabel}
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
});
