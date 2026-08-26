"use client";

import { useEffect, useId, useMemo, useRef, useState, type FormEvent } from "react";
import { createPortal } from "react-dom";
import { UserRound, X } from "lucide-react";
import { useMemberCheckoutProfile } from "@/hooks/useMemberCheckoutProfile";
import { useProductQuote } from "@/components/products/ProductQuoteContext";
import {
  createOrderId,
  type BookingPaymentPayload,
  type CheckoutPaymentType,
} from "@/lib/payments/bookingPaymentPayload";
import { resolveCheckoutDepartureYmd } from "@/lib/payments/resolveCheckoutDepartureYmd";
import {
  firstCheckoutFormErrorKey,
  formatPhoneInput,
  validateCheckoutForm,
  type CheckoutFormErrors,
  type CheckoutFormValues,
} from "@/lib/payments/checkoutFormValidation";
import { submitPayment } from "@/lib/payments/submitPayment";
import { formatPriceKR } from "@/lib/pricing/calcQuote";
import { normalizeProductDepartureDateToYmd } from "@/lib/products/productDepartureDates";
import { cn } from "@/lib/cn";
import type { SelectedDeparture } from "@/lib/products/buildProductInquiryPrefill";
import type { BookingPaymentOptionItem } from "@/lib/payments/bookingPaymentPayload";
import type { SelectedOptions } from "@/types/product";

export type ProductCheckoutModalProps = {
  open: boolean;
  onClose: () => void;
  productId: string;
  productTitle: string;
  selectedDeparture: SelectedDeparture | null;
  travelerCount: number;
  selectedOptions: SelectedOptions;
  optionItems: BookingPaymentOptionItem[];
  /** 사이드바에서 선택한 결제 방식 — 모달 라디오·CTA 금액과 동기화 */
  paymentType: CheckoutPaymentType;
  onPaymentTypeChange: (type: CheckoutPaymentType) => void;
  totalTripPrice: number;
  depositTotal: number;
  payAmount: number;
  remainingBalance: number;
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

/** 원클릭 결제: 모달 오픈 시 약관 사전 동의 */
const AGREED_DEFAULTS: Pick<CheckoutFormValues, "agreeTerms" | "agreePrivacy" | "agreeRefund"> = {
  agreeTerms: true,
  agreePrivacy: true,
  agreeRefund: true,
};

function hasValue(v: string | undefined | null): boolean {
  return Boolean(v?.trim());
}

export function ProductCheckoutModal({
  open,
  onClose,
  productId,
  productTitle,
  selectedDeparture,
  travelerCount,
  selectedOptions,
  optionItems,
  paymentType,
  onPaymentTypeChange,
  totalTripPrice,
  depositTotal,
  payAmount,
  remainingBalance,
}: ProductCheckoutModalProps) {
  const titleId = useId();
  const { status: authStatus, profile, refresh: refreshProfile } = useMemberCheckoutProfile();
  const { selectedDepartureKey } = useProductQuote();
  const isMember = authStatus === "member";
  const isGuest = authStatus === "guest";

  const [form, setForm] = useState<CheckoutFormValues>({
    ...EMPTY_FORM,
    ...AGREED_DEFAULTS,
  });
  const [editingCustomer, setEditingCustomer] = useState(false);
  const [errors, setErrors] = useState<CheckoutFormErrors>({});
  const [message, setMessage] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [agreeAll, setAgreeAll] = useState(true);
  const [mounted, setMounted] = useState(false);

  const nameRef = useRef<HTMLInputElement>(null);
  const phoneRef = useRef<HTMLInputElement>(null);
  const emailRef = useRef<HTMLInputElement>(null);
  const agreeRef = useRef<HTMLInputElement>(null);
  const dialogRef = useRef<HTMLDialogElement>(null);
  /** PortOne UI가 body에 붙을 때 <dialog> top-layer에 가려지지 않도록 결제 중 일시 close */
  const payingRef = useRef(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  /** 모달 열릴 때마다 최신 회원 정보 재조회 — 로그인 직후 비회원 UI 잔존 방지 */
  useEffect(() => {
    if (!open) return;
    void refreshProfile();
  }, [open, refreshProfile]);

  /** 오픈 시에만 폼 리셋. profile deps면 재조회 시 타이핑 중 값이 날아감 */
  useEffect(() => {
    if (!open) return;
    setErrors({});
    setMessage("");
    setSubmitting(false);
    setAgreeAll(true);
    setEditingCustomer(false);
    setForm({
      ...EMPTY_FORM,
      ...AGREED_DEFAULTS,
      name: profile?.name ?? "",
      phone: profile?.phone ?? "",
      email: profile?.email ?? "",
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps -- open edge only
  }, [open]);

  /** 프로필이 늦게 도착해도 비어 있는 칸만 채움 (사용자 입력 유지) */
  useEffect(() => {
    if (!open || !isMember || !profile || editingCustomer) return;
    setForm((prev) => ({
      ...prev,
      name: prev.name.trim() ? prev.name : profile.name || "",
      phone: prev.phone.trim() ? prev.phone : profile.phone || "",
      email: prev.email.trim() ? prev.email : profile.email || "",
    }));
  }, [open, isMember, profile, editingCustomer]);

  useEffect(() => {
    const dialog = dialogRef.current;
    if (!dialog) return;
    if (payingRef.current) return;
    if (open && !dialog.open) dialog.showModal();
    else if (!open && dialog.open) dialog.close();
  }, [open]);

  useEffect(() => {
    if (!open) return;
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") onClose();
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, onClose]);

  /**
   * 인라인 입력 노출은 계정(profile) 기준.
   * form 기준으로 하면 한 글자 입력 즉시 missing=false → 입력창이 사라져 버림.
   */
  const missingName = isMember && !hasValue(profile?.name);
  const missingPhone = isMember && !hasValue(profile?.phone);
  const missingEmail = isMember && !hasValue(profile?.email);
  const hasAnyMissing = missingName || missingPhone || missingEmail;
  const formCustomerComplete =
    hasValue(form.name) && hasValue(form.phone) && hasValue(form.email);

  /** 회원 원클릭: 요약 카드. [변경] 시에만 전체 폼. 누락 항목만 인라인 */
  const showMemberSummary = isMember && !editingCustomer;
  const showFullCustomerForm = isGuest || (isMember && editingCustomer);

  const setField = <K extends keyof CheckoutFormValues>(key: K, value: CheckoutFormValues[K]) => {
    setForm((prev) => ({ ...prev, [key]: value }));
    setErrors((prev) => {
      if (!prev[key]) return prev;
      const next = { ...prev };
      delete next[key];
      return next;
    });
  };

  const applyAgreeAll = (checked: boolean) => {
    setAgreeAll(checked);
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

  const restoreMemberProfile = () => {
    setEditingCustomer(false);
    if (!profile) return;
    setForm((prev) => ({
      ...prev,
      name: profile.name,
      phone: profile.phone,
      email: profile.email,
    }));
    setErrors((prev) => {
      const next = { ...prev };
      delete next.name;
      delete next.phone;
      delete next.email;
      return next;
    });
  };

  const focusFirstError = (nextErrors: CheckoutFormErrors) => {
    const key = firstCheckoutFormErrorKey(nextErrors);
    if (key === "name") nameRef.current?.focus();
    else if (key === "phone") phoneRef.current?.focus();
    else if (key === "email") emailRef.current?.focus();
    else agreeRef.current?.focus();
  };

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    if (submitting) return;

    const nextErrors = validateCheckoutForm(form, { requireCustomer: true });
    setErrors(nextErrors);
    if (Object.keys(nextErrors).length > 0) {
      if (isMember && !editingCustomer && (nextErrors.name || nextErrors.phone || nextErrors.email)) {
        // 요약 모드에서 누락 검증 실패 시 인라인 노출 유지, 필요 시 전체 편집
        if (!hasAnyMissing) setEditingCustomer(true);
      }
      focusFirstError(nextErrors);
      return;
    }

    setSubmitting(true);
    setMessage("");
    try {
      const departureYmd =
        resolveCheckoutDepartureYmd({
          selectedDeparture,
          selectedDepartureKey,
        }) || normalizeProductDepartureDateToYmd(selectedDeparture?.ymd);

      if (!departureYmd) {
        setMessage("출발일 형식이 올바르지 않습니다. 달력에서 출발일을 다시 선택해 주세요.");
        setSubmitting(false);
        return;
      }

      const payload: BookingPaymentPayload = {
        orderId: createOrderId(),
        productId,
        productName: productTitle,
        selectedDate: departureYmd,
        headcount: travelerCount,
        selectedOptions: optionItems,
        selectedOptionsMap: selectedOptions,
        departure: {
          label: selectedDeparture?.label ?? departureYmd,
          inquiryValue: selectedDeparture?.inquiryValue ?? departureYmd,
          ymd: departureYmd,
          price: selectedDeparture?.price,
        },
        paymentType,
        totalTripPrice,
        payAmount,
        remainingBalance,
        customer: {
          name: form.name.trim(),
          phone: form.phone.trim(),
          email: form.email.trim(),
        },
        specialRequest: form.specialRequest.trim() || undefined,
      };

      // showModal() top-layer가 PortOne iframe/오버레이를 가리면 requestPayment가
      // resolve되지 않아 「결제창 여는 중…」에 고착된다. 결제 UI 직전에 dialog만 닫는다.
      payingRef.current = true;
      dialogRef.current?.close();

      const result = await submitPayment(payload);
      payingRef.current = false;

      if (!result.ok) {
        setMessage(result.message);
        if (open && dialogRef.current && !dialogRef.current.open) {
          dialogRef.current.showModal();
        }
        return;
      }
      onClose();
      if (typeof window !== "undefined") {
        const bookingNumber = result.bookingNumber;
        if (isMember && bookingNumber) {
          window.location.assign(`/mypage/bookings/${encodeURIComponent(bookingNumber)}`);
          return;
        }
        window.alert(
          bookingNumber
            ? `결제가 완료되었습니다.\n예약번호: ${bookingNumber}`
            : "결제가 완료되었습니다.",
        );
      }
    } catch {
      payingRef.current = false;
      setMessage("결제 요청 중 오류가 발생했습니다. 잠시 후 다시 시도해 주세요.");
      if (open && dialogRef.current && !dialogRef.current.open) {
        dialogRef.current.showModal();
      }
    } finally {
      setSubmitting(false);
    }
  };

  const summaryLine = useMemo(() => {
    const parts = [selectedDeparture?.label || "출발일 미선택", `${travelerCount}명`];
    return parts.join(" · ");
  }, [selectedDeparture, travelerCount]);

  const memberSummaryText = useMemo(() => {
    const parts = [
      form.name.trim() || "이름 미등록",
      form.phone.trim() || "연락처 미등록",
      form.email.trim() || "이메일 미등록",
    ];
    return parts.join(" · ");
  }, [form.name, form.phone, form.email]);

  if (!open || !mounted) return null;

  return createPortal(
    <dialog
      ref={dialogRef}
      aria-labelledby={titleId}
      className="fixed inset-0 z-[70] m-0 h-[100dvh] max-h-[100dvh] w-full max-w-none overflow-hidden bg-transparent p-0 backdrop:bg-black/45"
      onClose={() => {
        // 결제용 일시 close는 부모 open을 유지해야 PortOne 종료 후 모달을 다시 열 수 있음
        if (payingRef.current) return;
        onClose();
      }}
    >
      <div
        className="flex h-full flex-col justify-end lg:items-center lg:justify-center lg:p-6"
        onClick={onClose}
      >
        <div
          className={cn(
            "flex w-full flex-col overflow-hidden bg-white shadow-[0_-8px_32px_rgba(15,23,42,0.16)]",
            "max-h-[92dvh] rounded-t-2xl lg:max-h-[min(90vh,720px)] lg:max-w-lg lg:rounded-2xl",
          )}
          onClick={(e) => e.stopPropagation()}
        >
          <header className="flex shrink-0 items-start justify-between gap-3 border-b border-slate-100 px-5 py-4">
            <div className="min-w-0">
              <p className="text-xs font-medium uppercase tracking-wide text-slate-400">간편 예약</p>
              <h2 id={titleId} className="mt-0.5 truncate text-lg font-semibold text-slate-900">
                {productTitle}
              </h2>
              <p className="mt-1 text-sm text-slate-500">{summaryLine}</p>
            </div>
            <button
              type="button"
              onClick={onClose}
              className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-slate-500 hover:bg-slate-100"
              aria-label="닫기"
            >
              <X className="h-4 w-4" aria-hidden />
            </button>
          </header>

          <form
            onSubmit={(e) => void handleSubmit(e)}
            className="flex min-h-0 flex-1 flex-col"
            noValidate
          >
            <div className="min-h-0 flex-1 space-y-5 overflow-y-auto overscroll-contain px-5 py-4">
              <section>
                {authStatus === "loading" ? (
                  <p className="rounded-xl bg-slate-50 px-3 py-3 text-sm text-slate-500">
                    회원 정보를 불러오는 중…
                  </p>
                ) : null}

                {isGuest ? (
                  <>
                    <p className="mb-2 text-xs font-semibold tracking-wide text-[var(--primary)]">
                      비회원 간편 예약
                    </p>
                    <h3 className="mb-3 text-sm font-semibold text-slate-900">예약자 정보 입력</h3>
                  </>
                ) : null}

                {showMemberSummary ? (
                  <div className="space-y-3">
                    <div className="rounded-xl border border-slate-200 bg-slate-50 px-3.5 py-3">
                      <div className="flex items-start justify-between gap-2">
                        <div className="flex min-w-0 items-center gap-2">
                          <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-white text-slate-600 ring-1 ring-slate-200">
                            <UserRound className="h-4 w-4" aria-hidden />
                          </span>
                          <div className="min-w-0">
                            <p className="text-xs font-semibold text-slate-500">예약자 정보</p>
                            <p className="mt-0.5 truncate text-sm font-medium text-slate-900">
                              {memberSummaryText}
                            </p>
                          </div>
                        </div>
                        <button
                          type="button"
                          onClick={() => setEditingCustomer(true)}
                          className="shrink-0 text-xs font-medium text-[var(--primary)] underline-offset-2 hover:underline"
                        >
                          변경
                        </button>
                      </div>
                      <p className="mt-2 text-[11px] text-slate-400">
                        다른 사람 정보로 예약하려면 [변경]을 눌러 주세요.
                      </p>
                    </div>

                    {hasAnyMissing ? (
                      <div className="space-y-3">
                        <p className="text-xs leading-relaxed text-slate-500">
                          원클릭 결제를 위해 아래 빈 항목만 입력해 주세요.
                        </p>
                        {missingName ? (
                          <CustomerField
                            id="modal-checkout-name"
                            label="예약자명"
                            inputRef={nameRef}
                            value={form.name}
                            onChange={(v) => setField("name", v)}
                            placeholder="성함을 입력해 주세요"
                            autoComplete="name"
                            error={errors.name}
                          />
                        ) : null}
                        {missingPhone ? (
                          <CustomerField
                            id="modal-checkout-phone"
                            label="휴대폰"
                            inputRef={phoneRef}
                            value={form.phone}
                            onChange={(v) => setField("phone", formatPhoneInput(v))}
                            placeholder="010-XXXX-XXXX"
                            inputMode="numeric"
                            autoComplete="tel"
                            error={errors.phone}
                          />
                        ) : null}
                        {missingEmail ? (
                          <CustomerField
                            id="modal-checkout-email"
                            label="이메일"
                            inputRef={emailRef}
                            type="email"
                            value={form.email}
                            onChange={(v) => setField("email", v)}
                            placeholder="확인서 수신용 이메일"
                            autoComplete="email"
                            error={errors.email}
                          />
                        ) : null}
                      </div>
                    ) : null}
                  </div>
                ) : null}

                {showFullCustomerForm ? (
                  <div className="space-y-3">
                    {isMember ? (
                      <div className="mb-1 flex items-center justify-between">
                        <h3 className="text-sm font-semibold text-slate-900">다른 사람 정보로 예약</h3>
                        <button
                          type="button"
                          onClick={restoreMemberProfile}
                          className="text-xs font-medium text-slate-500 underline-offset-2 hover:underline"
                        >
                          내 정보로 되돌리기
                        </button>
                      </div>
                    ) : null}
                    <CustomerField
                      id="modal-checkout-name"
                      label="예약자명"
                      inputRef={nameRef}
                      value={form.name}
                      onChange={(v) => setField("name", v)}
                      placeholder="성함을 입력해 주세요"
                      autoComplete="name"
                      error={errors.name}
                    />
                    <CustomerField
                      id="modal-checkout-phone"
                      label="휴대폰"
                      inputRef={phoneRef}
                      value={form.phone}
                      onChange={(v) => setField("phone", formatPhoneInput(v))}
                      placeholder="010-XXXX-XXXX"
                      inputMode="numeric"
                      autoComplete="tel"
                      error={errors.phone}
                    />
                    <CustomerField
                      id="modal-checkout-email"
                      label="이메일"
                      inputRef={emailRef}
                      type="email"
                      value={form.email}
                      onChange={(v) => setField("email", v)}
                      placeholder="확인서 수신용 이메일"
                      autoComplete="email"
                      error={errors.email}
                    />
                  </div>
                ) : null}
              </section>

              <section>
                <h3 className="mb-2 text-sm font-semibold text-slate-900">결제 방식</h3>
                <div className="space-y-2" role="radiogroup" aria-label="결제 방식">
                  <PaymentChoice
                    selected={paymentType === "deposit"}
                    onSelect={() => onPaymentTypeChange("deposit")}
                    title="예약금 결제"
                    amount={depositTotal}
                    hint="인당 20만 원으로 안전하게 좌석 및 일정을 사전 확보하세요."
                  />
                  <PaymentChoice
                    selected={paymentType === "full"}
                    onSelect={() => onPaymentTypeChange("full")}
                    title="전액 결제"
                    amount={totalTripPrice}
                    hint="상품 총액을 한 번에 결제합니다."
                  />
                </div>
                {paymentType === "deposit" && remainingBalance > 0 ? (
                  <p className="mt-2 text-xs leading-relaxed text-slate-500">
                    * 잔금 ₩{formatPriceKR(remainingBalance) ?? "0"}은 좌석 확정 후 출발 D-14일 전까지
                    결제됩니다.
                  </p>
                ) : null}
              </section>

              <section>
                <label className="flex items-start gap-2.5 rounded-xl border border-slate-200 bg-white px-3 py-3 text-sm text-slate-700">
                  <input
                    ref={agreeRef}
                    type="checkbox"
                    checked={agreeAll}
                    onChange={(e) => applyAgreeAll(e.target.checked)}
                    className="mt-0.5"
                  />
                  <span>
                    <span className="font-medium text-slate-900">
                      필수 약관 및 취소/환불 규정에 동의합니다
                    </span>
                    <a
                      href="/terms"
                      target="_blank"
                      rel="noopener noreferrer"
                      className="ml-1 text-xs text-[var(--primary)] underline-offset-2 hover:underline"
                      onClick={(e) => e.stopPropagation()}
                    >
                      내용보기
                    </a>
                  </span>
                </label>
                {errors.agreeTerms || errors.agreePrivacy || errors.agreeRefund ? (
                  <p className="mt-1 text-xs text-[var(--danger)]">
                    {errors.agreeTerms || errors.agreePrivacy || errors.agreeRefund}
                  </p>
                ) : null}
              </section>

              {message ? <p className="text-sm text-[var(--danger)]">{message}</p> : null}
            </div>

            <div className="shrink-0 border-t border-slate-100 bg-white px-5 py-4 safe-bottom">
              <button
                type="submit"
                disabled={submitting || payAmount <= 0 || authStatus === "loading"}
                className="inline-flex min-h-[52px] w-full items-center justify-center rounded-xl bg-[var(--accent)] px-4 text-sm font-semibold text-[var(--on-accent)] shadow-[var(--shadow-soft)] disabled:cursor-not-allowed disabled:opacity-50"
              >
                {submitting
                  ? "결제창 여는 중…"
                  : `₩${payAmount.toLocaleString("ko-KR")}원 결제 진행하기`}
              </button>
              <p className="mt-2 text-center text-[11px] text-slate-400">
                {isMember && formCustomerComplete && !editingCustomer
                  ? "내 정보로 바로 결제 · 확정 전 무료 취소 가능"
                  : "확정 전 무료 취소 가능 · 안전한 결제 준비"}
              </p>
            </div>
          </form>
        </div>
      </div>
    </dialog>,
    document.body,
  );
}

function CustomerField({
  id,
  label,
  value,
  onChange,
  placeholder,
  error,
  inputRef,
  type = "text",
  inputMode,
  autoComplete,
}: {
  id: string;
  label: string;
  value: string;
  onChange: (value: string) => void;
  placeholder: string;
  error?: string;
  inputRef?: React.RefObject<HTMLInputElement | null>;
  type?: string;
  inputMode?: React.HTMLAttributes<HTMLInputElement>["inputMode"];
  autoComplete?: string;
}) {
  return (
    <div>
      <label className="block text-xs font-medium text-slate-600" htmlFor={id}>
        {label}
      </label>
      <input
        ref={inputRef}
        id={id}
        type={type}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        inputMode={inputMode}
        autoComplete={autoComplete}
        className="mt-1 w-full rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm"
        aria-invalid={Boolean(error)}
      />
      {error ? <p className="mt-1 text-xs text-[var(--danger)]">{error}</p> : null}
    </div>
  );
}

function PaymentChoice({
  selected,
  onSelect,
  title,
  amount,
  hint,
}: {
  selected: boolean;
  onSelect: () => void;
  title: string;
  amount: number;
  hint: string;
}) {
  return (
    <button
      type="button"
      role="radio"
      aria-checked={selected}
      onClick={onSelect}
      className={cn(
        "flex w-full items-start gap-3 rounded-xl border px-3 py-3 text-left transition",
        selected
          ? "border-[var(--primary)] bg-[var(--primary)]/5 ring-1 ring-[var(--primary)]"
          : "border-slate-200 bg-white hover:border-slate-300",
      )}
    >
      <span
        className={cn(
          "mt-0.5 flex h-4 w-4 shrink-0 items-center justify-center rounded-full border",
          selected ? "border-[var(--primary)]" : "border-slate-300",
        )}
        aria-hidden
      >
        {selected ? <span className="h-2 w-2 rounded-full bg-[var(--primary)]" /> : null}
      </span>
      <span className="min-w-0 flex-1">
        <span className="flex items-baseline justify-between gap-2">
          <span className="text-sm font-semibold text-slate-900">{title}</span>
          <span className="shrink-0 text-sm font-bold text-[var(--primary)]">
            ₩{formatPriceKR(amount) ?? "0"}
          </span>
        </span>
        <span className="mt-0.5 block text-xs text-slate-500">{hint}</span>
      </span>
    </button>
  );
}
