"use client";

import {
  createContext,
  useCallback,
  useContext,
  useState,
  useEffect,
  type FormEvent,
  type ReactNode,
} from "react";
import { Send, X } from "lucide-react";
import { useProductQuote } from "@/components/products/ProductQuoteContext";
import { trackReviewConversionInquiry } from "@/lib/reviewExperimentTracking";
import { trackConsultOpen, trackConsultSubmit } from "@/lib/analytics/trackConsultModal";
import { getAttributionTouch } from "@/lib/analytics/firstTouch";
import { inferAttribution } from "@/lib/analytics/attribution";
import { GolfBriefFields } from "@/components/inquiry/GolfBriefFields";
import { InquirySuccessPanel } from "@/components/inquiry/InquirySuccessPanel";
import {
  isGolfBriefContext,
  mergeGolfBriefIntoContent,
  type GolfBriefSnapshot,
} from "@/lib/inquiry/golfBriefFields";
import { buildProductInquiryPrefill } from "@/lib/products/buildProductInquiryPrefill";
import { resolveDefaultPointsUseAmount } from "@/lib/inquiry/inquiryPointsUse";
import { solidButtonShadowClasses } from "@/components/ui/Button";
import { cn } from "@/lib/cn";

export type ConsultModalParams = {
  productId?: string;
  productTitle?: string;
  sourcePath?: string;
  landingSlug?: string;
  quoteCategory?: string;
  prefillContent?: string;
};

type ConsultModalContextValue = {
  isOpen: boolean;
  openModal: (params?: ConsultModalParams) => void;
  closeModal: () => void;
};

const ConsultModalContext = createContext<ConsultModalContextValue | null>(null);

export function useConsultModal() {
  const ctx = useContext(ConsultModalContext);
  if (!ctx) {
    return {
      isOpen: false,
      openModal: () => {},
      closeModal: () => {},
    };
  }
  return ctx;
}

type QuickFormState = {
  name: string;
  phone: string;
  content: string;
};

const initialFormState: QuickFormState = {
  name: "",
  phone: "",
  content: "",
};

type FieldErrors = { name?: string; phone?: string };

function formatPhoneInput(raw: string) {
  const digits = raw.replace(/\D/g, "").slice(0, 11);
  if (digits.length <= 3) return digits;
  if (digits.length <= 7) return `${digits.slice(0, 3)}-${digits.slice(3)}`;
  return `${digits.slice(0, 3)}-${digits.slice(3, 7)}-${digits.slice(7)}`;
}

function maskPhoneDisplay(phone: string): string {
  const digits = phone.replace(/\D/g, "");
  if (digits.length < 7) return phone;
  if (digits.length <= 10) {
    return `${digits.slice(0, 3)}-****-${digits.slice(-4)}`;
  }
  return `${digits.slice(0, 3)}-****-${digits.slice(-4)}`;
}

function validateForm(form: QuickFormState): FieldErrors {
  const errors: FieldErrors = {};
  if (!form.name.trim()) errors.name = "이름을 입력해 주세요.";
  if (!form.phone.trim()) errors.phone = "연락처를 입력해 주세요.";
  return errors;
}

export function ConsultModalProvider({ children }: { children: ReactNode }) {
  const [isOpen, setIsOpen] = useState(false);
  const [params, setParams] = useState<ConsultModalParams>({});
  const [form, setForm] = useState<QuickFormState>(initialFormState);
  const [fieldErrors, setFieldErrors] = useState<FieldErrors>({});
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isSuccess, setIsSuccess] = useState(false);
  const [golfBrief, setGolfBrief] = useState<GolfBriefSnapshot>({});
  const [kakaoHref, setKakaoHref] = useState<string | undefined>();
  const [slaMinutes, setSlaMinutes] = useState(30);
  const [toast, setToast] = useState<{ kind: "success" | "error"; message: string } | null>(null);
  const [pointBalance, setPointBalance] = useState<number | null>(null);
  const [pointsUseEnabled, setPointsUseEnabled] = useState(false);
  const [pointsUseAmount, setPointsUseAmount] = useState(0);
  const [pointsLoading, setPointsLoading] = useState(false);
  const [memberProfile, setMemberProfile] = useState<{ name: string; phone: string } | null>(null);
  const [memberProfileLoading, setMemberProfileLoading] = useState(false);
  const quoteCtx = useProductQuote();

  const showGolfBrief = isGolfBriefContext({
    quoteCategory: params.quoteCategory,
    productTitle: params.productTitle,
    landingSlug: params.landingSlug,
  });

  const hideNameField = Boolean(memberProfile?.name?.trim());
  const hidePhoneField = Boolean(memberProfile?.phone?.trim());
  const hideContactFields = hideNameField && hidePhoneField;

  useEffect(() => {
    let mounted = true;
    fetch("/api/site-settings", { cache: "no-store" })
      .then((res) => res.json())
      .then((data: { kakao_chat_url?: string; consult_sla_minutes?: string }) => {
        if (!mounted) return;
        if (data.kakao_chat_url) setKakaoHref(data.kakao_chat_url);
        const mins = Number(data.consult_sla_minutes);
        if (Number.isFinite(mins) && mins > 0) setSlaMinutes(mins);
      })
      .catch(() => undefined);
    return () => {
      mounted = false;
    };
  }, []);

  useEffect(() => {
    if (!isOpen) return;
    let mounted = true;
    setPointsLoading(true);
    setMemberProfileLoading(true);
    setMemberProfile(null);

    const pointsPromise = fetch("/api/me/points", { credentials: "include", cache: "no-store" })
      .then(async (res) => {
        if (!mounted) return;
        if (!res.ok) {
          setPointBalance(null);
          setPointsUseEnabled(false);
          setPointsUseAmount(0);
          return;
        }
        const data = (await res.json()) as { balance?: number };
        const balance = Number(data.balance ?? 0);
        setPointBalance(balance);
        const defaultAmount = resolveDefaultPointsUseAmount(balance, quoteCtx.quoteSummary?.total ?? null);
        setPointsUseAmount(defaultAmount);
        setPointsUseEnabled(defaultAmount > 0);
      })
      .catch(() => {
        if (!mounted) return;
        setPointBalance(null);
        setPointsUseEnabled(false);
        setPointsUseAmount(0);
      })
      .finally(() => {
        if (mounted) setPointsLoading(false);
      });

    const profilePromise = fetch("/api/me/profile", { credentials: "include", cache: "no-store" })
      .then(async (res) => {
        if (!mounted) return;
        if (!res.ok) {
          setMemberProfile(null);
          return;
        }
        const data = (await res.json()) as { name?: string; phone?: string };
        const name = typeof data.name === "string" ? data.name.trim() : "";
        const phoneRaw = typeof data.phone === "string" ? data.phone.trim() : "";
        const phone = phoneRaw ? formatPhoneInput(phoneRaw) : "";
        setMemberProfile({ name, phone });
        if (name || phone) {
          setForm((prev) => ({
            ...prev,
            name: name || prev.name,
            phone: phone || prev.phone,
          }));
        }
      })
      .catch(() => {
        if (!mounted) return;
        setMemberProfile(null);
      })
      .finally(() => {
        if (mounted) setMemberProfileLoading(false);
      });

    void Promise.all([pointsPromise, profilePromise]);
    return () => {
      mounted = false;
    };
  }, [isOpen, quoteCtx.quoteSummary?.total]);

  useEffect(() => {
    if (pointBalance == null || pointBalance <= 0) return;
    const defaultAmount = resolveDefaultPointsUseAmount(pointBalance, quoteCtx.quoteSummary?.total ?? null);
    setPointsUseAmount((prev) => (prev > 0 ? Math.min(prev, pointBalance) : defaultAmount));
  }, [pointBalance, quoteCtx.quoteSummary?.total]);

  useEffect(() => {
    if (isOpen) {
      trackConsultOpen({
        productId: params.productId,
        sourcePath: params.sourcePath,
      });
    }
  }, [isOpen, params.productId, params.sourcePath]);

  const openModal = useCallback((nextParams?: ConsultModalParams) => {
    setParams(nextParams ?? {});
    const prefillFromParams = nextParams?.prefillContent?.trim();
    const prefill =
      prefillFromParams ||
      buildProductInquiryPrefill({
        productTitle: nextParams?.productTitle,
        selectedDeparture: quoteCtx.selectedDeparture,
        travelerCount: quoteCtx.travelerCount,
        quoteSummary: quoteCtx.quoteSummary,
        selectedOptions: quoteCtx.selectedOptions,
      });
    setForm({
      ...initialFormState,
      content: prefill,
    });
    setGolfBrief({});
    setFieldErrors({});
    setIsSuccess(false);
    setPointBalance(null);
    setPointsUseEnabled(false);
    setPointsUseAmount(0);
    setMemberProfile(null);
    setIsOpen(true);
  }, [
    quoteCtx.selectedDeparture,
    quoteCtx.quoteSummary,
    quoteCtx.selectedOptions,
    quoteCtx.travelerCount,
  ]);

  const closeModal = useCallback(() => {
    setIsOpen(false);
    setIsSuccess(false);
    setFieldErrors({});
    setMemberProfile(null);
  }, []);

  const showToast = useCallback((kind: "success" | "error", message: string) => {
    setToast({ kind, message });
    setTimeout(() => setToast(null), 2600);
  }, []);

  const handleSubmit = useCallback(
    async (event: FormEvent<HTMLFormElement>) => {
      event.preventDefault();
      const errors = validateForm(form);
      if (Object.keys(errors).length > 0) {
        setFieldErrors(errors);
        return;
      }
      setFieldErrors({});

      const selectedOptions = quoteCtx.selectedOptions ?? null;
      const quoteSummary = quoteCtx.quoteSummary ?? null;
      const selectedDeparture = quoteCtx.selectedDeparture ?? null;
      const hasOptionData =
        (selectedOptions && Object.keys(selectedOptions).length > 0) ||
        (quoteSummary && (quoteSummary.total != null || (quoteSummary.breakdown?.length ?? 0) > 0));
      const hasDepartureData = Boolean(selectedDeparture?.inquiryValue);

      const firstTouch = getAttributionTouch();
      let contentBase = form.content.trim();
      if (hasDepartureData && !contentBase.includes("희망 출발일")) {
        const departureLines = buildProductInquiryPrefill({
          productTitle: params.productTitle,
          selectedDeparture,
          travelerCount: quoteCtx.travelerCount,
        });
        contentBase = departureLines
          ? contentBase
            ? `${departureLines}\n\n${contentBase}`
            : departureLines
          : contentBase;
      }
      const content = showGolfBrief
        ? mergeGolfBriefIntoContent(contentBase, golfBrief)
        : contentBase;

      const body: Record<string, unknown> = {
        name: form.name.trim(),
        phone: form.phone.trim(),
        content,
        product_id: params.productId?.trim() || undefined,
        product_title: params.productTitle?.trim() || undefined,
        source_path: params.sourcePath?.trim() || undefined,
        landing_slug: params.landingSlug?.trim() || undefined,
        quote_category: params.quoteCategory?.trim() || undefined,
        first_touch: firstTouch ?? undefined,
        inquiry_page_url: typeof window !== "undefined" ? window.location.pathname : undefined,
      };
      if (showGolfBrief) {
        body.quote_snapshot = { golf_brief: golfBrief };
      }
      if (hasDepartureData && selectedDeparture) {
        body.selected_departure = {
          label: selectedDeparture.label,
          inquiry_value: selectedDeparture.inquiryValue,
          price: selectedDeparture.price ?? null,
        };
      }
      if (hasOptionData || hasDepartureData) {
        if (selectedOptions && Object.keys(selectedOptions).length > 0) {
          body.selected_options = selectedOptions;
        }
        if (quoteSummary && (quoteSummary.total != null || (quoteSummary.breakdown?.length ?? 0) > 0)) {
          body.quote_summary = {
            total: quoteSummary.total,
            base_price: quoteSummary.basePrice,
            breakdown: quoteSummary.breakdown.map((b) => ({
              group_label: b.groupLabel,
              option_label: b.optionLabel,
              price_delta: b.priceDelta,
            })),
          };
        }
        body.inquired_at = new Date().toISOString();
      }

      if (pointsUseEnabled && pointsUseAmount > 0 && pointBalance != null) {
        body.points_use_requested = pointsUseAmount;
      }

      setIsSubmitting(true);
      try {
        const response = await fetch("/api/inquiries", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(body),
        });

        if (!response.ok) {
          let message = "문의 저장 중 오류가 발생했습니다. 잠시 후 다시 시도해 주세요.";
          try {
            const data = (await response.json()) as { message?: string };
            if (data.message?.trim()) message = data.message.trim();
          } catch {
            /* ignore */
          }
          showToast("error", message);
          return;
        }

        if (params.productId) {
          trackReviewConversionInquiry(params.productId);
        }
        trackConsultSubmit({
          productId: params.productId,
          sourcePath: params.sourcePath,
        });
        try {
          if (typeof window !== "undefined" && typeof window.gtag === "function") {
            const att = inferAttribution(firstTouch ?? undefined);
            window.gtag("event", "generate_lead", {
              event_category: "inquiry",
              event_label: params.productTitle || "general_inquiry",
              source_path: params.sourcePath ?? undefined,
              inquiry_page_url: window.location.pathname,
              acquisition_channel: att.acquisition_channel ?? undefined,
              acquisition_source_label: att.acquisition_source_label ?? undefined,
              acquisition_medium: att.acquisition_medium ?? undefined,
            });
          }
        } catch {
          /* GA4 전송 실패해도 문의 흐름에는 영향 없음 */
        }
        setForm(initialFormState);
        setIsSuccess(true);
      } catch {
        showToast("error", "네트워크 오류가 발생했습니다. 잠시 후 다시 시도해 주세요.");
      } finally {
        setIsSubmitting(false);
      }
    },
    [form, params, showToast, quoteCtx, pointsUseEnabled, pointsUseAmount, pointBalance, showGolfBrief, golfBrief],
  );

  const value: ConsultModalContextValue = { isOpen, openModal, closeModal };

  return (
    <ConsultModalContext.Provider value={value}>
      {children}
      {isOpen && (
        <div className="fixed inset-0 z-[60] bg-[var(--overlay)] backdrop-blur-[2px]">
          <div className="flex min-h-full items-center justify-center px-4 py-6">
            <div className="w-full max-w-md rounded-2xl border border-[var(--border)] bg-[var(--surface-elevated)] p-6 text-[var(--text-primary)] shadow-[var(--shadow-modal)]">
              {isSuccess ? (
                <div className="space-y-4">
                  <div>
                    <p className="text-sm font-semibold tracking-[0.18em] text-[var(--text-muted)]">
                      THEALL QUICK CONSULT
                    </p>
                    <h2 className="mt-1 text-xl font-semibold text-[var(--text-primary)] md:text-2xl">
                      상담 요청이 접수되었습니다
                    </h2>
                    <p className="mt-2 text-base text-[var(--text-muted)]">
                      영업시간 기준 약 {slaMinutes}분 내 순차 연락드립니다.
                    </p>
                  </div>
                  <InquirySuccessPanel slaMinutes={slaMinutes} kakaoHref={kakaoHref} />
                  <button
                    type="button"
                    onClick={closeModal}
                    className="w-full rounded-full border border-[var(--border)] bg-[var(--surface)] px-5 py-3 text-base font-semibold text-[var(--text-primary)] transition-colors hover:bg-[var(--surface-muted)]"
                  >
                    확인
                  </button>
                </div>
              ) : (
                <>
                  <div className="mb-4 flex items-start justify-between gap-3">
                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-semibold tracking-[0.18em] text-[var(--text-muted)]">
                        THEALL QUICK CONSULT
                      </p>
                      <h2 className="mt-1 text-xl font-semibold text-[var(--text-primary)] md:text-2xl">
                        상담 요청
                      </h2>
                      <p className="mt-1 text-sm text-[var(--text-muted)] md:text-base">
                        남겨주신 내용을 확인한 뒤 안내드립니다.
                      </p>
                      {params.productTitle ? (
                        <div className="mt-2 max-w-full text-sm text-[var(--text-muted)]">
                          문의 상품:{" "}
                          <span className="truncate font-medium text-[var(--text-primary)]">
                            {params.productTitle}
                          </span>
                        </div>
                      ) : null}
                    </div>
                    <button
                      type="button"
                      onClick={closeModal}
                      className="inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-full border border-[var(--border)] text-[var(--text-muted)] transition-colors duration-150 hover:border-[var(--border-strong)] hover:text-[var(--text-primary)]"
                      aria-label="상담 모달 닫기"
                    >
                      <X className="h-4 w-4" aria-hidden="true" />
                    </button>
                  </div>

                  <form onSubmit={handleSubmit} className="space-y-3.5">
                    {memberProfileLoading ? null : hideContactFields ? (
                      <div className="rounded-xl border border-[var(--border)] bg-[var(--surface-muted)] px-3.5 py-3 text-sm text-[var(--text-secondary)]">
                        <p className="font-medium text-[var(--text-primary)]">회원 정보로 접수됩니다.</p>
                        <p className="mt-1">
                          {form.name}
                          {form.phone ? ` · ${maskPhoneDisplay(form.phone)}` : null}
                        </p>
                      </div>
                    ) : (
                      <p className="text-sm text-[var(--text-muted)]">
                        {hideNameField
                          ? "연락처를 입력해 주시면 상담이 가능합니다."
                          : "이름과 연락처만 입력하셔도 상담이 가능합니다."}
                      </p>
                    )}
                    {showGolfBrief ? <GolfBriefFields value={golfBrief} onChange={setGolfBrief} /> : null}
                    {!memberProfileLoading && !hideNameField ? (
                    <div className="flex flex-col gap-1.5 text-sm font-medium text-[var(--text-secondary)]">
                      <label className="space-y-1.5">
                        <span>이름 *</span>
                        <input
                          type="text"
                          value={form.name}
                          onChange={(e) => {
                            setForm((prev) => ({ ...prev, name: e.target.value }));
                            if (fieldErrors.name) setFieldErrors((prev) => ({ ...prev, name: undefined }));
                          }}
                          placeholder="성함을 입력해 주세요"
                          className="w-full rounded-xl border border-[var(--border)] bg-[var(--surface)] px-3 py-2.5 text-base text-[var(--text-primary)] outline-none transition-colors duration-150 placeholder:text-[var(--text-subtle)] focus:border-[var(--focus-ring)] focus:ring-2 focus:ring-[var(--focus-ring)]"
                          aria-invalid={!!fieldErrors.name}
                          aria-describedby={fieldErrors.name ? "consult-name-error" : undefined}
                        />
                        {fieldErrors.name ? (
                          <p id="consult-name-error" className="text-red-600" role="alert">
                            {fieldErrors.name}
                          </p>
                        ) : null}
                      </label>
                    </div>
                    ) : null}
                    {!memberProfileLoading && !hidePhoneField ? (
                    <div className="flex flex-col gap-1.5 text-sm font-medium text-[var(--text-secondary)]">
                      <label className="space-y-1.5">
                        <span>연락처 *</span>
                        <input
                          type="tel"
                          value={form.phone}
                          onChange={(e) => {
                            setForm((prev) => ({ ...prev, phone: formatPhoneInput(e.target.value) }));
                            if (fieldErrors.phone) setFieldErrors((prev) => ({ ...prev, phone: undefined }));
                          }}
                          placeholder="010-0000-0000"
                          className="w-full rounded-xl border border-[var(--border)] bg-[var(--surface)] px-3 py-2.5 text-base text-[var(--text-primary)] outline-none transition-colors duration-150 placeholder:text-[var(--text-subtle)] focus:border-[var(--focus-ring)] focus:ring-2 focus:ring-[var(--focus-ring)]"
                          aria-invalid={!!fieldErrors.phone}
                          aria-describedby={fieldErrors.phone ? "consult-phone-error" : undefined}
                        />
                        {fieldErrors.phone ? (
                          <p id="consult-phone-error" className="text-red-600" role="alert">
                            {fieldErrors.phone}
                          </p>
                        ) : null}
                      </label>
                    </div>
                    ) : null}
                    <div className="flex flex-col gap-1.5 text-sm font-medium text-[var(--text-secondary)]">
                      <label className="space-y-1.5">
                        <span>문의 내용 <span className="text-[var(--text-muted)]">(선택)</span></span>
                        <textarea
                          rows={4}
                          value={form.content}
                          onChange={(e) => {
                            setForm((prev) => ({ ...prev, content: e.target.value }));
                          }}
                          placeholder="예: 출발일, 인원, 원하는 일정 등을 간단히 남겨주세요"
                          className="w-full rounded-xl border border-[var(--border)] bg-[var(--surface)] px-3 py-2.5 text-base text-[var(--text-primary)] outline-none transition-colors duration-150 placeholder:text-[var(--text-subtle)] focus:border-[var(--focus-ring)] focus:ring-2 focus:ring-[var(--focus-ring)]"
                        />
                      </label>
                    </div>
                    {pointBalance != null && pointBalance > 0 ? (
                      <div className="rounded-xl border border-[var(--border)] bg-[var(--surface-muted)] p-3.5 text-sm">
                        <p className="font-medium text-[var(--text-primary)]">
                          보유 포인트: {pointBalance.toLocaleString("ko-KR")}P
                        </p>
                        <label className="mt-2 flex cursor-pointer items-start gap-2">
                          <input
                            type="checkbox"
                            checked={pointsUseEnabled}
                            onChange={(e) => setPointsUseEnabled(e.target.checked)}
                            disabled={pointsLoading}
                            className="mt-0.5 h-4 w-4 rounded border-[var(--border)]"
                          />
                          <span className="text-[var(--text-secondary)]">
                            포인트 사용 요청 (카카오 30,000P 포함)
                          </span>
                        </label>
                        {pointsUseEnabled ? (
                          <div className="mt-2 flex items-center gap-2">
                            <input
                              type="number"
                              min={1}
                              max={pointBalance}
                              value={pointsUseAmount}
                              onChange={(e) => {
                                const next = Number.parseInt(e.target.value, 10);
                                if (!Number.isFinite(next)) {
                                  setPointsUseAmount(0);
                                  return;
                                }
                                setPointsUseAmount(Math.max(0, Math.min(pointBalance, next)));
                              }}
                              className="w-full rounded-lg border border-[var(--border)] bg-[var(--surface)] px-3 py-2 text-base text-[var(--text-primary)] outline-none focus:border-[var(--focus-ring)] focus:ring-2 focus:ring-[var(--focus-ring)]"
                            />
                            <span className="shrink-0 text-[var(--text-muted)]">P</span>
                          </div>
                        ) : null}
                      </div>
                    ) : null}
                    <div className="mt-2 flex flex-col gap-3">
                      <div className="flex justify-end">
                        <button
                          type="submit"
                          disabled={isSubmitting}
                          className={cn(
                            "inline-flex w-full min-w-0 items-center justify-center gap-2 rounded-full border border-transparent bg-[var(--accent)] px-5 py-2.5 text-base font-semibold text-[var(--on-accent)] transition-colors duration-150 hover:bg-[var(--accent-hover)] active:bg-[var(--accent-active)] disabled:cursor-not-allowed disabled:opacity-70 sm:min-w-[180px] sm:w-auto",
                            solidButtonShadowClasses,
                          )}
                        >
                          <Send className="h-4 w-4 opacity-90" strokeWidth={1.5} />
                          {isSubmitting ? "전송 중..." : "상담 요청 보내기"}
                        </button>
                      </div>
                      <p className="text-right text-[10px] text-[var(--text-muted)]">
                        입력하신 내용을 확인한 뒤 안내드립니다.
                      </p>
                    </div>
                    <p className="text-xs text-[var(--text-muted)] md:text-sm">
                      남겨주신 연락처로만 상담 연락을 드리며, 다른 용도로는 사용하지 않습니다.
                    </p>
                  </form>
                </>
              )}
            </div>
          </div>
        </div>
      )}

      {toast ? (
        <div className="fixed top-4 right-4 z-[70]">
          <div
            className={`rounded-xl px-4 py-3 text-sm font-semibold text-white shadow-lg ${
              toast.kind === "success" ? "bg-emerald-600" : "bg-red-600"
            }`}
          >
            {toast.message}
          </div>
        </div>
      ) : null}
    </ConsultModalContext.Provider>
  );
}
