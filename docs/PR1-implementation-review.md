# PR1 구현 결과 검토 — 파일 경로 + 전체 코드

비로그인 상담 고객 기반 후기 시스템 구조 검토용으로, 요청 범위의 코드를 **요약 없이 전체** 발췌했습니다.

---

## 1. DB Migration 전체

**파일 경로:** `supabase/migrations/20260305100000_customer_profiles_and_eligibility.sql`

```sql
-- PR1: 비로그인 상담 고객 기반 후기 시스템 도메인/DB 기반 구축
-- customer_profiles, travel_bookings, review_eligibilities, customer_account_links 신규
-- inquiries 테이블 확장 (customer_profile_id, consultation_status, booking_status, completed_at)

create extension if not exists "pgcrypto";

-- ---------------------------------------------------------------------------
-- 1) customer_profiles
-- 비로그인 상담 고객을 운영 기준으로 식별하는 마스터 테이블
-- ---------------------------------------------------------------------------
create table if not exists public.customer_profiles (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  phone text not null,
  email text,
  source text not null default 'inquiry',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_customer_profiles_phone on public.customer_profiles(phone);
create index if not exists idx_customer_profiles_email on public.customer_profiles(email) where email is not null;

comment on table public.customer_profiles is '비로그인 상담 고객 마스터. 동일 전화번호/이메일 고객 묶음용.';

alter table public.customer_profiles enable row level security;

drop policy if exists "customer_profiles_insert_anon" on public.customer_profiles;
create policy "customer_profiles_insert_anon" on public.customer_profiles for insert to anon with check (true);
drop policy if exists "customer_profiles_select_anon" on public.customer_profiles;
create policy "customer_profiles_select_anon" on public.customer_profiles for select to anon using (true);
drop policy if exists "customer_profiles_update_anon" on public.customer_profiles;
create policy "customer_profiles_update_anon" on public.customer_profiles for update to anon using (true) with check (true);

-- ---------------------------------------------------------------------------
-- 2) travel_bookings
-- 실제 여행 예약/완료 기준. customer_profile 기준 관리
-- inquiry_id: 실제 DB의 inquiries.id 타입에 맞춤 (uuid 또는 bigint)
-- ---------------------------------------------------------------------------
create table if not exists public.travel_bookings (
  id uuid primary key default gen_random_uuid(),
  customer_profile_id uuid not null references public.customer_profiles(id) on delete cascade,
  inquiry_id bigint references public.inquiries(id) on delete set null,
  product_id text,
  product_title text,
  source_path text,
  booking_status text not null default 'reserved' check (booking_status in ('reserved','completed','canceled')),
  departure_date date,
  return_date date,
  travel_completed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_travel_bookings_customer_profile_id on public.travel_bookings(customer_profile_id);
create index if not exists idx_travel_bookings_inquiry_id on public.travel_bookings(inquiry_id) where inquiry_id is not null;

comment on table public.travel_bookings is '여행 예약/완료 기준. customer_profile 기준 관리.';

alter table public.travel_bookings enable row level security;

drop policy if exists "travel_bookings_all_anon" on public.travel_bookings;
create policy "travel_bookings_all_anon" on public.travel_bookings for all to anon using (true) with check (true);

-- ---------------------------------------------------------------------------
-- 3) review_eligibilities
-- 후기 작성 자격. 여행건 기준 생성, 나중에 회원 claim 가능
-- ---------------------------------------------------------------------------
create table if not exists public.review_eligibilities (
  id uuid primary key default gen_random_uuid(),
  booking_id uuid not null references public.travel_bookings(id) on delete cascade,
  customer_profile_id uuid not null references public.customer_profiles(id) on delete cascade,
  status text not null default 'eligible' check (status in ('eligible','claimed','submitted','expired','blocked')),
  review_open_at timestamptz not null default now(),
  review_deadline_at timestamptz,
  claimed_by_member_id text,
  claimed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique(booking_id)
);

create index if not exists idx_review_eligibilities_booking_id on public.review_eligibilities(booking_id);
create index if not exists idx_review_eligibilities_customer_profile_id on public.review_eligibilities(customer_profile_id);
create index if not exists idx_review_eligibilities_claimed_by_member_id on public.review_eligibilities(claimed_by_member_id) where claimed_by_member_id is not null;

comment on table public.review_eligibilities is '후기 작성 자격. 여행건 기준 생성, 회원 claim 시 claimed_by_member_id 연결.';

alter table public.review_eligibilities enable row level security;

drop policy if exists "review_eligibilities_all_anon" on public.review_eligibilities;
create policy "review_eligibilities_all_anon" on public.review_eligibilities for all to anon using (true) with check (true);

-- ---------------------------------------------------------------------------
-- 4) customer_account_links
-- customer_profile ↔ member 연결 (현재 member session / member_id text 기준)
-- ---------------------------------------------------------------------------
create table if not exists public.customer_account_links (
  id uuid primary key default gen_random_uuid(),
  customer_profile_id uuid not null references public.customer_profiles(id) on delete cascade,
  member_id text not null,
  linked_by text not null default 'self',
  verified_method text not null default 'manual',
  verified_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  unique(customer_profile_id, member_id)
);

create index if not exists idx_customer_account_links_customer_profile_id on public.customer_account_links(customer_profile_id);
create index if not exists idx_customer_account_links_member_id on public.customer_account_links(member_id);

comment on table public.customer_account_links is 'customer_profile ↔ member 연결. theall_member_auth / member_id(text) 기준.';

alter table public.customer_account_links enable row level security;

drop policy if exists "customer_account_links_all_anon" on public.customer_account_links;
create policy "customer_account_links_all_anon" on public.customer_account_links for all to anon using (true) with check (true);

-- ---------------------------------------------------------------------------
-- 5) inquiries 확장
-- customer_profile_id, consultation_status, booking_status, completed_at 추가
-- is_completed는 유지 (후에 deprecated 예정)
-- ---------------------------------------------------------------------------
alter table public.inquiries add column if not exists customer_profile_id uuid references public.customer_profiles(id) on delete set null;
alter table public.inquiries add column if not exists consultation_status text not null default 'new';
alter table public.inquiries add column if not exists booking_status text not null default 'none';
alter table public.inquiries add column if not exists completed_at timestamptz;

do $$
begin
  if not exists (
    select 1 from pg_constraint where conname = 'inquiries_consultation_status_check'
  ) then
    alter table public.inquiries add constraint inquiries_consultation_status_check
      check (consultation_status in ('new','contacted','closed'));
  end if;
  if not exists (
    select 1 from pg_constraint where conname = 'inquiries_booking_status_check'
  ) then
    alter table public.inquiries add constraint inquiries_booking_status_check
      check (booking_status in ('none','reserved','completed','canceled'));
  end if;
end $$;

create index if not exists idx_inquiries_customer_profile_id on public.inquiries(customer_profile_id) where customer_profile_id is not null;

comment on column public.inquiries.customer_profile_id is '연결된 비로그인 고객 프로필';
comment on column public.inquiries.consultation_status is '상담 진행 상태: new, contacted, closed';
comment on column public.inquiries.booking_status is '예약/완료 상태: none, reserved, completed, canceled';
```

---

## 2. 타입 파일 전체

### 2-1. src/types/customerProfile.ts

```ts
/**
 * 비로그인 상담 고객 프로필.
 * 운영 기준 고객 식별용 마스터.
 */

export type CustomerProfile = {
  id: string;
  name: string;
  phone: string;
  email: string | null;
  source: string;
  created_at: string;
  updated_at: string;
};

export type CustomerProfileInput = {
  name: string;
  phone: string;
  email?: string | null;
  source?: string;
};
```

### 2-2. src/types/travelBooking.ts

```ts
/**
 * 여행 예약/완료 건.
 * customer_profile 기준 관리.
 */

export type TravelBookingStatus = "reserved" | "completed" | "canceled";

export type TravelBooking = {
  id: string;
  customer_profile_id: string;
  inquiry_id: string | null;
  product_id: string | null;
  product_title: string | null;
  source_path: string | null;
  booking_status: TravelBookingStatus;
  departure_date: string | null;
  return_date: string | null;
  travel_completed_at: string | null;
  created_at: string;
  updated_at: string;
};

export type TravelBookingInput = {
  customer_profile_id: string;
  inquiry_id?: string | null;
  product_id?: string | null;
  product_title?: string | null;
  source_path?: string | null;
  booking_status?: TravelBookingStatus;
  departure_date?: string | null;
  return_date?: string | null;
  travel_completed_at?: string | null;
};
```

### 2-3. src/types/reviewEligibility.ts

```ts
/**
 * 후기 작성 자격.
 * 여행건(booking) 기준 생성, 회원 claim 시 claimed_by_member_id 연결.
 */

export type ReviewEligibilityStatus =
  | "eligible"
  | "claimed"
  | "submitted"
  | "expired"
  | "blocked";

export type ReviewEligibility = {
  id: string;
  booking_id: string;
  customer_profile_id: string;
  status: ReviewEligibilityStatus;
  review_open_at: string;
  review_deadline_at: string | null;
  claimed_by_member_id: string | null;
  claimed_at: string | null;
  created_at: string;
  updated_at: string;
};

export type ReviewEligibilityInput = {
  booking_id: string;
  customer_profile_id: string;
  status?: ReviewEligibilityStatus;
  review_open_at?: string;
  review_deadline_at?: string | null;
};
```

### 2-4. src/types/customerAccountLink.ts

```ts
/**
 * customer_profile ↔ member 연결.
 * 현재 프로젝트 member session (theall_member_auth / member_id) 기준.
 */

export type CustomerAccountLink = {
  id: string;
  customer_profile_id: string;
  member_id: string;
  linked_by: string;
  verified_method: string;
  verified_at: string;
  created_at: string;
};

export type CustomerAccountLinkInput = {
  customer_profile_id: string;
  member_id: string;
  linked_by?: string;
  verified_method?: string;
};
```

### 2-5. src/types/inquiry.ts (수정됨)

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
  /** 연결된 비로그인 고객 프로필 */
  customer_profile_id?: string | null;
  /** 상담 진행 상태: new, contacted, closed */
  consultation_status?: string;
  /** 예약/완료 상태: none, reserved, completed, canceled */
  booking_status?: string;
  /** 상담 완료 시각 */
  completed_at?: string | null;
  created_at?: string;
  /** 상품 옵션 선택 시: 선택 옵션 + 예상 견적 스냅샷 */
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
  /** 옵션 선택 시에만 전송 (빈 객체 금지) */
  selected_options?: Record<string, string>;
  /** 예상 금액/breakdown (옵션 선택 시) */
  quote_summary?: {
    total: number | null;
    base_price: number | null;
    breakdown: Array<{ group_label: string; option_label: string; price_delta: number }>;
  };
  inquired_at?: string;
};
```

### 2-6. src/types/review.ts (수정됨)

```ts
export type Review = {
  id: string;
  member_id?: string;
  title: string;
  content: string;
  image_url?: string;
  image_urls?: string[];
  author_name: string;
  created_at?: string;
  rating?: number;
  /** 후속 PR: eligibility 기반 확장용 */
  eligibility_id?: string;
  booking_id?: string;
  customer_profile_id?: string;
};
```

---

## 3. lib 계층 신규 파일 전체

### 3-1. src/lib/customerProfiles.ts

```ts
/**
 * 비로그인 상담 고객 프로필 조회/생성.
 * 전화번호·이메일 기준 고객 묶음, 중복 생성 방지.
 */

import { supabase } from "@/lib/supabase";
import type { CustomerProfile, CustomerProfileInput } from "@/types/customerProfile";

const SOURCE_DEFAULT = "inquiry";

/** 전화번호 정규화: 숫자만 추출 (최대 11자리) */
export function normalizePhone(phone: string): string {
  const digits = (phone ?? "").replace(/\D/g, "").slice(0, 11);
  return digits;
}

function toProfile(row: Record<string, unknown>): CustomerProfile {
  return {
    id: String(row.id ?? ""),
    name: String(row.name ?? ""),
    phone: String(row.phone ?? ""),
    email: typeof row.email === "string" ? row.email : null,
    source: String(row.source ?? SOURCE_DEFAULT),
    created_at: String(row.created_at ?? ""),
    updated_at: String(row.updated_at ?? ""),
  };
}

/** 전화번호로 고객 프로필 조회 (1건). 없으면 null */
export async function findCustomerProfileByPhone(phone: string): Promise<CustomerProfile | null> {
  const normalized = normalizePhone(phone);
  if (!normalized) return null;

  const { data, error } = await supabase
    .from("customer_profiles")
    .select("*")
    .eq("phone", normalized)
    .limit(1)
    .maybeSingle();

  if (error || !data) return null;
  return toProfile(data as Record<string, unknown>);
}

/** 이메일로 고객 프로필 조회 (1건). 없으면 null. 이메일이 비어 있으면 미조회 */
export async function findCustomerProfileByEmail(email: string): Promise<CustomerProfile | null> {
  const trimmed = (email ?? "").trim().toLowerCase();
  if (!trimmed) return null;

  const { data, error } = await supabase
    .from("customer_profiles")
    .select("*")
    .eq("email", trimmed)
    .limit(1)
    .maybeSingle();

  if (error || !data) return null;
  return toProfile(data as Record<string, unknown>);
}

/** 고객 프로필 생성. 중복 전화번호 시 기존 반환용으로 호출 전 find 로 확인 권장 */
export async function createCustomerProfile(
  input: CustomerProfileInput,
): Promise<CustomerProfile | null> {
  const phone = normalizePhone(input.phone);
  if (!phone) return null;

  const payload = {
    name: input.name.trim(),
    phone,
    email: input.email?.trim() || null,
    source: input.source?.trim() || SOURCE_DEFAULT,
    updated_at: new Date().toISOString(),
  };

  const { data, error } = await supabase
    .from("customer_profiles")
    .insert(payload)
    .select("id,name,phone,email,source,created_at,updated_at")
    .maybeSingle();

  if (error || !data) return null;
  return toProfile(data as Record<string, unknown>);
}

/**
 * 전화번호 기준으로 프로필 조회, 없으면 생성 후 반환.
 * 동일 전화번호로 동시 요청 시 중복 생성 가능성 있으므로, 필요 시 애플리케이션 레벨 락/재시도 고려.
 */
export async function findOrCreateCustomerProfile(
  input: CustomerProfileInput,
): Promise<CustomerProfile | null> {
  const existing = await findCustomerProfileByPhone(input.phone);
  if (existing) return existing;
  return createCustomerProfile(input);
}
```

### 3-2. src/lib/travelBookings.ts

```ts
/**
 * 여행 예약/완료 건 생성·조회·상태 업데이트.
 * 후속 PR에서 관리자 UI에서 직접 활용.
 */

import { supabase } from "@/lib/supabase";
import type { TravelBooking, TravelBookingInput, TravelBookingStatus } from "@/types/travelBooking";

function toBooking(row: Record<string, unknown>): TravelBooking {
  return {
    id: String(row.id ?? ""),
    customer_profile_id: String(row.customer_profile_id ?? ""),
    inquiry_id: typeof row.inquiry_id === "string" ? row.inquiry_id : null,
    product_id: typeof row.product_id === "string" ? row.product_id : null,
    product_title: typeof row.product_title === "string" ? row.product_title : null,
    source_path: typeof row.source_path === "string" ? row.source_path : null,
    booking_status: (row.booking_status as TravelBookingStatus) ?? "reserved",
    departure_date: typeof row.departure_date === "string" ? row.departure_date : null,
    return_date: typeof row.return_date === "string" ? row.return_date : null,
    travel_completed_at: typeof row.travel_completed_at === "string" ? row.travel_completed_at : null,
    created_at: String(row.created_at ?? ""),
    updated_at: String(row.updated_at ?? ""),
  };
}

/** 예약 건 생성 */
export async function createTravelBooking(
  input: TravelBookingInput,
): Promise<TravelBooking | null> {
  const payload = {
    customer_profile_id: input.customer_profile_id,
    inquiry_id: input.inquiry_id ?? null,
    product_id: input.product_id ?? null,
    product_title: input.product_title ?? null,
    source_path: input.source_path ?? null,
    booking_status: input.booking_status ?? "reserved",
    departure_date: input.departure_date ?? null,
    return_date: input.return_date ?? null,
    travel_completed_at: input.travel_completed_at ?? null,
    updated_at: new Date().toISOString(),
  };

  const { data, error } = await supabase
    .from("travel_bookings")
    .insert(payload)
    .select("*")
    .maybeSingle();

  if (error || !data) return null;
  return toBooking(data as Record<string, unknown>);
}

/** inquiry_id로 예약 1건 조회 */
export async function getTravelBookingByInquiryId(
  inquiryId: string,
): Promise<TravelBooking | null> {
  const { data, error } = await supabase
    .from("travel_bookings")
    .select("*")
    .eq("inquiry_id", inquiryId)
    .limit(1)
    .maybeSingle();

  if (error || !data) return null;
  return toBooking(data as Record<string, unknown>);
}

/** 예약 상태 업데이트 (booking_status, 필요 시 travel_completed_at) */
export async function updateTravelBookingStatus(
  bookingId: string,
  status: TravelBookingStatus,
  options?: { travel_completed_at?: string | null },
): Promise<boolean> {
  const update: Record<string, unknown> = {
    booking_status: status,
    updated_at: new Date().toISOString(),
  };
  if (options?.travel_completed_at !== undefined) {
    update.travel_completed_at = options.travel_completed_at;
  }

  const { error } = await supabase.from("travel_bookings").update(update).eq("id", bookingId);
  return !error;
}
```

### 3-3. src/lib/reviewEligibilities.ts

```ts
/**
 * 후기 작성 자격(eligibility) 생성·조회.
 * 여행건 기준 생성, 후속 PR에서 회원 claim 플로우 연결.
 * @see docs/PR1-follow-up-todos.md 후속 PR TODO 목록
 */

import { supabase } from "@/lib/supabase";
import type {
  ReviewEligibility,
  ReviewEligibilityInput,
  ReviewEligibilityStatus,
} from "@/types/reviewEligibility";

const STATUS_DEFAULT: ReviewEligibilityStatus = "eligible";

function toEligibility(row: Record<string, unknown>): ReviewEligibility {
  return {
    id: String(row.id ?? ""),
    booking_id: String(row.booking_id ?? ""),
    customer_profile_id: String(row.customer_profile_id ?? ""),
    status: (row.status as ReviewEligibilityStatus) ?? STATUS_DEFAULT,
    review_open_at: String(row.review_open_at ?? ""),
    review_deadline_at: typeof row.review_deadline_at === "string" ? row.review_deadline_at : null,
    claimed_by_member_id: typeof row.claimed_by_member_id === "string" ? row.claimed_by_member_id : null,
    claimed_at: typeof row.claimed_at === "string" ? row.claimed_at : null,
    created_at: String(row.created_at ?? ""),
    updated_at: String(row.updated_at ?? ""),
  };
}

/** 자격 1건 생성. booking_id 유니크 제약으로 중복 생성 시 실패 */
export async function createReviewEligibility(
  input: ReviewEligibilityInput,
): Promise<ReviewEligibility | null> {
  const payload = {
    booking_id: input.booking_id,
    customer_profile_id: input.customer_profile_id,
    status: input.status ?? STATUS_DEFAULT,
    review_open_at: input.review_open_at ?? new Date().toISOString(),
    review_deadline_at: input.review_deadline_at ?? null,
    updated_at: new Date().toISOString(),
  };

  const { data, error } = await supabase
    .from("review_eligibilities")
    .insert(payload)
    .select("*")
    .maybeSingle();

  if (error || !data) return null;
  return toEligibility(data as Record<string, unknown>);
}

/** booking_id로 자격 1건 조회 */
export async function getEligibilityByBookingId(
  bookingId: string,
): Promise<ReviewEligibility | null> {
  const { data, error } = await supabase
    .from("review_eligibilities")
    .select("*")
    .eq("booking_id", bookingId)
    .limit(1)
    .maybeSingle();

  if (error || !data) return null;
  return toEligibility(data as Record<string, unknown>);
}

/**
 * member_id로 자격 목록 조회.
 * 현재는 customer_account_links join 없이 review_eligibilities.claimed_by_member_id 기준만 조회.
 * 후속 PR에서 customer_account_links join으로 확장 가능하도록 함수 시그니처만 유지.
 */
export async function getEligibilitiesByMemberId(
  memberId: string,
): Promise<ReviewEligibility[]> {
  const { data, error } = await supabase
    .from("review_eligibilities")
    .select("*")
    .eq("claimed_by_member_id", memberId)
    .order("created_at", { ascending: false });

  if (error) return [];
  return (data ?? []).map((row) => toEligibility(row as Record<string, unknown>));
}
```

---

## 4. inquiries API 전체

### 4-1. src/app/api/inquiries/route.ts

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

### 4-2. src/app/api/inquiries/[id]/route.ts

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
  if (body.completed_at !== undefined) {
    updatePayload.completed_at = body.completed_at === null || body.completed_at === "" ? null : body.completed_at;
  }

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
    if (errorCode === "42501") {
      return NextResponse.json(
        { message: "inquiries 테이블 UPDATE 권한(RLS 정책)이 없습니다. 정책 SQL을 확인해 주세요." },
        { status: 500 },
      );
    }
    return NextResponse.json({ message: "상담 상태 업데이트에 실패했습니다." }, { status: 500 });
  }

  return NextResponse.json({ message: "상담 상태가 업데이트되었습니다." });
}
```

---

## 5. reviews 관련 코드 전체

### 5-1. src/lib/reviews.ts

```ts
import { supabase } from "@/lib/supabase";
import type { Review } from "@/types/review";

function normalizeReview(row: Record<string, unknown>): Review {
  const imageUrls = Array.isArray(row.image_urls)
    ? row.image_urls.filter((item): item is string => typeof item === "string" && item.length > 0)
    : [];
  const legacyImageUrl = typeof row.image_url === "string" ? row.image_url : undefined;

  return {
    id: String(row.id ?? ""),
    member_id: typeof row.member_id === "string" ? row.member_id : undefined,
    title: String(row.title ?? ""),
    content: String(row.content ?? ""),
    image_url: legacyImageUrl,
    image_urls: imageUrls.length > 0 ? imageUrls : legacyImageUrl ? [legacyImageUrl] : [],
    author_name: String(row.author_name ?? ""),
    created_at: typeof row.created_at === "string" ? row.created_at : undefined,
    rating: typeof row.rating === "number" ? row.rating : undefined,
    eligibility_id: typeof row.eligibility_id === "string" ? row.eligibility_id : undefined,
    booking_id: typeof row.booking_id === "string" ? row.booking_id : undefined,
    customer_profile_id: typeof row.customer_profile_id === "string" ? row.customer_profile_id : undefined,
  };
}

export async function getReviews() {
  const { data, error } = await supabase
    .from("reviews")
    .select("*")
    .order("created_at", { ascending: false, nullsFirst: false });

  if (error) {
    return [] as Review[];
  }
  return (data ?? []).map((row) => normalizeReview(row as Record<string, unknown>));
}

/** 마이페이지용: 특정 회원이 작성한 리뷰만 조회 (member_id 일치) */
export async function getReviewsByMemberId(memberId: string): Promise<Review[]> {
  if (!memberId) return [];
  const { data, error } = await supabase
    .from("reviews")
    .select("*")
    .eq("member_id", memberId)
    .order("created_at", { ascending: false, nullsFirst: false });

  if (error) return [];
  return (data ?? []).map((row) => normalizeReview(row as Record<string, unknown>));
}
```

### 5-2. src/app/api/reviews/route.ts

```ts
import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { supabase } from "@/lib/supabase";
import { getReviews } from "@/lib/reviews";
import { getMemberSessionFromCookies } from "@/lib/memberSession";
import { createNewReviewNotification } from "@/lib/adminNotifications";

type ReviewBody = {
  title?: string;
  content?: string;
  image_url?: string | null;
  image_urls?: string[];
  rating?: number;
};

const MAX_REVIEW_IMAGES = 4;

export async function GET() {
  const reviews = await getReviews();
  return NextResponse.json(reviews);
}

export async function POST(request: Request) {
  const cookieStore = await cookies();
  const session = getMemberSessionFromCookies(cookieStore);
  if (!session) {
    return NextResponse.json({ message: "회원 로그인 후 작성할 수 있습니다." }, { status: 401 });
  }

  const body = (await request.json()) as ReviewBody;
  const title = body.title?.trim() ?? "";
  const content = body.content?.trim() ?? "";
  const rawImageUrls = (Array.isArray(body.image_urls) ? body.image_urls : [])
    .map((url) => String(url).trim())
    .filter((url) => url.length > 0);
  const imageUrls = rawImageUrls.slice(0, MAX_REVIEW_IMAGES);
  const imageUrl = imageUrls[0] ?? body.image_url?.trim() ?? null;
  const rating =
    typeof body.rating === "number" && Number.isFinite(body.rating)
      ? Math.round(body.rating)
      : undefined;

  if (!title || !content) {
    return NextResponse.json({ message: "제목과 내용을 입력해 주세요." }, { status: 400 });
  }
  if (rating !== undefined && (rating < 1 || rating > 5)) {
    return NextResponse.json({ message: "별점은 1점에서 5점 사이로 선택해 주세요." }, { status: 400 });
  }
  if (rawImageUrls.length > MAX_REVIEW_IMAGES) {
    return NextResponse.json(
      { message: `이미지는 최대 ${MAX_REVIEW_IMAGES}장까지 첨부할 수 있습니다.` },
      { status: 400 },
    );
  }
  if (imageUrls.some((url) => url.length > 2000) || (imageUrl && imageUrl.length > 2000)) {
    return NextResponse.json({ message: "이미지 URL이 너무 깁니다." }, { status: 400 });
  }

  const payload = {
    member_id: session.memberId,
    author_name: session.name,
    title,
    content,
    image_url: imageUrl,
    image_urls: imageUrls,
    rating: rating ?? null,
  };

  const insertWithArray = await supabase
    .from("reviews")
    .insert(payload)
    .select("id,title,author_name")
    .maybeSingle();
  if (insertWithArray.error) {
    const insertLegacy = await supabase
      .from("reviews")
      .insert({
        member_id: session.memberId,
        author_name: session.name,
        title,
        content,
        image_url: imageUrl,
      })
      .select("id,title,author_name")
      .maybeSingle();
    if (insertLegacy.error || !insertLegacy.data) {
      return NextResponse.json({ message: "후기 등록에 실패했습니다." }, { status: 500 });
    }
    await createNewReviewNotification({
      reviewId: String(insertLegacy.data.id),
      authorName: String(insertLegacy.data.author_name),
      title: String(insertLegacy.data.title),
    });
    return NextResponse.json({ message: "후기가 등록되었습니다." }, { status: 201 });
  }

  if (insertWithArray.data) {
    await createNewReviewNotification({
      reviewId: String(insertWithArray.data.id),
      authorName: String(insertWithArray.data.author_name),
      title: String(insertWithArray.data.title),
    });
  }

  return NextResponse.json({ message: "후기가 등록되었습니다." }, { status: 201 });
}
```

- **확인 포인트:** POST payload에는 `member_id`, `author_name`, `title`, `content`, `image_url`, `image_urls`, `rating`만 포함. `eligibility_id`, `booking_id`, `customer_profile_id`는 아직 insert하지 않음(기존 리뷰 흐름 유지).

---

## 6. 마이페이지 리뷰 관리 페이지 전체

### 6-1. src/app/mypage/reviews/page.tsx

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

- MOCK_REVIEWS 제거됨.
- 실제 데이터: `getReviewsByMemberId(session.memberId)` 로 현재 사용자(member_id) 기준 필터링.
- empty state: 리뷰 0건일 때 문구 + “여행후기 작성하기” 링크.

---

## 7. PR1 수정 파일 목록

**추가된 파일**

- `supabase/migrations/20260305100000_customer_profiles_and_eligibility.sql`
- `src/types/customerProfile.ts`
- `src/types/travelBooking.ts`
- `src/types/reviewEligibility.ts`
- `src/types/customerAccountLink.ts`
- `src/lib/customerProfiles.ts`
- `src/lib/travelBookings.ts`
- `src/lib/reviewEligibilities.ts`
- `docs/PR1-follow-up-todos.md`
- `docs/PR1-result-summary.md`
- `docs/PR1-implementation-review.md` (본 검토 문서)

**수정된 파일**

- `src/types/inquiry.ts` (customer_profile_id, consultation_status, booking_status, completed_at, is_completed deprecated)
- `src/types/review.ts` (eligibility_id, booking_id, customer_profile_id optional)
- `src/app/api/inquiries/route.ts` (POST findOrCreateCustomerProfile + customer_profile_id, GET/PATCH 확장)
- `src/app/api/inquiries/[id]/route.ts` (PATCH consultation_status, booking_status, completed_at)
- `src/lib/reviews.ts` (normalizeReview 확장, getReviewsByMemberId 추가)
- `src/app/mypage/reviews/page.tsx` (mock 제거, 실제 조회, empty state)

---

## 8. Cursor가 남긴 TODO / 설명

- **docs/PR1-follow-up-todos.md** 에 후속 PR용 필수 TODO 6개 정리됨.
- **src/lib/reviewEligibilities.ts** 상단: `@see docs/PR1-follow-up-todos.md 후속 PR TODO 목록`
- **타입/API** 에서 `@deprecated` (is_completed), “후속 PR: eligibility 기반 확장용” 등 주석 유지.

**후속 TODO 요약 (문서 내용 그대로):**

1. admin 문의 관리 화면에서 consultation_status / booking_status 편집 UI 추가  
2. 예약 확정 시 travel_booking 생성하는 관리자 액션 추가  
3. 여행 완료 시 review_eligibility 생성하는 관리자 액션 추가  
4. 후기 claim 토큰 및 로그인 후 계정 연결 플로우 추가  
5. /reviews/write 를 eligibility 기반 진입 구조로 변경  
6. 마이페이지를 “작성 가능한 후기 / 작성 중 / 작성 완료” 3섹션으로 개편  

---

## 9. 테스트 방법

PR1 기준으로 아래 순서로 확인하면 됩니다.

1. **상담 신청 → inquiries 생성**
   - ConsultModal 또는 /quote 등에서 이름·연락처·내용 입력 후 전송.
   - Supabase `inquiries` 테이블에 1행 추가되는지 확인.

2. **customer_profile 자동 생성**
   - 동일 전화번호로 두 번 문의 시 `customer_profiles` 에는 1건만 있는지 확인 (findOrCreate).

3. **inquiry에 customer_profile_id 연결**
   - 새 문의 저장 후 해당 inquiry 행의 `customer_profile_id` 가 채워져 있는지 확인.

4. **GET /api/inquiries**
   - 응답 items[].customer_profile_id, consultation_status, booking_status, completed_at 존재 여부 확인.

5. **PATCH /api/inquiries (일괄)**
   - body: `{ "ids": ["<id>"], "consultation_status": "contacted" }` 등으로 요청 후 해당 문의의 consultation_status 변경 확인.
   - 기존처럼 `{ "ids": ["<id>"], "is_completed": true }` 도 동작하는지 확인.

6. **PATCH /api/inquiries/[id]**
   - body: `{ "consultation_status": "closed", "booking_status": "completed", "completed_at": "2026-03-05T12:00:00Z" }` 등으로 요청 후 해당 컬럼 반영 확인.

7. **마이페이지 리뷰**
   - 로그인 후 /mypage/reviews 접속 시 해당 회원의 리뷰만 표시되는지, 없을 때 empty state와 “여행후기 작성하기” 링크가 나오는지 확인.

이 문서는 **파일 경로 + 전체 코드(또는 해당 파일 참조)** 기준으로 PR1 구현 결과를 검토할 수 있도록 정리한 것입니다. 실제 수정 여부는 각 파일을 열어 비교하면 됩니다.
