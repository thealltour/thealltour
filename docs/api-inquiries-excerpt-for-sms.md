# /api/inquiries 라우트 발췌 — 알리고 SMS 연동용

알리고 SMS 자동응답 연동을 위해 `/api/inquiries` 라우트의 실행 환경, POST 처리 흐름, 문자 발송 로직 삽입 위치를 정리한 문서입니다.

---

## 1. 파일 경로 및 런타임

| 항목 | 값 |
|------|-----|
| **파일 경로** | `src/app/api/inquiries/route.ts` |
| **라우터** | Next.js App Router |
| **runtime** | **명시 없음** → Next.js 기본값 **Node.js** (Edge 아님) |
| **export const runtime** | 없음 (다른 API는 `src/app/api/analytics/events/route.ts` 등에서 `export const runtime = "nodejs"` 사용) |

- Vercel/Next.js App Router 기준: `src/app/api/inquiries/route.ts`가 그대로 `/api/inquiries`에 매핑됩니다.
- Edge가 아니므로 **Node.js 환경에서 실행**되며, 알리고 등 외부 HTTP API 연동에 제약이 없습니다.

---

## 2. POST handler 전체 코드 (복사 가능)

```typescript
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

  await notifyInquiryCreated({ name, phone, content: contentValue });
  await createNewInquiryNotification({
    inquiryId: String(inquiryId),
    name,
    phone,
    content: contentValue,
  });

  return NextResponse.json({ message: "문의가 저장되었습니다." }, { status: 201 });
}
```

---

## 3. 문의 저장 로직 (DB insert / 성공·실패 분기)

- **저장소**: Supabase `inquiries` 테이블.
- **1차**: `insertPayload`(name, phone, content, product_id, product_title, source_path, quote_snapshot, customer_profile_id)로 `insert` 후 `select("id").maybeSingle()`.
- **실패 시 분기**  
  - `code === "42703"` 이고 `quoteSnapshot` 있으면 → `quote_snapshot` 제거한 payload로 **2차 insert**.  
  - 그래도 `inquiryId` 없으면 → `customer_profile_id` 제거한 payload로 **3차 insert**.  
  - 그래도 없으면 → **최소 필드**(name, phone, content)만으로 **4차 insert**.
- **최종 실패**: 4차까지 실패 시에만 `NextResponse.json({ message: "문의 저장에 실패했습니다." }, { status: 500 })` 반환.
- **성공**: 위 단계 중 어느 하나라도 성공하면 `inquiryId`가 설정되고, 이후 알림/응답 처리로 진행.

---

## 4. 현재 응답 처리 흐름

| 상황 | 반환 |
|------|------|
| 이름/연락처 없음 | `400` + `{ message: "이름과 연락처를 입력해 주세요." }` |
| DB 저장 최종 실패 | `500` + `{ message: "문의 저장에 실패했습니다." }` |
| 저장 성공 후 알림까지 완료 | `201` + `{ message: "문의가 저장되었습니다." }` |

- 성공 시 추가 데이터 없이 **메시지만** 반환합니다.

---

## 5. 이미 사용 중인 외부 API 호출

- **파일**: `src/lib/notifications.ts` — `notifyInquiryCreated()` 내부.
- **패턴**: `fetch()` 사용.
  - Slack: `process.env.SLACK_WEBHOOK_URL` → `fetch(webhookUrl, { method: "POST", ... })`
  - Resend 이메일: `fetch("https://api.resend.com/emails", { method: "POST", headers: { Authorization: Bearer ... }, ... })`
  - 카카오: `process.env.KAKAO_WEBHOOK_URL` → `fetch(webhookUrl, { method: "POST", ... })`
- **호출 시점**: POST handler에서 **DB 저장이 성공한 뒤**, `await notifyInquiryCreated(...)` 로 한 번에 호출됩니다.
- **결론**: 이 API 경로에서 **외부 HTTP 요청(fetch)은 이미 사용 중**이므로, 같은 방식으로 알리고 SMS용 `fetch()`를 추가해도 됩니다.

---

## 6. 환경변수 사용 위치

- **`src/app/api/inquiries/route.ts`**: `process.env` 직접 사용 없음.
- **연동된 모듈**  
  - `@/lib/notifications.ts`: `SLACK_WEBHOOK_URL`, `RESEND_API_KEY`, `NOTIFY_EMAIL_FROM`, `NOTIFY_EMAIL_TO`, `KAKAO_WEBHOOK_URL`
  - Supabase: `@/lib/supabase` (보통 `NEXT_PUBLIC_SUPABASE_*` 또는 서버용 env)
- **알리고 연동 시 권장**: `.env.local` 등에 `ALIGO_*` (예: API key, sender 등) 추가 후, SMS 전송 함수나 route 내부에서 `process.env.ALIGO_*` 로 읽기.

---

## 7. 에러 처리 방식

- **POST handler**: 전역 `try/catch` 없음.  
  - 검증 실패 → 즉시 `400` 반환.  
  - DB 실패 → 2·3·4차 fallback 후, 최종 실패 시에만 `500` 반환.  
  - 알림(`notifyInquiryCreated`, `createNewInquiryNotification`) 실패 시에는 로그만 하고, **응답은 이미 저장 성공 기준으로 201**을 유지합니다.
- **`notifyInquiryCreated`**: 내부에서 `Promise.allSettled`로 Slack/Email/Kakao 병렬 전송, 실패 시 `console.warn`만 하고 예외를 밖으로 던지지 않음.

---

## 8. 주요 처리 흐름 (단계별)

1. `request.json()`으로 body 파싱.
2. `name`, `phone` 필수 검사 → 없으면 400.
3. 옵션/견적 payload 있으면 `quote_snapshot` 객체 생성.
4. `insertPayload` 구성 (name, phone, content, product_*, source_path, quote_snapshot 등).
5. `findOrCreateCustomerProfile({ name, phone, source: "inquiry" })` 호출 → 있으면 `customer_profile_id` 추가.
6. Supabase `inquiries` insert (1차 → 실패 시 2·3·4차 fallback).
7. **저장 최종 실패 시** 500 반환 후 종료.
8. **저장 성공 시**  
   - `await notifyInquiryCreated({ name, phone, content })` (Slack/Email/Kakao fetch).
   - `await createNewInquiryNotification({ inquiryId, name, phone, content })` (관리자 알림 DB).
9. `NextResponse.json({ message: "문의가 저장되었습니다." }, { status: 201 })` 반환.

---

## 추가 확인 요청에 대한 답변

### 1. 이 API에서 외부 HTTP 요청(fetch) 실행이 가능한가?

- **가능합니다.**  
  같은 POST handler에서 이미 `notifyInquiryCreated()`를 통해 Slack, Resend, Kakao 등 외부 URL로 `fetch`를 사용하고 있습니다.  
  알리고 SMS도 동일하게 `fetch("https://...", { method: "POST", ... })` 형태로 추가하면 됩니다.

### 2. Node.js runtime인가? (알리고 연동 가능 여부)

- **네, Node.js입니다.**  
  `route.ts`에 `export const runtime = "edge"`가 없고, 프로젝트 다른 API에서만 `runtime = "nodejs"`를 일부 명시하고 있어, 기본값인 **Node.js**에서 실행됩니다.  
  따라서 알리고 REST API 연동에 문제 없습니다.

### 3. 문자 발송 로직을 넣기 가장 적절한 위치

- **권장 위치**: **DB 저장이 성공한 직후**, `notifyInquiryCreated()` 호출 **바로 다음** (또는 동일 블록 내에서 그와 함께).  
  - 구체적으로는 `inquiryId`를 확정한 뒤,  
    `await notifyInquiryCreated(...);`  
    `await createNewInquiryNotification(...);`  
    사이 또는 **`notifyInquiryCreated` 호출 직후**에  
    `await sendAligoSms({ phone, name, ... });` 같은 함수를 두는 방식이 적절합니다.
- **이유**  
  - 문의가 실제로 DB에 남은 뒤에만 문자를 보내야 하므로, insert fallback이 모두 끝나고 `inquiryId`가 있는 시점 이후가 맞습니다.  
  - 기존 알림(Slack/이메일/카카오)과 동일하게 “저장 성공 후 알림” 패턴을 유지할 수 있습니다.  
  - SMS 실패가 있어도 문의 저장 자체는 성공으로 두고, 로그만 남기려면 `notifyInquiryCreated`처럼 `Promise.allSettled` 또는 try/catch로 감싸서 201 응답은 유지하면 됩니다.

---

## 요약

- **파일**: `src/app/api/inquiries/route.ts`  
- **런타임**: Node.js (기본값)  
- **저장**: Supabase `inquiries` insert, 1~4차 fallback 후 실패 시에만 500.  
- **응답**: 성공 시 201 + `{ message: "문의가 저장되었습니다." }`.  
- **외부 호출**: 이미 `notifyInquiryCreated()`에서 fetch 사용 중 → 알리고 SMS용 fetch 추가 가능.  
- **문자 발송 삽입 위치**: DB 저장 성공 직후, `notifyInquiryCreated()` 호출 직후(또는 그와 나란히)가 가장 적절합니다.
