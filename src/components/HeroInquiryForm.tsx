"use client";

import { FormEvent, useState } from "react";
import { getFirstTouch } from "@/lib/analytics/firstTouch";
import { inferAttribution } from "@/lib/analytics/attribution";

type HeroFormState = {
  name: string;
  phone: string;
  content: string;
};

const initialState: HeroFormState = {
  name: "",
  phone: "",
  content: "",
};

function formatPhone(raw: string) {
  const digits = raw.replace(/\D/g, "").slice(0, 11);
  if (digits.length <= 3) return digits;
  if (digits.length <= 7) return `${digits.slice(0, 3)}-${digits.slice(3)}`;
  return `${digits.slice(0, 3)}-${digits.slice(3, 7)}-${digits.slice(7)}`;
}

export default function HeroInquiryForm() {
  const [form, setForm] = useState<HeroFormState>(initialState);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [message, setMessage] = useState("");
  const [isSuccess, setIsSuccess] = useState(false);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setIsSubmitting(true);
    setMessage("");

    try {
      const firstTouch = getFirstTouch();
      const response = await fetch("/api/inquiries", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...form,
          first_touch: firstTouch ?? undefined,
          inquiry_page_url: typeof window !== "undefined" ? window.location.pathname : undefined,
        }),
      });

      const result = (await response.json()) as { message?: string };
      if (!response.ok) {
        setIsSuccess(false);
        setMessage(result.message ?? "문의 저장 중 오류가 발생했습니다.");
        return;
      }

      try {
        if (typeof window !== "undefined" && typeof window.gtag === "function") {
          const att = inferAttribution(firstTouch ?? undefined);
          window.gtag("event", "generate_lead", {
            event_category: "inquiry",
            event_label: "general_inquiry",
            inquiry_page_url: window.location.pathname,
            acquisition_channel: att.acquisition_channel ?? undefined,
            acquisition_source_label: att.acquisition_source_label ?? undefined,
            acquisition_medium: att.acquisition_medium ?? undefined,
          });
        }
      } catch {
        /* GA4 전송 실패해도 문의 흐름에는 영향 없음 */
      }
      setIsSuccess(true);
      setMessage("문의가 접수되었습니다. 확인 후 순차적으로 연락드리겠습니다.");
      setForm(initialState);
    } catch {
      setIsSuccess(false);
      setMessage("네트워크 오류가 발생했습니다. 잠시 후 다시 시도해 주세요.");
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <form className="space-y-4" onSubmit={handleSubmit}>
      <label className="flex flex-col gap-1.5 text-sm font-medium text-slate-800">
        이름
        <input
          type="text"
          required
          value={form.name}
          onChange={(event) =>
            setForm((prev) => ({ ...prev, name: event.target.value }))
          }
          placeholder="이름을 입력해 주세요"
          className="rounded-lg border border-slate-300 px-4 py-3 text-sm outline-none transition focus:border-[var(--focus-ring)] focus:ring-2 focus:ring-[var(--focus-ring)]"
        />
      </label>

      <label className="flex flex-col gap-1.5 text-sm font-medium text-slate-800">
        연락처
        <input
          type="tel"
          required
          value={form.phone}
          onChange={(event) =>
            setForm((prev) => ({
              ...prev,
              phone: formatPhone(event.target.value),
            }))
          }
          placeholder="010-0000-0000"
          className="rounded-lg border border-slate-300 px-4 py-3 text-sm outline-none transition focus:border-[var(--focus-ring)] focus:ring-2 focus:ring-[var(--focus-ring)]"
        />
      </label>

      <label className="flex flex-col gap-1.5 text-sm font-medium text-slate-800">
        상담 희망 내용
        <textarea
          required
          rows={4}
          value={form.content}
          onChange={(event) =>
            setForm((prev) => ({ ...prev, content: event.target.value }))
          }
          placeholder="예: 5월 중 일본 골프 3박 4일, 부부 동반 일정 상담希望"
          className="rounded-lg border border-slate-300 px-4 py-3 text-sm outline-none transition focus:border-[var(--focus-ring)] focus:ring-2 focus:ring-[var(--focus-ring)]"
        />
      </label>

      <button
        type="submit"
        disabled={isSubmitting}
        className="flex w-full items-center justify-center rounded-lg bg-[var(--accent)] px-5 py-3 text-sm font-semibold text-[var(--on-accent)] transition hover:bg-[var(--accent-hover)] active:bg-[var(--accent-active)] disabled:cursor-not-allowed disabled:opacity-50"
      >
        {isSubmitting ? "상담 요청 중..." : "전담 상담사에게 문의하기"}
      </button>

      {message ? (
        <p
          className={`text-xs leading-relaxed ${
            isSuccess ? "text-emerald-700" : "text-red-600"
          }`}
        >
          {message}
        </p>
      ) : null}
    </form>
  );
}

