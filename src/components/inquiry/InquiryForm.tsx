"use client";

import { FormEvent, useEffect, useMemo, useState, useCallback } from "react";
import type { InquiryInput } from "@/types/inquiry";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { Textarea } from "@/components/ui/Textarea";
import { Label } from "@/components/ui/Label";
import { trackQuoteSubmitClick, trackQuoteSubmitSuccess } from "@/lib/analytics/trackQuoteEvent";
import { getAttributionTouch } from "@/lib/analytics/firstTouch";
import { inferAttribution } from "@/lib/analytics/attribution";
import { GolfBriefFields } from "@/components/inquiry/GolfBriefFields";
import { InquirySuccessPanel } from "@/components/inquiry/InquirySuccessPanel";
import {
  isGolfBriefContext,
  mergeGolfBriefIntoContent,
  type GolfBriefSnapshot,
} from "@/lib/inquiry/golfBriefFields";

type FormState = {
  name: string;
  phone: string;
  desiredDeparture: string;
  peopleCount: string;
  content: string;
};

const initialFormState: FormState = {
  name: "",
  phone: "",
  desiredDeparture: "",
  peopleCount: "",
  content: "",
};

type Touched = { name?: boolean; phone?: boolean };
type Errors = { name?: string; phone?: string };

function validate(form: FormState): Errors {
  const errors: Errors = {};
  if (!form.name?.trim()) errors.name = "이름을 입력해 주세요.";
  if (!form.phone?.trim()) errors.phone = "연락처를 입력해 주세요.";
  return errors;
}

type InquiryFormProps = {
  source?: Partial<
    Pick<InquiryInput, "product_id" | "product_title" | "source_path" | "landing_slug" | "quote_category">
  >;
  productIdForTracking?: string;
  initialDesiredDeparture?: string;
};

export default function InquiryForm({
  source,
  productIdForTracking,
  initialDesiredDeparture,
}: InquiryFormProps) {
  const sourceProductId = source?.product_id?.trim() ?? "";
  const sourceProductTitle = source?.product_title?.trim() ?? "";
  const sourcePath = source?.source_path?.trim() ?? "";
  const landingSlug = source?.landing_slug?.trim() ?? "";
  const quoteCategory = source?.quote_category?.trim() ?? "";

  const showGolfBrief = useMemo(
    () =>
      isGolfBriefContext({
        quoteCategory,
        productTitle: sourceProductTitle,
        landingSlug,
      }),
    [quoteCategory, sourceProductTitle, landingSlug],
  );

  const [form, setForm] = useState<FormState>({
    ...initialFormState,
    desiredDeparture: initialDesiredDeparture ?? "",
  });
  const [golfBrief, setGolfBrief] = useState<GolfBriefSnapshot>({});
  const [touched, setTouched] = useState<Touched>({});
  const [errors, setErrors] = useState<Errors>({});
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [message, setMessage] = useState("");
  const [isSuccess, setIsSuccess] = useState(false);
  const [kakaoHref, setKakaoHref] = useState<string | undefined>();
  const [slaMinutes, setSlaMinutes] = useState(30);

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

  const formatPhoneInput = useCallback((raw: string) => {
    const digits = raw.replace(/\D/g, "").slice(0, 11);
    if (digits.length <= 3) return digits;
    if (digits.length <= 7) return `${digits.slice(0, 3)}-${digits.slice(3)}`;
    return `${digits.slice(0, 3)}-${digits.slice(3, 7)}-${digits.slice(7)}`;
  }, []);

  const buildContent = useCallback(
    (state: FormState) => {
      const parts: string[] = [];
      if (state.desiredDeparture?.trim()) parts.push(`출발 희망일: ${state.desiredDeparture.trim()}`);
      if (state.peopleCount?.trim()) parts.push(`인원: ${state.peopleCount.trim()}`);
      const base = state.content?.trim() ?? "";
      const merged = showGolfBrief ? mergeGolfBriefIntoContent(base, golfBrief) : base;
      if (merged) parts.push(merged);
      return parts.join("\n");
    },
    [golfBrief, showGolfBrief],
  );

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setTouched({ name: true, phone: true });
    const nextErrors = validate(form);
    setErrors(nextErrors);
    if (Object.keys(nextErrors).length > 0) return;

    const trackingId = productIdForTracking || sourceProductId;
    if (trackingId) trackQuoteSubmitClick(trackingId);
    setIsSubmitting(true);
    setMessage("");

    try {
      const content = buildContent(form);
      const firstTouch = getAttributionTouch();
      const quoteSnapshot = showGolfBrief
        ? { golf_brief: golfBrief, desired_departure: form.desiredDeparture || null }
        : undefined;

      const response = await fetch("/api/inquiries", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: form.name.trim(),
          phone: form.phone.trim(),
          content: content || "",
          product_id: sourceProductId || undefined,
          product_title: sourceProductTitle || undefined,
          source_path: sourcePath || undefined,
          landing_slug: landingSlug || undefined,
          quote_category: quoteCategory || undefined,
          first_touch: firstTouch ?? undefined,
          inquiry_page_url: typeof window !== "undefined" ? window.location.pathname : undefined,
          quote_snapshot: quoteSnapshot,
        }),
      });

      const result = (await response.json()) as { message?: string };

      if (!response.ok) {
        setIsSuccess(false);
        setMessage(result.message ?? "문의 저장 중 오류가 발생했습니다.");
        return;
      }

      if (trackingId) trackQuoteSubmitSuccess(trackingId);

      try {
        if (typeof window !== "undefined" && typeof window.gtag === "function") {
          const att = inferAttribution(firstTouch ?? undefined);
          window.gtag("event", "generate_lead", {
            event_category: "inquiry",
            event_label: sourceProductTitle || "general_inquiry",
            source_path: sourcePath || undefined,
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
      setForm({ ...initialFormState, desiredDeparture: initialDesiredDeparture ?? "" });
      setGolfBrief({});
      setErrors({});
      setTouched({});
    } catch {
      setIsSuccess(false);
      setMessage("네트워크 오류가 발생했습니다. 잠시 후 다시 시도해 주세요.");
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleBlur = (field: "name" | "phone") => {
    setTouched((prev) => ({ ...prev, [field]: true }));
    const nextErrors = validate(form);
    setErrors((prev) => ({ ...prev, [field]: nextErrors[field] }));
  };

  return (
    <form className="flex flex-col space-y-4 md:space-y-0 md:grid md:grid-cols-2 md:gap-5" onSubmit={handleSubmit}>
      <div className="md:col-span-2 flex flex-col space-y-3 md:space-y-0 md:grid md:grid-cols-3 md:gap-3 rounded-xl bg-[#f9fafb] p-4 border border-[#e2e8f0]">
        <div>
          <p className="section-label text-[var(--primary)]">응답 안내</p>
          <p className="mt-1 type-small text-content-secondary">접수된 순서대로 확인 후 연락드립니다.</p>
        </div>
        <div>
          <p className="section-label text-[var(--primary)]">맞춤 제안</p>
          <p className="mt-1 type-small text-content-secondary">일정/예산/동행 구성 중심으로 설계합니다.</p>
        </div>
        <div>
          <p className="section-label text-[var(--primary)]">개인정보 보호</p>
          <p className="mt-1 type-small text-content-secondary">상담 목적 외에는 사용하지 않습니다.</p>
        </div>
      </div>

      {sourceProductTitle ? (
        <div className="md:col-span-2 rounded-lg border border-slate-200 bg-slate-50 px-4 py-3 type-small text-content-primary">
          문의 상품: <span className="font-semibold">{sourceProductTitle}</span>
        </div>
      ) : null}

      {showGolfBrief ? <GolfBriefFields value={golfBrief} onChange={setGolfBrief} /> : null}

      <div className="flex flex-col gap-1 md:col-span-1">
        <Label className="flex flex-col gap-2">
          이름 <span className="text-red-500">*</span>
          <Input
            type="text"
            name="name"
            value={form.name}
            onChange={(e) => setForm((prev) => ({ ...prev, name: e.target.value }))}
            onBlur={() => handleBlur("name")}
            placeholder="홍길동"
            className="py-3"
            aria-invalid={touched.name && !!errors.name}
            aria-describedby={touched.name && errors.name ? "name-error" : undefined}
          />
        </Label>
        {touched.name && errors.name ? (
          <p id="name-error" className="text-sm text-red-600" role="alert">
            {errors.name}
          </p>
        ) : null}
      </div>

      <div className="flex flex-col gap-1 md:col-span-1">
        <Label className="flex flex-col gap-2">
          연락처 <span className="text-red-500">*</span>
          <Input
            type="tel"
            name="phone"
            value={form.phone}
            onChange={(e) =>
              setForm((prev) => ({
                ...prev,
                phone: formatPhoneInput(e.target.value),
              }))
            }
            onBlur={() => handleBlur("phone")}
            placeholder="01012345678 ( '-' 없이 입력 )"
            className="py-3"
            aria-invalid={touched.phone && !!errors.phone}
            aria-describedby={touched.phone && errors.phone ? "phone-error" : undefined}
          />
        </Label>
        {touched.phone && errors.phone ? (
          <p id="phone-error" className="text-sm text-red-600" role="alert">
            {errors.phone}
          </p>
        ) : null}
      </div>

      <Label className="flex flex-col gap-2 md:col-span-2">
        출발 희망일 <span className="text-slate-400 text-sm font-normal">(선택)</span>
        <Input
          type="text"
          name="desiredDeparture"
          value={form.desiredDeparture}
          onChange={(e) => setForm((prev) => ({ ...prev, desiredDeparture: e.target.value }))}
          placeholder="예: 20xx년 10월"
          className="py-3"
        />
      </Label>

      <Label className="flex flex-col gap-2 md:col-span-2">
        인원 <span className="text-slate-400 text-sm font-normal">(선택)</span>
        <Input
          type="text"
          name="peopleCount"
          value={form.peopleCount}
          onChange={(e) => setForm((prev) => ({ ...prev, peopleCount: e.target.value }))}
          placeholder="예: 2명"
          className="py-3"
        />
      </Label>

      <Label className="flex flex-col gap-2 md:col-span-2">
        문의 내용 <span className="text-slate-400 text-sm font-normal">(선택)</span>
        <Textarea
          name="content"
          rows={4}
          value={form.content}
          onChange={(e) => setForm((prev) => ({ ...prev, content: e.target.value }))}
          placeholder="예: 스위스 7일, 부모님 동반, 5월 출발 희망"
          className="py-3 min-h-[4.5rem]"
        />
      </Label>

      <div className="md:col-span-2 flex flex-col gap-2">
        <Button type="submit" disabled={isSubmitting} className="w-full py-3">
          {isSubmitting ? "전송 중..." : "상담 요청 보내기"}
        </Button>
        <p className="text-center text-sm text-slate-500">입력해주신 내용을 확인 후 안내드립니다.</p>
      </div>

      {message ? (
        <div
          className={`md:col-span-2 rounded-lg px-3 py-2 text-sm ${
            isSuccess ? "bg-emerald-50 text-emerald-700" : "bg-red-50 text-red-600"
          }`}
          role="alert"
        >
          <p>{message}</p>
          {isSuccess ? (
            <InquirySuccessPanel
              className="mt-3"
              slaMinutes={slaMinutes}
              kakaoHref={kakaoHref}
            />
          ) : null}
        </div>
      ) : null}
    </form>
  );
}
