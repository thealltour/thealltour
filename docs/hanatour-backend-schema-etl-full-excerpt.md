# 하나투어 수집기 연동 — 백엔드 DB 스키마 및 ETL 파이프라인 전체 발췌

> **작성일:** 2026-08-20  
> **대상:** `tools/thealltour_hanatour_collector` 수집 JSON → `POST /api/admin/products/import-external` → `public.products`  
> **목적:** 타입·스키마·DDL·비즈니스 로직을 누락 없이 한 문서에 모아 ETL/파서 개발 참조용으로 사용  
> **관련 문서:** [`hanatour-collector-etl-mapping.md`](./hanatour-collector-etl-mapping.md), [`product-schema-and-import-api-excerpt.md`](./product-schema-and-import-api-excerpt.md)

---

## 목차

1. [DB DDL 및 마이그레이션 SQL](#1-db-ddl-및-마이그레이션-sql)
2. [TypeScript 핵심 타입 인터페이스](#2-typescript-핵심-타입-인터페이스)
3. [Zod 유효성 검증 및 AI 스키마](#3-zod-유효성-검증-및-ai-스키마)
4. [ETL 및 데이터 매핑 비즈니스 로직](#4-etl-및-데이터-매핑-비즈니스-로직)
5. [필드별 1:1 매핑 요약표](#5-필드별-11-매핑-요약표)

---

## 1. DB DDL 및 마이그레이션 SQL

### 1.1 `supabase/products_safe_upgrade.sql` — 기본 테이블 DDL

```sql
create extension if not exists "pgcrypto";

create table if not exists public.products (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  description text not null,
  image_url text not null,
  category text not null default '여행상품',
  price integer,
  duration text,
  itinerary text,
  inclusions text,
  is_active boolean not null default true,
  sort_order integer,
  created_at timestamptz not null default now()
);

alter table public.products add column if not exists title text;
alter table public.products add column if not exists description text;
alter table public.products add column if not exists image_url text;
alter table public.products add column if not exists category text;
alter table public.products add column if not exists price integer;
alter table public.products add column if not exists duration text;
alter table public.products add column if not exists itinerary text;
alter table public.products add column if not exists inclusions text;
alter table public.products add column if not exists is_active boolean not null default true;
alter table public.products add column if not exists sort_order integer;
alter table public.products add column if not exists created_at timestamptz not null default now();

update public.products
set category = coalesce(nullif(category, ''), '여행상품')
where category is null or category = '';

alter table public.products alter column title set not null;
alter table public.products alter column description set not null;
alter table public.products alter column image_url set not null;
alter table public.products alter column category set not null;
alter table public.products alter column category set default '여행상품';

create index if not exists idx_products_sort_order on public.products(sort_order);
create index if not exists idx_products_is_active on public.products(is_active);
create index if not exists idx_products_created_at on public.products(created_at desc);
```

### 1.2 `supabase/migrations/20260628100000_departure_schedules_json.sql`

```sql
alter table public.products add column if not exists departure_schedules_json jsonb;

comment on column public.products.departure_schedules_json is
  '출발일별 스케줄 [{ departureDate, returnDate?, price?, label?, status? }]';
```

### 1.3 `supabase/products_itinerary_v2_json.sql`

```sql
-- [STEP 1] 구조화 일정 v2: jsonb 1컬럼 (시각화 최적화)
-- itinerary_v2_json: days[].day, dateText?, title?, coverImageUrl?, events[] (timeOfDay, iconKey, heading, description?, location?, order?)

alter table public.products add column if not exists itinerary_v2_json jsonb;

comment on column public.products.itinerary_v2_json is '구조화 일정 v2. { days: [{ day, dateText?, title?, coverImageUrl?, events: [{ timeOfDay?, iconKey?, heading, description?, location?, order? }] }] }';
```

### 1.4 `supabase/migrations/20260627100000_add_optional_expenses_selling_points.sql`

```sql
-- 선택경비(optional_expenses) 및 상품 핵심안내(selling_points_json) 컬럼 추가
alter table public.products add column if not exists optional_expenses text;
alter table public.products add column if not exists selling_points_json jsonb;

comment on column public.products.optional_expenses is '선택경비 내역 (포함/불포함과 별도)';
comment on column public.products.selling_points_json is '상품 핵심안내 JSON: corePoints, tourism, meals, transport, insurance';
```

### 1.5 `supabase/migrations/20260818183000_products_package_catalog_json.sql`

```sql
-- 하나투어 패키지 카탈로그 (예정 호텔 이름, 관광지, 선택관광, 상품 고유 참고사항)
alter table public.products
  add column if not exists package_catalog_json jsonb;

comment on column public.products.package_catalog_json is
  '하나투어 패키지 카탈로그. { hotels: [{name}], attractions: [{name, description, imageUrls}], optionalTours: [...], referenceNotes? }';
```

### 1.6 `supabase/migrations/20260308170000_normalize_products_core_columns.sql`

```sql
-- =============================================================================
-- Phase 2 PR10-B1: public.products 핵심 컬럼 정합성 보정
-- =============================================================================

do $$
declare
  products_exists boolean;
  has_image_url boolean;
begin
  select exists (
    select 1 from information_schema.tables
    where table_schema = 'public' and table_name = 'products'
  ) into products_exists;

  if not products_exists then
    raise exception 'public.products 테이블이 없습니다. baseline.sql 또는 products_safe_upgrade.sql 적용 후 이 migration을 실행하세요.';
  end if;

  alter table public.products add column if not exists theme text;
  alter table public.products add column if not exists images_json jsonb;
  alter table public.products add column if not exists point_benefits text;
  alter table public.products add column if not exists point_tourism text;
  alter table public.products add column if not exists point_guide text;
  alter table public.products add column if not exists meeting_info text;
  alter table public.products add column if not exists travel_insurance text;
  alter table public.products add column if not exists included_items text;
  alter table public.products add column if not exists excluded_items text;
  alter table public.products add column if not exists detailed_schedule text;
  alter table public.products add column if not exists optional_tours text;
  alter table public.products add column if not exists terms_and_notes text;
  alter table public.products add column if not exists min_departure_people integer;
  alter table public.products add column if not exists product_source_url text;

  select exists (
    select 1 from information_schema.columns
    where table_schema = 'public' and table_name = 'products' and column_name = 'image_url'
  ) into has_image_url;

  if has_image_url then
    update public.products
    set images_json = jsonb_build_array(btrim(image_url))
    where images_json is null
      and image_url is not null
      and btrim(image_url) <> '';
  end if;
end $$;

create index if not exists idx_products_category on public.products(category);
create index if not exists idx_products_theme on public.products(theme) where theme is not null;
```

### 1.7 `supabase/migrations/20260308180000_normalize_products_extended_columns.sql`

```sql
-- =============================================================================
-- Phase 2 PR10-B2: public.products 확장 컬럼 정합성 보정
-- =============================================================================

do $$
declare
  products_exists boolean;
begin
  select exists (
    select 1 from information_schema.tables
    where table_schema = 'public' and table_name = 'products'
  ) into products_exists;

  if not products_exists then
    raise exception 'public.products 테이블이 없습니다. baseline.sql 또는 products_safe_upgrade.sql 적용 후 이 migration을 실행하세요.';
  end if;

  -- 항공편
  alter table public.products add column if not exists departure_from_airport text;
  alter table public.products add column if not exists departure_from_date text;
  alter table public.products add column if not exists departure_from_time text;
  alter table public.products add column if not exists departure_to_airport text;
  alter table public.products add column if not exists departure_to_date text;
  alter table public.products add column if not exists departure_to_time text;
  alter table public.products add column if not exists departure_flight_name text;
  alter table public.products add column if not exists departure_baggage_limit text;
  alter table public.products add column if not exists arrival_from_airport text;
  alter table public.products add column if not exists arrival_from_date text;
  alter table public.products add column if not exists arrival_from_time text;
  alter table public.products add column if not exists arrival_to_airport text;
  alter table public.products add column if not exists arrival_to_date text;
  alter table public.products add column if not exists arrival_to_time text;
  alter table public.products add column if not exists arrival_flight_name text;
  alter table public.products add column if not exists arrival_baggage_limit text;

  -- SEO
  alter table public.products add column if not exists meta_title text;
  alter table public.products add column if not exists meta_description text;

  -- 관리자/카드
  alter table public.products add column if not exists status text;
  alter table public.products add column if not exists options jsonb;
  alter table public.products add column if not exists fuel_included boolean;
  alter table public.products add column if not exists price_meta text;
  alter table public.products add column if not exists meta_info text;
  alter table public.products add column if not exists one_liner text;

  -- overview / itinerary
  alter table public.products add column if not exists overview_json jsonb;
  alter table public.products add column if not exists overview_accommodation text;
  alter table public.products add column if not exists overview_region text;
  alter table public.products add column if not exists overview_duration text;
  alter table public.products add column if not exists itinerary_days_json jsonb;
  alter table public.products add column if not exists itinerary_media_json jsonb;
  alter table public.products add column if not exists itinerary_v2_json jsonb;
  alter table public.products add column if not exists theme_chart_json jsonb;
  alter table public.products add column if not exists overview_cover_url text;
end $$;

create index if not exists idx_products_status on public.products(status) where status is not null;
```

---

## 2. TypeScript 핵심 타입 인터페이스

### 2.1 `src/types/product.ts` (전문)

```typescript
import type { ProductCampaignCardMeta } from "@/types/productCampaignCard";

/** 모두투어 등 계절·주말·성수기 구간가 (KRW 정수). 비어 있으면 필드 생략 또는 null */
export type SeasonalPriceBands = {
  offSeason?: number | null;
  weekend?: number | null;
  peakSeason?: number | null;
};

export type ProductTrust = {
  recentConsultCount?: number;
  recentDays?: number;
  totalInquiries?: number;
  ratingAvg?: number;
  reviewCount?: number;
};

export type ProductOptionItem = {
  value: string;
  label: string;
  priceDelta?: number;
  meta?: string;
  isDefault?: boolean;
};

export type ProductOptionGroup = {
  key: string;
  title: string;
  type: "radio" | "select" | "stepper" | "multi";
  items: ProductOptionItem[];
};

export type ProductOptions = {
  basePrice: number;
  currency: "KRW";
  requiredGroups?: string[];
  groups: ProductOptionGroup[];
};

export type SelectedOptions = Record<string, string | string[]>;

export type OverviewSummaryCardKind =
  | "flight"
  | "hotel"
  | "region"
  | "theme"
  | "golf"
  | "etc";

export type OverviewSummaryCard = {
  kind: OverviewSummaryCardKind;
  label: string;
  value: string;
};

export type OverviewChartItem = { label: string; percent: number };

export type OverviewTimelineDay = {
  day: number;
  dateText?: string;
  headline?: string;
  bullets: string[];
};

export type ItineraryEventImage = {
  url: string;
  alt?: string;
  sortOrder?: number;
  isCover?: boolean;
  status?: "active" | "deleted" | "unassigned";
  isThumbnailCandidate?: boolean;
  isLogoCandidate?: boolean;
  isLowResolution?: boolean;
};

export type ItineraryStructuredEvent = {
  heading: string;
  description?: string;
  timeOfDay?: "오전" | "오후" | "저녁" | "종일";
  iconKey?: string;
  images?: ItineraryEventImage[];
};

export type ItineraryStructuredDay = {
  day: number;
  dateText?: string;
  title?: string;
  coverImageUrl?: string | null;
  events: ItineraryStructuredEvent[];
};

/** [STEP 1] 구조화 일정 v2 (시각화 최적화, jsonb 1컬럼) */
export type ItineraryV2Event = {
  timeOfDay?: "오전" | "오후" | "저녁" | "종일";
  timeText?: string;
  iconKey?: string;
  heading: string;
  description?: string;
  location?: string;
  order?: number;
  displayRole?: "summary" | "activity";
  images?: ItineraryEventImage[];
};

export type ItineraryV2Day = {
  day: number;
  dateText?: string;
  title?: string;
  coverImageUrl?: string;
  coverImages?: ItineraryEventImage[];
  events: ItineraryV2Event[];
};

export type ItineraryV2 = {
  days: ItineraryV2Day[];
};

export type SelectedEventRef =
  | { editorType: "v2"; dayIndex: number; eventIndex: number }
  | { editorType: "structured"; dayIndex: number; eventIndex: number };

export type ProductItineraryDay = {
  day: number;
  title?: string;
  subtitle?: string;
  description?: string;
  meals?: string[];
  hotel?: string;
};

export type ProductSellingPoints = {
  corePoints?: string | null;
  tourism?: string | null;
  meals?: string | null;
  transport?: string | null;
  insurance?: string | null;
};

export type GolfCourseInfoItem = {
  name: string;
  content: string;
};

export type PackageHotelNameItem = { name: string };

export type PackageAttractionItem = {
  name: string;
  description: string;
  imageUrls: string[];
};

export type PackageOptionalTourItem = {
  name: string;
  description: string;
  priceText?: string;
  scheduleText?: string;
  alternativeText?: string;
  included?: boolean;
  imageUrls: string[];
};

export type PackageCatalog = {
  hotels: PackageHotelNameItem[];
  attractions: PackageAttractionItem[];
  optionalTours: PackageOptionalTourItem[];
  referenceNotes?: string;
};

/** 출발일별 스케줄 (departure_schedules_json) */
export type ProductDepartureSchedule = {
  departureDate: string;
  returnDate?: string | null;
  price?: number | null;
  label?: string | null;
  status?: "AVAILABLE" | "LIMITED" | "SOLD_OUT" | null;
};

export type ProductOverview = {
  enabled: boolean;
  title?: string;
  summaryCards: OverviewSummaryCard[];
  coverImageUrl?: string;
  chart?: { enabled: boolean; items: OverviewChartItem[] };
  timeline?: { enabled: boolean; days: OverviewTimelineDay[] };
};

export type Product = {
  id: string;
  title: string;
  description: string;
  golf_course_info?: string | null;
  golf_courses_json?: GolfCourseInfoItem[] | null;
  package_catalog_json?: PackageCatalog | null;
  image_url: string;
  images_json?: string[];
  category: string;
  theme?: string;
  destination_id?: string | null;
  product_line_id?: string | null;
  campaigns?: string[] | null;
  campaigns_json?: string[] | null;
  tags?: string[] | null;
  highlights?: string[] | null;
  price?: number;
  seasonal_price_bands?: SeasonalPriceBands | null;
  duration?: string;
  departure?: string;
  airline?: string;
  hotel?: string;
  travelStyle?: string;
  departures?: string[];
  departureSchedules?: ProductDepartureSchedule[];
  itinerary_days?: ProductItineraryDay[];
  itinerary?: string;
  inclusions?: string;
  point_benefits?: string;
  point_tourism?: string;
  point_guide?: string;
  meeting_info?: string;
  travel_insurance?: string;
  included_items?: string;
  excluded_items?: string;
  detailed_schedule?: string;
  optional_tours?: string;
  optional_expenses?: string;
  selling_points_json?: ProductSellingPoints | null;
  min_departure_people?: string;
  terms_and_notes?: string | null;
  booking_notes?: string | null;
  travel_notes?: string | null;
  booking_conditions?: string | null;
  refund_policy?: string | null;
  product_source_url?: string;
  departure_from_airport?: string;
  departure_from_date?: string;
  departure_from_time?: string;
  departure_to_airport?: string;
  departure_to_date?: string;
  departure_to_time?: string;
  departure_flight_name?: string;
  departure_baggage_limit?: string;
  arrival_from_airport?: string;
  arrival_from_date?: string;
  arrival_from_time?: string;
  arrival_to_airport?: string;
  arrival_to_date?: string;
  arrival_to_time?: string;
  arrival_flight_name?: string;
  arrival_baggage_limit?: string;
  meta_title?: string;
  meta_description?: string;
  is_active?: boolean;
  is_recommend?: boolean;
  is_popular?: boolean;
  sort_order?: number;
  created_at?: string;
  updated_at?: string;
  status?: "AVAILABLE" | "LIMITED" | "SOLD_OUT" | "CONSULT_REQUIRED";
  fuel_included?: boolean;
  price_meta?: string;
  meta_info?: string;
  one_liner?: string;
  overview_json?: ProductOverview | null;
  itinerary_media_json?: Record<string, string> | null;
  itinerary_days_json?: ItineraryStructuredDay[] | null;
  itinerary_v2_json?: ItineraryV2 | null;
  theme_chart_json?: { items: Array<{ label: string; percent: number }> } | null;
  overview_accommodation?: string;
  overview_region?: string;
  overview_duration?: string;
  trust?: ProductTrust;
  options?: ProductOptions;
  campaign_card_meta?: ProductCampaignCardMeta[];
};
```

### 2.2 `src/types/adminProductForm.ts` (전문)

```typescript
import type { ItineraryStructuredDay, ItineraryV2, PackageCatalog } from "@/types/product";

export type TermsTemplateType =
  | "overseas_brokerage"
  | "domestic_brokerage"
  | "overseas_direct"
  | "domestic_direct";

export type NoticeTemplateType = TermsTemplateType;

export type DepartureScheduleFormRow = {
  departureDate: string;
  returnDate: string;
  price: string;
  label: string;
  status: "" | "AVAILABLE" | "LIMITED" | "SOLD_OUT";
};

export function createEmptyDepartureScheduleRow(): DepartureScheduleFormRow {
  return {
    departureDate: "",
    returnDate: "",
    price: "",
    label: "",
    status: "AVAILABLE",
  };
}

export type ProductFormState = {
  title: string;
  description: string;
  golf_course_info: string;
  golf_courses_json: Array<{ name: string; content: string }>;
  package_catalog_json: PackageCatalog;
  product_source_url: string;
  point_benefits: string;
  point_tourism: "O" | "X";
  point_guide: "O" | "X";
  meeting_info: "O" | "X";
  travel_insurance: "O" | "X";
  included_items: string;
  excluded_items: string;
  departure_from_airport: string;
  departure_from_date: string;
  departure_from_time: string;
  departure_to_airport: string;
  departure_to_date: string;
  departure_to_time: string;
  departure_flight_name: string;
  departure_baggage_limit: string;
  arrival_from_airport: string;
  arrival_from_date: string;
  arrival_from_time: string;
  arrival_to_airport: string;
  arrival_to_date: string;
  arrival_to_time: string;
  arrival_flight_name: string;
  arrival_baggage_limit: string;
  detailed_schedule: string;
  optional_tours: string;
  optional_expenses: string;
  selling_core_points: string;
  selling_tourism: string;
  selling_meals: string;
  selling_transport: string;
  selling_insurance: string;
  min_departure_people: string;
  terms_template_type: "" | TermsTemplateType;
  terms_and_notes: string;
  booking_notes: string;
  travel_notes: string;
  booking_conditions: string;
  booking_notes_template_type: "" | NoticeTemplateType;
  travel_notes_template_type: "" | NoticeTemplateType;
  booking_conditions_template_type: "" | NoticeTemplateType;
  refund_policy: string;
  refund_policy_template_type: "" | NoticeTemplateType;
  meta_title: string;
  meta_description: string;
  image_url: string;
  images_json: string[];
  category: string;
  destination_id: string;
  theme: string;
  product_line_id: string;
  campaigns: string;
  price: string;
  seasonal_price_bands: { offSeason: string; weekend: string; peakSeason: string };
  duration: string;
  itinerary: string;
  inclusions: string;
  is_active: boolean;
  sort_order: string;
  status: "" | "AVAILABLE" | "LIMITED" | "SOLD_OUT" | "CONSULT_REQUIRED";
  one_liner: string;
  price_meta: string;
  fuel_included: "" | "true" | "false";
  meta_info: string;
  options_json: string;
  itinerary_media_json: Record<string, string>;
  itinerary_days_json: ItineraryStructuredDay[];
  itinerary_v2_json: ItineraryV2;
  legacy_itinerary_text: string;
  theme_chart_json: Array<{ label: string; percent: number }>;
  overview_accommodation: string;
  overview_region: string;
  overview_duration: string;
  departure_schedules: DepartureScheduleFormRow[];
};

export type ProductFormDraft = {
  version: 1;
  form: ProductFormState;
  savedAt: number;
};

export function mergeProductFormWithSchemaDefaults(
  form: Partial<ProductFormState> | ProductFormState,
): ProductFormState { /* ... */ }

export function createEmptyProductFormState(): ProductFormState { /* ... */ }
```

> `mergeProductFormWithSchemaDefaults`, `createEmptyProductFormState` 구현부는 파일 원본(`src/types/adminProductForm.ts` 144~258행) 참조.

### 2.3 `src/lib/admin/externalImport/itineraryBlockTypes.ts` (전문)

```typescript
export type ItineraryBlockKind = "meal" | "sightseeing" | "move" | "notice" | "other";

export type ItineraryBlockDisplayRole = "summary" | "activity";

export type ItineraryBlock = {
  day?: number;
  dateText?: string;
  dayTitle?: string;
  heading: string;
  description: string;
  imageUrls: string[];
  kind?: ItineraryBlockKind;
  timeText?: string;
  timeOfDay?: "오전" | "오후" | "저녁" | "종일";
  displayRole?: ItineraryBlockDisplayRole;
};

export function isItineraryBlock(value: unknown): value is ItineraryBlock { /* ... */ }

export function normalizeItineraryBlocks(raw: unknown): ItineraryBlock[] { /* ... */ }
```

### 2.4 `src/lib/admin/externalImport/hanatour/types.ts` (전문)

```typescript
export type HanatourCalendarDay = {
  depDay: string;
  depDayNm?: string;
  adtAmt?: string;
  minAmtYn?: string;
  selected?: string;
};

export type HanatourCalendarDataRow = {
  saleProdCd?: string;
  rprsProdCd?: string;
  saleProdNm?: string;
  nrmlAmt?: number;
  adtAmt?: number;
  reserveStatus?: string;
  arrDay?: string;
  depDay?: string;
};

export type HanatourCalendarPayload = {
  prodCode?: string;
  saleProdCd?: string | null;
  rprsProdCd?: string | null;
  depDay?: string | null;
  searchCalendar?: Record<string, HanatourCalendarDay[]>;
  calendarData?: HanatourCalendarDataRow[];
  fetchMeta?: Array<{ yearMonth?: string; ok: boolean; error?: string; source?: string; reason?: string }>;
};

export function normalizeHanatourCalendarPayload(raw: unknown): HanatourCalendarPayload | null { /* ... */ }
```

### 2.5 `src/lib/products/normalizeDepartureSchedules.ts` (전문)

```typescript
import type { ProductDepartureSchedule } from "@/types/product";
import { normalizeProductDepartureDateToYmd } from "@/lib/products/productDepartureDates";

const SCHEDULE_STATUSES = ["AVAILABLE", "LIMITED", "SOLD_OUT"] as const;
type ScheduleStatus = (typeof SCHEDULE_STATUSES)[number];

function parseScheduleStatus(raw: unknown): ScheduleStatus | null { /* ... */ }
function toPositiveInt(value: unknown): number | null { /* ... */ }
function readString(raw: unknown): string | null { /* ... */ }

function normalizeScheduleRow(raw: unknown): ProductDepartureSchedule | null {
  if (!raw || typeof raw !== "object") return null;
  const row = raw as Record<string, unknown>;
  const departureRaw =
    readString(row.departureDate) ??
    readString(row.departure_date) ??
    readString(row.departure);
  if (!departureRaw) return null;
  const departureYmd = normalizeProductDepartureDateToYmd(departureRaw);
  const departureDate = departureYmd ?? departureRaw;
  const returnRaw = readString(row.returnDate) ?? readString(row.return_date);
  const returnYmd = returnRaw ? normalizeProductDepartureDateToYmd(returnRaw) : null;
  const returnDate = returnYmd ?? returnRaw;
  const price = toPositiveInt(row.price);
  const label = readString(row.label);
  const status = parseScheduleStatus(row.status);
  return { departureDate, returnDate: returnDate ?? null, price: price ?? null, label: label ?? null, status };
}

export function normalizeDepartureSchedulesFromUnknown(raw: unknown): ProductDepartureSchedule[] | undefined { /* ... */ }

export function departureSchedulesToJsonColumn(
  schedules: ProductDepartureSchedule[] | null | undefined,
): ProductDepartureSchedule[] | null { /* YMD 정규화 후 jsonb 저장용 배열 반환 */ }

export function deriveDeparturesFromSchedules(schedules: ProductDepartureSchedule[] | undefined): string[] | undefined { /* ... */ }

export function getDepartureSchedulesMinPrice(schedules: ProductDepartureSchedule[] | undefined): number | null { /* ... */ }

export function formatDepartureScheduleChipLabel(schedule: ProductDepartureSchedule): string { /* ... */ }

export function formatDepartureScheduleInquiryValue(schedule: ProductDepartureSchedule): string { /* ... */ }
```

---

## 3. Zod 유효성 검증 및 AI 스키마

### 3.1 `src/lib/admin/externalImport/externalProductMetaSchema.ts` (전문)

```typescript
import { z } from "zod";

const nullableString = z.string().nullable();

const sellingPointsSchema = z
  .object({
    corePoints: nullableString.describe("핵심포인트 본문 (원문 보존)"),
    tourism: nullableString.describe("관광 본문 (원문 보존)"),
    meals: nullableString.describe("식사 본문 (원문 보존)"),
    transport: nullableString.describe("교통 본문 (원문 보존)"),
    insurance: nullableString.describe("보험 본문 (원문 보존)"),
  })
  .nullable()
  .describe("상품 핵심안내 (하나투어 상품안내 탭)");

export const externalProductMetaSchema = z.object({
  title: nullableString.describe("상품명 원문 그대로. [대괄호], 제목 내 #키워드, 공백·특수문자 제거·요약 금지."),
  seo_hashtags: z.array(z.string()).nullable().describe("SEO 검색 키워드 4~8개 (# 없이)."),
  one_liner: nullableString.describe(
    "상세 상단용 한 줄 소개(셀링 카피). 짧은 한국어 문장 1개만. 본문·일정 요지로 추천 작성.",
  ),
  meta_description: nullableString.describe(
    "SEO meta_description. 한국어 1~2문장, 대략 80~160자.",
  ),
  description: nullableString.describe("상품 요약 및 핵심 셀링 포인트"),
  price: z
    .union([z.number(), z.string(), z.null()])
    .transform((v) => {
      if (v === null || v === undefined || v === "") return null;
      if (typeof v === "number") {
        const n = Math.round(v);
        return n > 0 ? n : null;
      }
      const digits = String(v).replace(/[^\d]/g, "");
      if (!digits) return null;
      const n = parseInt(digits, 10);
      return n > 0 ? n : null;
    })
    .nullable()
    .describe("기본 인당 가격 (원화 정수)"),
  duration: nullableString.describe("여행 기간 (예: 3박4일)"),
  theme: nullableString.describe("여행스타일/테마 (예: 관광, 다이닝/미식). 출발지역과 혼용 금지."),
  departure_region: nullableString.describe("출발 지역 (예: 인천, 김포). 여행스타일과 구분."),
  included_items: nullableString.describe("포함내역 전체. [교통] 등 대괄호 카테고리·줄바꿈 유지."),
  excluded_items: nullableString.describe("불포함내역 전체. 불릿·각주 포함 원문 그대로."),
  optional_expenses: nullableString.describe("선택경비 섹션만. [교통] 등 카테고리·줄바꿈 유지."),
  booking_notes: nullableString.describe("예약 유의·비고"),
  status: z.enum(["AVAILABLE", "LIMITED", "SOLD_OUT", "CONSULT_REQUIRED"]).nullable().describe("판매 상태"),
  airline_name: nullableString.describe("항공사명 (예: 제주항공)"),
  departure_flight_number: nullableString.describe("가는편 항공편명 (예: 7C8631)"),
  departure_from_airport: nullableString,
  departure_to_airport: nullableString,
  departure_from_date: nullableString.describe("가는편 출발일 YYYY-MM-DD"),
  departure_from_time: nullableString.describe("가는편 출발 시각 HH:mm"),
  departure_to_date: nullableString.describe("가는편 도착일 YYYY-MM-DD"),
  departure_to_time: nullableString.describe("가는편 도착 시각 HH:mm"),
  departure_duration: nullableString,
  arrival_flight_number: nullableString,
  arrival_from_airport: nullableString,
  arrival_to_airport: nullableString,
  arrival_from_date: nullableString,
  arrival_from_time: nullableString,
  arrival_to_date: nullableString,
  arrival_to_time: nullableString,
  arrival_duration: nullableString,
  departure_time: nullableString.describe("레거시: 가는편 출발 시각"),
  arrival_time: nullableString.describe("레거시: 가는편 도착 시각"),
  selling_points_json: sellingPointsSchema,
});

export type ExternalParsedMeta = z.infer<typeof externalProductMetaSchema>;
```

### 3.2 `src/lib/admin/externalImport/externalProductSchema.ts` (전문)

```typescript
import { z } from "zod";
import { externalProductMetaSchema } from "@/lib/admin/externalImport/externalProductMetaSchema";
import { themeChartJsonSchema } from "@/lib/admin/themeChartSchema";

const timeOfDayEnum = z.enum(["오전", "오후", "저녁", "종일"]);

const externalItineraryEventSchema = z.object({
  heading: z.string().describe("이벤트 제목 (관광지명, 식사, 이동 등)"),
  description: z.string().nullable().describe("이벤트 상세 설명 원문. 요약·생략 금지."),
  timeOfDay: timeOfDayEnum.nullable().describe("시간대"),
  timeText: z.string().nullable().describe("구체 시각 (예: 09:00)"),
  imageUrls: z.array(z.string()).max(8).describe("이 이벤트 HTML 블록에 인접한 <img> src URL만"),
});

const externalItineraryDaySchema = z.object({
  day: z.number().int().positive().describe("HTML 내 'N일차' 마커 기준 일차 번호"),
  dateText: z.string().nullable(),
  title: z.string().nullable(),
  coverImageUrl: z.string().nullable(),
  events: z.array(externalItineraryEventSchema),
});

const externalItineraryV2Schema = z.object({ days: z.array(externalItineraryDaySchema) }).nullable();

export const externalItineraryOnlySchema = z.object({
  itinerary_v2_json: externalItineraryV2Schema,
  theme_chart_json: themeChartJsonSchema.optional(),
});

export const externalProductSchema = externalProductMetaSchema.extend({
  meta_title: z.string().nullable().optional().describe("SEO meta_title (공백 구분 키워드)"),
  itinerary_v2_json: externalItineraryV2Schema.describe("ItineraryV2 구조 일정"),
  theme_chart_json: themeChartJsonSchema,
  image_url: z.string().nullable().describe("대표 이미지 URL"),
  images_json: z.array(z.string()).max(10).nullable().describe("갤러리 이미지 URL 최대 10개"),
});

export type ExternalParsedProduct = z.infer<typeof externalProductSchema>;
export type ExternalParsedItineraryV2 = z.infer<typeof externalItineraryV2Schema>;
export type ExternalParsedItineraryDay = z.infer<typeof externalItineraryDaySchema>;
export type ExternalParsedItineraryEvent = z.infer<typeof externalItineraryEventSchema>;
```

---

## 4. ETL 및 데이터 매핑 비즈니스 로직

### 4.1 `src/app/api/admin/products/import-external/route.ts`

**`ImportExternalBody` 타입**

```typescript
type ImportExternalBody = {
  cleanHtmlStructure?: string;
  productGalleryUrls?: string[];
  heroImageUrl?: string;
  sourceProductTitle?: string;
  seoHashtags?: string[];
  product_source_url?: string;
  /** @deprecated 관리자 수동 폼용 */
  rawHtmlText?: string;
  itineraryBlocks?: unknown[];
  hanatourCalendarPayload?: unknown;
  packageCatalog?: unknown;
  /** @deprecated light 모드는 거부됨. Gemini full 파싱만 허용 */
  importMode?: "light" | "full";
};
```

**POST 핸들러 흐름 (요약)**

```typescript
export const maxDuration = 300;

export async function POST(request: NextRequest) {
  // 1. CORS + requireAdminSession()
  // 2. body 파싱 — cleanHtmlStructure || rawHtmlText 필수
  // 3. product_source_url 중복 검사 (409)
  // 4. normalizeItineraryBlocks(body.itineraryBlocks)
  // 5. normalizeHanatourCalendarPayload(body.hanatourCalendarPayload)
  // 6. normalizePackageCatalog(body.packageCatalog)
  // 7. importMode === "light" 거부
  // 8. hasImportAiKey() 확인
  // 9. parseExternalProductPage({ cleanHtmlStructure, rawHtmlText, itineraryBlocks, ... })
  // 10. mergeExternalImport({ meta, productGalleryUrls, heroImageUrl, sourceProductTitle, seoHashtags, itineraryBlocks, aiItineraryFallback, theme_chart_json })
  // 11. mapExternalParsedToInsert({ parsed, productSourceUrl, provider, sourceProductTitle, seoHashtags, hanatourCalendarPayload, packageCatalog })
  // 12. insertProductWithSchemaFallback(supabaseAdmin.from("products").insert(...))
  // 13. revalidateTag + 201 응답 (parsedSummary, fieldCoverage)
}
```

> 전체 소스: `src/app/api/admin/products/import-external/route.ts` (402행)

### 4.2 `src/lib/admin/externalImport/mapExternalParsedToInsert.ts` (전문)

```typescript
import {
  BAND_IMPORT_DEFAULT_CATEGORY,
  BAND_IMPORT_PLACEHOLDER_IMAGE,
} from "@/lib/admin/bandImport/constants";
import type { ExternalProvider } from "@/lib/admin/externalImport/detectExternalProvider";
import type { ExternalParsedProduct } from "@/lib/admin/externalImport/externalProductSchema";
import type { ItineraryV2 } from "@/types/product";
import {
  countItineraryEvents,
  countItineraryImages,
  mapExternalItineraryToV2,
} from "@/lib/admin/externalImport/mapExternalItineraryToV2";
import { countGalleryUrls } from "@/lib/admin/externalImport/mergeExternalImport";
import { mapHanatourCalendarToImport } from "@/lib/admin/externalImport/hanatour/mapHanatourCalendarToImport";
import type { HanatourCalendarPayload } from "@/lib/admin/externalImport/hanatour/types";
import { sellingPointsToJsonColumn } from "@/lib/products/normalizeSellingPoints";
import { normalizeSeoMetaTitleKeywords } from "@/lib/products/seoMetaTitleAi";
import {
  normalizePackageCatalog,
  optionalToursToPlainText,
} from "@/lib/admin/packageCatalog";
import type { PackageCatalog } from "@/types/product";
import {
  normalizeProductDepartureDateToYmd,
  ymdDayDiff,
} from "@/lib/products/productDepartureDates";
import { trimOrNull } from "@/lib/admin/stringHelpers";
import { normalizeThemeChartForInsert } from "@/lib/admin/themeChartSchema";

export type MapExternalParsedInput = {
  parsed: ExternalParsedProduct;
  productSourceUrl?: string | null;
  provider: ExternalProvider | null;
  sourceProductTitle?: string | null;
  seoHashtags?: string[];
  hanatourCalendarPayload?: HanatourCalendarPayload | null;
  packageCatalog?: PackageCatalog | null;
};

const PROVIDER_DEFAULT_CATEGORY: Record<ExternalProvider, string> = {
  hanatour: "하나투어",
  modetour: "모두투어",
};

export function mapExternalParsedToInsert(input: MapExternalParsedInput): Record<string, unknown> {
  const {
    parsed,
    productSourceUrl,
    provider,
    sourceProductTitle,
    seoHashtags,
    hanatourCalendarPayload,
    packageCatalog,
  } = input;

  const itineraryV2 = resolveItineraryV2(parsed.itinerary_v2_json);
  const { departureSchedules, minPrice: calendarMinPrice } =
    mapHanatourCalendarToImport(hanatourCalendarPayload);

  const productImages = normalizeImageUrls(parsed.images_json);
  const imageUrl =
    trimOrNull(parsed.image_url) ?? productImages[0] ?? BAND_IMPORT_PLACEHOLDER_IMAGE;
  const finalGallery =
    productImages.length > 0
      ? productImages
      : imageUrl !== BAND_IMPORT_PLACEHOLDER_IMAGE
        ? [imageUrl]
        : [];

  const title =
    trimOrNull(sourceProductTitle) ?? trimOrNull(parsed.title) ?? "제목 미정 상품";
  const description = trimOrNull(parsed.description) ?? "상품 설명을 확인해 주세요.";
  const duration = trimOrNull(parsed.duration);
  const category = provider ? PROVIDER_DEFAULT_CATEGORY[provider] : BAND_IMPORT_DEFAULT_CATEGORY;

  const airlineName = trimOrNull(parsed.airline_name);
  const departureFlight = trimOrNull(parsed.departure_flight_number);
  const arrivalFlight = trimOrNull(parsed.arrival_flight_number);

  const sellingPoints = sellingPointsToJsonColumn(parsed.selling_points_json ?? undefined);

  let price = toSafeInteger(parsed.price);
  if (calendarMinPrice != null) {
    price = calendarMinPrice;
  }

  const firstScheduleDate = departureSchedules?.[0]?.departureDate ?? null;
  const hasCalendarSchedules = Boolean(departureSchedules?.length);
  const resolvedDepartureFromDate = hasCalendarSchedules
    ? firstScheduleDate
    : trimOrNull(parsed.departure_from_date) ?? firstScheduleDate;
  const resolvedDepartureToDate = resolveFlightDepartureToDate(parsed, hasCalendarSchedules);

  const catalog = normalizePackageCatalog(packageCatalog);
  const optionalToursFallback = optionalToursToPlainText(catalog);

  return {
    title,
    description,
    image_url: imageUrl,
    images_json: finalGallery.length > 0 ? finalGallery : null,
    category,
    theme: trimOrNull(parsed.theme),
    price,
    duration,
    overview_duration: duration,
    overview_region: trimOrNull(parsed.departure_region),
    included_items: trimOrNull(parsed.included_items),
    excluded_items: trimOrNull(parsed.excluded_items),
    optional_expenses: trimOrNull(parsed.optional_expenses),
    optional_tours: optionalToursFallback,
    selling_points_json: sellingPoints,
    booking_notes: trimOrNull(parsed.booking_notes),
    is_active: true,
    status: parsed.status ?? "AVAILABLE",
    one_liner: trimOrNull(parsed.one_liner),
    meta_title: resolveMetaTitle(parsed, seoHashtags),
    meta_description: trimOrNull(parsed.meta_description),
    meta_info: formatAirlineMetaInfo(airlineName, departureFlight),
    departure_flight_name: departureFlight,
    departure_from_airport: trimOrNull(parsed.departure_from_airport),
    departure_to_airport: trimOrNull(parsed.departure_to_airport),
    departure_from_date: resolvedDepartureFromDate,
    departure_from_time: pickTime(parsed.departure_from_time, parsed.departure_time),
    departure_to_date: resolvedDepartureToDate,
    departure_to_time: pickTime(parsed.departure_to_time, parsed.arrival_time),
    arrival_flight_name: arrivalFlight,
    arrival_from_airport: trimOrNull(parsed.arrival_from_airport),
    arrival_to_airport: trimOrNull(parsed.arrival_to_airport),
    arrival_from_date: trimOrNull(parsed.arrival_from_date),
    arrival_from_time: trimOrNull(parsed.arrival_from_time),
    arrival_to_date: trimOrNull(parsed.arrival_to_date),
    arrival_to_time: trimOrNull(parsed.arrival_to_time),
    itinerary_v2_json: itineraryV2,
    theme_chart_json: normalizeThemeChartForInsert(parsed.theme_chart_json),
    departure_schedules_json: departureSchedules,
    product_source_url: trimOrNull(productSourceUrl ?? undefined),
    package_catalog_json: catalog,
  };
}

export function summarizeExternalParsedForResponse(/* ... */) { /* ... */ }
```

### 4.3 `src/lib/admin/externalImport/mergeExternalImport.ts` (전문)

```typescript
import type { ExternalParsedProduct } from "@/lib/admin/externalImport/externalProductSchema";
import type { ExternalParsedMeta } from "@/lib/admin/externalImport/externalProductMetaSchema";
import type { ItineraryBlock } from "@/lib/admin/externalImport/itineraryBlockTypes";
import { enrichAiItineraryWithBlocks } from "@/lib/admin/externalImport/enrichItineraryWithBlocks";
import { mapExternalItineraryToV2 } from "@/lib/admin/externalImport/mapExternalItineraryToV2";
import { hasRichItineraryBlocks } from "@/lib/admin/externalImport/mapExternalItineraryToV2";
import type { ExternalParsedItineraryV2 } from "@/lib/admin/externalImport/externalProductSchema";
import type { ItineraryV2 } from "@/types/product";
import { normalizeSeoMetaTitleKeywords } from "@/lib/products/seoMetaTitleAi";
import { trimOrNull } from "@/lib/admin/stringHelpers";
import type { ThemeChartJson } from "@/lib/admin/themeChartSchema";

export type MergeExternalImportInput = {
  meta: ExternalParsedMeta;
  productGalleryUrls?: string[];
  heroImageUrl?: string | null;
  sourceProductTitle?: string | null;
  seoHashtags?: string[];
  itineraryBlocks?: ItineraryBlock[];
  aiItineraryFallback?: ExternalParsedItineraryV2 | null;
  theme_chart_json?: ThemeChartJson | null;
};

export function mergeExternalImport(input: MergeExternalImportInput): ExternalParsedProduct {
  const {
    meta,
    productGalleryUrls,
    heroImageUrl,
    sourceProductTitle,
    seoHashtags,
    itineraryBlocks,
    aiItineraryFallback,
    theme_chart_json,
  } = input;

  const gallery = normalizeGalleryUrls(productGalleryUrls, heroImageUrl);

  let itineraryV2: ItineraryV2 | null = null;
  const aiMapped = mapExternalItineraryToV2(aiItineraryFallback);
  if (itineraryBlocks?.length && hasRichItineraryBlocks(itineraryBlocks)) {
    itineraryV2 = enrichAiItineraryWithBlocks(aiItineraryFallback, itineraryBlocks) ?? aiMapped;
  } else if (aiMapped) {
    itineraryV2 = aiMapped;
  }

  const domMetaTitle = normalizeSeoMetaTitleKeywords(seoHashtags);
  const aiMetaTitle = normalizeSeoMetaTitleKeywords(meta.seo_hashtags ?? undefined);

  return {
    ...meta,
    title: trimOrNull(sourceProductTitle) ?? meta.title,
    meta_title: domMetaTitle ?? aiMetaTitle ?? null,
    itinerary_v2_json: itineraryV2 as ExternalParsedProduct["itinerary_v2_json"],
    theme_chart_json: theme_chart_json ?? null,
    image_url: gallery.imageUrl,
    images_json: gallery.imagesJson,
  };
}

export function countGalleryUrls(parsed: ExternalParsedProduct): number {
  return parsed.images_json?.length ?? (parsed.image_url ? 1 : 0);
}
```

### 4.4 `src/lib/admin/externalImport/hanatour/mapHanatourCalendarToImport.ts` (전문)

```typescript
import { transformCalendarData } from "@/lib/admin/externalImport/hanatour/transformCalendarData";
import type { HanatourCalendarPayload } from "@/lib/admin/externalImport/hanatour/types";
import {
  departureSchedulesToJsonColumn,
  getDepartureSchedulesMinPrice,
} from "@/lib/products/normalizeDepartureSchedules";
import type { ProductDepartureSchedule } from "@/types/product";

export type HanatourCalendarImportResult = {
  departureSchedules: ProductDepartureSchedule[] | null;
  minPrice: number | null;
};

export function mapHanatourCalendarToImport(
  payload: HanatourCalendarPayload | null | undefined,
): HanatourCalendarImportResult {
  if (!payload?.searchCalendar && !payload?.calendarData?.length) {
    return { departureSchedules: null, minPrice: null };
  }

  const schedules = transformCalendarData(payload.searchCalendar, payload.calendarData);
  const departureSchedules = departureSchedulesToJsonColumn(schedules);
  const minPrice = getDepartureSchedulesMinPrice(departureSchedules ?? undefined);

  return { departureSchedules, minPrice };
}
```

### 4.5 `src/lib/admin/externalImport/hanatour/transformCalendarData.ts` (전문)

```typescript
import { parseHanatourWonAmount } from "@/lib/admin/externalImport/hanatour/parseHanatourWonAmount";
import type {
  HanatourCalendarDataRow,
  HanatourCalendarDay,
} from "@/lib/admin/externalImport/hanatour/types";
import type { ProductDepartureSchedule } from "@/types/product";

export function depDayToYmd(depDay: string): string | null {
  const match = depDay.trim().match(/^(\d{4})(\d{2})(\d{2})$/);
  if (!match) return null;
  return `${match[1]}-${match[2]}-${match[3]}`;
}

export function mapHanatourReserveStatus(
  reserveStatus: string | undefined,
): ProductDepartureSchedule["status"] {
  if (!reserveStatus) return null;
  if (/마감|품절|취소|불가|매진/i.test(reserveStatus)) return "SOLD_OUT";
  if (/대기|여유|제한/i.test(reserveStatus)) return "LIMITED";
  if (/가능|예약/i.test(reserveStatus)) return "AVAILABLE";
  return null;
}

export function transformCalendarData(
  searchCalendar: Record<string, HanatourCalendarDay[]> | undefined,
  calendarData?: HanatourCalendarDataRow[],
): ProductDepartureSchedule[] {
  const dataByDepDay = new Map<string, HanatourCalendarDataRow>();
  for (const row of calendarData ?? []) {
    if (row.depDay) dataByDepDay.set(row.depDay, row);
  }

  const byDepDay = new Map<string, ProductDepartureSchedule>();

  if (searchCalendar) {
    for (const rows of Object.values(searchCalendar)) {
      if (!Array.isArray(rows)) continue;
      for (const day of rows) {
        const depDay = day.depDay?.trim();
        if (!depDay) continue;

        const departureDate = depDayToYmd(depDay);
        if (!departureDate) continue;

        const enrich = dataByDepDay.get(depDay);
        const price =
          (enrich?.adtAmt != null ? parseHanatourWonAmount(enrich.adtAmt) : null) ??
          parseHanatourWonAmount(day.adtAmt);

        const returnDate = enrich?.arrDay ? depDayToYmd(enrich.arrDay) : null;

        byDepDay.set(depDay, {
          departureDate,
          returnDate,
          price,
          label: day.depDayNm?.trim() || null,
          status: mapHanatourReserveStatus(enrich?.reserveStatus),
        });
      }
    }
  }

  for (const row of calendarData ?? []) {
    const depDay = row.depDay?.trim();
    if (!depDay || byDepDay.has(depDay)) continue;

    const departureDate = depDayToYmd(depDay);
    if (!departureDate) continue;

    byDepDay.set(depDay, {
      departureDate,
      returnDate: row.arrDay ? depDayToYmd(row.arrDay) : null,
      price: parseHanatourWonAmount(row.adtAmt),
      label: null,
      status: mapHanatourReserveStatus(row.reserveStatus),
    });
  }

  return [...byDepDay.values()].sort((a, b) => a.departureDate.localeCompare(b.departureDate));
}
```

---

## 5. 필드별 1:1 매핑 요약표

### 5.1 수집 Payload → DB (import-external 경로)

| 수집 JSON 필드 (Payload) | 중간 가공 타입 (TS/Zod) | 최종 적재 DB 컬럼 (`public.products`) | 변환 규칙 / Null 허용 여부 |
| :--- | :--- | :--- | :--- |
| `cleanHtmlStructure` | *(AI 입력만)* | *(저장 안 함)* | `parseExternalProductPage()` 입력. DB 미저장 |
| `rawHtmlText` | *(AI 입력만)* | *(저장 안 함)* | `cleanHtmlStructure` 없을 때 폴백 입력. DB 미저장 |
| `sourceProductTitle` | `string` | `title` | `trimOrNull(sourceProductTitle) ?? parsed.title`. **NOT NULL** (폴백: "제목 미정 상품") |
| `seoHashtags[]` | `string[]` | `meta_title` | `normalizeSeoMetaTitleKeywords(seoHashtags)` — AI `seo_hashtags`보다 **DOM 우선** |
| `product_source_url` | `string` | `product_source_url` | 중복 시 409. **NULL 허용** |
| `heroImageUrl` | `string` | `image_url`, `images_json[0]` | `mergeExternalImport` 갤러리 첫 항목. 없으면 `productGalleryUrls[0]` → 플레이스홀더 |
| `productGalleryUrls[]` | `string[]` (max 10) | `images_json` | 중복·`data:`·로고 URL 제거. **NULL 허용** (빈 배열이면 null) |
| `itineraryBlocks[]` | `ItineraryBlock[]` | `itinerary_v2_json` | `normalizeItineraryBlocks` → `enrichAiItineraryWithBlocks` (rich blocks) 또는 AI fallback |
| *(AI)* `itinerary_v2_json` | `ExternalParsedItineraryV2` → `ItineraryV2` | `itinerary_v2_json` | `mapExternalItineraryToV2`. blocks 없으면 AI만. **NULL 허용** |
| `hanatourCalendarPayload.searchCalendar` | `Record<string, HanatourCalendarDay[]>` | `departure_schedules_json` | `transformCalendarData` → `depDay` YYYYMMDD→YYYY-MM-DD |
| `hanatourCalendarPayload.calendarData[]` | `HanatourCalendarDataRow[]` | `departure_schedules_json` (보강) | `adtAmt`, `arrDay`, `reserveStatus` 병합 |
| *(파생)* 달력 최저가 | `number` | `price` | `getDepartureSchedulesMinPrice()` — **달력 최저가가 AI price보다 우선** |
| `hanatourCalendarPayload.fetchMeta` | 진단 배열 | *(저장 안 함)* | ETL 품질 게이트용 (서버 로그만) |
| `packageCatalog` | `PackageCatalog` | `package_catalog_json` | `normalizePackageCatalog`. **NULL 허용** |
| `packageCatalog.optionalTours` | `PackageOptionalTourItem[]` | `optional_tours` (text) | `optionalToursToPlainText(catalog)` 폴백 텍스트 |
| *(AI)* `title` | `ExternalParsedMeta.title` | `title` | `sourceProductTitle` 없을 때만 사용 |
| *(AI)* `description` | `ExternalParsedMeta.description` | `description` | **NOT NULL** (폴백: "상품 설명을 확인해 주세요.") |
| *(AI)* `one_liner` | `ExternalParsedMeta.one_liner` | `one_liner` | 상세 상단 한 줄 소개. AI 추천 작성. **NULL 허용** |
| *(AI)* `meta_description` | `ExternalParsedMeta.meta_description` | `meta_description` | SEO 메타 설명. **NULL 허용** |
| *(AI)* `price` | `ExternalParsedMeta.price` (Zod int) | `price` | 달력 `minPrice` 있으면 **무시**. **NULL 허용** |
| *(AI)* `duration` | `ExternalParsedMeta.duration` | `duration`, `overview_duration` | 동일 값 복사. **NULL 허용** |
| *(AI)* `theme` | `ExternalParsedMeta.theme` | `theme` | **NULL 허용** |
| *(AI)* `departure_region` | `ExternalParsedMeta.departure_region` | `overview_region` | **NULL 허용** |
| *(AI)* `included_items` | `ExternalParsedMeta.included_items` | `included_items` | **NULL 허용** |
| *(AI)* `excluded_items` | `ExternalParsedMeta.excluded_items` | `excluded_items` | **NULL 허용** |
| *(AI)* `optional_expenses` | `ExternalParsedMeta.optional_expenses` | `optional_expenses` | **NULL 허용** |
| *(AI)* `selling_points_json` | `ProductSellingPoints` | `selling_points_json` | `sellingPointsToJsonColumn`. **NULL 허용** |
| *(AI)* `booking_notes` | `ExternalParsedMeta.booking_notes` | `booking_notes` | **NULL 허용** |
| *(AI)* `status` | `enum` | `status` | 기본값 `"AVAILABLE"` |
| *(AI)* `airline_name` + `departure_flight_number` | `string` | `meta_info` | `"항공사 항공편"` 결합. **NULL 허용** |
| *(AI)* `departure_flight_number` | `string` | `departure_flight_name` | **NULL 허용** |
| *(AI)* `departure_from_airport` | `string` | `departure_from_airport` | **NULL 허용** |
| *(AI)* `departure_to_airport` | `string` | `departure_to_airport` | **NULL 허용** |
| *(AI)* `departure_from_date` | `string` | `departure_from_date` | 달력 있으면 **첫 출발일**로 대체 |
| *(AI)* `departure_from_time` / `departure_time` | `string` | `departure_from_time` | legacy `departure_time` 폴백 |
| *(AI)* `departure_to_date` | `string` | `departure_to_date` | 달력+항공 날짜 불일치 시 null 처리 (`resolveFlightDepartureToDate`) |
| *(AI)* `departure_to_time` / `arrival_time` | `string` | `departure_to_time` | legacy 폴백 |
| *(AI)* `arrival_flight_number` | `string` | `arrival_flight_name` | **NULL 허용** |
| *(AI)* `arrival_from_*` / `arrival_to_*` | `string` | `arrival_*` 컬럼 6개 | **NULL 허용** |
| *(AI)* `theme_chart_json` | `ThemeChartJson` | `theme_chart_json` | `normalizeThemeChartForInsert`. **NULL 허용** |
| *(AI)* `image_url` / `images_json` | `string` / `string[]` | `image_url`, `images_json` | DOM 갤러리(`mergeExternalImport`)와 병합 후 최종 결정 |
| *(고정)* provider=`hanatour` | `ExternalProvider` | `category` | `"하나투어"` 고정 |
| *(고정)* | — | `is_active` | `true` |

### 5.2 `departure_schedules_json` 원소 스키마

| 필드 | 타입 | 변환 | Null |
| :--- | :--- | :--- | :--- |
| `departureDate` | `string` | `depDay` `20260801` → `2026-08-01` | **필수** |
| `returnDate` | `string \| null` | `arrDay` YMD 변환 | NULL 허용 |
| `price` | `number \| null` | `parseHanatourWonAmount(adtAmt)` | NULL 허용 |
| `label` | `string \| null` | `depDayNm` | NULL 허용 |
| `status` | `AVAILABLE \| LIMITED \| SOLD_OUT \| null` | `mapHanatourReserveStatus(reserveStatus)` | NULL 허용 |

### 5.3 ETL 파이프라인 순서 (참고)

```
수집기 background.js
  → POST /api/admin/products/import-external (ImportExternalBody)
    → normalizeItineraryBlocks / normalizeHanatourCalendarPayload / normalizePackageCatalog
    → parseExternalProductPage (Gemini → externalProductMetaSchema + itinerary)
    → mergeExternalImport (DOM 갤러리·blocks·SEO 병합)
    → mapExternalParsedToImport (DB insert row)
    → supabaseAdmin.from("products").insert(...)
```

---

## 부록: import-external INSERT 컬럼 목록

`mapExternalParsedToInsert`가 반환하는 키 (2026-08-21 기준):

`title`, `description`, `image_url`, `images_json`, `category`, `theme`, `price`, `duration`, `overview_duration`, `overview_region`, `included_items`, `excluded_items`, `optional_expenses`, `optional_tours`, `selling_points_json`, `booking_notes`, `is_active`, `status`, `one_liner`, `meta_title`, `meta_description`, `meta_info`, `departure_flight_name`, `departure_from_airport`, `departure_to_airport`, `departure_from_date`, `departure_from_time`, `departure_to_date`, `departure_to_time`, `arrival_flight_name`, `arrival_from_airport`, `arrival_to_airport`, `arrival_from_date`, `arrival_from_time`, `arrival_to_date`, `arrival_to_time`, `itinerary_v2_json`, `theme_chart_json`, `departure_schedules_json`, `product_source_url`, `package_catalog_json`

> DB에 컬럼이 없으면 `insertProductWithSchemaFallback`이 해당 키를 제거하고 재시도합니다 (`20260627100000` 등 migration 미적용 시 경고 로그).
