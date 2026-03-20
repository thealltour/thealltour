# 문의 POST 저장 흐름 발췌 (전체 복사용)

목적: 문의 저장 후 알리고 호출이 실제 실행 경로에 있는지, return 이전에 fetch가 있는지, 로그 구현 여부, route 경로 사용 여부 확인.

---

## 1. src/app/api/inquiries/route.ts — import 구문 전체

```ts
import { NextResponse } from "next/server";
import { supabase } from "@/lib/supabase";
import { findOrCreateCustomerProfile } from "@/lib/customerProfiles";
import { notifyInquiryCreated } from "@/lib/notifications";
import { createNewInquiryNotification } from "@/lib/adminNotifications";
import { inferAttribution } from "@/lib/analytics/attribution";
import type { Inquiry, InquiryInput } from "@/types/inquiry";
```

---

## 2. src/app/api/inquiries/route.ts — POST 핸들러 전체

(문의 데이터 validation, 저장 실행, 저장 성공 후 알리고 중계 fetch, try/catch, 응답 반환까지 포함)

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
  if (process.env.NODE_ENV === "production") {
    try {
      await fetch("http://121.78.183.144:3000/send-aligo", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name,
          phone,
          content: contentValue,
          product_title: productTitle || null,
          source_path: sourcePath || null,
          first_touch: firstTouch ?? null,
          inquiry_page_url: inquiryPageUrl || null,
          acquisition_channel: attribution.acquisition_channel,
          acquisition_source_label: attribution.acquisition_source_label,
          acquisition_medium: attribution.acquisition_medium,
          acquisition_summary: attribution.acquisition_summary,
          first_landing_path: attribution.first_landing_path,
        }),
      });
    } catch (error) {
      console.error("[inquiries] failed to call aligo relay server", error);
    }
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

---

## 3. 확인 포인트 정리

| 항목 | 위치 | 내용 |
|------|------|------|
| 알리고 호출이 실제 실행 경로에 있는지 | `inquiryId` 확정 직후, `return` 직전 | `if (process.env.NODE_ENV === "production")` 안에서만 실행. 문의 저장이 한 번이라도 성공한 뒤에만 도달. |
| return 이전에 fetch가 있는지 | 위 블록 다음에 `Promise.allSettled`, 그 다음 한 줄 | `return NextResponse.json(..., 201)` 바로 앞에 알리고 fetch 블록과 `Promise.allSettled`가 있음. |
| 로그가 남도록 구현됐는지 | 알리고 fetch의 catch 블록 | `console.error("[inquiries] failed to call aligo relay server", error);` 로 실패 시 로그 출력. |
| route 파일이 사용 중인지 | App Router 규칙 | `src/app/api/inquiries/route.ts` → `POST /api/inquiries` 로 사용됨. |

---

## 4. 프론트에서 문의 생성 호출 위치 및 응답 처리

아래 컴포넌트들이 `POST /api/inquiries` 를 호출하며, 성공 시 `response.ok === true`(보통 201)와 `{ message: "문의가 저장되었습니다." }` 를 전제로 동작합니다.

---

### 4.1. src/components/InquiryForm.tsx

- **위치**: `handleSubmit` 내부 (약 83~106행)
- **호출**: `fetch("/api/inquiries", { method: "POST", ... })`
- **성공 시 기대**: `response.ok === true`, `result.message` 사용 가능. 성공 시 "문의가 접수되었습니다. 확인 후 순차적으로 연락드리겠습니다." 표시.

```ts
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
  // ... GA4 generate_lead ...
  setIsSuccess(true);
  setMessage("문의가 접수되었습니다. 확인 후 순차적으로 연락드리겠습니다.");
  // ...
} catch {
  setIsSuccess(false);
  setMessage("네트워크 오류가 발생했습니다. 잠시 후 다시 시도해 주세요.");
}
```

---

### 4.2. src/components/ConsultModal.tsx

- **위치**: 문의 제출 핸들러 (약 159~167행)
- **호출**: `fetch("/api/inquiries", { method: "POST", ... })`
- **성공 시 기대**: `response.ok === true` 이면 성공 토스트, 실패 시 `!response.ok` 에서 토스트.

```ts
const response = await fetch("/api/inquiries", {
  method: "POST",
  headers: { "Content-Type": "application/json" },
  body: JSON.stringify(body),
});

if (!response.ok) {
  showToast("error", "문의 저장 중 오류가 발생했습니다. 잠시 후 다시 시도해 주세요.");
  return;
}
// ... 성공 시 trackConsultSubmit, GA4, setForm, setIsSuccess(true) ...
```

---

### 4.3. src/components/HeroInquiryForm.tsx

- **위치**: `handleSubmit` (약 37~54행)
- **호출**: `fetch("/api/inquiries", { method: "POST", ... })`
- **성공 시 기대**: `response.ok === true` 이면 "문의가 접수되었습니다. 확인 후 순차적으로 연락드리겠습니다." 표시.

```ts
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
// ... GA4, setIsSuccess(true), setMessage("문의가 접수되었습니다. ...") ...
```

---

### 4.4. src/components/HeaderQuickConsultCtas.tsx

- **위치**: 제출 핸들러 (약 89~102행)
- **호출**: `fetch("/api/inquiries", { method: "POST", ... })`
- **성공 시 기대**: `response.ok === true` 이면 "빠른 상담 요청이 접수되었습니다. ..." 토스트.

```ts
const response = await fetch("/api/inquiries", {
  method: "POST",
  headers: { "Content-Type": "application/json" },
  body: JSON.stringify({
    ...form,
    source_path: `${pathname || "/"}#header-quick-consult`,
  }),
});

if (!response.ok) {
  showToast("error", "문의 저장 중 오류가 발생했습니다. 잠시 후 다시 시도해 주세요.");
  return;
}
setForm(initialFormState);
setIsOpen(false);
showToast("success", "빠른 상담 요청이 접수되었습니다. 확인 후 순차적으로 연락드리겠습니다.");
```

---

### 4.5. src/components/HeroQuickConsultButton.tsx

- **위치**: 제출 핸들러 (약 48~61행)
- **호출**: `fetch("/api/inquiries", { method: "POST", ... })`
- **성공 시 기대**: `response.ok === true` 이면 "빠른 상담 요청이 접수되었습니다. ..." 토스트.

```ts
const response = await fetch("/api/inquiries", {
  method: "POST",
  headers: { "Content-Type": "application/json" },
  body: JSON.stringify({
    ...form,
    source_path: `${pathname || "/"}#hero-quick-consult`,
  }),
});

if (!response.ok) {
  showToast("error", "문의 저장 중 오류가 발생했습니다. 잠시 후 다시 시도해 주세요.");
  return;
}
setForm(initialFormState);
setIsOpen(false);
showToast("success", "빠른 상담 요청이 접수되었습니다. 확인 후 순차적으로 연락드리겠습니다.");
```

---

## 5. 문의 저장 성공 시 API가 반환하는 응답

- **상태 코드**: `201`
- **본문**: `{ message: "문의가 저장되었습니다." }`

```ts
return NextResponse.json({ message: "문의가 저장되었습니다." }, { status: 201 });
```

프론트는 모두 `response.ok`(즉 2xx)로 성공 여부를 판단하며, 일부는 `response.json()` 후 `result.message`를 에러 메시지로 사용합니다. 알리고 중계 실패 시에도 이 201 응답은 그대로 반환됩니다.
