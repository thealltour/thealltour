# 문의 제출·문자 발송 코드 추적 (2건 발송 원인 분석용)

**목적:** 문자가 2건 나가는 원인을 프론트 / Next API / VPS 중 어디에서 짚을지, 이 레포 코드만으로 흐름을 따라갈 수 있게 한다.

**레포 밖:** 가비아 VPS(PM2) `send-aligo` **핸들러 소스는 이 저장소에 없음**. 호출 URL·JSON 형태만 아래에 정리한다.

---

## 흐름 한눈에 (이 레포 기준)

| 경로 | 문자(알리고 relay) 호출 |
|------|-------------------------|
| 공개 문의 `POST /api/inquiries` (성공 시) | **1회** `sendAligoRelay` (고객 번호로 `[더올투어 문의접수]` 블록) |
| 관리자 `POST .../send-message` | **1회** `sendAligoRelay` (관리자가 쓴 본문) |
| `notifyInquiryCreated` | Slack / Resend / KAKAO 웹훅만. **SMS 아님** |
| `createNewInquiryNotification` | Supabase `admin_notifications` insert. **SMS 아님** |
| `src/lib/sms/aligo.ts` (`sendAligoSms` 등) | **다른 파일에서 import 되지 않음** → 문의 흐름과 **현재 미연결** |

**2건 의심 시 우선순위 (코드상):**

1. **클라이언트:** 동일 폼에서 `fetch("/api/inquiries")`가 2번 나가는지(연타, 재시도, 중복 핸들러).
2. **API:** `POST` 핸들러는 성공 시 `sendAligoRelay`를 **한 블록**에서만 호출한다. insert fallback은 **같은 요청 안에서 inquiryId 하나**로 이어짐.
3. **VPS:** 요청 1건인데 relay/알리고 쪽에서 2회 발송하는지(레포 밖 확인).

**React Strict Mode:** 개발 모드에서 Effect가 두 번 돌 수 있으나, 본 문의들은 **`useEffect`로 `/api/inquiries`를 자동 POST 하지 않음.** 제출은 `onSubmit`/`handleSubmit` 기준.

---

## [1] `/quote` 페이지 → 실제 폼

`/quote`는 서버 컴포넌트에서 `QuotePageContent`만 렌더한다. 제출 로직은 `InquiryForm`에 있음.

### `src/app/quote/page.tsx` (전체)

```tsx
import SiteHeader from "@/components/site-chrome/SiteHeader";
import { PageHero } from "@/components/layout/PageHero";
import { SectionBody } from "@/components/layout/SectionBody";
import { ContentCard } from "@/components/layout/ContentCard";
import { QuotePageContent, type QuoteSummary } from "@/components/quote/QuotePageContent";
import { getProductById } from "@/lib/products";

type QuotePageProps = {
  searchParams?: Promise<{
    product_id?: string;
    product_title?: string;
    source_path?: string;
  }>;
};

export default async function QuotePage({ searchParams }: QuotePageProps) {
  const query = (await searchParams) ?? {};
  const productId = query.product_id?.trim();
  const productTitleFromQuery = query.product_title?.trim();

  let productSummary: QuoteSummary | null = null;
  if (productId) {
    const product = await getProductById(productId);
    if (product) {
      productSummary = {
        productTitle: product.title?.trim() || productTitleFromQuery || "상품",
        duration: product.duration ?? undefined,
        region: product.theme ?? product.overview_region ?? product.departure ?? undefined,
        price: typeof product.price === "number" && product.price > 0 ? product.price : undefined,
      };
    } else if (productTitleFromQuery) {
      productSummary = {
        productTitle: productTitleFromQuery,
        duration: undefined,
        region: undefined,
        price: undefined,
      };
    }
  }

  return (
    <div className="min-h-screen bg-gradient-to-b from-[#f3f8ff] to-white text-content-primary">
      <SiteHeader activeTab="quote" />

      <SectionBody className="flex flex-col gap-[var(--space-5)]">
        <PageHero
          kicker="THEALL TOUR QUOTE"
          title="맞춤 견적 문의"
          subtitle="여행 희망 조건을 남겨주시면 접수 순서대로 맞춤 일정과 견적 옵션을 안내드립니다."
          size="sm"
        />

        <ContentCard>
          <div className="mb-6 space-y-2">
            <p className="section-label text-[#B8962E]">THEALL TOUR CONTACT</p>
            <h2 className="section-title type-h2">견적 문의 작성</h2>
            <p className="type-small text-content-secondary">
              간단한 정보만 남겨주시면 확인 후 안내드리겠습니다. 필수 항목만 입력하셔도 상담이 가능합니다.
            </p>
          </div>
          <QuotePageContent
            source={{
              product_id: query.product_id,
              product_title: productSummary?.productTitle ?? query.product_title,
              source_path: query.source_path,
            }}
            productSummary={productSummary}
          />
        </ContentCard>
      </SectionBody>
    </div>
  );
}
```

### `src/components/quote/QuotePageContent.tsx` (전체)

**요약:** `useEffect`는 `trackQuotePageView`만 호출. **문의/문자 자동 발송 없음.**

```tsx
"use client";

import { useEffect } from "react";
import InquiryForm from "@/components/inquiry/InquiryForm";
import { QuoteSummaryCard } from "@/components/quote/QuoteSummaryCard";
import { trackQuotePageView } from "@/lib/analytics/trackQuoteEvent";
import type { InquiryInput } from "@/types/inquiry";

export type QuoteSummary = {
  productTitle: string;
  duration?: string | null;
  region?: string | null;
  price?: number | null;
};

type QuotePageContentProps = {
  source?: Partial<Pick<InquiryInput, "product_id" | "product_title" | "source_path">>;
  productSummary?: QuoteSummary | null;
};

export function QuotePageContent({ source, productSummary }: QuotePageContentProps) {
  const productId = source?.product_id?.trim() ?? "";

  useEffect(() => {
    trackQuotePageView(productId || undefined);
  }, [productId]);

  return (
    <>
      {productSummary && (
        <div className="mb-6">
          <QuoteSummaryCard
            productTitle={productSummary.productTitle}
            duration={productSummary.duration}
            region={productSummary.region}
            price={productSummary.price}
          />
        </div>
      )}
      <InquiryForm source={source} productIdForTracking={productId || undefined} />
    </>
  );
}
```

### `src/components/inquiry/InquiryForm.tsx` (전체)

**요약:** `handleSubmit` → `setIsSubmitting(true)` → **`fetch("/api/inquiries", { method: "POST" })` 단 1회** → 성공 시 폼 리셋. `isSubmitting`으로 버튼 비활성.

```tsx
"use client";

import { FormEvent, useState, useCallback } from "react";
import Link from "next/link";
import type { InquiryInput } from "@/types/inquiry";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { Textarea } from "@/components/ui/Textarea";
import { Label } from "@/components/ui/Label";
import { trackQuoteSubmitClick, trackQuoteSubmitSuccess } from "@/lib/analytics/trackQuoteEvent";
import { getFirstTouch } from "@/lib/analytics/firstTouch";
import { inferAttribution } from "@/lib/analytics/attribution";

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
  source?: Partial<Pick<InquiryInput, "product_id" | "product_title" | "source_path">>;
  /** quote 페이지에서 전달 시 submit_click / submit_success 트래킹에 사용 */
  productIdForTracking?: string;
};

export default function InquiryForm({ source, productIdForTracking }: InquiryFormProps) {
  const sourceProductId = source?.product_id?.trim() ?? "";
  const sourceProductTitle = source?.product_title?.trim() ?? "";
  const sourcePath = source?.source_path?.trim() ?? "";
  const [form, setForm] = useState<FormState>(initialFormState);
  const [touched, setTouched] = useState<Touched>({});
  const [errors, setErrors] = useState<Errors>({});
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [message, setMessage] = useState("");
  const [isSuccess, setIsSuccess] = useState(false);

  const formatPhoneInput = useCallback((raw: string) => {
    const digits = raw.replace(/\D/g, "").slice(0, 11);
    if (digits.length <= 3) return digits;
    if (digits.length <= 7) return `${digits.slice(0, 3)}-${digits.slice(3)}`;
    return `${digits.slice(0, 3)}-${digits.slice(3, 7)}-${digits.slice(7)}`;
  }, []);

  const buildContent = useCallback((state: FormState) => {
    const parts: string[] = [];
    if (state.desiredDeparture?.trim()) parts.push(`출발 희망일: ${state.desiredDeparture.trim()}`);
    if (state.peopleCount?.trim()) parts.push(`인원: ${state.peopleCount.trim()}`);
    if (state.content?.trim()) parts.push(state.content.trim());
    return parts.join("\n");
  }, []);

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setTouched({ name: true, phone: true });
    const nextErrors = validate(form);
    setErrors(nextErrors);
    if (Object.keys(nextErrors).length > 0) return;

    if (productIdForTracking) trackQuoteSubmitClick(productIdForTracking);
    setIsSubmitting(true);
    setMessage("");

    try {
      const content = buildContent(form);
      const firstTouch = getFirstTouch();
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

      if (productIdForTracking) trackQuoteSubmitSuccess(productIdForTracking);
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
      setForm(initialFormState);
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
```

---

## [1-보충] 기타 `POST /api/inquiries` 클라이언트

동일 패턴: **`fetch("/api/inquiries")` 1회**, `isSubmitting`(또는 동등)으로 전송 중 버튼 제어. **전체 소스는 부록 표의 원본 파일을 복사.**

**`ConsultModal.tsx` — 자동 문자/자동 제출 없음 (`useEffect`는 오픈 트래킹만):**

```tsx
  useEffect(() => {
    if (isOpen) {
      trackConsultOpen({
        productId: params.productId,
        sourcePath: params.sourcePath,
      });
    }
  }, [isOpen, params.productId, params.sourcePath]);
```

---

## [2] Next.js API: `POST` `src/app/api/inquiries/route.ts`

**상단 import (relay):**

```ts
import { normalizeReceiverPhone, sendAligoRelay } from "@/lib/notifications/sendAligoRelay";
import { notifyInquiryCreated } from "@/lib/notifications";
import { createNewInquiryNotification } from "@/lib/adminNotifications";
```

**`export async function POST` 전체 (문의 저장 성공 후 분기·payload·로그·relay·후처리 포함):**

```ts
export async function POST(request: Request) {
  const body = (await request.json()) as Partial<InquiryInput>;
  const name = body.name?.trim();
  const phone = body.phone?.trim();
  const content = body.content?.trim();
  const productId = body.product_id?.trim();
  const productTitle = body.product_title?.trim();
  const sourcePath = body.source_path?.trim();
  const selectedOptions = body.selected_options;
  const quoteSummaryRaw = body.quote_summary;
  const inquiredAt = body.inquired_at?.trim();
  const firstTouch = body.first_touch;
  const inquiryPageUrl = body.inquiry_page_url?.trim();

  if (!name || !phone) {
    return NextResponse.json({ message: "이름과 연락처를 입력해 주세요." }, { status: 400 });
  }

  const hasOptionPayload =
    (selectedOptions && Object.keys(selectedOptions).length > 0) ||
    (quoteSummaryRaw &&
      (quoteSummaryRaw.total != null || (quoteSummaryRaw.breakdown?.length ?? 0) > 0)) ||
    inquiredAt;

  let quoteSnapshot: Record<string, unknown> | null = null;
  if (hasOptionPayload) {
    quoteSnapshot = {
      inquiredAt: inquiredAt || new Date().toISOString(),
    };
    if (selectedOptions && Object.keys(selectedOptions).length > 0) {
      quoteSnapshot.selectedOptions = selectedOptions;
    }
    if (quoteSummaryRaw && (quoteSummaryRaw.total != null || (quoteSummaryRaw.breakdown?.length ?? 0) > 0)) {
      quoteSnapshot.quoteSummary = {
        total: quoteSummaryRaw.total,
        basePrice: quoteSummaryRaw.base_price,
        breakdown: (quoteSummaryRaw.breakdown ?? []).map((b) => ({
          groupLabel: b.group_label,
          optionLabel: b.option_label,
          priceDelta: b.price_delta,
        })),
      };
    }
  }

  const contentValue = content ?? "";
  const insertPayload: Record<string, unknown> = {
    name,
    phone,
    content: contentValue,
    product_id: productId || null,
    product_title: productTitle || null,
    source_path: sourcePath || null,
  };
  if (quoteSnapshot) {
    insertPayload.quote_snapshot = quoteSnapshot;
  }
  if (firstTouch != null && typeof firstTouch === "object") {
    insertPayload.first_touch = firstTouch;
  }
  if (inquiryPageUrl) {
    insertPayload.inquiry_page_url = inquiryPageUrl;
  }

  const attribution = inferAttribution(firstTouch ?? undefined);
  insertPayload.acquisition_channel = attribution.acquisition_channel;
  insertPayload.acquisition_source_label = attribution.acquisition_source_label;
  insertPayload.acquisition_medium = attribution.acquisition_medium;
  insertPayload.acquisition_summary = attribution.acquisition_summary;
  insertPayload.first_landing_path = attribution.first_landing_path;

  const profile = await findOrCreateCustomerProfile({
    name,
    phone,
    source: "inquiry",
  });
  if (profile) {
    insertPayload.customer_profile_id = profile.id;
  }

  // 1차: 전체 payload(quote_snapshot, customer_profile_id, product_*, source_path 포함)로 insert
  const insertResultWithProduct = await supabase
    .from("inquiries")
    .insert(insertPayload)
    .select("id")
    .maybeSingle();

  let inquiryId = insertResultWithProduct.data?.id;
  if (insertResultWithProduct.error || !insertResultWithProduct.data) {
    const firstError = insertResultWithProduct.error;
    const code = firstError?.code;

    // 2차: quote_snapshot만 제거하고 재시도 (product_*, source_path, customer_profile_id 유지)
    if (code === "42703" && quoteSnapshot) {
      const withoutQuote: Record<string, unknown> = {
        name,
        phone,
        content: contentValue,
        product_id: productId || null,
        product_title: productTitle || null,
        source_path: sourcePath || null,
      };
      if (insertPayload.customer_profile_id) {
        withoutQuote.customer_profile_id = insertPayload.customer_profile_id;
      }
      const retryWithoutQuote = await supabase
        .from("inquiries")
        .insert(withoutQuote)
        .select("id")
        .maybeSingle();
      if (!retryWithoutQuote.error && retryWithoutQuote.data) {
        inquiryId = retryWithoutQuote.data.id;
        console.error("[inquiries POST] fallback: quote_snapshot 제거 후 저장 성공", {
          code,
          message: firstError?.message,
        });
      }
    }

    if (!inquiryId) {
      // 3차: customer_profile_id 제거 후 재시도 (product_*, source_path 유지)
      const withoutProfile: Record<string, unknown> = {
        name,
        phone,
        content: contentValue,
        product_id: productId || null,
        product_title: productTitle || null,
        source_path: sourcePath || null,
      };
      const retryWithoutProfile = await supabase
        .from("inquiries")
        .insert(withoutProfile)
        .select("id")
        .maybeSingle();
      if (!retryWithoutProfile.error && retryWithoutProfile.data) {
        inquiryId = retryWithoutProfile.data.id;
        console.error("[inquiries POST] fallback: customer_profile_id 제거 후 저장 성공", {
          code: firstError?.code,
          message: firstError?.message,
        });
      }
    }

    // 최종: 정말 불가할 때만 최소 필드 insert
    if (!inquiryId) {
      const insertLegacy = await supabase
        .from("inquiries")
        .insert({
          name,
          phone,
          content: contentValue,
        })
        .select("id")
        .maybeSingle();
      if (insertLegacy.error || !insertLegacy.data) {
        console.error("[inquiries POST] fallback: 최소 필드 insert 실패", {
          error: insertLegacy.error?.message,
          code: insertLegacy.error?.code,
        });
        return NextResponse.json({ message: "문의 저장에 실패했습니다." }, { status: 500 });
      }
      inquiryId = insertLegacy.data.id;
      console.error("[inquiries POST] fallback: 최소 필드(name,phone,content)만 저장됨. product/customer_profile 등 유실 가능.");
    }
  }

  // 문의 저장 성공 이후: 가비아 알리고 중계 서버 호출 (부수효과, 실패해도 응답 유지)
  const normalizedPhone = normalizeReceiverPhone(phone);
  const message = [
    "[더올투어 문의접수]",
    `이름: ${name}`,
    `연락처: ${normalizedPhone}`,
    productTitle ? `상품: ${productTitle}` : null,
    sourcePath ? `유입: ${sourcePath}` : null,
    contentValue ? `문의내용: ${contentValue}` : null,
  ]
    .filter(Boolean)
    .join("\n");

  try {
    console.log("[inquiries] calling aligo relay server", {
      inquiryId,
      phone,
      normalizedPhone,
      productTitle: productTitle || null,
      sourcePath: sourcePath || null,
    });

    const { data } = await sendAligoRelay({
      receiver: normalizedPhone,
      msg: message,
      relayExtras: {
        name,
        phone,
        product_title: productTitle || null,
        source_path: sourcePath || null,
        content: contentValue || "",
      },
    });

    console.log("[inquiries] aligo relay success", {
      inquiryId,
      data,
    });
  } catch (error) {
    console.error("[inquiries] failed to call aligo relay server", {
      inquiryId,
      error,
    });
  }

  await Promise.allSettled([
    notifyInquiryCreated({ name, phone, content: contentValue }),
    createNewInquiryNotification({
      inquiryId: String(inquiryId),
      name,
      phone,
      content: contentValue,
    }),
  ]);

  return NextResponse.json({ message: "문의가 저장되었습니다." }, { status: 201 });
}
```

**정리:** insert fallback이 여러 번 시도되어도, **성공하는 insert는 하나**이고 그 뒤 **relay는 try 블록에서 1번** 호출된다. (첫 insert가 성공하면 fallback 분기 자체에 들어가지 않음.)

---

## [3] Relay 유틸: `src/lib/notifications/sendAligoRelay.ts` (전체)

**요약:** `POST http://121.78.183.144:3000/send-aligo`, body `JSON.stringify({ receiver, msg, ...relayExtras })`. **재시도 루프 없음.** 타임아웃 5초.

```ts
const RELAY_URL = "http://121.78.183.144:3000/send-aligo";
const TIMEOUT_MS = 5000;

export type AligoRelayErrorCode =
  | "EMPTY_RECEIVER"
  | "RELAY_HTTP"
  | "RELAY_TIMEOUT"
  | "RELAY_NETWORK";

export class AligoRelayError extends Error {
  readonly code: AligoRelayErrorCode;
  readonly httpStatus?: number;
  readonly data?: unknown;

  constructor(
    code: AligoRelayErrorCode,
    message: string,
    opts?: {
      httpStatus?: number;
      data?: unknown;
    },
  ) {
    super(message);
    this.name = "AligoRelayError";
    this.code = code;
    this.httpStatus = opts?.httpStatus;
    this.data = opts?.data;
  }
}

/** 수신번호에서 숫자만 남깁니다. */
export function normalizeReceiverPhone(input: string): string {
  return input.replace(/\D/g, "");
}

export type SendAligoRelayParams = {
  receiver: string;
  msg: string;
  /** 문의 접수 등 relay 측 부가 메타(선택). receiver/msg 외 필드만 병합됩니다. */
  relayExtras?: Record<string, unknown>;
};

/**
 * 가비아 VPS 알리고 relay 서버로 SMS 발송 요청.
 * @throws 수신번호가 비어 있거나 HTTP 비정상 응답 시
 */
export async function sendAligoRelay(params: SendAligoRelayParams): Promise<{ ok: true; data: unknown }> {
  const receiver = normalizeReceiverPhone(params.receiver);
  if (!receiver) {
    throw new AligoRelayError("EMPTY_RECEIVER", "수신번호가 비어 있습니다.");
  }

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), TIMEOUT_MS);

  try {
    const body: Record<string, unknown> = {
      receiver,
      msg: params.msg,
      ...(params.relayExtras ?? {}),
    };

    let response: Response;
    try {
      response = await fetch(RELAY_URL, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(body),
        signal: controller.signal,
      });
    } catch (e) {
      if (e instanceof Error && e.name === "AbortError") {
        throw new AligoRelayError("RELAY_TIMEOUT", "알리고 relay 요청 시간 초과(5초)");
      }
      if (e instanceof TypeError) {
        throw new AligoRelayError("RELAY_NETWORK", "알리고 relay 서버에 연결할 수 없습니다.");
      }
      throw e;
    }

    const data = await response.json().catch(() => null);

    if (!response.ok) {
      throw new AligoRelayError("RELAY_HTTP", `알리고 relay HTTP ${response.status}`, {
        httpStatus: response.status,
        data,
      });
    }

    return { ok: true, data };
  } finally {
    clearTimeout(timeout);
  }
}
```

---

## [4] VPS / PM2 서버 코드

**이 레포에 없음.** 확인하려면 VPS의 `send-aligo` 라우트 구현(알리고 2회 호출 여부, 큐 중복 등)을 직접 봐야 함.

---

## [5] 공식 알리고 REST (`src/lib/sms/aligo.ts`) — 전체

**요약:** `https://apis.aligo.in/send/` 직접 호출. **`sendCustomerInquirySms`는 “접수 확인” 문구**를 쓰지만, **현재 레포에서 import 되는 곳 없음** → 문의 플로우와 무관(배선만 되어 있으면 중복 원인이 될 수 있음).

```ts
/**
 * 알리고 SMS 공통 발송 (저수준).
 * - receiver는 숫자만 남기도록 정규화.
 * - 실패 시 로그 후 throw. 래퍼에서 catch하여 API 실패로 이어지지 않도록 처리.
 */
export async function sendAligoSms({
  receiver,
  msg,
}: {
  receiver: string;
  msg: string;
}): Promise<void> {
  const normalized = receiver.replace(/\D/g, "");
  if (!normalized) {
    console.error("[SMS] 수신번호 없음 (정규화 후)", { receiver });
    throw new Error("SMS receiver empty after normalize");
  }

  const key = process.env.ALIGO_API_KEY;
  const userId = process.env.ALIGO_USER_ID;
  const sender = process.env.ALIGO_SENDER;
  if (!key || !userId || !sender) {
    console.error("[SMS] 알리고 env 미설정 (ALIGO_API_KEY, ALIGO_USER_ID, ALIGO_SENDER)");
    throw new Error("SMS Aligo env not set");
  }

  const response = await fetch("https://apis.aligo.in/send/", {
    method: "POST",
    headers: {
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body: new URLSearchParams({
      key,
      user_id: userId,
      sender,
      receiver: normalized,
      msg,
    }),
  });

  if (!response.ok) {
    const text = await response.text();
    console.error("[SMS] 알리고 API 실패", { status: response.status, body: text });
    throw new Error(`Aligo API HTTP ${response.status}`);
  }

  const data = (await response.json()) as { result_code?: string; message?: string };
  if (data.result_code && String(data.result_code) !== "1") {
    console.error("[SMS] 알리고 응답 실패", {
      result_code: data.result_code,
      message: data.message,
    });
    throw new Error(`Aligo result_code ${data.result_code}`);
  }
}

/**
 * 고객용 접수 확인 SMS. 담백한 톤, 영업 표현 금지.
 */
export async function sendCustomerInquirySms({
  phone,
  productTitle,
}: {
  phone: string;
  productTitle?: string;
}): Promise<void> {
  const msg = productTitle
    ? `안녕하세요.\n[${productTitle}] 상담 요청이 접수되었습니다.\n\n남겨주신 내용을 확인한 뒤 안내드리겠습니다.`
    : `안녕하세요.\n상담 요청이 접수되었습니다.\n\n남겨주신 내용을 확인한 뒤 안내드리겠습니다.`;

  try {
    await sendAligoSms({ receiver: phone, msg });
  } catch (e) {
    console.error("[SMS:고객] 접수 확인 발송 실패", e);
  }
}

/**
 * 관리자용 새 문의 알림 SMS. 짧고 실무형, 문의 내용 전문 미포함.
 * 수신: process.env.ALIGO_ADMIN_RECEIVERS (콤마 구분)
 */
export async function sendAdminInquirySms({
  name,
  phone,
  productTitle,
  sourcePath,
}: {
  name: string;
  phone: string;
  productTitle?: string;
  sourcePath?: string;
}): Promise<void> {
  const raw = process.env.ALIGO_ADMIN_RECEIVERS?.trim();
  if (!raw) {
    return;
  }
  const receivers = raw.split(",").map((s) => s.trim()).filter(Boolean);
  if (receivers.length === 0) {
    return;
  }

  const productLine = productTitle || sourcePath || "일반 문의";
  const msg = [
    "[새 문의 접수]",
    `상품: ${productLine}`,
    `이름: ${name}`,
    `연락처: ${phone}`,
  ].join("\n");

  try {
    for (const receiver of receivers) {
      await sendAligoSms({ receiver, msg });
    }
  } catch (e) {
    console.error("[SMS:관리자] 새 문의 알림 발송 실패", e);
  }
}
```

---

## [6] `notifyInquiryCreated` — SMS 없음 (`src/lib/notifications.ts`)

```ts
export async function notifyInquiryCreated(payload: InquiryInput) {
  const settled = await Promise.allSettled([
    sendSlackNotification(payload),
    sendEmailNotification(payload),
    sendKakaoNotification(payload),
  ]);

  settled.forEach((result) => {
    if (result.status === "fulfilled") {
      if (!result.value.ok) {
        console.warn(`[notify:${result.value.channel}] ${result.value.reason}`);
      }
      return;
    }
    console.warn(`[notify:error] ${result.reason}`);
  });
}
```

---

## [7] 관리자 문자 패널: `send-message` 호출 (`MessageSendPanel.tsx` 핵심만)

**요약:** `isSending` / `inFlightRef`로 연타 방지. **문의 접수 API와 별도.**

```ts
  const handleSend = async () => {
    if (inFlightRef.current || sending) return;
    // ... 검증, duplicate guard ...
    inFlightRef.current = true;
    setSending(true);

    try {
      const res = await fetch(`/api/admin/inquiries/${encodeURIComponent(inquiry.id)}/send-message`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          message: body,
          receiver: to,
          actor_name: "관리자",
        }),
      });
      // ...
    } finally {
      setSending(false);
      inFlightRef.current = false;
    }
  };
```

---

## [8] 2건 발송 체크리스트 (요약)

1. **네트워크 탭:** `POST /api/inquiries`가 **한 번**인지 두 번인지.
2. **서버 로그:** `[inquiries] calling aligo relay server`가 **같은 inquiryId로 두 번** 찍히는지 (같은 요청에서 두 번이면 버그, 두 요청이면 프론트/프록시).
3. **VPS 로그:** 수신 **HTTP 요청 수**와 알리고 API 호출 수.
4. **`aligo.ts`:** 레포 내 미사용이나, VPS 안에서 공식 API를 **추가로** 부르는지는 레포 밖 확인.

---

## 부록: 이 문서에 길이상 통째 넣지 않은 파일 (원본 = 레포와 동일)

아래는 **문의 `POST /api/inquiries`를 1회 호출하는 클라이언트 전체**이므로, 전체 복사는 해당 경로에서 하면 됩니다.

| 경로 | 설명 |
|------|------|
| `src/components/inquiry/HeroInquiryForm.tsx` | 히어로 폼 + `handleSubmit` + `isSubmitting` |
| `src/components/inquiry/ConsultModal.tsx` | 모달 + `useEffect(trackConsultOpen)` + `handleSubmit` + `isSubmitting` |
| `src/components/header/HeaderQuickConsultCtas.tsx` | 헤더 빠른 상담 + `handleSubmit` |
| `src/components/inquiry/HeroQuickConsultButton.tsx` | 히어로 빠른 상담 버튼 + `handleSubmit` |

관리자 **`MessageSendPanel.tsx` 전체**는 `handleSend`, `inFlightRef`, `sending`, `refetchLogs` 등이 포함되어 있음 — 2건 원인이 관리자 발송이면 이 파일과 `send-message/route.ts`를 함께 보면 됨.

---

*문서 생성 시점: 레포 소스 기준.*
