# PR1 구현 결과 보완 검토 — 추가 발췌

파일 경로 + 전체 코드 기준으로 추가 발췌합니다. 요약 없이 전문 출력합니다.

---

## 1. inquiries 실제 스키마 확인

### 1-1. inquiries 테이블 생성 스키마 (기본 정의)

**파일 경로:** `supabase/inquiries.sql`

```sql
create extension if not exists "pgcrypto";

create table if not exists public.inquiries (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  phone text not null,
  content text not null,
  is_completed boolean not null default false,
  created_at timestamptz not null default now()
);

alter table public.inquiries enable row level security;

drop policy if exists "Allow public insert inquiries" on public.inquiries;
create policy "Allow public insert inquiries"
on public.inquiries
for insert
to anon
with check (true);

drop policy if exists "Allow public read inquiries" on public.inquiries;
create policy "Allow public read inquiries"
on public.inquiries
for select
to anon
using (true);

drop policy if exists "Allow public update inquiries" on public.inquiries;
create policy "Allow public update inquiries"
on public.inquiries
for update
to anon
using (true)
with check (true);
```

**inquiries.id 컬럼 타입:** `uuid` (primary key, default gen_random_uuid()).

---

### 1-2. PR1 migration에서의 inquiries 참조

**파일 경로:** `supabase/migrations/20260305100000_customer_profiles_and_eligibility.sql` (일부)

- inquiries 확장(컬럼 추가)만 수행. `inquiries` 테이블 생성은 하지 않음.
- `travel_bookings.inquiry_id` 정의:

```sql
inquiry_id bigint references public.inquiries(id) on delete set null,
```

**주의:** `supabase/inquiries.sql` 기준으로는 **inquiries.id는 uuid**입니다.  
따라서 실제 DB가 inquiries.sql로 생성되었다면 `travel_bookings.inquiry_id`는 **uuid**여야 하며, migration의 **bigint**는 스키마 불일치입니다.  
실제 DB가 다른 migration으로 id가 bigint로 되어 있다면 bigint가 맞습니다. **실제 DB의 inquiries.id 타입을 한 번 확인하는 것을 권장합니다.**

---

## 2. 현재 RLS 정책 전체

### 2-1. customer_profiles

**파일 경로:** `supabase/migrations/20260305100000_customer_profiles_and_eligibility.sql`

```sql
alter table public.customer_profiles enable row level security;

drop policy if exists "customer_profiles_insert_anon" on public.customer_profiles;
create policy "customer_profiles_insert_anon" on public.customer_profiles for insert to anon with check (true);
drop policy if exists "customer_profiles_select_anon" on public.customer_profiles;
create policy "customer_profiles_select_anon" on public.customer_profiles for select to anon using (true);
drop policy if exists "customer_profiles_update_anon" on public.customer_profiles;
create policy "customer_profiles_update_anon" on public.customer_profiles for update to anon using (true) with check (true);
```

- **enable row level security:** 예.

---

### 2-2. travel_bookings

**파일 경로:** `supabase/migrations/20260305100000_customer_profiles_and_eligibility.sql`

```sql
alter table public.travel_bookings enable row level security;

drop policy if exists "travel_bookings_all_anon" on public.travel_bookings;
create policy "travel_bookings_all_anon" on public.travel_bookings for all to anon using (true) with check (true);
```

- **enable row level security:** 예.

---

### 2-3. review_eligibilities

**파일 경로:** `supabase/migrations/20260305100000_customer_profiles_and_eligibility.sql`

```sql
alter table public.review_eligibilities enable row level security;

drop policy if exists "review_eligibilities_all_anon" on public.review_eligibilities;
create policy "review_eligibilities_all_anon" on public.review_eligibilities for all to anon using (true) with check (true);
```

- **enable row level security:** 예.

---

### 2-4. customer_account_links

**파일 경로:** `supabase/migrations/20260305100000_customer_profiles_and_eligibility.sql`

```sql
alter table public.customer_account_links enable row level security;

drop policy if exists "customer_account_links_all_anon" on public.customer_account_links;
create policy "customer_account_links_all_anon" on public.customer_account_links for all to anon using (true) with check (true);
```

- **enable row level security:** 예.

---

### 2-5. inquiries

**파일 경로:** `supabase/inquiries.sql`

```sql
alter table public.inquiries enable row level security;

drop policy if exists "Allow public insert inquiries" on public.inquiries;
create policy "Allow public insert inquiries"
on public.inquiries
for insert
to anon
with check (true);

drop policy if exists "Allow public read inquiries" on public.inquiries;
create policy "Allow public read inquiries"
on public.inquiries
for select
to anon
using (true);

drop policy if exists "Allow public update inquiries" on public.inquiries;
create policy "Allow public update inquiries"
on public.inquiries
for update
to anon
using (true)
with check (true);
```

- **enable row level security:** 예.

---

### 2-6. reviews

**파일 경로:** `supabase/reviews.sql`

```sql
alter table public.reviews enable row level security;

drop policy if exists "Allow public read reviews" on public.reviews;
create policy "Allow public read reviews"
on public.reviews
for select
to anon
using (true);

drop policy if exists "Allow public insert reviews" on public.reviews;
create policy "Allow public insert reviews"
on public.reviews
for insert
to anon
with check (true);
```

- **enable row level security:** 예.

---

## 3. 마이페이지 리뷰 관리 페이지 최종본

**파일 경로:** `src/app/mypage/reviews/page.tsx`

```tsx
import { cookies } from "next/headers";
import MyPageLayout from "@/components/mypage/MyPageLayout";
import { getMemberSessionFromCookies } from "@/lib/memberSession";
import { getReviewsByMemberId } from "@/lib/reviews";
import Link from "next/link";

function formatDate(value?: string) {
  if (!value) return "-";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "-";
  return date.toLocaleDateString("ko-KR");
}

export default async function MyPageReviewsPage() {
  const cookieStore = await cookies();
  const session = getMemberSessionFromCookies(cookieStore);
  const reviews = session ? await getReviewsByMemberId(session.memberId) : [];

  return (
    <MyPageLayout title="리뷰 관리" description="내가 작성한 리뷰를 확인할 수 있습니다.">
      <section className="space-y-4">
        {reviews.length === 0 ? (
          <div className="rounded-xl border border-[var(--border)] bg-[var(--surface)] p-6 text-center">
            <p className="text-sm font-medium text-[var(--text-primary)]">
              아직 작성한 후기가 없습니다.
            </p>
            <p className="mt-2 text-xs text-[var(--text-secondary)]">
              여행을 마친 뒤 후기를 남기면 이곳에서 관리할 수 있습니다.
            </p>
            <Link
              href="/reviews/write"
              className="mt-4 inline-block rounded-lg border border-[var(--primary)] bg-[var(--primary-soft)] px-4 py-2 text-sm font-medium text-[var(--primary)] transition hover:bg-[var(--primary)] hover:text-[var(--on-primary)]"
            >
              여행후기 작성하기
            </Link>
          </div>
        ) : (
          <ul className="space-y-2">
            {reviews.map((review) => (
              <li key={review.id}>
                <article className="rounded-xl border border-[var(--border)] bg-[var(--surface)] p-4">
                  <p className="text-sm font-semibold text-[var(--text-primary)]">{review.title}</p>
                  <p className="mt-1 text-xs text-[var(--text-secondary)]">
                    작성일 {formatDate(review.created_at)}
                  </p>
                  <p className="mt-2 line-clamp-2 text-xs text-[var(--text-secondary)]">
                    {review.content}
                  </p>
                </article>
              </li>
            ))}
          </ul>
        )}
      </section>
    </MyPageLayout>
  );
}
```

---

## 4. inquiries summary/UI에서 is_completed를 사용하는 위치

### 4-1. API — 문의 목록/요약/일괄·단건 PATCH

**파일 경로:** `src/app/api/inquiries/route.ts`

- **normalizeInquiryRow:** `is_completed` 반환 (42행 근처)
- **getInquirySummarySafe:** `.eq("is_completed", false)` / `.eq("is_completed", true)` (58–59행)
- **GET:** `status === "completed"` → `query.eq("is_completed", true)`, `status === "pending"` → `query.eq("is_completed", false)` (95–96행)
- **GET 정렬:** `sort === "pending_first"` → `query.order("is_completed", { ascending: true })` (99행)
- **GET fallback 주석:** "Fallback for legacy schema (e.g. missing is_completed/product_title columns)." (111행)
- **BulkPatchBody:** `is_completed?: boolean` (145행)
- **PATCH:** `body.is_completed`를 `updatePayload.is_completed`에 설정 (162–163행)
- **PATCH 에러 메시지:** "is_completed, consultation_status, booking_status 중 하나 이상이 필요합니다." (182행)
- **PATCH 에러 코드 42703:** "inquiries 테이블에 is_completed 컬럼이 없습니다. DB 업그레이드 SQL을 실행해 주세요." (196행)

**파일 경로:** `src/app/api/inquiries/[id]/route.ts`

```ts
import { NextResponse } from "next/server";
import { supabase } from "@/lib/supabase";

type PatchBody = {
  /** @deprecated 단계적 deprecated. consultation_status 사용 권장 */
  is_completed?: boolean;
  consultation_status?: "new" | "contacted" | "closed";
  booking_status?: "none" | "reserved" | "completed" | "canceled";
  completed_at?: string | null;
};

export async function PATCH(
  request: Request,
  context: { params: Promise<{ id: string }> },
) {
  const { id } = await context.params;
  const body = (await request.json()) as PatchBody;

  const updatePayload: Record<string, unknown> = {};
  if (typeof body.is_completed === "boolean") {
    updatePayload.is_completed = body.is_completed;
  }
  // ... consultation_status, booking_status, completed_at ...

  if (Object.keys(updatePayload).length === 0) {
    return NextResponse.json(
      { message: "is_completed, consultation_status, booking_status, completed_at 중 하나 이상이 필요합니다." },
      { status: 400 },
    );
  }

  const { error } = await supabase
    .from("inquiries")
    .update(updatePayload)
    .eq("id", id);

  if (error) {
    const errorCode = error?.code;
    if (errorCode === "42703") {
      return NextResponse.json(
        { message: "inquiries 테이블에 is_completed 컬럼이 없습니다. DB 업그레이드 SQL을 실행해 주세요." },
        { status: 500 },
      );
    }
    // ...
  }
  return NextResponse.json({ message: "상담 상태가 업데이트되었습니다." });
}
```

---

### 4-2. 관리자 문의 관리 페이지/훅 — AdminInquiryTable

**파일 경로:** `src/components/AdminInquiryTable.tsx`

- **단건 완료 토글:** `updateCompletion(id, isCompleted)` → body `{ is_completed: isCompleted }` (171, 178행)
- **일괄 완료:** `updateBulkCompletion(isCompleted)` → body `{ ids: selectedIds, is_completed: isCompleted }` (207, 214행)
- **테이블 행 표시:** `const isCompleted = inquiry.is_completed === true` (406행), 완료/미완료 배지·체크박스에 사용 (406–419행)

관련 코드만 발췌:

```ts
  async function updateCompletion(id: string, isCompleted: boolean) {
    setPendingId(id);
    setErrorMessage("");

    const previous = inquiries;
    setInquiries((current) =>
      current.map((item) => (item.id === id ? { ...item, is_completed: isCompleted } : item)),
    );

    try {
      const response = await fetch(`/api/inquiries/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ is_completed: isCompleted }),
      });
      // ...
    }
  }

  async function updateBulkCompletion(isCompleted: boolean) {
    // ...
    const response = await fetch("/api/inquiries", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ids: selectedIds, is_completed: isCompleted }),
    });
    // ...
  }
```

```tsx
            {inquiries.map((inquiry) => {
                const isCompleted = inquiry.is_completed === true;
                // ...
                return (
                  // ...
                    <td className="px-4 py-3">
                      <label className="inline-flex items-center gap-2">
                        <input
                          type="checkbox"
                          checked={isCompleted}
                          disabled={pendingId === inquiry.id}
                          onChange={(event) => {
                            updateCompletion(inquiry.id, event.target.checked);
                          }}
                          // ...
                        />
                        <span className={...}>
                          {isCompleted ? "완료" : "미완료"}
                        </span>
                      </label>
                    </td>
```

---

### 4-3. 관리자 대시보드 카운트(훅/유틸)

**파일 경로:** `src/lib/adminCounts.ts`

전체 파일 (is_completed 사용처만 강조):

```ts
import { supabase } from "@/lib/supabase";
import { unstable_cache } from "next/cache";

function percentChange(current: number, previous: number): number {
  if (previous <= 0) {
    if (current <= 0) return 0;
    return 100;
  }
  return Math.round(((current - previous) / previous) * 100);
}

async function fetchAdminCountsRaw() {
  const now = new Date();
  const startOfToday = new Date(now);
  startOfToday.setHours(0, 0, 0, 0);

  const startOfYesterday = new Date(startOfToday);
  startOfYesterday.setDate(startOfYesterday.getDate() - 1);

  const startOfTomorrow = new Date(startOfToday);
  startOfTomorrow.setDate(startOfTomorrow.getDate() + 1);

  const delayedThresholdIso = new Date(now.getTime() - 24 * 60 * 60 * 1000).toISOString();

  const [
    productsResult,
    pendingInquiriesResult,
    membersResult,
    reviewsResult,
    totalInquiriesResult,
    delayedResult,
    todayTotalResult,
    yesterdayTotalResult,
    todayPendingResult,
    yesterdayPendingResult,
    todayDelayedResult,
    yesterdayDelayedResult,
  ] = await Promise.all([
    supabase.from("products").select("id", { count: "exact", head: true }),
    supabase.from("inquiries").select("id", { count: "exact", head: true }).eq("is_completed", false),
    supabase.from("members").select("id", { count: "exact", head: true }),
    supabase.from("reviews").select("id", { count: "exact", head: true }),
    supabase.from("inquiries").select("id", { count: "exact", head: true }),
    supabase
      .from("inquiries")
      .select("id", { count: "exact", head: true })
      .eq("is_completed", false)
      .lt("created_at", delayedThresholdIso),
    supabase
      .from("inquiries")
      .select("id", { count: "exact", head: true })
      .gte("created_at", startOfToday.toISOString())
      .lt("created_at", startOfTomorrow.toISOString()),
    supabase
      .from("inquiries")
      .select("id", { count: "exact", head: true })
      .gte("created_at", startOfYesterday.toISOString())
      .lt("created_at", startOfToday.toISOString()),
    supabase
      .from("inquiries")
      .select("id", { count: "exact", head: true })
      .eq("is_completed", false)
      .gte("created_at", startOfToday.toISOString())
      .lt("created_at", startOfTomorrow.toISOString()),
    supabase
      .from("inquiries")
      .select("id", { count: "exact", head: true })
      .eq("is_completed", false)
      .gte("created_at", startOfYesterday.toISOString())
      .lt("created_at", startOfToday.toISOString()),
    supabase
      .from("inquiries")
      .select("id", { count: "exact", head: true })
      .eq("is_completed", false)
      .lt("created_at", delayedThresholdIso)
      .gte("created_at", startOfToday.toISOString()),
    supabase
      .from("inquiries")
      .select("id", { count: "exact", head: true })
      .eq("is_completed", false)
      .lt("created_at", delayedThresholdIso)
      .gte("created_at", startOfYesterday.toISOString())
      .lt("created_at", startOfToday.toISOString()),
  ]);

  const pendingCount = pendingInquiriesResult.error ? 0 : (pendingInquiriesResult.count ?? 0);
  const totalInquiries = totalInquiriesResult.error ? 0 : (totalInquiriesResult.count ?? 0);
  const completedInquiries = Math.max(0, totalInquiries - pendingCount);
  const completionRate =
    totalInquiries === 0 ? 0 : Math.round((completedInquiries / totalInquiries) * 100);
  // ... 나머지 집계 ...

  return {
    productCount: productsResult.error ? 0 : (productsResult.count ?? 0),
    inquiryCount: pendingCount,
    memberCount: membersResult.error ? 0 : (membersResult.count ?? 0),
    reviewCount: reviewsResult.error ? 0 : (reviewsResult.count ?? 0),
    totalInquiries,
    pendingInquiries: pendingCount,
    completedInquiries,
    delayedInquiries: delayedResult.error ? 0 : (delayedResult.count ?? 0),
    completionRate,
    totalInquiriesDeltaPercent: percentChange(todayTotal, yesterdayTotal),
    pendingInquiriesDeltaPercent: percentChange(todayPending, yesterdayPending),
    completedInquiriesDeltaPercent: percentChange(todayCompleted, yesterdayCompleted),
    delayedInquiriesDeltaPercent: percentChange(todayDelayed, yesterdayDelayed),
  };
}

export async function getAdminCounts() {
  return unstable_cache(
    fetchAdminCountsRaw,
    ["admin-counts"],
    { revalidate: 60, tags: ["admin-counts"] },
  )();
}
```

---

### 4-4. 타입 정의

**파일 경로:** `src/types/inquiry.ts`

```ts
export type Inquiry = {
  id: string;
  name: string;
  phone: string;
  content: string;
  product_id?: string;
  product_title?: string;
  source_path?: string;
  /** @deprecated 단계적 deprecated. consultation_status / booking_status 중심으로 전환 예정 */
  is_completed?: boolean;
  customer_profile_id?: string | null;
  consultation_status?: string;
  booking_status?: string;
  completed_at?: string | null;
  created_at?: string;
  quote_snapshot?: QuoteSnapshot | null;
};
// ... QuoteSnapshot, InquiryInput ...
```

---

### 4-5. DB/마이그레이션

- **supabase/inquiries.sql:** `is_completed boolean not null default false`
- **supabase/inquiries_completion_upgrade.sql:** `add column if not exists is_completed boolean not null default false;`, `create index if not exists idx_inquiries_is_completed ...`
- **supabase/inquiries_indexes_for_counts.sql:** `idx_inquiries_is_completed_created_at on public.inquiries(is_completed, created_at desc)`

---

## 5. inquiries insert fallback 관련 코드

### 5-1. src/app/api/inquiries/route.ts 전체

**파일 경로:** `src/app/api/inquiries/route.ts`

```ts
import { NextResponse } from "next/server";
import { supabase } from "@/lib/supabase";
import { findOrCreateCustomerProfile } from "@/lib/customerProfiles";
import { notifyInquiryCreated } from "@/lib/notifications";
import { createNewInquiryNotification } from "@/lib/adminNotifications";
import type { Inquiry, InquiryInput } from "@/types/inquiry";

function normalizeInquiryRow(row: Record<string, unknown>) {
  const quoteSnapshotRaw = row.quote_snapshot;
  let quote_snapshot: Inquiry["quote_snapshot"] = undefined;
  if (quoteSnapshotRaw && typeof quoteSnapshotRaw === "object") {
    const o = quoteSnapshotRaw as Record<string, unknown>;
    const qs = o.quoteSummary as Record<string, unknown> | undefined;
    quote_snapshot = {
      selectedOptions:
        o.selectedOptions && typeof o.selectedOptions === "object"
          ? (o.selectedOptions as Record<string, string>)
          : undefined,
      quoteSummary: qs
        ? {
            total: qs.total as number | null,
            basePrice: qs.basePrice as number | null,
            breakdown: Array.isArray(qs.breakdown)
              ? (qs.breakdown as Array<{ groupLabel: string; optionLabel: string; priceDelta: number }>)
              : [],
          }
        : undefined,
      inquiredAt: typeof o.inquiredAt === "string" ? o.inquiredAt : undefined,
    };
    if (!quote_snapshot.selectedOptions && !quote_snapshot.quoteSummary && !quote_snapshot.inquiredAt) {
      quote_snapshot = undefined;
    }
  }
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
}

type ListStatus = "all" | "completed" | "pending";
type SortOption = "pending_first" | "recent" | "oldest" | "name";
type SafeSummary = { pendingCount: number; completedCount: number };

async function getInquirySummarySafe(): Promise<SafeSummary> {
  const [pendingSummary, completedSummary] = await Promise.all([
    supabase.from("inquiries").select("*", { count: "exact", head: true }).eq("is_completed", false),
    supabase.from("inquiries").select("*", { count: "exact", head: true }).eq("is_completed", true),
  ]);

  return {
    pendingCount: pendingSummary.error ? 0 : (pendingSummary.count ?? 0),
    completedCount: completedSummary.error ? 0 : (completedSummary.count ?? 0),
  };
}

export async function GET(request: Request) {
  const url = new URL(request.url);
  const search = url.searchParams.get("search")?.trim() ?? "";
  const statusParam = url.searchParams.get("status");
  const status: ListStatus =
    statusParam === "completed" || statusParam === "pending" ? statusParam : "all";
  const sortParam = url.searchParams.get("sort");
  const sort: SortOption =
    sortParam === "recent" || sortParam === "oldest" || sortParam === "name" || sortParam === "pending_first"
      ? sortParam
      : "pending_first";
  const pageRaw = Number.parseInt(url.searchParams.get("page") ?? "1", 10);
  const pageSizeRaw = Number.parseInt(url.searchParams.get("pageSize") ?? "10", 10);
  const page = Number.isFinite(pageRaw) && pageRaw > 0 ? pageRaw : 1;
  const pageSize = Number.isFinite(pageSizeRaw) ? Math.min(Math.max(pageSizeRaw, 5), 50) : 10;
  const from = (page - 1) * pageSize;
  const to = from + pageSize - 1;

  let query = supabase.from("inquiries").select("*", { count: "exact" });

  if (search) {
    const escaped = search.replace(/[%_]/g, "\\$&");
    query = query.or(
      `name.ilike.%${escaped}%,phone.ilike.%${escaped}%,content.ilike.%${escaped}%,product_title.ilike.%${escaped}%`,
    );
  }

  if (status === "completed") query = query.eq("is_completed", true);
  if (status === "pending") query = query.eq("is_completed", false);

  if (sort === "pending_first") {
    query = query.order("is_completed", { ascending: true }).order("created_at", { ascending: false });
  } else if (sort === "oldest") {
    query = query.order("created_at", { ascending: true });
  } else if (sort === "name") {
    query = query.order("name", { ascending: true }).order("created_at", { ascending: false });
  } else {
    query = query.order("created_at", { ascending: false });
  }

  let { data, error, count } = await query.range(from, to);

  if (error) {
    // Fallback for legacy schema (e.g. missing is_completed/product_title columns).
    let fallback = supabase.from("inquiries").select("*", { count: "exact" });
    if (search) {
      const escaped = search.replace(/[%_]/g, "\\$&");
      fallback = fallback.or(`name.ilike.%${escaped}%,phone.ilike.%${escaped}%,content.ilike.%${escaped}%`);
    }
    const fallbackResult = await fallback
      .order("created_at", { ascending: false, nullsFirst: false })
      .range(from, to);

    data = fallbackResult.data;
    error = fallbackResult.error;
    count = fallbackResult.count ?? 0;
  }

  if (error) {
    return NextResponse.json({ message: "문의 목록 조회에 실패했습니다." }, { status: 500 });
  }

  const summary = await getInquirySummarySafe();

  return NextResponse.json({
    items: (data ?? []).map((row) => normalizeInquiryRow(row as Record<string, unknown>)),
    total: count ?? 0,
    page,
    pageSize,
    pendingCount: summary.pendingCount,
    completedCount: summary.completedCount,
  });
}

type BulkPatchBody = {
  ids?: string[];
  /** @deprecated 단계적 deprecated. consultation_status / booking_status 사용 권장 */
  is_completed?: boolean;
  consultation_status?: "new" | "contacted" | "closed";
  booking_status?: "none" | "reserved" | "completed" | "canceled";
};

export async function PATCH(request: Request) {
  const body = (await request.json()) as BulkPatchBody;
  const ids = Array.isArray(body.ids) ? body.ids.filter(Boolean) : [];

  if (ids.length === 0) {
    return NextResponse.json(
      { message: "ids 배열이 필요합니다." },
      { status: 400 },
    );
  }

  const updatePayload: Record<string, unknown> = {};
  if (typeof body.is_completed === "boolean") {
    updatePayload.is_completed = body.is_completed;
  }
  if (
    body.consultation_status === "new" ||
    body.consultation_status === "contacted" ||
    body.consultation_status === "closed"
  ) {
    updatePayload.consultation_status = body.consultation_status;
  }
  if (
    body.booking_status === "none" ||
    body.booking_status === "reserved" ||
    body.booking_status === "completed" ||
    body.booking_status === "canceled"
  ) {
    updatePayload.booking_status = body.booking_status;
  }
  if (Object.keys(updatePayload).length === 0) {
    return NextResponse.json(
      { message: "is_completed, consultation_status, booking_status 중 하나 이상이 필요합니다." },
      { status: 400 },
    );
  }

  const updateResults = await Promise.all(
    ids.map((id) => supabase.from("inquiries").update(updatePayload).eq("id", id)),
  );

  const failed = updateResults.find((result) => result.error);
  if (failed?.error) {
    const code = failed.error.code;
    if (code === "42703") {
      return NextResponse.json(
        { message: "inquiries 테이블에 is_completed 컬럼이 없습니다. DB 업그레이드 SQL을 실행해 주세요." },
        { status: 500 },
      );
    }
    if (code === "42501") {
      return NextResponse.json(
        { message: "inquiries 테이블 UPDATE 권한(RLS 정책)이 없습니다. 정책 SQL을 확인해 주세요." },
        { status: 500 },
      );
    }
    return NextResponse.json(
      { message: `일괄 상태 업데이트에 실패했습니다. (${failed.error.message})` },
      { status: 500 },
    );
  }

  return NextResponse.json({ message: "선택한 문의 상태가 업데이트되었습니다." });
}

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

  if (!name || !phone || !content) {
    return NextResponse.json({ message: "이름, 연락처, 문의 내용은 필수입니다." }, { status: 400 });
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

  const insertPayload: Record<string, unknown> = {
    name,
    phone,
    content,
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

  const insertResultWithProduct = await supabase
    .from("inquiries")
    .insert(insertPayload)
    .select("id")
    .maybeSingle();

  let inquiryId = insertResultWithProduct.data?.id;
  if (insertResultWithProduct.error || !insertResultWithProduct.data) {
    if (insertResultWithProduct.error?.code === "42703" && quoteSnapshot) {
      const retry = await supabase
        .from("inquiries")
        .insert({
          name,
          phone,
          content,
          product_id: productId || null,
          product_title: productTitle || null,
          source_path: sourcePath || null,
        })
        .select("id")
        .maybeSingle();
      if (!retry.error && retry.data) {
        inquiryId = retry.data.id;
      }
    }
    if (!inquiryId) {
      const insertLegacy = await supabase
        .from("inquiries")
        .insert({
          name,
          phone,
          content,
        })
        .select("id")
        .maybeSingle();
      if (insertLegacy.error || !insertLegacy.data) {
        return NextResponse.json({ message: "문의 저장에 실패했습니다." }, { status: 500 });
      }
      inquiryId = insertLegacy.data.id;
    }
  }

  await notifyInquiryCreated({ name, phone, content });
  await createNewInquiryNotification({
    inquiryId: String(inquiryId),
    name,
    phone,
    content,
  });

  return NextResponse.json({ message: "문의가 저장되었습니다." }, { status: 201 });
}
```

**Insert fallback 요약:**

1. **1차 insert:** `insertPayload`(customer_profile_id·quote_snapshot 포함)로 insert.
2. **실패 시:** `error.code === "42703"` 이고 `quoteSnapshot`이 있으면 → `quote_snapshot` 없이 product_id/product_title/source_path만 넣어 **재시도**. 성공 시 `inquiryId` 설정.
3. **여전히 inquiryId 없으면:** `name`, `phone`, `content`만 넣은 **insertLegacy** 실행. 실패 시 500 "문의 저장에 실패했습니다." 반환.

**오류 로그/예외 처리:**  
별도 로깅 유틸 없음. 모든 오류는 `NextResponse.json({ message: "..." }, { status: 4xx|5xx })`로만 반환됩니다.

---

## 6. customer_profiles 사용 위치 전체

### 6-1. findOrCreateCustomerProfile 호출 파일

**파일 경로:** `src/app/api/inquiries/route.ts`

- **import:** `import { findOrCreateCustomerProfile } from "@/lib/customerProfiles";`
- **호출 및 customer_profile_id 저장:**

```ts
  const profile = await findOrCreateCustomerProfile({
    name,
    phone,
    source: "inquiry",
  });
  if (profile) {
    insertPayload.customer_profile_id = profile.id;
  }
```

---

### 6-2. customer_profile_id를 참조하는 파일 전체

**파일 경로:** `src/app/api/inquiries/route.ts`  
- `normalizeInquiryRow`: `customer_profile_id: typeof row.customer_profile_id === "string" ? row.customer_profile_id : undefined`  
- POST: `insertPayload.customer_profile_id = profile.id` (위와 동일)

**파일 경로:** `src/types/inquiry.ts`  
- `Inquiry.customer_profile_id?: string | null;` (타입 정의)

**파일 경로:** `src/types/travelBooking.ts`  
- `TravelBooking.customer_profile_id: string;`  
- `TravelBookingInput.customer_profile_id: string;`

**파일 경로:** `src/types/review.ts`  
- `Review.customer_profile_id?: string;`

**파일 경로:** `src/types/reviewEligibility.ts`  
- `ReviewEligibility.customer_profile_id: string;`  
- `ReviewEligibilityInput.customer_profile_id: string;`

**파일 경로:** `src/types/customerAccountLink.ts`  
- `CustomerAccountLink.customer_profile_id: string;`  
- `CustomerAccountLinkInput.customer_profile_id: string;`

**파일 경로:** `src/lib/travelBookings.ts`  
- `toBooking`: `customer_profile_id: String(row.customer_profile_id ?? "")`  
- `createTravelBooking` payload: `customer_profile_id: input.customer_profile_id`

**파일 경로:** `src/lib/reviews.ts`  
- `normalizeReview`: `customer_profile_id: typeof row.customer_profile_id === "string" ? row.customer_profile_id : undefined`

**파일 경로:** `src/lib/reviewEligibilities.ts`  
- `toEligibility`: `customer_profile_id: String(row.customer_profile_id ?? "")`  
- `createReviewEligibility` payload: `customer_profile_id: input.customer_profile_id`

**파일 경로:** `src/lib/customerProfiles.ts`  
- `toProfile` 등에서는 `id`만 사용. `customer_profile_id`라는 컬럼명으로 참조하는 코드는 없고, 다른 테이블에서 이 테이블을 FK로 참조할 때 사용.

---

이 문서는 PR1 보완 검토용 추가 발췌입니다. 실제 스키마는 `inquiries.sql` 기준 **inquiries.id = uuid**이며, migration의 `travel_bookings.inquiry_id bigint`와 불일치할 수 있으니 실제 DB 타입 확인을 권장합니다.
