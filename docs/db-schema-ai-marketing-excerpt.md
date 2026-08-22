# AI Marketing Department 설계용 DB 스키마 발췌

> **작성일:** 2026-08-22  
> **기준:** 현재 저장소의 실제 DB 정의 (`supabase/schema/baseline.sql`, `supabase/*.sql`, `supabase/migrations/*.sql`)  
> **목적:** AI Marketing Department의 DB / Context / Retrieval / Content Governance / Hermes Bot 설계 입력  
> **제한:** 존재하지 않는 모델·필드·관계를 추가하지 않음. 스키마만으로 의미가 확정되지 않으면 `확인 필요`

## 전제: `schema.prisma`는 존재하지 않음

이 프로젝트에는 **`prisma/schema.prisma` 파일이 없습니다.**  
ORM은 Prisma가 아니라 **Supabase (PostgreSQL)**. 앱이 기대하는 최종 스키마 제안본은 `supabase/schema/baseline.sql`이며, `public.products` 등은 README가 명시한 대로 **baseline에 최소 컬럼만** 있고 실제 컬럼은 루트 SQL·migration으로 확장됩니다.

요청문의 Prisma `model` 형식 대신, **실제 `CREATE TABLE` / `ALTER TABLE`에서 확인된 컬럼을 합친 재구성 DDL**을 사용합니다.  
합친 `CREATE TABLE` 문장 자체는 repo에 단일 파일로 존재하지 않으며, **나열된 컬럼·타입·제약·FK는 각 SQL 파일에 실제로 존재합니다.**

민감정보(비밀번호 해시, 액세스 토큰 값, `.env`)는 수록하지 않습니다. 해당 컬럼이 스키마에 있다는 사실만 표시합니다.

---

## 1. AI Marketing 관련 Prisma 모델

요청 형식의 섹션명입니다. 아래는 **PostgreSQL 테이블**입니다.

요청 목록과 실제 테이블 대응:

| 요청 개념 | 실제 테이블 | 비고 |
|---|---|---|
| Product | `public.products` | 옵션·일정·가격이 **별도 테이블이 아니라 JSON/컬럼** |
| ProductOption | *(없음)* | `products.options jsonb` |
| Schedule | *(없음)* | `products.departure_schedules_json`, `itinerary_*` |
| Price | *(없음)* | `products.price`, `seasonal_price_bands`, `departure_schedules_json[].price` |
| Category / Tag | `public.product_taxonomies` | `taxonomy_type`: destination / theme / product_line / campaign / tag |
| Customer | `public.customer_profiles`, `public.members` | 문의 고객과 회원 계정이 분리 |
| Inquiry | `public.inquiries` | 상담·유입 속성·담당자 필드 포함 |
| Booking / Order | `public.travel_bookings` | 주문 테이블명은 `orders`가 아님 |
| Content / Post | *(전용 테이블 없음)* | `notices`, `guides`, `flyer_drafts`, `thread_marketing_posts`, `home_hero_content`, `home_banners`, `mobile_golf_ad_landings` |
| Media | *(전용 테이블 없음)* | URL 컬럼 / jsonb 배열. Storage 버킷은 테이블이 아님 |
| Review | `public.reviews` | **`product_id` FK 없음** |
| User | `public.members`, `public.admin_users` | |
| Campaign | *(전용 테이블 없음)* | `products.campaigns_json`, `product_taxonomies.taxonomy_type='campaign'`, `kakao_moment_creatives.campaign_*` |

### 1.1 `public.products` (여행상품)

소스: `supabase/products_safe_upgrade.sql`, `supabase/schema/baseline.sql`, `supabase/migrations/20260308170000_normalize_products_core_columns.sql`, `20260308180000_normalize_products_extended_columns.sql`, `20260319000000_products_taxonomy_axes.sql`, `20260407120000_products_seasonal_price_bands.sql`, `20260408120000_add_product_notice_fields.sql`, `20260409120000_products_notice_template_types.sql`, `20260411120000_add_refund_policy.sql`, `20260627100000_add_optional_expenses_selling_points.sql`, `20260628100000_departure_schedules_json.sql`, `20260818010000_products_golf_course_info.sql`, `20260818163000_products_golf_courses_json.sql`, `20260818183000_products_package_catalog_json.sql` 및 루트 `products_*.sql`

```sql
-- 재구성: 아래 컬럼은 각 SQL에 존재. 이 CREATE TABLE 문은 문서용 합본.

create table if not exists public.products (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  description text not null,
  image_url text not null,
  category text not null default '여행상품',  -- legacy. destination_id/product_line_id 비어 있을 때 fallback
  theme text,                                  -- legacy. 테마 이름 토큰 문자열
  destination_id uuid references public.product_taxonomies(id) on delete set null,
  product_line_id uuid references public.product_taxonomies(id) on delete set null,
  campaigns_json jsonb,                        -- 기획/강조. 문자열 배열 또는 uuid 배열. taxonomy_type=campaign
  tags_json jsonb,                             -- 태그 이름 배열
  price integer,
  seasonal_price_bands jsonb,                  -- { offSeason?, weekend?, peakSeason? }
  duration text,
  itinerary text,
  inclusions text,
  is_active boolean not null default true,
  sort_order integer,
  created_at timestamptz not null default now(),
  status text,                                 -- comment: AVAILABLE|LIMITED|SOLD_OUT|CONSULT_REQUIRED, null이면 프론트에서 AVAILABLE. CHECK 제약 없음
  options jsonb,
  fuel_included boolean,
  price_meta text,
  meta_info text,
  one_liner text,
  meta_title text,
  meta_description text,
  product_source_url text,
  min_departure_people integer,

  -- 상품 본문/특징
  point_benefits text,
  point_tourism text,
  point_guide text,
  meeting_info text,
  travel_insurance text,
  included_items text,
  excluded_items text,
  detailed_schedule text,
  optional_tours text,
  optional_expenses text,
  selling_points_json jsonb,                   -- comment: corePoints, tourism, meals, transport, insurance
  golf_course_info text,
  golf_courses_json jsonb,                     -- [{ name, content }]
  package_catalog_json jsonb,                  -- { hotels, attractions, optionalTours, referenceNotes? }

  -- 일정/스케줄 (별도 Schedule 테이블 없음)
  departure_schedules_json jsonb,              -- [{ departureDate, returnDate?, price?, label?, status? }]
  itinerary_days_json jsonb,
  itinerary_media_json jsonb,
  itinerary_v2_json jsonb,
  theme_chart_json jsonb,

  -- 오버뷰
  overview_json jsonb,
  overview_cover_url text,
  overview_accommodation text,
  overview_region text,
  overview_duration text,

  -- 이미지 (별도 Media 테이블 없음)
  images_json jsonb,

  -- 항공
  departure_from_airport text,
  departure_from_date text,
  departure_from_time text,
  departure_to_airport text,
  departure_to_date text,
  departure_to_time text,
  departure_flight_name text,
  departure_baggage_limit text,
  arrival_from_airport text,
  arrival_from_date text,
  arrival_from_time text,
  arrival_to_airport text,
  arrival_to_date text,
  arrival_to_time text,
  arrival_flight_name text,
  arrival_baggage_limit text,

  -- 약관/안내 (템플릿 키는 product_terms_templates / product_notice_templates와 이름만 연결)
  terms_and_notes text,
  terms_template_type text,
  booking_notes text,
  travel_notes text,
  booking_conditions text,
  refund_policy text,
  refund_policy_template_type text,
  booking_notes_template_type text,
  travel_notes_template_type text,
  booking_conditions_template_type text
);

create index if not exists idx_products_sort_order on public.products(sort_order);
create index if not exists idx_products_is_active on public.products(is_active);
create index if not exists idx_products_created_at on public.products(created_at desc);
create index if not exists idx_products_category on public.products(category);
create index if not exists idx_products_theme on public.products(theme) where theme is not null;
create index if not exists idx_products_status on public.products(status) where status is not null;
create index if not exists idx_products_destination_id on public.products(destination_id) where destination_id is not null;
create index if not exists idx_products_product_line_id on public.products(product_line_id) where product_line_id is not null;
```

앱 TypeScript(`src/types/product.ts`)에는 `is_recommend`, `is_popular`, `highlights`, `updated_at`가 있으나, **SQL에서 해당 컬럼 추가를 확인하지 못함** → 섹션 5.

### 1.2 `public.product_taxonomies` (카테고리/테마/캠페인/태그)

소스: `supabase/product_taxonomies.sql`, `supabase/schema/baseline.sql`, `supabase/migrations/20260316000000_pr1_hub_landing_taxonomy.sql`, `20260318000000_add_taxonomy_type.sql`, `20260320000000_product_taxonomies_parent_id.sql`, `20260321000000_product_taxonomies_card_meta.sql`, `20260325000000_product_taxonomies_campaign_cms.sql`

```sql
create table if not exists public.product_taxonomies (
  id uuid primary key default gen_random_uuid(),
  type text not null check (type in ('category', 'theme')),  -- deprecated. taxonomy_type 사용
  name text not null,
  slug text,
  is_active boolean not null default true,
  sort_order integer,
  created_at timestamptz not null default now(),
  unique (type, name),

  taxonomy_type text not null default 'destination',
  -- comment: destination | theme | product_line | campaign | tag. CHECK 제약은 SQL에 없음
  parent_id uuid references public.product_taxonomies(id) on delete set null,
  category_type text default 'other',  -- deprecated. destination | product_line | highlight | other
  is_hub_visible boolean not null default true,
  is_landing_enabled boolean not null default false,

  card_title text,
  card_description text,
  card_image_url text,
  landing_title text,
  landing_description text,
  hero_image_url text,
  seo_title text,
  seo_description text,

  display_label text,
  badge_priority integer not null default 100,
  badge_visible boolean not null default true,
  badge_tone text not null default 'neutral',  -- comment: primary | highlight | neutral. CHECK 없음
  badge_description text
);

create unique index idx_product_taxonomies_taxonomy_type_slug_unique
  on public.product_taxonomies (taxonomy_type, slug)
  where slug is not null and trim(slug) != '';

create unique index idx_product_taxonomies_type_slug_unique
  on public.product_taxonomies (type, slug)
  where slug is not null and trim(slug) != '';
```

### 1.3 `public.product_terms_templates` / `public.product_notice_templates`

소스: `supabase/schema/baseline.sql`, `supabase/products_terms_templates_upgrade.sql`

```sql
create table if not exists public.product_terms_templates (
  type text primary key,
  content text not null default '',
  updated_at timestamptz not null default now()
);

create table if not exists public.product_notice_templates (
  id uuid primary key default gen_random_uuid(),
  template_group text not null,
  type text not null,
  label text,
  content text,
  sort_order integer not null default 0,
  updated_at timestamptz not null default now(),
  constraint product_notice_templates_group_chk check (
    template_group in (
      'booking_notes',
      'travel_notes',
      'booking_conditions',
      'refund_policy',
      'legacy'
    )
  ),
  constraint product_notice_templates_type_nonempty check (char_length(trim(type)) > 0),
  constraint product_notice_templates_unique_group_type unique (template_group, type)
);
```

`products.*_template_type` → 이 테이블의 `type`을 가리키는 **이름 기반 참조**. SQL FK는 없음.

### 1.4 `public.customer_profiles` / `public.customer_account_links`

소스: `supabase/migrations/20260305100000_customer_profiles_and_eligibility.sql`, `supabase/schema/baseline.sql`

```sql
create table if not exists public.customer_profiles (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  phone text not null,
  email text,
  source text not null default 'inquiry',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.customer_account_links (
  id uuid primary key default gen_random_uuid(),
  customer_profile_id uuid not null references public.customer_profiles(id) on delete cascade,
  member_id text not null,                     -- members.id와 타입 불일치 가능 (text vs uuid). 확인 필요
  linked_by text not null default 'self',
  verified_method text not null default 'manual',
  verified_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  unique(customer_profile_id, member_id)
);
```

### 1.5 `public.members` (회원 / User)

소스: `supabase/members.sql`, `supabase/schema/baseline.sql`, `supabase/migrations/20250304000000_points_rewards_v2.sql`, `20260724120000_members_kakao_channel_added.sql`

```sql
create table if not exists public.members (
  id uuid primary key default gen_random_uuid(),
  username text not null unique,
  name text not null,
  password_hash text not null,                 -- 민감정보. 값 미수록
  password_salt text not null,                 -- 민감정보. 값 미수록
  phone text not null,
  email text not null,
  birth_date date not null,
  gender text not null check (gender in ('male', 'female', 'other')),
  agree_terms boolean not null default false,
  agree_privacy boolean not null default false,
  agree_email boolean not null default false,
  points integer not null default 0,
  point_balance integer not null default 0,
  point_pending integer not null default 0,
  grade_id uuid,
  marketing_opt_in boolean not null default false,
  kakao_channel_added boolean,                 -- true=추가됨, false=미추가/차단, null=미확인
  created_at timestamptz not null default now()
);
```

### 1.6 `public.admin_users`

소스: `supabase/migrations/20260611100000_admin_users.sql`

```sql
create table if not exists public.admin_users (
  id uuid primary key default gen_random_uuid(),
  username text not null unique,
  display_name text,
  password_hash text not null,                 -- 민감정보. 값 미수록
  password_salt text not null,                 -- 민감정보. 값 미수록
  role_preset text not null default 'custom',
  permissions text[] not null default '{}',
  is_active boolean not null default true,
  last_login_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
```

`inquiries.assignee_id`와 FK로 연결돼 있지는 않음.

### 1.7 `public.inquiries` 및 상담 위성 테이블

소스: `supabase/inquiries.sql`, `supabase/inquiries_product_source_upgrade.sql`, `supabase/schema/baseline.sql`, `supabase/migrations/20260305100000_customer_profiles_and_eligibility.sql`, `20260318120000_add_first_touch.sql`, `20260318120100_add_inquiry_attribution_fields.sql`, `20260419120000_add_inquiry_assignment_followup_and_logs.sql`, `20260610100000_inquiries_member_id.sql`, `20260420120000_create_inquiry_message_logs.sql`, `20260612100000_inquiry_inbound_sms.sql`

```sql
create table if not exists public.inquiries (
  id uuid primary key default gen_random_uuid(),  -- 일부 환경은 legacy bigint. 확인 필요
  name text not null,
  phone text not null,
  content text not null,
  is_completed boolean not null default false,
  created_at timestamptz not null default now(),

  customer_profile_id uuid references public.customer_profiles(id) on delete set null,
  member_id uuid references public.members(id) on delete set null,
  consultation_status text not null default 'new'
    check (consultation_status in ('new', 'contacted', 'closed', 'on_hold')),
  booking_status text not null default 'none'
    check (booking_status in ('none', 'reserved', 'completed', 'canceled')),
  completed_at timestamptz,

  product_id text,                               -- products.id uuid와 타입 불일치. FK 없음
  product_title text,
  source_path text,

  first_touch jsonb,
  inquiry_page_url text,
  acquisition_channel text,
  acquisition_source_label text,
  acquisition_medium text,
  acquisition_summary text,
  first_landing_path text,

  assignee_id uuid,                              -- FK 없음
  assignee_name text,
  lead_priority text check (lead_priority is null or lead_priority in ('high', 'medium', 'low')),
  next_action text,
  follow_up_at timestamptz,
  last_contacted_at timestamptz,
  last_activity_at timestamptz
);

create table if not exists public.inquiry_activity_logs (
  id uuid primary key default gen_random_uuid(),
  inquiry_id uuid not null references public.inquiries(id) on delete cascade,
  activity_type text not null,
  actor_id uuid null,
  actor_name text null,
  summary text not null,
  metadata jsonb null,
  created_at timestamptz not null default now()
);

create table if not exists public.inquiry_message_logs (
  id uuid primary key default gen_random_uuid(),
  inquiry_id uuid references public.inquiries(id) on delete cascade,  -- 이후 nullable로 변경됨
  channel text not null default 'sms',
  recipient_phone text not null,
  message text not null,
  provider text not null default 'aligo_relay',
  send_status text not null check (send_status in ('success', 'failed')),
  provider_response jsonb null,
  failure_reason text null,
  actor_name text null,
  created_at timestamptz not null default now()
);

create table if not exists public.inquiry_inbound_sms (
  id uuid primary key default gen_random_uuid(),
  provider text not null default 'textbee',
  provider_message_id text not null unique,
  sender_phone text not null,
  message text not null,
  received_at timestamptz not null,
  inquiry_id uuid null references public.inquiries(id) on delete set null,
  match_status text not null check (match_status in ('matched', 'unmatched', 'manual_linked')),
  match_reason text null,
  read_at timestamptz null,
  raw_payload jsonb null,
  created_at timestamptz not null default now()
);
```

### 1.8 `public.travel_bookings` / `booking_travelers` / `booking_payments`

소스: `supabase/migrations/20260305100000_customer_profiles_and_eligibility.sql`, `supabase/schema/baseline.sql`, `supabase/migrations/20260620100000_travel_bookings_unified.sql`

```sql
create table if not exists public.travel_bookings (
  id uuid primary key default gen_random_uuid(),
  customer_profile_id uuid not null references public.customer_profiles(id) on delete cascade,
  inquiry_id uuid references public.inquiries(id) on delete set null,
  product_id text,                               -- FK 없음
  product_title text,
  source_path text,
  booking_status text not null default 'reserved'
    check (booking_status in ('reserved', 'completed', 'canceled')),
  departure_date date,
  return_date date,
  travel_completed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),

  booking_number text not null unique,
  traveler_count integer not null check (traveler_count >= 1),
  payer_name text,
  primary_traveler_phone text,
  payment_status text default 'unpaid'
    check (payment_status in ('unpaid', 'partial', 'paid', 'refunded')),
  payment_method text,
  payment_total_amount integer,
  payment_paid_amount integer default 0,
  payment_confirmed_at timestamptz,
  payment_external_id text,
  member_id uuid references public.members(id) on delete set null,
  confirmed_at timestamptz,
  confirmed_by_admin_id text,
  booking_confirmed_sms_sent_at timestamptz,
  trip_completed_sms_sent_at timestamptz,
  shipping_name text,
  shipping_phone text,
  shipping_zip text,
  shipping_address1 text,
  shipping_address2 text
);

create table if not exists public.booking_travelers (
  id uuid primary key default gen_random_uuid(),
  booking_id uuid not null references public.travel_bookings(id) on delete cascade,
  sort_order integer not null default 1 check (sort_order >= 1),
  full_name text not null default '',
  phone text,
  email text,
  passport_number text,
  passport_expiry date,
  birth_date date,
  gender text,
  nationality text,
  is_primary boolean not null default false,
  is_payer boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.booking_payments (
  id uuid primary key default gen_random_uuid(),
  booking_id uuid not null references public.travel_bookings(id) on delete cascade,
  amount integer not null check (amount > 0),
  method text not null default 'transfer',
  status text not null default 'recorded'
    check (status in ('recorded', 'pending', 'confirmed', 'failed', 'refunded')),
  external_provider text,
  external_payment_id text,
  recorded_by text,
  admin_memo text,
  recorded_at timestamptz not null default now(),
  created_at timestamptz not null default now()
);
```

### 1.9 `public.reviews` 및 리뷰 위성

소스: `supabase/reviews.sql`, `supabase/schema/baseline.sql`, `supabase/migrations/20260308120000_reconcile_reviews_columns.sql`, `20260310100000_review_moderation_columns.sql`, `20260308200000_review_votes.sql`, `20260308210000_review_reports.sql`, `20260309110000_product_review_summaries.sql`

```sql
create table if not exists public.review_eligibilities (
  id uuid primary key default gen_random_uuid(),
  booking_id uuid not null references public.travel_bookings(id) on delete cascade,
  customer_profile_id uuid not null references public.customer_profiles(id) on delete cascade,
  status text not null default 'eligible'
    check (status in ('eligible', 'claimed', 'submitted', 'expired', 'blocked')),
  review_open_at timestamptz not null default now(),
  review_deadline_at timestamptz,
  claimed_by_member_id text,
  claimed_at timestamptz,
  claim_token text,
  claim_token_expires_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique(booking_id)
);

create table if not exists public.reviews (
  id uuid primary key default gen_random_uuid(),
  member_id uuid not null references public.members(id) on delete cascade,
  author_name text not null,
  title text not null,
  content text not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  image_url text,
  image_urls text[] default '{}',
  rating integer,
  status text not null default 'submitted'
    check (status in ('draft', 'submitted', 'hidden')),
  -- 앱 comment: under_review, flagged 값도 저장할 수 있음. CHECK와 앱 사용이 다를 수 있음 → 확인 필요
  eligibility_id uuid references public.review_eligibilities(id) on delete set null,
  booking_id uuid references public.travel_bookings(id) on delete set null,
  customer_profile_id uuid references public.customer_profiles(id) on delete set null,
  summary text,
  content_good text,
  content_bad text,
  content_tip text,
  rating_schedule integer,
  rating_stay integer,
  rating_guide integer,
  rating_food integer,
  report_count integer not null default 0,
  last_moderated_at timestamptz,
  moderation_reason text
);

-- reviews에는 product_id 컬럼이 없음. 상품 연결은 booking_id → travel_bookings.product_id (text) 경로.

create table if not exists public.review_votes (
  id uuid primary key default gen_random_uuid(),
  review_id uuid not null references public.reviews(id) on delete cascade,
  member_id text not null,
  vote_type text not null default 'helpful',
  created_at timestamptz not null default now(),
  unique(review_id, member_id)
);

create table if not exists public.review_reports (
  id uuid primary key default gen_random_uuid(),
  review_id uuid not null references public.reviews(id) on delete cascade,
  member_id text not null,
  reason text not null,
  created_at timestamptz not null default now(),
  status text not null default 'pending',       -- comment: pending / resolved / dismissed. CHECK 없음
  unique(review_id, member_id)
);

create table if not exists public.product_review_summaries (
  id uuid primary key default gen_random_uuid(),
  product_id text not null,                     -- FK 없음
  review_count integer not null default 0,
  average_rating numeric(3,2),
  summary_text text,
  positive_points jsonb,
  negative_points jsonb,
  recommended_for jsonb,
  generated_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  source_review_ids jsonb,
  status text not null default 'ready' check (status in ('ready', 'stale', 'failed'))
);
```

### 1.10 콘텐츠 / 게시물 계열 (Content·Post 전용 테이블 없음)

#### `public.notices`

소스: `supabase/notices.sql`

```sql
create table if not exists public.notices (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  content text not null,
  is_published boolean not null default true,
  sort_order integer,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
```

#### `public.guides`

소스: `supabase/guides.sql`, `supabase/guides_notion_upgrade.sql`, `supabase/guides_pdf_fields.sql`, `supabase/guides_seo_fields.sql`

```sql
create table if not exists public.guides (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  summary text,
  thumbnail_url text,
  landing_url text,
  is_published boolean not null default true,
  sort_order integer,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  slug text unique,
  notion_page_id text unique,
  notion_url text,
  title_override text,
  cover_image_url text,
  tags text[],
  category text,
  published_at timestamptz,
  notion_last_edited_time timestamptz,
  last_synced_at timestamptz,
  guide_pdf_url text,
  guide_thumbnail_url text,
  seo_title text,
  seo_description text,
  focus_keyword text
);
```

#### `public.home_hero_content` / `public.home_banners`

소스: `supabase/home_hero_content.sql`, `supabase/home_banners.sql`

```sql
create table if not exists public.home_hero_content (
  id uuid primary key default gen_random_uuid(),
  badge text,
  main_copy_accent text,
  main_copy_tail text,
  sub_description text,
  bullet_1 text,
  bullet_2 text,
  bullet_3 text,
  recommended_text text,
  search_placeholder text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.home_banners (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  image_url text not null,
  mobile_image_url text,
  link_url text,
  sort_order integer,
  is_active boolean not null default true,
  created_at timestamptz not null default now()
);
```

#### `public.home_curated_*`

소스: `supabase/home_curated.sql`, `supabase/schema/baseline.sql`, `supabase/migrations/20260316000000_pr1_hub_landing_taxonomy.sql`, `20260424120000_home_curated_sections_landing_meta.sql`

```sql
create table if not exists public.home_curated_settings (
  id uuid primary key default gen_random_uuid(),
  setting_key text not null unique,
  section_label text not null default '',
  section_title text not null default '',
  section_description text not null default '',
  catalog_button_label text not null default '',
  catalog_button_href text not null default '/products',
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.home_curated_sections (
  id uuid primary key default gen_random_uuid(),
  setting_id uuid not null references public.home_curated_settings(id) on delete cascade,
  title text not null default '',
  description text not null default '',
  sort_order integer not null default 0,
  max_items integer not null default 8,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  slug text,
  landing_enabled boolean not null default false,
  template_type text,
  source_path text,
  quote_category text,
  source_taxonomy_id text,
  source_taxonomy_type text,
  source_taxonomy_slug text,
  seo_title text,
  seo_description text
);

create table if not exists public.home_curated_section_products (
  id uuid primary key default gen_random_uuid(),
  section_id uuid not null references public.home_curated_sections(id) on delete cascade,
  product_id uuid not null references public.products(id) on delete cascade,
  sort_order integer not null default 0,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  unique(section_id, product_id)
);
```

#### `public.landing_subnodes`

소스: `supabase/migrations/20260317000000_landing_subnodes.sql`

```sql
create table if not exists public.landing_subnodes (
  id uuid primary key default gen_random_uuid(),
  parent_kind text not null check (parent_kind in ('destination', 'theme', 'recommended')),
  parent_slug text not null,
  node_type text not null
    check (node_type in ('city', 'subdestination', 'subtheme', 'style', 'spot', 'custom')),
  title text not null,
  slug text not null,
  description text,
  image_url text,
  badge_label text,
  sort_order integer not null default 0,
  is_active boolean not null default true,
  filter_payload jsonb not null default '{}',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint uq_landing_subnodes_parent_slug unique (parent_kind, parent_slug, slug)
);
```

#### `public.flyer_drafts`

소스: `supabase/migrations/20260415120000_flyer_drafts.sql`, `20260416120000_flyer_drafts_layout_options.sql`

```sql
create table if not exists public.flyer_drafts (
  id uuid primary key default gen_random_uuid(),
  product_id uuid not null references public.products(id) on delete cascade,
  template_key text not null default 'a4-portrait-default',
  title text,
  subtitle text,
  sections_json jsonb not null,
  fields_json jsonb not null,
  image_urls_json jsonb not null default '[]'::jsonb,
  preview_version integer not null default 1,
  png_file_url text,
  share_slug text,
  created_by uuid,                             -- FK 없음
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  layout_options_json jsonb not null default '{}'::jsonb
);
```

#### `public.mobile_golf_ad_landings`

소스: `supabase/migrations/20260706100000_mobile_golf_ad_landings.sql`, `20260710100000_mobile_golf_ad_style_config.sql`, `20260711100000_mobile_golf_ad_body_doc.sql`

```sql
create table if not exists public.mobile_golf_ad_landings (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  slug text not null unique,
  hero_image_url text not null,
  benefit_text text not null,
  trust_action_text text not null,
  is_published boolean not null default false,
  seo_title text,
  seo_description text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  style_config jsonb not null,
  body_doc jsonb not null default '{"type":"doc","content":[]}'::jsonb
);
```

### 1.11 마케팅 / 캠페인 / 성과

#### `public.analytics_events`

소스: `supabase/analytics_events.sql`, `supabase/schema/baseline.sql`, `supabase/migrations/20260423120000_analytics_events_landing_quote_columns.sql`

```sql
create table if not exists public.analytics_events (
  id uuid primary key default gen_random_uuid(),
  event_name text not null,
  source text not null,
  page_path text,
  device_type text,
  taxonomy_type text,
  taxonomy_id text,
  taxonomy_slug text,
  taxonomy_name text,
  section text,
  label text,
  href text,
  position integer,
  query text,
  result_count integer,
  product_id text,                             -- FK 없음
  metadata jsonb,
  occurred_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  source_path text,
  landing_slug text,
  template_type text,
  quote_category text
);
```

#### `public.thread_marketing_posts` / `replies` / `logs`

소스: `supabase/migrations/20260814190000_thread_marketing_posts_and_replies.sql`, `20260814193000_thread_marketing_tokens_and_logs.sql`, `20260814194500_thread_marketing_replies_post_user_unique.sql`

`thread_marketing_tokens` 테이블은 존재하나 **액세스 토큰 저장소**이므로 컬럼 값·토큰 본문은 수록하지 않음. 구조만: `id text PK default 'default'`, `access_token text not null`(민감), `expires_at`, `refreshed_at`, `created_at`, `updated_at`.

```sql
create table if not exists public.thread_marketing_posts (
  id uuid primary key default gen_random_uuid(),
  media_id text not null unique,
  product_id text not null,                    -- FK 없음
  target_keyword text not null,
  permalink text,
  is_active boolean not null default true,
  published_at timestamptz not null default now(),
  created_at timestamptz not null default now()
);

create table if not exists public.thread_marketing_replies (
  id uuid primary key default gen_random_uuid(),
  post_id text not null,                       -- thread_marketing_posts.id uuid와 타입 불일치. FK 없음
  comment_id text not null unique,
  user_handle text,
  replied_at timestamptz not null default now()
);

create unique index if not exists idx_thread_marketing_replies_post_user
  on public.thread_marketing_replies (post_id, lower(user_handle))
  where user_handle is not null and btrim(user_handle) <> '';

create table if not exists public.thread_marketing_logs (
  id uuid primary key default gen_random_uuid(),
  event text not null,
  status text not null check (status in ('ok', 'error')),
  message text,
  meta jsonb,
  created_at timestamptz not null default now()
);
```

#### `public.kakao_moment_imports` / `kakao_moment_creatives`

소스: `supabase/migrations/20260726100000_kakao_moment_imports.sql`

```sql
create table if not exists public.kakao_moment_imports (
  id uuid primary key default gen_random_uuid(),
  period_start date not null,
  period_end date not null,
  filename text not null default '',
  uploaded_by text,
  created_at timestamptz not null default now(),
  constraint kakao_moment_imports_period_chk check (period_end >= period_start),
  constraint kakao_moment_imports_period_unique unique (period_start, period_end)
);

create table if not exists public.kakao_moment_creatives (
  id uuid primary key default gen_random_uuid(),
  import_id uuid not null references public.kakao_moment_imports(id) on delete cascade,
  creative_name text not null default '',
  creative_id text,
  status text,
  ad_group_name text,
  ad_group_id text,
  campaign_name text,
  campaign_id text,
  cost numeric(14, 2) not null default 0,
  impressions bigint not null default 0,
  clicks bigint not null default 0,
  ctr numeric(12, 8) not null default 0,
  reach bigint not null default 0,
  cpc numeric(14, 4) not null default 0,
  created_at timestamptz not null default now()
);
```

카카오 캠페인과 `products` / `product_taxonomies` 사이 **SQL FK는 없음.**

#### `public.golf_tour_leads`

소스: `supabase/migrations/20260608020000_create_golf_tour_leads.sql`

```sql
create table if not exists public.golf_tour_leads (
  id uuid primary key default gen_random_uuid(),
  reference_id text not null unique,
  customer_name text not null,
  phone_number text not null,
  group_size integer,
  target_destination text,
  landing_page text,
  utm_source text,
  utm_medium text,
  utm_campaign text,
  utm_term text,
  utm_content text,
  acquisition_channel text,
  status text not null default 'PENDING',      -- CHECK 없음
  actual_revenue numeric(12,2) not null default 0.00,
  created_at timestamptz not null default now()
);
```

`inquiries` / `customer_profiles`와 **SQL FK 없음.**

### 1.12 SMS / 검색 키워드 (마케팅 발송·검색 Context)

소스: `supabase/migrations/20260613100000_sms_center_followup.sql`, `supabase/schema/optional_recommended_search_keywords.sql`

```sql
create table if not exists public.sms_templates (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  body text not null,
  category text null default 'general',
  variables jsonb not null default '[]'::jsonb,
  is_active boolean not null default true,
  sort_order int not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.sms_bulk_jobs (
  id uuid primary key default gen_random_uuid(),
  message text not null,
  template_id uuid null references public.sms_templates(id) on delete set null,
  source_type text not null check (source_type in ('manual', 'inquiries', 'members')),
  source_filter jsonb null default '{}'::jsonb,
  status text not null default 'pending'
    check (status in ('pending', 'processing', 'completed', 'failed', 'cancelled')),
  total_count int not null default 0,
  success_count int not null default 0,
  failed_count int not null default 0,
  created_by text null,
  created_at timestamptz not null default now(),
  started_at timestamptz null,
  completed_at timestamptz null
);

create table if not exists public.sms_bulk_job_items (
  id uuid primary key default gen_random_uuid(),
  job_id uuid not null references public.sms_bulk_jobs(id) on delete cascade,
  recipient_phone text not null,
  inquiry_id text null,                        -- inquiries.id와 타입 불일치 가능. FK 없음
  member_id text null,
  recipient_name text null,
  status text not null default 'pending'
    check (status in ('pending', 'success', 'failed', 'skipped')),
  message_log_id uuid null,
  failure_reason text null,
  processed_at timestamptz null,
  created_at timestamptz not null default now()
);

-- optional schema. 환경에 따라 없을 수 있음
create table if not exists public.recommended_search_keywords (
  id uuid primary key default gen_random_uuid(),
  keyword text not null,
  sort_order integer,
  is_active boolean default true,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);
```

### 1.13 `public.site_settings`

소스: `supabase/schema/baseline.sql`

```sql
create table if not exists public.site_settings (
  key text primary key,
  value text not null default ''
);
```

키 목록·값의 비즈니스 의미는 스키마만으로 확정 불가 → 확인 필요.

---

## 2. 관련 Enum

PostgreSQL `CREATE TYPE` enum은 확인되지 않았습니다. 아래는 **CHECK 제약 또는 SQL comment로 확인된 허용 값**입니다.

```sql
-- members.gender
-- 'male' | 'female' | 'other'

-- product_taxonomies.type
-- 'category' | 'theme'

-- product_taxonomies.taxonomy_type  (CHECK 없음, comment)
-- 'destination' | 'theme' | 'product_line' | 'campaign' | 'tag'

-- product_taxonomies.category_type  (CHECK 없음, comment)
-- 'destination' | 'product_line' | 'highlight' | 'other'

-- product_notice_templates.template_group
-- 'booking_notes' | 'travel_notes' | 'booking_conditions' | 'refund_policy' | 'legacy'

-- inquiries.consultation_status
-- 'new' | 'contacted' | 'closed' | 'on_hold'

-- inquiries.booking_status
-- 'none' | 'reserved' | 'completed' | 'canceled'

-- inquiries.lead_priority
-- null | 'high' | 'medium' | 'low'

-- inquiry_message_logs.send_status
-- 'success' | 'failed'

-- inquiry_inbound_sms.match_status
-- 'matched' | 'unmatched' | 'manual_linked'

-- travel_bookings.booking_status
-- 'reserved' | 'completed' | 'canceled'

-- travel_bookings.payment_status
-- 'unpaid' | 'partial' | 'paid' | 'refunded'

-- booking_payments.status
-- 'recorded' | 'pending' | 'confirmed' | 'failed' | 'refunded'

-- review_eligibilities.status
-- 'eligible' | 'claimed' | 'submitted' | 'expired' | 'blocked'

-- reviews.status  (CHECK)
-- 'draft' | 'submitted' | 'hidden'

-- product_review_summaries.status
-- 'ready' | 'stale' | 'failed'

-- landing_subnodes.parent_kind
-- 'destination' | 'theme' | 'recommended'

-- landing_subnodes.node_type
-- 'city' | 'subdestination' | 'subtheme' | 'style' | 'spot' | 'custom'

-- thread_marketing_logs.status
-- 'ok' | 'error'

-- sms_bulk_jobs.source_type
-- 'manual' | 'inquiries' | 'members'

-- sms_bulk_jobs.status
-- 'pending' | 'processing' | 'completed' | 'failed' | 'cancelled'

-- sms_bulk_job_items.status
-- 'pending' | 'success' | 'failed' | 'skipped'

-- products.status  (CHECK 없음, column comment)
-- 'AVAILABLE' | 'LIMITED' | 'SOLD_OUT' | 'CONSULT_REQUIRED'

-- departure_schedules_json[].status  (TypeScript, SQL CHECK 없음)
-- 'AVAILABLE' | 'LIMITED' | 'SOLD_OUT'
```

---

## 3. 모델 관계도

스키마에서 **확인된 FK / 논리 참조만** 표시. 점선은 FK 없이 같은 값을 저장하는 참조.

```text
product_taxonomies
 ├── parent_id → product_taxonomies (self)
 ├── products.destination_id
 └── products.product_line_id

products
 ├── options jsonb                          -- ProductOption 테이블 없음
 ├── departure_schedules_json               -- Schedule 테이블 없음
 ├── price / seasonal_price_bands           -- Price 테이블 없음
 ├── campaigns_json / tags_json             -- taxonomy 이름 또는 id 배열. FK 없음
 ├── *_template_type ⋯⋯ product_terms_templates.type / product_notice_templates.type (이름 참조, FK 없음)
 ├── home_curated_section_products.product_id (uuid FK)
 ├── flyer_drafts.product_id (uuid FK)
 ├── inquiries.product_id (text, FK 없음)
 ├── travel_bookings.product_id (text, FK 없음)
 ├── analytics_events.product_id (text, FK 없음)
 ├── thread_marketing_posts.product_id (text, FK 없음)
 └── product_review_summaries.product_id (text, FK 없음)

customer_profiles
 ├── inquiries.customer_profile_id
 ├── travel_bookings.customer_profile_id
 ├── review_eligibilities.customer_profile_id
 ├── reviews.customer_profile_id
 └── customer_account_links.customer_profile_id
       └── member_id text ⋯⋯ members.id (타입 불일치 가능, FK 없음)

members
 ├── inquiries.member_id (uuid FK)
 ├── travel_bookings.member_id (uuid FK)
 ├── reviews.member_id (uuid FK)
 └── review_votes.member_id / review_reports.member_id (text, FK 없음)

inquiries
 ├── inquiry_activity_logs.inquiry_id
 ├── inquiry_message_logs.inquiry_id (nullable)
 ├── inquiry_inbound_sms.inquiry_id
 └── travel_bookings.inquiry_id

travel_bookings
 ├── booking_travelers.booking_id
 ├── booking_payments.booking_id
 ├── review_eligibilities.booking_id (unique)
 └── reviews.booking_id

reviews
 ├── review_votes.review_id
 └── review_reports.review_id

home_curated_settings
 └── home_curated_sections.setting_id
       └── home_curated_section_products.section_id
             └── product_id → products

kakao_moment_imports
 └── kakao_moment_creatives.import_id
       └── campaign_id / campaign_name  -- products와 FK 없음

thread_marketing_posts
 └── thread_marketing_replies.post_id (text, FK 없음)

sms_templates
 └── sms_bulk_jobs.template_id
       └── sms_bulk_job_items.job_id

golf_tour_leads                         -- inquiries/members와 FK 없음
mobile_golf_ad_landings                 -- products와 FK 없음
notices / guides / home_hero_content / home_banners / landing_subnodes
  -- 서로 및 products와 FK 없음 (landing_subnodes는 parent_slug 문자열로 랜딩 연결)
```

요청 예시 이름과의 차이:

```text
(요청) ProductOption / Schedule / Price / Content / Post / Campaign / Media
(실제) 해당 이름의 테이블 없음. products JSON 컬럼 및 notices/guides/flyer_drafts/thread_marketing_posts/kakao_moment_* 로 분산
```

---

## 4. AI Marketing Context로 활용 가능한 기존 데이터

```text
[A. 콘텐츠 생성 Context]

products
- id → 상품 식별자
- title → 콘텐츠 생성 시 상품명
- one_liner → 한 줄 소개
- description → 상품 설명 본문
- golf_course_info / golf_courses_json → 골프 상품 본문
- package_catalog_json → 호텔·관광지·선택관광 카탈로그
- selling_points_json → 핵심포인트·관광·식사·교통·보험
- point_benefits / point_tourism / point_guide → 특징 문구
- included_items / excluded_items / inclusions / optional_tours / optional_expenses
- itinerary / detailed_schedule / itinerary_days_json / itinerary_v2_json / itinerary_media_json
- departure_schedules_json → 출발일·일정별 가격·상태
- price / seasonal_price_bands / price_meta / fuel_included
- duration / overview_duration / overview_region / overview_accommodation / overview_json
- category (legacy) / theme (legacy)
- destination_id / product_line_id → 카테고리 축
- campaigns_json → 기획/강조 배지 원천
- tags_json → 태그
- theme_chart_json → 일정 테마 구성비
- status / is_active
- meta_title / meta_description
- image_url / images_json / overview_cover_url
- booking_notes / travel_notes / booking_conditions / refund_policy / terms_and_notes
- meeting_info / travel_insurance / min_departure_people
- 항공 필드(departure_* / arrival_*) → 일정·교통 카피
- product_source_url → 원천 URL. 채널 여부는 확인 필요

product_taxonomies
- name / slug / taxonomy_type
- landing_title / landing_description / seo_title / seo_description
- card_title / card_description / card_image_url / hero_image_url
- display_label / badge_description / badge_tone → 캠페인 배지 카피
- parent_id → 지역 계층

product_terms_templates / product_notice_templates
- type / content / template_group / label → 공통 안내 문구

guides
- title / title_override / summary / content 역할은 landing_url·Notion 본문. DB에 본문 컬럼은 없음 → 확인 필요
- tags / category / focus_keyword / seo_title / seo_description
- published_at / is_published
- cover_image_url / thumbnail_url / guide_pdf_url

home_hero_content / home_banners / home_curated_settings / home_curated_sections
- 홈·랜딩 카피, CTA 라벨, SEO, template_type

landing_subnodes
- title / description / badge_label / filter_payload

mobile_golf_ad_landings
- title / benefit_text / trust_action_text / body_doc / seo_* / slug

flyer_drafts
- title / subtitle / sections_json / fields_json / image_urls_json → 유인물 콘텐츠 Memory에도 해당


[B. 고객 Context]

customer_profiles
- id / name / phone / email / source / created_at
- source 기본값 'inquiry'. 그 외 값의 의미는 확인 필요

members
- id / name / phone / email / birth_date / gender
- marketing_opt_in → 마케팅 수신 동의
- agree_email
- kakao_channel_added → 채널 추가 상태
- grade_id → 등급 의미 확인 필요

inquiries
- name / phone / content → 상담 원문
- consultation_status / booking_status / is_completed
- product_id / product_title / source_path
- first_touch / inquiry_page_url
- acquisition_channel / acquisition_source_label / acquisition_medium / acquisition_summary / first_landing_path
- assignee_id / assignee_name / lead_priority / next_action / follow_up_at / last_contacted_at / last_activity_at
- member_id / customer_profile_id

inquiry_activity_logs
- activity_type / summary / metadata / created_at → 상담 행동 이력. activity_type 값 집합은 확인 필요

inquiry_message_logs / inquiry_inbound_sms
- message / send_status / received_at / match_status → 문자 상담

travel_bookings
- booking_number / booking_status / departure_date / return_date / travel_completed_at
- product_id / product_title / source_path
- traveler_count / payer_name / payment_status / payment_total_amount
- member_id / customer_profile_id / inquiry_id

golf_tour_leads
- customer_name / phone_number / group_size / target_destination
- landing_page / utm_* / acquisition_channel / status / actual_revenue
- inquiries와 연결 FK 없음


[C. 시장 반응 Context]

analytics_events
- event_name / source / page_path / href / label / section / position
- product_id / taxonomy_* / query / result_count
- source_path / landing_slug / template_type / quote_category
- device_type / occurred_at
- metadata jsonb → 클릭·조회 세부. 키 스키마는 확인 필요

inquiries
- created_at / acquisition_* / first_touch / product_id → 문의 전환
- consultation_status / booking_status → 상담·예약 진행

travel_bookings
- booking_status / payment_status / confirmed_at / travel_completed_at → 예약 전환

reviews
- rating / content / content_good / content_bad / content_tip / summary
- rating_schedule / rating_stay / rating_guide / rating_food
- status / report_count
- product 직접 FK 없음. booking_id 경유

review_votes
- vote_type (default 'helpful') → 리뷰 반응

product_review_summaries
- summary_text / positive_points / negative_points / recommended_for
- average_rating / review_count / status

kakao_moment_creatives
- impressions / clicks / ctr / reach / cpc / cost
- campaign_name / campaign_id / creative_name / ad_group_name

thread_marketing_posts / thread_marketing_replies
- published_at / permalink / target_keyword
- comment_id / user_handle / replied_at → 댓글 반응·중복 답글 방지

golf_tour_leads
- utm_* / status / actual_revenue


[D. 콘텐츠 Memory]

notices
- id / title / content / is_published / created_at / updated_at / sort_order

guides
- id / slug / title / title_override / summary / published_at / created_at / updated_at
- cover_image_url / thumbnail_url / tags
- notion_page_id / last_synced_at → 본문은 Notion 쪽일 수 있음. 확인 필요

flyer_drafts
- id / product_id / title / subtitle / sections_json / fields_json
- png_file_url / share_slug / updated_at / template_key

thread_marketing_posts
- id / media_id / product_id / target_keyword / permalink / published_at / is_active
- 게시 본문 컬럼은 없음 → 확인 필요

home_hero_content / home_banners / home_curated_sections / mobile_golf_ad_landings
- 제목·본문·이미지·게시(활성) 시각

products
- title / description / one_liner / images_json / created_at
- 상품 자체가 상시 콘텐츠 원천


[E. 중복 콘텐츠 방지]

thread_marketing_posts
- media_id unique → 외부 게시물 식별
- product_id + target_keyword + published_at → 같은 상품·키워드 재게시 판별용 후보
- permalink

thread_marketing_replies
- comment_id unique
- (post_id, lower(user_handle)) unique → 동일 유저 재답글 방지

flyer_drafts
- id / product_id / share_slug unique(where not null) / updated_at / preview_version

guides
- id / slug unique / notion_page_id unique / published_at / title

notices
- id / title / created_at
- channel 컬럼 없음

kakao_moment_imports
- (period_start, period_end) unique → 기간 단위 재업로드 교체

golf_tour_leads
- reference_id unique

mobile_golf_ad_landings
- slug unique / title / updated_at

home_curated_sections
- source_path / slug / template_type
- 채널 전용 컬럼은 없음

products
- id / title / created_at / product_source_url
- 게시 채널 컬럼 없음
```

```text
[AI Marketing 연관성이 높은 필드]

products
- id → 상품 식별자
- title → 콘텐츠 생성 시 상품명
- description / one_liner → 본문·훅
- category / destination_id / product_line_id → 상품 카테고리
- tags_json / campaigns_json → 태그·기획전
- price / seasonal_price_bands / departure_schedules_json → 가격·일정
- selling_points_json / included_items / itinerary_v2_json → 특징·일정
- image_url / images_json → 이미지
- status / is_active → 판매 가능 여부
- meta_title / meta_description → SEO 카피

inquiries
- content → 고객 질문 원문
- product_id / product_title → 문의 대상 상품
- acquisition_* / first_touch → 유입 채널
- consultation_status / booking_status → 전환 상태

analytics_events
- event_name / product_id / landing_slug / source_path → 조회·클릭 funnel

kakao_moment_creatives
- campaign_name / impressions / clicks / ctr → 유료 성과

thread_marketing_posts
- media_id / product_id / target_keyword / published_at / permalink → 채널 게시 이력

members
- marketing_opt_in / kakao_channel_added → 수신·채널 상태
```

---

## 5. 확인이 필요한 부분

```text
- schema.prisma 자체가 존재하지 않음. 본 발췌는 Supabase SQL이 기준
- supabase/schema/baseline.sql의 products는 최소 컬럼만 포함. 운영 DB는 migration/루트 SQL 적용 이력에 따라 컬럼이 더 있을 수 있음 (README 명시)
- recommended_search_keywords는 optional schema. 환경에 따라 테이블이 없을 수 있음
- inquiries.id / inquiry_activity_logs.inquiry_id 등이 환경에 따라 uuid 또는 bigint일 수 있음
- products.status는 CHECK 없이 text. comment 값(AVAILABLE|LIMITED|SOLD_OUT|CONSULT_REQUIRED)이 실제로만 쓰이는지 확인 필요
- product_taxonomies.taxonomy_type도 CHECK 없음. comment 값 외 데이터가 있는지 확인 필요
- products.campaigns_json이 taxonomy uuid 배열인지 이름 문자열 배열인지 행마다 다를 수 있음 (comment가 둘 다 허용)
- products.options jsonb 내부 스키마는 SQL이 아니라 TypeScript(ProductOptions). DB 제약 없음
- products.departure_schedules_json[].status 값 집합은 TypeScript에만 있음
- src/types/product.ts의 is_recommend, is_popular, highlights, updated_at는 SQL 컬럼 추가를 확인하지 못함. 앱 전용 필드인지 운영 DB에만 있는지 확인 필요
- reviews에 product_id가 없음. 상품별 리뷰 집계는 booking_id → travel_bookings.product_id 또는 product_review_summaries.product_id(text) 경유. 연결 누락 가능
- inquiries.product_id / travel_bookings.product_id / analytics_events.product_id / thread_marketing_posts.product_id / product_review_summaries.product_id 모두 text이고 products.id(uuid) FK가 없음
- home_curated_section_products.product_id만 uuid FK
- customer_account_links.member_id는 text, members.id는 uuid. FK 없음
- thread_marketing_replies.post_id는 text, thread_marketing_posts.id는 uuid. FK 없음
- thread_marketing_posts에 게시 제목/본문 컬럼이 없음. 본문은 외부 Threads API에만 있는지 확인 필요
- guides 본문 컬럼이 없음. Notion 연동(notion_page_id)이 본문 source of truth인지 확인 필요
- golf_tour_leads.status 기본값 'PENDING'이나 CHECK 없음. 값 집합 확인 필요
- golf_tour_leads와 inquiries/customer_profiles 연결 여부 확인 필요
- kakao_moment_creatives.campaign_id와 자사 상품/캠페인 taxonomy 매핑 여부 확인 필요
- inquiries.first_touch jsonb 키 스키마 확인 필요
- analytics_events.event_name / source 값 집합 확인 필요
- inquiry_activity_logs.activity_type 값 집합 확인 필요
- site_settings.key 목록과 마케팅 카피 저장 여부 확인 필요
- members.grade_id의 참조 테이블이 schema에 없음. 확인 필요
- flyer_drafts.created_by / inquiries.assignee_id가 admin_users.id인지 확인 필요 (FK 없음)
- reviews.status CHECK는 draft|submitted|hidden 인데, moderation migration comment는 under_review, flagged 사용 가능성을 언급. 실제 저장 값 확인 필요
- Content → Agenda → Campaign → Publication 레이어에 해당하는 전용 테이블은 없음
- Embedding / AI Memory 전용 테이블은 없음
- 채널(channel) 전용 컬럼은 inquiry_message_logs.channel (기본 'sms')뿐. 콘텐츠 게시 채널 컬럼은 없음
- Media 전용 테이블 없음. Storage 버킷(product_images 등)은 테이블이 아님
```

이번 발췌에서 제외한 테이블 (AI Marketing 본선과 거리, 또는 인증/인프라):

```text
- admin_sessions, admin_chat_rooms, admin_chat_room_members, admin_chat_messages, admin_push_subscriptions, admin_notifications
- point_ledger, reward_catalog, reward_redemptions, notifications, point_earn_requests, earn_request_attachments, coupon_ledger, member_coupon_packs
- review_reminders, review_experiment_events, review_system_notifications, review_moderation_history, review_rewards
- weather_cache
- thread_marketing_tokens 값 (테이블 존재만 1.11에서 구조 언급, 토큰 값 미수록)
```

```text
[발췌 완료]
위 내용은 현재 프로젝트의 실제 schema.prisma를 기준으로 작성했으며,
존재하지 않는 모델/필드/관계를 임의로 추가하지 않았습니다.
```

보완 주석: `schema.prisma`는 없고, 동일 제한을 **실제 Supabase SQL 스키마**에 적용했습니다.
