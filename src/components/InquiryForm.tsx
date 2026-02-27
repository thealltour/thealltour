"use client";

import { FormEvent, useState } from "react";
import Link from "next/link";
import type { InquiryInput } from "@/types/inquiry";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { Textarea } from "@/components/ui/Textarea";
import { Label } from "@/components/ui/Label";

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

  function formatPhoneInput(raw: string) {
    const digits = raw.replace(/\D/g, "").slice(0, 11);
    if (digits.length <= 3) return digits;
    if (digits.length <= 7) return `${digits.slice(0, 3)}-${digits.slice(3)}`;
    return `${digits.slice(0, 3)}-${digits.slice(3, 7)}-${digits.slice(7)}`;
  }

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
      setMessage("문의가 접수되었습니다. 확인 후 순차적으로 연락드리겠습니다.");
      setForm(initialFormState);
    } catch {
      setIsSuccess(false);
      setMessage("네트워크 오류가 발생했습니다. 잠시 후 다시 시도해 주세요.");
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <form className="grid gap-4 md:grid-cols-2 md:gap-5" onSubmit={handleSubmit}>
      <div className="md:col-span-2 grid gap-3 rounded-xl bg-[#f9fafb] p-4 border border-[#e2e8f0] md:grid-cols-3">
        <div>
          <p className="section-label text-[#1E3A8A]">응답 안내</p>
          <p className="mt-1 type-small text-content-secondary">접수된 순서대로 확인 후 연락드립니다.</p>
        </div>
        <div>
          <p className="section-label text-[#1E3A8A]">맞춤 제안</p>
          <p className="mt-1 type-small text-content-secondary">일정/예산/동행 구성 중심으로 설계합니다.</p>
        </div>
        <div>
          <p className="section-label text-[#1E3A8A]">개인정보 보호</p>
          <p className="mt-1 type-small text-content-secondary">상담 목적 외에는 사용하지 않습니다.</p>
        </div>
      </div>
      {sourceProductTitle ? (
        <div className="md:col-span-2 rounded-lg border border-slate-200 bg-slate-50 px-4 py-3 type-small text-content-primary">
          문의 상품: <span className="font-semibold">{sourceProductTitle}</span>
        </div>
      ) : null}
      <Label className="flex flex-col gap-2 md:col-span-1">
        이름
        <Input
          type="text"
          name="name"
          required
          value={form.name}
          onChange={(event) => setForm((prev) => ({ ...prev, name: event.target.value }))}
          placeholder="홍길동"
        />
      </Label>
      <Label className="flex flex-col gap-2 md:col-span-1">
        연락처
        <Input
          type="tel"
          name="phone"
          required
          value={form.phone}
          onChange={(event) =>
            setForm((prev) => ({
              ...prev,
              phone: formatPhoneInput(event.target.value),
            }))
          }
          placeholder="01012345678 ( '-' 없이 입력 )"
        />
      </Label>
      <Label className="flex flex-col gap-2 md:col-span-2">
        문의 내용
        <Textarea
          name="content"
          required
          rows={5}
          value={form.content}
          onChange={(event) => setForm((prev) => ({ ...prev, content: event.target.value }))}
          placeholder="예: 스위스 7일, 부모님 동반, 5월 출발 희망"
        />
      </Label>
      <Button type="submit" disabled={isSubmitting} className="md:col-span-2 mt-1 w-full">
        {isSubmitting ? "전송 중..." : "문의 하기"}
      </Button>
      {message ? (
        <div
          className={`md:col-span-2 rounded-lg px-3 py-2 text-sm ${
            isSuccess ? "bg-emerald-50 text-emerald-700" : "bg-red-50 text-red-600"
          }`}
        >
          <p>{message}</p>
          {isSuccess ? (
            <div className="mt-2 flex flex-wrap items-center gap-2 type-caption">
              <Link
                href="/products"
                className="inline-flex items-center rounded-md border border-emerald-200 bg-white px-2.5 py-1 font-semibold text-emerald-700 hover:bg-emerald-100"
              >
                다른 상품 더 보기
              </Link>
              <Link
                href="/support"
                className="inline-flex items-center rounded-md border border-emerald-200 bg-white px-2.5 py-1 font-semibold text-emerald-700 hover:bg-emerald-100"
              >
                고객센터 바로가기
              </Link>
            </div>
          ) : null}
        </div>
      ) : null}
    </form>
  );
}

