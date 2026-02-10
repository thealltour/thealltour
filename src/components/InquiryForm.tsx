"use client";

import { FormEvent, useState } from "react";
import type { InquiryInput } from "@/types/inquiry";

type FormState = {
  name: string;
  phone: string;
  content: string;
};

const initialFormState: FormState = {
  name: "",
  phone: "",
  content: "",
};

type InquiryFormProps = {
  source?: Partial<Pick<InquiryInput, "product_id" | "product_title" | "source_path">>;
};

export default function InquiryForm({ source }: InquiryFormProps) {
  const sourceProductId = source?.product_id?.trim() ?? "";
  const sourceProductTitle = source?.product_title?.trim() ?? "";
  const sourcePath = source?.source_path?.trim() ?? "";
  const [form, setForm] = useState<FormState>(initialFormState);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [message, setMessage] = useState("");
  const [isSuccess, setIsSuccess] = useState(false);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setIsSubmitting(true);
    setMessage("");

    try {
      const response = await fetch("/api/inquiries", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...form,
          product_id: sourceProductId || undefined,
          product_title: sourceProductTitle || undefined,
          source_path: sourcePath || undefined,
        }),
      });

      const result = (await response.json()) as { message?: string };

      if (!response.ok) {
        setIsSuccess(false);
        setMessage(result.message ?? "문의 저장 중 오류가 발생했습니다.");
        return;
      }

      setIsSuccess(true);
      setMessage("문의가 접수되었습니다. 빠르게 연락드리겠습니다.");
      setForm(initialFormState);
    } catch {
      setIsSuccess(false);
      setMessage("네트워크 오류가 발생했습니다. 잠시 후 다시 시도해 주세요.");
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <form className="grid gap-4 md:grid-cols-2" onSubmit={handleSubmit}>
      {sourceProductTitle ? (
        <div className="md:col-span-2 rounded-lg border border-blue-200 bg-blue-50 px-4 py-3 text-sm text-blue-800">
          문의 상품: <span className="font-semibold">{sourceProductTitle}</span>
        </div>
      ) : null}
      <label className="flex flex-col gap-2 text-sm font-medium text-slate-700">
        이름
        <input
          type="text"
          name="name"
          required
          value={form.name}
          onChange={(event) => setForm((prev) => ({ ...prev, name: event.target.value }))}
          placeholder="홍길동"
          className="rounded-lg border border-slate-300 px-4 py-3 text-sm outline-none transition focus:border-[#2563eb] focus:ring-2 focus:ring-[#bfdbfe]"
        />
      </label>
      <label className="flex flex-col gap-2 text-sm font-medium text-slate-700">
        연락처
        <input
          type="tel"
          name="phone"
          required
          value={form.phone}
          onChange={(event) => setForm((prev) => ({ ...prev, phone: event.target.value }))}
          placeholder="010-1234-5678"
          className="rounded-lg border border-slate-300 px-4 py-3 text-sm outline-none transition focus:border-[#2563eb] focus:ring-2 focus:ring-[#bfdbfe]"
        />
      </label>
      <label className="flex flex-col gap-2 text-sm font-medium text-slate-700 md:col-span-2">
        문의 내용
        <textarea
          name="content"
          required
          rows={5}
          value={form.content}
          onChange={(event) => setForm((prev) => ({ ...prev, content: event.target.value }))}
          placeholder="예: 스위스 7일, 부모님 동반, 5월 출발 희망"
          className="rounded-lg border border-slate-300 px-4 py-3 text-sm outline-none transition focus:border-[#2563eb] focus:ring-2 focus:ring-[#bfdbfe]"
        />
      </label>
      <button
        type="submit"
        disabled={isSubmitting}
        className="md:col-span-2 rounded-lg bg-[#1d4ed8] px-5 py-3 text-sm font-semibold text-white transition hover:bg-[#1e40af] disabled:cursor-not-allowed disabled:bg-[#93c5fd]"
      >
        {isSubmitting ? "전송 중..." : "문의 내용 보내기"}
      </button>
      {message ? (
        <p className={`md:col-span-2 text-sm ${isSuccess ? "text-green-600" : "text-red-500"}`}>
          {message}
        </p>
      ) : null}
    </form>
  );
}
