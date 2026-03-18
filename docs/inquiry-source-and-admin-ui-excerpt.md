# 문의 최초유입경로 추적 + 관리자 문의 목록 UI 노출 — 수정 지점 발췌

실제 존재하는 파일만 기준으로, 전체 복사 가능한 발췌 형태로 정리했습니다.

---

## A. 문의 생성/저장 플로우

---

### 1. 문의 폼 컴포넌트 (상품 상세/헤더 퀵상담)

**1. 파일 경로**  
`src/components/ConsultModal.tsx`

**2. 파일 역할**  
글로벌 상담 요청 모달. 상품 상세/헤더 등에서 열며, 이름·연락처·문의 내용 입력 후 `/api/inquiries` POST 호출.

**3. 관련 함수/컴포넌트**  
`ConsultModalProvider`, `useConsultModal`, `handleSubmit`, `validateForm`, `trackConsultOpen`, `trackConsultSubmit`

**4. 왜 수정 대상인지**  
문의 최초 유입 경로 저장 시, submit 시점에 **유입 경로(예: referrer, UTM, 첫 방문 path)** 를 body에 포함하려면 여기서 `body` 구성 부분을 수정해야 함. 현재는 `product_id`, `product_title`, `source_path`(모달 열 때 받은 params)만 전달.

**5. 전체 복사 가능한 코드 발췌**

```tsx
// 발췌: body 구성 및 fetch 호출 부분 (라인 124~178 근처)
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
  // ... 이하 생략
```

**6. 1순위 수정 대상 여부**  
예. 유입 경로를 “클라이언트에서 수집해 서버로 넘기는” 진입점이므로 1순위.

---

### 2. 문의 폼 컴포넌트 (견적/quote 페이지)

**1. 파일 경로**  
`src/components/InquiryForm.tsx`

**2. 파일 역할**  
quote 페이지 등에서 쓰는 문의 폼. 출발희망일·인원·문의내용을 조합해 content로 보내고, `source`(product_id, product_title, source_path)를 전달.

**3. 관련 함수/컴포넌트**  
`InquiryForm`, `handleSubmit`, `buildContent`, `validate`

**4. 왜 수정 대상인지**  
유입 경로를 문의와 함께 저장할 때, **quote 페이지에서의 첫 유입**을 구분해 넘기려면 여기서도 body에 유입 경로 필드 추가 필요.

**5. 전체 복사 가능한 코드 발췌**

```tsx
// 발췌: POST body 구성 (라인 79~92)
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
  }),
});
```

**6. 1순위 수정 대상 여부**  
예. ConsultModal과 동일하게 “문의 생성 시 유입 경로 전달” 1순위.

---

### 3. 히어로 문의 폼 (product_id/product_title/source_path 미전달)

**1. 파일 경로**  
`src/components/HeroInquiryForm.tsx`

**2. 파일 역할**  
랜딩/히어로 섹션용 간단 문의 폼. 이름·연락처·상담희망내용만 전송.

**3. 관련 함수/컴포넌트**  
`HeroInquiryForm`, `handleSubmit`

**4. 왜 수정 대상인지**  
유입 경로 저장 시, **어느 페이지(히어로)에서 왔는지**를 넣으려면 body에 `source_path` 또는 새 유입 경로 필드 추가 필요. 현재는 `...form` 만 보냄.

**5. 전체 복사 가능한 코드 발췌**

```tsx
// 발췌: POST body (라인 35~42)
const response = await fetch("/api/inquiries", {
  method: "POST",
  headers: { "Content-Type": "application/json" },
  body: JSON.stringify({
    ...form,
  }),
});
```

**6. 1순위 수정 대상 여부**  
예. 문의 생성 플로우 중 하나이므로 1순위.

---

### 4. 문의 생성 API (POST)

**1. 파일 경로**  
`src/app/api/inquiries/route.ts`

**2. 파일 역할**  
문의 목록 GET, 일괄 PATCH, 문의 생성 POST 제공. POST에서 body 파싱 → customer profile 연결 → Supabase `inquiries` insert(폴백 포함) → 알림(Slack/이메일/카카오/SMS) → 201 반환.

**3. 관련 함수/컴포넌트**  
`POST`, `normalizeInquiryRow`, `findOrCreateCustomerProfile`, Supabase insert 다단계 폴백

**4. 왜 수정 대상인지**  
최초 유입 경로를 **DB에 저장**하려면 `InquiryInput`/타입과 insert payload에 유입 경로 컬럼(예: `referrer`, `utm_source`, `first_landing_path` 등)을 추가하고, body에서 읽어서 넣어야 함.

**5. 전체 복사 가능한 코드 발췌**

```ts
// 발췌: POST 상단 body 파싱 및 insertPayload 구성 (라인 291~354)
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

  // ... quoteSnapshot 구성 생략 ...

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

  // 1차: 전체 payload로 insert
  const insertResultWithProduct = await supabase
    .from("inquiries")
    .insert(insertPayload)
    .select("id")
    .maybeSingle();
  // ... 이하 폴백 및 알림 ...
}
```

**6. 1순위 수정 대상 여부**  
예. 유입 경로 컬럼을 채우는 서버 측 진입점이므로 1순위.

---

### 5. 문의 타입 정의

**1. 파일 경로**  
`src/types/inquiry.ts`

**2. 파일 역할**  
문의 도메인 타입: `Inquiry`, `InquiryInput`, `QuoteSnapshot`, `ConsultationStatus`, `BookingStatus`.

**3. 관련 타입**  
`Inquiry`, `InquiryInput`, `QuoteSnapshot`

**4. 왜 수정 대상인지**  
최초 유입 경로 필드를 타입에 반영해야 함. 예: `Inquiry`에 `referrer`/`utm_source`/`first_landing_path` 등, `InquiryInput`에 동일 필드 추가.

**5. 전체 복사 가능한 코드 발췌**

```ts
// 파일 전체
/** 상담 진행 상태 */
export type ConsultationStatus = "new" | "contacted" | "closed";

/** 예약/여행 상태 */
export type BookingStatus = "none" | "reserved" | "completed" | "canceled";

export type Inquiry = {
  id: string;
  name: string;
  phone: string;
  content: string;
  product_id?: string;
  product_title?: string;
  source_path?: string;
  /** @deprecated 하위호환용. consultation_status / booking_status 사용 */
  is_completed?: boolean;
  customer_profile_id?: string | null;
  consultation_status?: ConsultationStatus;
  booking_status?: BookingStatus;
  completed_at?: string | null;
  created_at?: string;
  quote_snapshot?: QuoteSnapshot | null;
};

/** 문의 시 함께 저장한 옵션/견적 스냅샷 (관리자 표시용, 서버 재계산용) */
export type QuoteSnapshot = {
  selectedOptions?: Record<string, string>;
  quoteSummary?: {
    total: number | null;
    basePrice: number | null;
    breakdown: Array<{ groupLabel: string; optionLabel: string; priceDelta: number }>;
  };
  inquiredAt?: string;
};

export type InquiryInput = {
  name: string;
  phone: string;
  content: string;
  product_id?: string;
  product_title?: string;
  source_path?: string;
  selected_options?: Record<string, string>;
  quote_summary?: { ... };
  inquired_at?: string;
};
```

**6. 1순위 수정 대상 여부**  
예. 타입/스키마 변경 시 가장 먼저 맞춰야 하므로 1순위.

---

### 6. 문의 validation 스키마 (zod 등)

**검색 결과**  
문의 전용 zod(또는 다른) 스키마 파일은 없음.  
- `ConsultModal.tsx`: `validateForm(form)` (이름/연락처/내용 필수).  
- `InquiryForm.tsx`: `validate(form)` (이름/연락처 필수).  
- API route: body를 `Partial<InquiryInput>`으로만 받고, name/phone 존재 여부만 검사.

**수정 시 고려**  
유입 경로 필드를 추가할 때, 필요하면 공통 스키마를 새로 두거나 기존 validate 함수에 선택 검증 추가.

---

## B. 관리자 문의 목록 / 상세 UI

---

### 7. 관리자 문의 페이지

**1. 파일 경로**  
`src/app/admin/inquiries/page.tsx`

**2. 파일 역할**  
관리자 문의 관리 페이지. 카운트·알림 개수 조회 후 `AdminInquiryTable` 렌더.

**3. 관련 함수/컴포넌트**  
`AdminInquiriesPage` (서버 컴포넌트), `AdminHeader`, `AdminInquiryTable`, `getAdminCounts`, `prepareAdminNotificationsAndGetUnreadCount`

**4. 왜 수정 대상인지**  
문의 목록 UI에 “최초 유입 경로” 컬럼/뱃지를 넣을 경우, 이 페이지 자체는 그대로 두고 테이블/훅에서만 수정해도 됨. 레이아웃/헤더 변경이 필요하면 여기 수정.

**5. 전체 복사 가능한 코드 발췌**

```tsx
// 파일 전체
import AdminHeader from "@/components/admin/AdminHeader";
import AdminInquiryTable from "@/components/admin/AdminInquiryTable";
import { prepareAdminNotificationsAndGetUnreadCount } from "@/lib/adminNotifications";
import { getAdminCounts } from "@/lib/adminCounts";

export default async function AdminInquiriesPage() {
  const [{ inquiryCount, productCount, memberCount, reviewCount }, unreadNotificationCount] =
    await Promise.all([getAdminCounts(), prepareAdminNotificationsAndGetUnreadCount()]);

  return (
    <div className="min-h-screen bg-[var(--bg)] px-6 py-10 text-[var(--text-primary)] md:px-10">
      <main className="w-full space-y-6">
        <AdminHeader
          activeTab="inquiries"
          title="문의 관리"
          description="접수된 문의를 검색하고 상담 완료 상태를 업데이트할 수 있습니다."
          inquiryCount={inquiryCount}
          productCount={productCount}
          memberCount={memberCount}
          reviewCount={reviewCount}
          unreadNotificationCount={unreadNotificationCount}
        />

        <section className="overflow-hidden rounded-2xl bg-[var(--surface)] shadow-[var(--shadow-soft)] ring-1 ring-[var(--border)]">
          <AdminInquiryTable />
        </section>
      </main>
    </div>
  );
}
```

**6. 1순위 수정 대상 여부**  
아니오. 테이블/데이터 수정이 우선.

---

### 8. 관리자 문의 테이블 (목록 + row + 액션)

**1. 파일 경로**  
`src/components/admin/AdminInquiryTable.tsx`

**2. 파일 역할**  
문의 목록 테이블: 검색/상태필터/정렬/페이징, 상담상태·여행상태 뱃지, 유입 상품·문의내용·문의일시·선택구성·액션(상담중/상담종료/예약확정/여행완료), 예약 확정 모달.

**3. 관련 함수/컴포넌트**  
`AdminInquiryTable`, `QuoteSnapshotSection`, `CONSULTATION_LABELS`, `BOOKING_LABELS`, `useAdminInquiryTable`

**4. 왜 수정 대상인지**  
“최초 유입 경로”를 목록에 노출하려면 테이블 헤더에 컬럼 추가하고, 각 row에서 `inquiry.referrer` / `inquiry.first_landing_path` 등 새 필드를 표시(뱃지/텍스트)해야 함.

**5. 전체 복사 가능한 코드 발췌 (테이블 헤더·바디 일부)**

```tsx
// thead (라인 213~224)
<thead className="sticky top-0 z-10 bg-[var(--primary-soft)] text-[var(--primary)]">
  <tr>
    <th className="w-[100px] px-4 py-3 text-left font-semibold">상담 상태</th>
    <th className="w-[100px] px-4 py-3 text-left font-semibold">여행 상태</th>
    <th className="w-[120px] px-4 py-3 text-left font-semibold">고객명</th>
    <th className="w-[150px] px-4 py-3 text-left font-semibold">연락처</th>
    <th className="w-[220px] px-4 py-3 text-left font-semibold">유입 상품</th>
    <th className="min-w-[320px] px-4 py-3 text-left font-semibold">문의 내용</th>
    <th className="w-[180px] px-4 py-3 text-left font-semibold">문의일시</th>
    <th className="w-[100px] px-4 py-3 text-left font-semibold">선택 구성</th>
    <th className="w-[200px] px-4 py-3 text-left font-semibold">액션</th>
  </tr>
</thead>

// tbody 내 row — 유입 상품 셀 (라인 276~287)
<td className="px-4 py-3">
  {inquiry.product_title ? (
    <div className="space-y-1">
      <p className="font-medium text-[var(--text-secondary)]">{inquiry.product_title}</p>
      {inquiry.source_path ? (
        <p className="text-xs text-[var(--text-subtle)]">{inquiry.source_path}</p>
      ) : null}
    </div>
  ) : (
    <span className="text-xs text-[var(--text-subtle)]">일반 문의</span>
  )}
</td>
```

**6. 1순위 수정 대상 여부**  
예. 관리자 문의 목록 UI에서 “유입 경로 노출”을 구현하는 핵심 컴포넌트이므로 1순위.

---

### 9. 관리자 문의 테이블 훅 (목록 fetch / 상태 변경)

**1. 파일 경로**  
`src/components/admin/hooks/useAdminInquiryTable.ts`

**2. 파일 역할**  
`/api/inquiries` GET으로 목록·집계 로드, PATCH로 상담상태/예약/여행완료 처리. 페이지/필터/정렬/페이징/모달 상태 관리.

**3. 관련 함수/컴포넌트**  
`useAdminInquiryTable`, `loadInquiries`, `updateConsultationStatus`, `openReserveModal`, `submitReserveBooking`, `completeTrip`

**4. 왜 수정 대상인지**  
API가 유입 경로 필드를 내려주면 `Inquiry` 타입만 맞추면 됨. API 응답 구조가 바뀌지 않으면 수정 최소. 타입 확장 시 여기서 쓰는 `Inquiry`가 새 필드를 포함하도록 하면 됨.

**5. 전체 복사 가능한 코드 발췌 (fetch 및 데이터 설정)**

```ts
// 목록 fetch (라인 53~99)
const loadInquiries = useCallback(async (options?: { silent?: boolean; resetSelection?: boolean }) => {
  // ...
  const response = await fetch(`/api/inquiries?${params.toString()}`, { cache: "no-store" });
  // ...
  const data = (await response.json()) as Inquiry[] | InquiryListResponse;
  if (Array.isArray(data)) {
    setInquiries(data);
    setTotal(data.length);
  } else {
    setInquiries(data.items ?? []);
    setTotal(data.total ?? 0);
    setPendingCount(data.pendingCount ?? 0);
    setCompletedCount(data.completedCount ?? 0);
    setReservedCount(data.reservedCount ?? 0);
  }
  // ...
}, [page, pageSize, statusFilter, sortBy, debouncedSearch]);
```

**6. 1순위 수정 대상 여부**  
아니오. 타입만 맞추면 되고, API가 새 필드를 이미 내려주는 경우 수정 최소.

---

### 10. theall_manager_only 문의 페이지

**1. 파일 경로**  
`src/app/theall_manager_only/inquiries/page.tsx`

**2. 파일 역할**  
`@/app/admin/inquiries/page`를 그대로 re-export. 별도 구현 없음.

**3. 관련 함수/컴포넌트**  
없음 (re-export만)

**4. 왜 수정 대상인지**  
일반적으로 없음. admin과 동일한 UI를 쓰므로 admin 측만 수정하면 됨.

**5. 전체 복사 가능한 코드 발췌**

```ts
export { default } from "@/app/admin/inquiries/page";
```

**6. 1순위 수정 대상 여부**  
아니오.

---

## C. 타입 / 모델 / DB 스키마

---

### 11. Inquiry 타입 정의 (재확인)

위 **5. 문의 타입 정의** (`src/types/inquiry.ts`)와 동일.  
DB에 유입 경로 컬럼을 추가하면 `Inquiry`와 `InquiryInput`에 해당 필드를 반영해야 함.

---

### 12. DB 스키마·마이그레이션 (inquiries)

**1. 파일 경로**  
- `supabase/schema/baseline.sql` (inquiries 테이블 생성)
- `supabase/inquiries_product_source_upgrade.sql` (product_id, product_title, source_path 추가)
- `supabase/inquiries_completion_upgrade.sql` (is_completed 등)
- `supabase/migrations/20260305100000_customer_profiles_and_eligibility.sql` (customer_profile_id, consultation_status, booking_status, completed_at 등)

**2. 파일 역할**  
inquiries 테이블 정의 및 확장. 현재 컬럼: id, name, phone, content, is_completed, customer_profile_id, consultation_status, booking_status, completed_at, created_at, product_id, product_title, source_path, quote_snapshot(추가 스크립트로 있을 수 있음).

**3. 관련 스키마**  
`public.inquiries` 테이블, RLS 정책

**4. 왜 수정 대상인지**  
최초 유입 경로를 저장하려면 **새 마이그레이션**에서 inquiries에 컬럼 추가(예: `referrer text`, `utm_source text`, `first_landing_path text` 등). 기존 baseline/upgrade는 참고용.

**5. 전체 복사 가능한 코드 발췌**

```sql
-- supabase/schema/baseline.sql (inquiries 부분, 라인 109~121)
create table if not exists public.inquiries (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  phone text not null,
  content text not null,
  is_completed boolean not null default false,
  customer_profile_id uuid,
  consultation_status text not null default 'new' check (consultation_status in ('new', 'contacted', 'closed')),
  booking_status text not null default 'none' check (booking_status in ('none', 'reserved', 'completed', 'canceled')),
  completed_at timestamptz,
  created_at timestamptz not null default now()
);

-- supabase/inquiries_product_source_upgrade.sql (전체)
alter table public.inquiries add column if not exists product_id text;
alter table public.inquiries add column if not exists product_title text;
alter table public.inquiries add column if not exists source_path text;
create index if not exists idx_inquiries_product_id on public.inquiries(product_id);
create index if not exists idx_inquiries_product_title on public.inquiries(product_title);
```

**6. 1순위 수정 대상 여부**  
예. 유입 경로를 “저장”하려면 DB 스키마/마이그레이션이 선행되어야 하므로 1순위.

---

### 13. 문의 목록 조회 API (GET)

**1. 파일 경로**  
`src/app/api/inquiries/route.ts`

**2. 파일 역할**  
GET: search, status, sort, page, pageSize로 목록 조회 및 집계. `normalizeInquiryRow`로 각 row를 클라이언트 타입에 맞게 변환.

**3. 관련 함수**  
`GET`, `normalizeInquiryRow`, `getInquirySummarySafe`

**4. 왜 수정 대상인지**  
inquiries 테이블에 유입 경로 컬럼을 추가한 뒤, 목록/상세 응답에 포함하려면 `normalizeInquiryRow`에서 해당 필드를 넣고, select에 컬럼이 포함되면 됨(현재 `select("*")` 사용).

**5. 전체 복사 가능한 코드 발췌**

```ts
// normalizeInquiryRow 반환 객체 (라인 33~48)
return {
  id: String(row.id ?? ""),
  name: String(row.name ?? ""),
  phone: String(row.phone ?? ""),
  content: String(row.content ?? ""),
  product_id: typeof row.product_id === "string" ? row.product_id : undefined,
  product_title: typeof row.product_title === "string" ? row.product_title : undefined,
  source_path: typeof row.source_path === "string" ? row.source_path : undefined,
  is_completed: typeof row.is_completed === "boolean" ? row.is_completed : undefined,
  customer_profile_id: typeof row.customer_profile_id === "string" ? row.customer_profile_id : undefined,
  consultation_status: typeof row.consultation_status === "string" ? row.consultation_status : undefined,
  booking_status: typeof row.booking_status === "string" ? row.booking_status : undefined,
  completed_at: typeof row.completed_at === "string" ? row.completed_at : undefined,
  created_at: typeof row.created_at === "string" ? row.created_at : undefined,
  quote_snapshot: quote_snapshot ?? undefined,
};
```

**6. 1순위 수정 대상 여부**  
예. DB에 컬럼 추가 후 목록 API에서 노출하려면 여기서 정규화하는 것이 1순위.

---

## D. 앱 전역 클라이언트 초기화 지점

---

### 14. 루트 레이아웃

**1. 파일 경로**  
`src/app/layout.tsx`

**2. 파일 역할**  
전역 레이아웃: metadata, viewport, body에 `WebVitalsReporter`, `ConsultModalProvider`, 푸터, 카카오 플로팅 버튼.

**3. 관련 컴포넌트**  
`RootLayout`, `ConsultModalProvider`, `WebVitalsReporter`, `KakaoFloatingButton`, `GlobalSiteFooter`

**4. 왜 수정 대상인지**  
유입 경로를 “첫 방문 시 한 번만” 수집해 두고 문의 시 사용하려면, 레이아웃 또는 공통 클라이언트 컴포넌트에서 referrer/UTM을 읽어 저장하는 로직을 둘 수 있음. 현재는 UTM/GA 전용 초기화가 이 파일에 없음.

**5. 전체 복사 가능한 코드 발췌**

```tsx
// 파일 전체 (요약)
export default function RootLayout({ children }: { ... }) {
  return (
    <html lang="ko">
      <head>...</head>
      <body ...>
        <WebVitalsReporter />
        <ConsultModalProvider>
          <div className="flex-1">{children}</div>
          <KakaoFloatingButton />
          <GlobalSiteFooter />
        </ConsultModalProvider>
      </body>
    </html>
  );
}
```

**6. 1순위 수정 대상 여부**  
선택. 유입 경로를 “앱 진입 시” 수집하는 방식을 쓰면 수정 대상. 문의 폼/모달에서만 document.referrer 등으로 수집하면 레이아웃 수정 없이 가능.

---

### 15. 상담 모달 계측 (트래킹)

**1. 파일 경로**  
`src/lib/analytics/trackConsultModal.ts`

**2. 파일 역할**  
상담 모달 열기(consult_open), 제출(consult_submit) 시 클라이언트 이벤트 전송. pagePath, productId, sourcePath를 metadata로 넘김.

**3. 관련 함수**  
`trackConsultOpen`, `trackConsultSubmit`, `getPagePath`, `trackClientEvent`, `createAnalyticsPayload`

**4. 왜 수정 대상인지**  
유입 경로를 “문의와 함께 저장”할 때, 같은 이벤트에 referrer/UTM을 metadata로 넣어 나중에 analytics_events와 연계할지 결정할 수 있음. 문의 API에 직접 넘기는 것과는 별도.

**5. 전체 복사 가능한 코드 발췌**

```ts
// trackConsultSubmit (라인 41~57)
export function trackConsultSubmit(params?: ConsultModalTrackParams | null): void {
  try {
    const pagePath = getPagePath();
    const productId = params?.productId?.trim() || null;
    const sourcePath = params?.sourcePath?.trim() || null;
    trackClientEvent(
      createAnalyticsPayload({
        eventName: ANALYTICS_EVENTS.consult_submit,
        source: ANALYTICS_SOURCES.consult_cta,
        pagePath,
        productId,
        metadata:
          productId || sourcePath
            ? { productId: productId ?? undefined, sourcePath: sourcePath ?? undefined }
            : undefined,
      }),
    );
  } catch {
    // no-op
  }
}
```

**6. 1순위 수정 대상 여부**  
아니오. 유입 경로를 “문의 레코드에만” 저장할 때는 필수 아님. 분석용으로 확장할 때 수정.

---

### 16. Analytics payload / 이벤트 타입

**1. 파일 경로**  
`src/lib/analytics/types.ts`, `src/lib/analytics/events.ts`, `src/lib/analytics/payload.ts`

**2. 파일 역할**  
이벤트명·소스 상수, AnalyticsPayload 타입, createAnalyticsPayload 등. UTM/referrer 필드는 현재 타입에 없음.

**3. 관련**  
`AnalyticsEventName`, `AnalyticsSource`, `AnalyticsPayload`, `createAnalyticsPayload`

**4. 왜 수정 대상인지**  
유입 경로를 analytics 이벤트에도 넣으려면 payload 타입과 createAnalyticsPayload에 referrer/utm_* 필드 추가 필요. 문의 테이블만 쓸 경우 불필요.

**5. 1순위 수정 대상 여부**  
아니오.

---

## [최종 요약]

### 1. 실제 수정이 필요해 보이는 파일 목록

- `src/types/inquiry.ts` — 유입 경로 필드 타입 추가  
- `src/components/ConsultModal.tsx` — submit 시 유입 경로 전달  
- `src/components/InquiryForm.tsx` — submit 시 유입 경로 전달  
- `src/components/HeroInquiryForm.tsx` — submit 시 유입 경로 전달  
- `src/app/api/inquiries/route.ts` — POST body 수신 및 insert payload 확장, GET normalizeInquiryRow 확장  
- `src/components/admin/AdminInquiryTable.tsx` — 목록에 유입 경로 컬럼/뱃지 노출  
- `src/components/admin/hooks/useAdminInquiryTable.ts` — (필요 시) Inquiry 타입만 반영  
- 새 파일: `supabase/migrations/xxxx_inquiries_referrer_or_first_landing.sql` (또는 유입 경로용 컬럼 추가 스크립트)

### 2. 문의 최초 유입 저장 시 건드려야 할 파일 목록

- **클라이언트**: `ConsultModal.tsx`, `InquiryForm.tsx`, `HeroInquiryForm.tsx` (body에 유입 경로 필드 추가)  
- **서버**: `src/app/api/inquiries/route.ts` (POST에서 새 필드 수신 → insertPayload에 포함)  
- **타입/DB**: `src/types/inquiry.ts` (Inquiry, InquiryInput 확장), 새 Supabase 마이그레이션 (inquiries 컬럼 추가)

### 3. 관리자 문의 목록 UI에 건드려야 할 파일 목록

- `src/components/admin/AdminInquiryTable.tsx` — 컬럼 추가 및 셀 표시  
- (선택) `src/app/admin/inquiries/page.tsx` — 설명/헤더 문구 변경

### 4. DB/타입 변경이 필요한 파일 목록

- `src/types/inquiry.ts` — Inquiry, InquiryInput  
- `supabase/migrations/` — inquiries에 유입 경로용 컬럼 추가하는 새 마이그레이션  
- `src/app/api/inquiries/route.ts` — normalizeInquiryRow에 새 필드 매핑, POST insertPayload에 새 필드 포함

### 5. 가장 먼저 수정해야 할 1순위 파일 3개

1. **`src/types/inquiry.ts`** — 유입 경로 필드 타입을 먼저 정의해야 API·폼·테이블이 일관되게 수정 가능  
2. **`supabase/migrations/` (새 마이그레이션)** — inquiries 테이블에 유입 경로 컬럼 추가. 저장 가능해야 이후 API/UI가 의미 있음  
3. **`src/app/api/inquiries/route.ts`** — POST에서 새 필드 수신·저장, GET의 normalizeInquiryRow에서 새 필드 반환. 타입·DB 다음으로 적용하면 관리자 UI에서 바로 사용 가능

이후 **`ConsultModal.tsx`**(및 필요 시 InquiryForm, HeroInquiryForm)에서 유입 경로 수집·전달, **`AdminInquiryTable.tsx`**에서 컬럼/뱃지 노출을 진행하면 됩니다.
