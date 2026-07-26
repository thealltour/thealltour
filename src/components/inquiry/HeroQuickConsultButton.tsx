"use client";

import { useState, FormEvent } from "react";
import { usePathname } from "next/navigation";
import { Send, X } from "lucide-react";
import { solidButtonShadowClasses } from "@/components/ui/Button";
import { cn } from "@/lib/cn";
import { getFirstTouch } from "@/lib/analytics/firstTouch";

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

export default function HeroQuickConsultButton() {
  const pathname = usePathname();
  const [isOpen, setIsOpen] = useState(false);
  const [form, setForm] = useState<QuickFormState>(initialFormState);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [toast, setToast] = useState<{ kind: "success" | "error"; message: string } | null>(null);

  function formatPhoneInput(raw: string) {
    const digits = raw.replace(/\D/g, "").slice(0, 11);
    if (digits.length <= 3) return digits;
    if (digits.length <= 7) return `${digits.slice(0, 3)}-${digits.slice(3)}`;
    return `${digits.slice(0, 3)}-${digits.slice(3, 7)}-${digits.slice(7)}`;
  }

  function showToast(kind: "success" | "error", message: string) {
    setToast({ kind, message });
    setTimeout(() => {
      setToast(null);
    }, 2600);
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!form.name.trim() || !form.phone.trim() || !form.content.trim()) {
      showToast("error", "이름, 연락처, 문의 내용을 모두 입력해 주세요.");
      return;
    }

    setIsSubmitting(true);
    try {
      const firstTouch = getFirstTouch();
      const response = await fetch("/api/inquiries", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: form.name.trim(),
          phone: form.phone.trim(),
          content: form.content.trim(),
          source_path: `${pathname || "/"}#hero-quick-consult`,
          first_touch: firstTouch ?? undefined,
          inquiry_page_url: pathname || "/",
        }),
      });

      if (!response.ok) {
        showToast("error", "문의 저장 중 오류가 발생했습니다. 잠시 후 다시 시도해 주세요.");
        return;
      }

      setForm(initialFormState);
      setIsOpen(false);
      showToast("success", "빠른 상담 요청이 접수되었습니다. 확인 후 순차적으로 연락드리겠습니다.");
    } catch {
      showToast("error", "네트워크 오류가 발생했습니다. 잠시 후 다시 시도해 주세요.");
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <>
      <button
        type="button"
        onClick={() => setIsOpen(true)}
        className={cn(
          "inline-flex h-12 w-full items-center justify-center gap-2 rounded-full border border-[var(--primary)] bg-[var(--primary)] px-4 text-[14px] font-semibold text-[var(--on-primary)] transition-colors duration-150 hover:bg-[var(--primary-hover)] hover:border-[var(--primary-hover)] focus-visible:outline-none focus-visible:ring-[3px] focus-visible:ring-[var(--focus-ring)] md:px-6 md:text-[15px]",
          solidButtonShadowClasses,
        )}
      >
        <Send
          className="h-4 w-4 opacity-90"
          strokeWidth={1.5}
          aria-hidden="true"
        />
        <span>1:1 상담 문의</span>
      </button>

      {isOpen ? (
        <div className="fixed inset-0 z-50 bg-[var(--overlay)] backdrop-blur-[2px]">
          <div className="flex min-h-full items-center justify-center px-4 py-6">
            <div className="glass-float w-full max-w-md rounded-2xl p-6 text-[var(--text-primary)]">
              <div className="mb-4 flex items-start justify-between gap-3">
                <div>
                  <p className="text-xs font-semibold tracking-[0.18em] text-[var(--text-muted)]">
                    THEALL QUICK CONSULT
                  </p>
                  <h2 className="mt-1 text-xl font-semibold text-[var(--text-primary)] md:text-2xl">
                    프리미엄 상담 요청 남기기
                  </h2>
                  <p className="mt-1 text-xs text-[var(--text-muted)] md:text-sm">
                    간단한 정보만 남겨주시면, 전담 상담사가 순차적으로 연락드립니다.
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => setIsOpen(false)}
                  className="inline-flex h-8 w-8 items-center justify-center rounded-full border border-[var(--border)] text-[var(--text-muted)] transition-colors duration-150 hover:border-[var(--border-strong)] hover:text-[var(--text-primary)]"
                  aria-label="상담 모달 닫기"
                >
                  <X className="h-4 w-4" aria-hidden="true" />
                </button>
              </div>

              <form onSubmit={handleSubmit} className="space-y-3.5">
                <div className="flex flex-col gap-1.5 text-xs font-medium text-[var(--text-secondary)]">
                  <label className="space-y-1.5">
                    <span>이름 *</span>
                    <input
                      type="text"
                      value={form.name}
                      onChange={(event) =>
                        setForm((prev) => ({ ...prev, name: event.target.value }))
                      }
                      placeholder="성함을 입력해 주세요"
                      className="w-full rounded-xl border border-[var(--border)] bg-[var(--surface)] px-3 py-2.5 text-sm text-[var(--text-primary)] outline-none transition-colors duration-150 placeholder:text-[var(--text-subtle)] focus:border-[var(--focus-ring)] focus:ring-2 focus:ring-[var(--focus-ring)]"
                      required
                    />
                  </label>
                </div>

                <div className="flex flex-col gap-1.5 text-xs font-medium text-[var(--text-secondary)]">
                  <label className="space-y-1.5">
                    <span>연락처 *</span>
                    <input
                      type="tel"
                      value={form.phone}
                      onChange={(event) =>
                        setForm((prev) => ({
                          ...prev,
                          phone: formatPhoneInput(event.target.value),
                        }))
                      }
                      placeholder="010-0000-0000"
                      className="w-full rounded-xl border border-[var(--border)] bg-[var(--surface)] px-3 py-2.5 text-sm text-[var(--text-primary)] outline-none transition-colors duration-150 placeholder:text-[var(--text-subtle)] focus:border-[var(--focus-ring)] focus:ring-2 focus:ring-[var(--focus-ring)]"
                      required
                    />
                  </label>
                </div>

                <div className="flex flex-col gap-1.5 text-xs font-medium text-[var(--text-secondary)]">
                  <label className="space-y-1.5">
                    <span>문의 내용 *</span>
                    <textarea
                      rows={4}
                      value={form.content}
                      onChange={(event) =>
                        setForm((prev) => ({ ...prev, content: event.target.value }))
                      }
                      placeholder="예: 5월 중 일본 골프 3박 4일, 4인 강습 포함 일정 희망"
                      className="w-full rounded-xl border border-[var(--border)] bg-[var(--surface)] px-3 py-2.5 text-sm text-[var(--text-primary)] outline-none transition-colors duration-150 placeholder:text-[var(--text-subtle)] focus:border-[var(--focus-ring)] focus:ring-2 focus:ring-[var(--focus-ring)]"
                      required
                    />
                  </label>
                </div>

                <div className="mt-2 flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
                  <p className="text-[10px] text-[var(--text-muted)] md:text-xs">
                    남겨주신 연락처로만 상담 연락을 드리며, 다른 용도로는 사용하지 않습니다.
                  </p>
                  <div className="flex items-center justify-end">
                    <button
                      type="submit"
                      disabled={isSubmitting}
                      className={cn(
                        "inline-flex min-w-[180px] items-center justify-center gap-2 rounded-full border border-[var(--primary)] bg-[var(--primary)] px-5 py-2.5 text-sm font-semibold text-[var(--on-primary)] transition-colors duration-150 hover:bg-[var(--primary-hover)] hover:border-[var(--primary-hover)] focus-visible:outline-none focus-visible:ring-[3px] focus-visible:ring-[var(--focus-ring)] disabled:pointer-events-none disabled:opacity-70",
                        solidButtonShadowClasses,
                      )}
                    >
                      {isSubmitting ? "전송 중..." : "상담 신청"}
                    </button>
                  </div>
                </div>
              </form>
            </div>
          </div>
        </div>
      ) : null}

      {toast ? (
        <div className="fixed top-4 right-4 z-50">
          <div
            className={`rounded-xl px-4 py-3 text-sm font-semibold shadow-lg text-[var(--on-primary)] ${
              toast.kind === "success" ? "bg-[var(--success)]" : "bg-[var(--danger)]"
            }`}
          >
            {toast.message}
          </div>
        </div>
      ) : null}
    </>
  );
}

