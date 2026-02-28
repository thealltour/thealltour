"use client";

import {
  createContext,
  useCallback,
  useContext,
  useState,
  type FormEvent,
  type ReactNode,
} from "react";
import { Send, X } from "lucide-react";
import { useProductQuote } from "@/components/products/ProductQuoteContext";

export type ConsultModalParams = {
  productId?: string;
  productTitle?: string;
  sourcePath?: string;
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

function formatPhoneInput(raw: string) {
  const digits = raw.replace(/\D/g, "").slice(0, 11);
  if (digits.length <= 3) return digits;
  if (digits.length <= 7) return `${digits.slice(0, 3)}-${digits.slice(3)}`;
  return `${digits.slice(0, 3)}-${digits.slice(3, 7)}-${digits.slice(7)}`;
}

export function ConsultModalProvider({ children }: { children: ReactNode }) {
  const [isOpen, setIsOpen] = useState(false);
  const [params, setParams] = useState<ConsultModalParams>({});
  const [form, setForm] = useState<QuickFormState>(initialFormState);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [toast, setToast] = useState<{ kind: "success" | "error"; message: string } | null>(null);
  const quoteCtx = useProductQuote();

  const openModal = useCallback((nextParams?: ConsultModalParams) => {
    setParams(nextParams ?? {});
    setForm(initialFormState);
    setIsOpen(true);
  }, []);

  const closeModal = useCallback(() => {
    setIsOpen(false);
  }, []);

  const showToast = useCallback((kind: "success" | "error", message: string) => {
    setToast({ kind, message });
    setTimeout(() => setToast(null), 2600);
  }, []);

  const handleSubmit = useCallback(
    async (event: FormEvent<HTMLFormElement>) => {
      event.preventDefault();
      if (!form.name.trim() || !form.phone.trim() || !form.content.trim()) {
        showToast("error", "이름, 연락처, 문의 내용을 모두 입력해 주세요.");
        return;
      }

      const selectedOptions = quoteCtx.selectedOptions ?? null;
      const quoteSummary = quoteCtx.quoteSummary ?? null;
      const hasOptionData =
        (selectedOptions && Object.keys(selectedOptions).length > 0) ||
        (quoteSummary && (quoteSummary.total != null || (quoteSummary.breakdown?.length ?? 0) > 0));

      const body: Record<string, unknown> = {
        name: form.name.trim(),
        phone: form.phone.trim(),
        content: form.content.trim(),
        product_id: params.productId?.trim() || undefined,
        product_title: params.productTitle?.trim() || undefined,
        source_path: params.sourcePath?.trim() || undefined,
      };
      if (hasOptionData) {
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

      setIsSubmitting(true);
      try {
        const response = await fetch("/api/inquiries", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(body),
        });

        if (!response.ok) {
          showToast("error", "문의 저장 중 오류가 발생했습니다. 잠시 후 다시 시도해 주세요.");
          return;
        }

        setForm(initialFormState);
        closeModal();
        showToast("success", "상담 요청이 접수되었습니다. 확인 후 순차적으로 연락드리겠습니다.");
      } catch {
        showToast("error", "네트워크 오류가 발생했습니다. 잠시 후 다시 시도해 주세요.");
      } finally {
        setIsSubmitting(false);
      }
    },
    [form, params, closeModal, showToast, quoteCtx],
  );

  const value: ConsultModalContextValue = { isOpen, openModal, closeModal };

  return (
    <ConsultModalContext.Provider value={value}>
      {children}
      {isOpen && (
        <div className="fixed inset-0 z-50 bg-[#020617]/75">
          <div className="flex min-h-full items-center justify-center px-4 py-6">
            <div className="w-full max-w-md rounded-2xl border border-white/12 bg-[#0F172A] p-6 text-site-primary shadow-xl">
              <div className="mb-4 flex items-start justify-between gap-3">
                <div>
                  <p className="text-xs font-semibold tracking-[0.18em] text-site-muted">
                    THEALL QUICK CONSULT
                  </p>
                  <h2 className="mt-1 text-xl font-semibold text-site-primary md:text-2xl">
                    상담 문의하기
                  </h2>
                  <p className="mt-1 text-xs text-site-muted md:text-sm">
                    간단한 정보만 남겨주시면, 전담 상담사가 순차적으로 연락드립니다.
                  </p>
                  {params.productTitle ? (
                    <p className="mt-2 text-xs text-site-muted">
                      상품: {params.productTitle}
                    </p>
                  ) : null}
                </div>
                <button
                  type="button"
                  onClick={closeModal}
                  className="inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-full border border-white/10 text-site-muted transition-colors duration-150 hover:border-white/25 hover:text-white"
                  aria-label="상담 모달 닫기"
                >
                  <X className="h-4 w-4" aria-hidden="true" />
                </button>
              </div>

              <form onSubmit={handleSubmit} className="space-y-3.5">
                <div className="flex flex-col gap-1.5 text-xs font-medium text-site-secondary">
                  <label className="space-y-1.5">
                    <span>이름 *</span>
                    <input
                      type="text"
                      value={form.name}
                      onChange={(e) => setForm((prev) => ({ ...prev, name: e.target.value }))}
                      placeholder="성함을 입력해 주세요"
                      className="w-full rounded-xl border border-white/12 bg-[#020617]/60 px-3 py-2.5 text-sm text-white outline-none transition-colors duration-150 placeholder:text-white/35 focus:border-[rgba(59,130,246,0.6)] focus:ring-2 focus:ring-[rgba(59,130,246,0.35)]"
                      required
                    />
                  </label>
                </div>
                <div className="flex flex-col gap-1.5 text-xs font-medium text-site-secondary">
                  <label className="space-y-1.5">
                    <span>연락처 *</span>
                    <input
                      type="tel"
                      value={form.phone}
                      onChange={(e) =>
                        setForm((prev) => ({ ...prev, phone: formatPhoneInput(e.target.value) }))
                      }
                      placeholder="010-0000-0000"
                      className="w-full rounded-xl border border-white/12 bg-[#020617]/60 px-3 py-2.5 text-sm text-white outline-none transition-colors duration-150 placeholder:text-white/35 focus:border-[rgba(59,130,246,0.6)] focus:ring-2 focus:ring-[rgba(59,130,246,0.35)]"
                      required
                    />
                  </label>
                </div>
                <div className="flex flex-col gap-1.5 text-xs font-medium text-site-secondary">
                  <label className="space-y-1.5">
                    <span>문의 내용 *</span>
                    <textarea
                      rows={4}
                      value={form.content}
                      onChange={(e) => setForm((prev) => ({ ...prev, content: e.target.value }))}
                      placeholder="예: 5월 중 일본 골프 3박 4일, 4인 강습 포함 일정 희망"
                      className="w-full rounded-xl border border-white/12 bg-[#020617]/60 px-3 py-2.5 text-sm text-white outline-none transition-colors duration-150 placeholder:text-white/35 focus:border-[rgba(59,130,246,0.6)] focus:ring-2 focus:ring-[rgba(59,130,246,0.35)]"
                      required
                    />
                  </label>
                </div>
                <div className="mt-2 flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
                  <p className="text-[10px] text-site-muted md:text-xs">
                    남겨주신 연락처로만 상담 연락을 드리며, 다른 용도로는 사용하지 않습니다.
                  </p>
                  <div className="flex justify-end">
                    <button
                      type="submit"
                      disabled={isSubmitting}
                      className="inline-flex min-w-[180px] items-center justify-center gap-2 rounded-full border border-[#60a5fa]/70 bg-gradient-to-r from-[#1d4ed8] to-[#2563eb] px-5 py-2.5 text-sm font-semibold text-white transition-colors duration-150 hover:border-[#93c5fd] hover:from-[#2563eb] hover:to-[#1d4ed8] disabled:cursor-not-allowed disabled:opacity-70"
                    >
                      <Send className="h-4 w-4 opacity-90" strokeWidth={1.5} />
                      {isSubmitting ? "전송 중..." : "상담 신청"}
                    </button>
                  </div>
                </div>
              </form>
            </div>
          </div>
        </div>
      )}

      {toast ? (
        <div className="fixed top-4 right-4 z-[60]">
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
