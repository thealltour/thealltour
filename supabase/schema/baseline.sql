-- =============================================================================
-- BASELINE SCHEMA — 앱이 기대하는 최종 스키마 기준본 (제안)
-- =============================================================================
--
-- 목적:
--   - 새 환경에서 DB를 0부터 재현할 때 참고하는 "source of truth 제안본"입니다.
--   - 기존 supabase/*.sql 루트 파일 및 supabase/migrations/*.sql 을 대체하지 않습니다.
--   - 실제 정합성 보정은 PR4 migration에서 수행합니다.
--
-- 포함 객체 요약:
--   필수: members, products, product_taxonomies, inquiries, customer_profiles,
--         travel_bookings, review_eligibilities, customer_account_links,
--         point_ledger(user_id 기준), reward_catalog, reward_redemptions,
--         notifications, reviews(전체 목표 컬럼), guides, notices, site_settings,
--         home_banners, admin_notifications, analytics_events,
--         home_curated_settings, home_curated_sections, home_curated_section_products,
--         product_terms_templates, point_earn_requests, earn_request_attachments.
--   제외/주석: pending_points(레거시 보류), reward_redemption 단수(레거시 호환 대상).
--   optional 별도 파일: recommended_search_keywords → optional_recommended_search_keywords.sql
--
-- destructive 변경 없음: drop table / drop column 등 파괴적 SQL은 포함하지 않습니다.
-- =============================================================================

create extension if not exists "pgcrypto";

-- -----------------------------------------------------------------------------
-- 1) public.members
-- -----------------------------------------------------------------------------
create table if not exists public.members (
  id uuid primary key default gen_random_uuid(),
  username text not null unique,
  name text not null,
  password_hash text not null,
  password_salt text not null,
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
  created_at timestamptz not null default now()
);

create index if not exists idx_members_username on public.members(username);

alter table public.members enable row level security;
drop policy if exists "Allow public insert members" on public.members;
create policy "Allow public insert members" on public.members for insert to anon with check (true);
drop policy if exists "Allow public check username" on public.members;
create policy "Allow public check username" on public.members for select to anon using (true);

-- -----------------------------------------------------------------------------
-- 2) public.products
-- -----------------------------------------------------------------------------
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
  terms_template_type text,
  created_at timestamptz not null default now()
);

create index if not exists idx_products_sort_order on public.products(sort_order);
create index if not exists idx_products_is_active on public.products(is_active);
create index if not exists idx_products_created_at on public.products(created_at desc);

-- -----------------------------------------------------------------------------
-- 3) public.product_taxonomies
-- -----------------------------------------------------------------------------
create table if not exists public.product_taxonomies (
  id uuid primary key default gen_random_uuid(),
  type text not null check (type in ('category', 'theme')),
  name text not null,
  slug text,
  is_active boolean not null default true,
  sort_order integer,
  created_at timestamptz not null default now(),
  unique (type, name)
);

create index if not exists idx_product_taxonomies_type on public.product_taxonomies(type);
create index if not exists idx_product_taxonomies_sort on public.product_taxonomies(sort_order);

alter table public.product_taxonomies enable row level security;
drop policy if exists "taxonomies_select_anon" on public.product_taxonomies;
create policy "taxonomies_select_anon" on public.product_taxonomies for select to anon using (true);
drop policy if exists "taxonomies_insert_anon" on public.product_taxonomies;
create policy "taxonomies_insert_anon" on public.product_taxonomies for insert to anon with check (true);
drop policy if exists "taxonomies_update_anon" on public.product_taxonomies;
create policy "taxonomies_update_anon" on public.product_taxonomies for update to anon using (true) with check (true);
drop policy if exists "taxonomies_delete_anon" on public.product_taxonomies;
create policy "taxonomies_delete_anon" on public.product_taxonomies for delete to anon using (true);

-- -----------------------------------------------------------------------------
-- 4) public.inquiries (id uuid 목표)
-- -----------------------------------------------------------------------------
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

create index if not exists idx_inquiries_customer_profile_id on public.inquiries(customer_profile_id) where customer_profile_id is not null;

alter table public.inquiries enable row level security;
drop policy if exists "Allow public insert inquiries" on public.inquiries;
create policy "Allow public insert inquiries" on public.inquiries for insert to anon with check (true);
drop policy if exists "Allow public read inquiries" on public.inquiries;
create policy "Allow public read inquiries" on public.inquiries for select to anon using (true);
drop policy if exists "Allow public update inquiries" on public.inquiries;
create policy "Allow public update inquiries" on public.inquiries for update to anon using (true) with check (true);

-- -----------------------------------------------------------------------------
-- 5) public.customer_profiles
-- -----------------------------------------------------------------------------
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

alter table public.customer_profiles enable row level security;
drop policy if exists "customer_profiles_insert_anon" on public.customer_profiles;
create policy "customer_profiles_insert_anon" on public.customer_profiles for insert to anon with check (true);
drop policy if exists "customer_profiles_select_anon" on public.customer_profiles;
create policy "customer_profiles_select_anon" on public.customer_profiles for select to anon using (true);
drop policy if exists "customer_profiles_update_anon" on public.customer_profiles;
create policy "customer_profiles_update_anon" on public.customer_profiles for update to anon using (true) with check (true);

-- inquiries.customer_profile_id FK (customer_profiles 선행)
do $$
begin
  if not exists (select 1 from information_schema.table_constraints where constraint_name = 'inquiries_customer_profile_id_fkey' and table_schema = 'public' and table_name = 'inquiries') then
    alter table public.inquiries add constraint inquiries_customer_profile_id_fkey foreign key (customer_profile_id) references public.customer_profiles(id) on delete set null;
  end if;
end $$;

-- -----------------------------------------------------------------------------
-- 6) public.travel_bookings (inquiry_id uuid FK to inquiries(id) 목표)
-- -----------------------------------------------------------------------------
create table if not exists public.travel_bookings (
  id uuid primary key default gen_random_uuid(),
  customer_profile_id uuid not null references public.customer_profiles(id) on delete cascade,
  inquiry_id uuid references public.inquiries(id) on delete set null,
  product_id text,
  product_title text,
  source_path text,
  booking_status text not null default 'reserved' check (booking_status in ('reserved', 'completed', 'canceled')),
  departure_date date,
  return_date date,
  travel_completed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_travel_bookings_customer_profile_id on public.travel_bookings(customer_profile_id);
create index if not exists idx_travel_bookings_inquiry_id on public.travel_bookings(inquiry_id) where inquiry_id is not null;

alter table public.travel_bookings enable row level security;
drop policy if exists "travel_bookings_all_anon" on public.travel_bookings;
create policy "travel_bookings_all_anon" on public.travel_bookings for all to anon using (true) with check (true);

-- -----------------------------------------------------------------------------
-- 7) public.review_eligibilities (claim_token 포함)
-- -----------------------------------------------------------------------------
create table if not exists public.review_eligibilities (
  id uuid primary key default gen_random_uuid(),
  booking_id uuid not null references public.travel_bookings(id) on delete cascade,
  customer_profile_id uuid not null references public.customer_profiles(id) on delete cascade,
  status text not null default 'eligible' check (status in ('eligible', 'claimed', 'submitted', 'expired', 'blocked')),
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

create index if not exists idx_review_eligibilities_booking_id on public.review_eligibilities(booking_id);
create index if not exists idx_review_eligibilities_customer_profile_id on public.review_eligibilities(customer_profile_id);
create index if not exists idx_review_eligibilities_claimed_by_member_id on public.review_eligibilities(claimed_by_member_id) where claimed_by_member_id is not null;
create unique index if not exists idx_review_eligibilities_claim_token on public.review_eligibilities(claim_token) where claim_token is not null;

alter table public.review_eligibilities enable row level security;
drop policy if exists "review_eligibilities_all_anon" on public.review_eligibilities;
create policy "review_eligibilities_all_anon" on public.review_eligibilities for all to anon using (true) with check (true);

-- -----------------------------------------------------------------------------
-- 8) public.customer_account_links
-- -----------------------------------------------------------------------------
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

alter table public.customer_account_links enable row level security;
drop policy if exists "customer_account_links_all_anon" on public.customer_account_links;
create policy "customer_account_links_all_anon" on public.customer_account_links for all to anon using (true) with check (true);

-- -----------------------------------------------------------------------------
-- 9) public.reward_catalog
-- -----------------------------------------------------------------------------
create table if not exists public.reward_catalog (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  description text,
  point_price integer not null default 0 check (point_price >= 0),
  point_cost integer default 0,
  image_url text,
  stock_count integer not null default 0 check (stock_count >= 0),
  stock integer,
  is_active boolean not null default true,
  sort_order integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- -----------------------------------------------------------------------------
-- 10) public.point_ledger (목표: user_id 기준 최종 스키마)
-- -----------------------------------------------------------------------------
-- 레거시: member_id, kind, balance_after, reference_type 등은 baseline 최종 컬럼에 포함하지 않음.
-- 실제 정합성 보정(기존 DB에 user_id/type/status 추가 등)은 PR4 migration에서 처리.
create table if not exists public.point_ledger (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.members(id) on delete cascade,
  type text not null check (type in ('EARN', 'USE', 'EXPIRE', 'ADJUST', 'RESERVE', 'RELEASE')),
  status text not null default 'CONFIRMED' check (status in ('PENDING', 'CONFIRMED', 'CANCELED')),
  amount integer not null check (amount > 0),
  reason text,
  ref_type text,
  ref_id text,
  expires_at timestamptz,
  created_at timestamptz not null default now()
);

create index if not exists idx_point_ledger_user_created on public.point_ledger(user_id, created_at desc);
create index if not exists idx_point_ledger_user_status on public.point_ledger(user_id, status);
create index if not exists idx_point_ledger_ref on public.point_ledger(ref_type, ref_id) where ref_type is not null;

alter table public.point_ledger enable row level security;
drop policy if exists "Allow anon point_ledger" on public.point_ledger;
create policy "Allow anon point_ledger" on public.point_ledger for all to anon using (true) with check (true);

-- -----------------------------------------------------------------------------
-- 11) public.reward_redemptions (최종 테이블)
-- -----------------------------------------------------------------------------
-- reward_redemption(단수)는 레거시 호환 대상. 데이터 이전/뷰 제공/drop 여부는 PR4~Phase 2에서 결정.
create table if not exists public.reward_redemptions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.members(id) on delete restrict,
  catalog_id uuid not null references public.reward_catalog(id) on delete restrict,
  status text not null default 'REQUESTED' check (status in ('REQUESTED', 'APPROVED', 'REJECTED', 'SHIPPED', 'COMPLETED', 'CANCELED')),
  point_amount integer not null check (point_amount > 0),
  requested_at timestamptz not null default now(),
  decided_at timestamptz,
  shipped_at timestamptz,
  completed_at timestamptz,
  admin_memo text,
  user_message text,
  shipping_name text not null default '',
  shipping_phone text not null default '',
  shipping_address1 text not null default '',
  shipping_address2 text,
  shipping_zip text,
  tracking_carrier text,
  tracking_number text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_reward_redemptions_user_created on public.reward_redemptions(user_id, created_at desc);
create index if not exists idx_reward_redemptions_status on public.reward_redemptions(status);
create index if not exists idx_reward_redemptions_catalog on public.reward_redemptions(catalog_id);

alter table public.reward_redemptions enable row level security;
drop policy if exists "Allow anon reward_redemptions" on public.reward_redemptions;
create policy "Allow anon reward_redemptions" on public.reward_redemptions for all to anon using (true) with check (true);

-- -----------------------------------------------------------------------------
-- 12) public.notifications
-- -----------------------------------------------------------------------------
create table if not exists public.notifications (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.members(id) on delete cascade,
  type text not null check (type in ('REWARD_STATUS', 'POINT_EARNED', 'ADMIN_MESSAGE')),
  title text not null default '',
  body text,
  is_read boolean not null default false,
  created_at timestamptz not null default now()
);

create index if not exists idx_notifications_user_created on public.notifications(user_id, created_at desc);
create index if not exists idx_notifications_user_read on public.notifications(user_id, is_read) where is_read = false;

alter table public.notifications enable row level security;
drop policy if exists "Allow anon notifications" on public.notifications;
create policy "Allow anon notifications" on public.notifications for all to anon using (true) with check (true);

-- -----------------------------------------------------------------------------
-- 13) public.reviews (앱 실제 사용 컬럼 기준 목표 스키마)
-- -----------------------------------------------------------------------------
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
  status text not null default 'submitted' check (status in ('draft', 'submitted', 'hidden')),
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
  rating_food integer
);

create index if not exists idx_reviews_created_at on public.reviews(created_at desc);
create index if not exists idx_reviews_member_id on public.reviews(member_id);
create index if not exists idx_reviews_eligibility_id on public.reviews(eligibility_id) where eligibility_id is not null;
create index if not exists idx_reviews_status on public.reviews(status);
create index if not exists idx_reviews_updated_at on public.reviews(updated_at desc);
create index if not exists idx_reviews_member_status on public.reviews(member_id, status);
create unique index if not exists idx_reviews_eligibility_unique on public.reviews(eligibility_id) where eligibility_id is not null;

alter table public.reviews enable row level security;
drop policy if exists "Allow public read reviews" on public.reviews;
create policy "Allow public read reviews" on public.reviews for select to anon using (true);
drop policy if exists "Allow public insert reviews" on public.reviews;
create policy "Allow public insert reviews" on public.reviews for insert to anon with check (true);
drop policy if exists "Allow public update reviews" on public.reviews;
create policy "Allow public update reviews" on public.reviews for update to anon using (true) with check (true);

-- -----------------------------------------------------------------------------
-- 14) public.guides
-- -----------------------------------------------------------------------------
create table if not exists public.guides (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  summary text,
  thumbnail_url text,
  landing_url text,
  is_published boolean not null default true,
  sort_order integer,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_guides_is_published on public.guides(is_published);
create index if not exists idx_guides_sort_order on public.guides(sort_order);
create index if not exists idx_guides_created_at on public.guides(created_at desc);

create or replace function public.set_guides_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists trg_guides_updated_at on public.guides;
create trigger trg_guides_updated_at before update on public.guides for each row execute function public.set_guides_updated_at();

alter table public.guides enable row level security;
drop policy if exists "guides_select_anon" on public.guides;
create policy "guides_select_anon" on public.guides for select to anon using (true);
drop policy if exists "guides_insert_anon" on public.guides;
create policy "guides_insert_anon" on public.guides for insert to anon with check (true);
drop policy if exists "guides_update_anon" on public.guides;
create policy "guides_update_anon" on public.guides for update to anon using (true) with check (true);
drop policy if exists "guides_delete_anon" on public.guides;
create policy "guides_delete_anon" on public.guides for delete to anon using (true);

-- -----------------------------------------------------------------------------
-- 15) public.notices
-- -----------------------------------------------------------------------------
create table if not exists public.notices (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  content text not null,
  is_published boolean not null default true,
  sort_order integer,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_notices_is_published on public.notices(is_published);
create index if not exists idx_notices_sort_order on public.notices(sort_order);
create index if not exists idx_notices_created_at on public.notices(created_at desc);

create or replace function public.set_notices_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists trg_notices_updated_at on public.notices;
create trigger trg_notices_updated_at before update on public.notices for each row execute function public.set_notices_updated_at();

alter table public.notices enable row level security;
drop policy if exists "notices_select_anon" on public.notices;
create policy "notices_select_anon" on public.notices for select to anon using (true);
drop policy if exists "notices_insert_anon" on public.notices;
create policy "notices_insert_anon" on public.notices for insert to anon with check (true);
drop policy if exists "notices_update_anon" on public.notices;
create policy "notices_update_anon" on public.notices for update to anon using (true) with check (true);
drop policy if exists "notices_delete_anon" on public.notices;
create policy "notices_delete_anon" on public.notices for delete to anon using (true);

-- -----------------------------------------------------------------------------
-- 16) public.site_settings
-- -----------------------------------------------------------------------------
create table if not exists public.site_settings (
  key text primary key,
  value text not null default ''
);

alter table public.site_settings enable row level security;
drop policy if exists "site_settings_select_anon" on public.site_settings;
create policy "site_settings_select_anon" on public.site_settings for select to anon using (true);
drop policy if exists "site_settings_insert_anon" on public.site_settings;
create policy "site_settings_insert_anon" on public.site_settings for insert to anon with check (true);
drop policy if exists "site_settings_update_anon" on public.site_settings;
create policy "site_settings_update_anon" on public.site_settings for update to anon using (true) with check (true);
drop policy if exists "site_settings_delete_anon" on public.site_settings;
create policy "site_settings_delete_anon" on public.site_settings for delete to anon using (true);

-- -----------------------------------------------------------------------------
-- 17) public.home_banners
-- -----------------------------------------------------------------------------
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

create index if not exists idx_home_banners_sort_order on public.home_banners(sort_order);
create index if not exists idx_home_banners_is_active on public.home_banners(is_active);
create index if not exists idx_home_banners_created_at on public.home_banners(created_at desc);

alter table public.home_banners enable row level security;
drop policy if exists "home_banners_select_anon" on public.home_banners;
create policy "home_banners_select_anon" on public.home_banners for select to anon using (true);
drop policy if exists "home_banners_insert_anon" on public.home_banners;
create policy "home_banners_insert_anon" on public.home_banners for insert to anon with check (true);
drop policy if exists "home_banners_update_anon" on public.home_banners;
create policy "home_banners_update_anon" on public.home_banners for update to anon using (true) with check (true);
drop policy if exists "home_banners_delete_anon" on public.home_banners;
create policy "home_banners_delete_anon" on public.home_banners for delete to anon using (true);

-- -----------------------------------------------------------------------------
-- 18) public.admin_notifications
-- -----------------------------------------------------------------------------
create table if not exists public.admin_notifications (
  id uuid primary key default gen_random_uuid(),
  type text not null,
  title text not null,
  message text not null,
  target_url text,
  unique_key text not null unique,
  payload jsonb not null default '{}'::jsonb,
  is_read boolean not null default false,
  created_at timestamptz not null default now()
);

create index if not exists idx_admin_notifications_created_at on public.admin_notifications(created_at desc);
create index if not exists idx_admin_notifications_is_read on public.admin_notifications(is_read);
create index if not exists idx_admin_notifications_unique_key on public.admin_notifications(unique_key);

alter table public.admin_notifications enable row level security;
drop policy if exists "Allow public read admin notifications" on public.admin_notifications;
create policy "Allow public read admin notifications" on public.admin_notifications for select to anon using (true);
drop policy if exists "Allow public insert admin notifications" on public.admin_notifications;
create policy "Allow public insert admin notifications" on public.admin_notifications for insert to anon with check (true);
drop policy if exists "Allow public update admin notifications" on public.admin_notifications;
create policy "Allow public update admin notifications" on public.admin_notifications for update to anon using (true) with check (true);

-- -----------------------------------------------------------------------------
-- 19) public.analytics_events
-- -----------------------------------------------------------------------------
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
  product_id text,
  metadata jsonb,
  occurred_at timestamptz not null default now(),
  created_at timestamptz not null default now()
);

create index if not exists idx_analytics_events_event_occurred on public.analytics_events(event_name, occurred_at desc);
create index if not exists idx_analytics_events_source_occurred on public.analytics_events(source, occurred_at desc);
create index if not exists idx_analytics_events_taxonomy_occurred on public.analytics_events(taxonomy_type, taxonomy_slug, occurred_at desc) where taxonomy_type is not null and taxonomy_slug is not null;
create index if not exists idx_analytics_events_query_occurred on public.analytics_events(query, occurred_at desc) where query is not null;

alter table public.analytics_events enable row level security;
drop policy if exists "analytics_events_insert_anon" on public.analytics_events;
create policy "analytics_events_insert_anon" on public.analytics_events for insert to anon with check (true);

-- -----------------------------------------------------------------------------
-- 20) public.home_curated_settings, sections, section_products
-- -----------------------------------------------------------------------------
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

create index if not exists idx_home_curated_settings_key on public.home_curated_settings(setting_key);
create index if not exists idx_home_curated_settings_active on public.home_curated_settings(is_active);

create table if not exists public.home_curated_sections (
  id uuid primary key default gen_random_uuid(),
  setting_id uuid not null references public.home_curated_settings(id) on delete cascade,
  title text not null default '',
  description text not null default '',
  sort_order integer not null default 0,
  max_items integer not null default 8,
  is_active boolean not null default true,
  created_at timestamptz not null default now()
);

create index if not exists idx_home_curated_sections_setting on public.home_curated_sections(setting_id);
create index if not exists idx_home_curated_sections_sort on public.home_curated_sections(sort_order asc, created_at asc);
create index if not exists idx_home_curated_sections_active on public.home_curated_sections(is_active);

create table if not exists public.home_curated_section_products (
  id uuid primary key default gen_random_uuid(),
  section_id uuid not null references public.home_curated_sections(id) on delete cascade,
  product_id uuid not null references public.products(id) on delete cascade,
  sort_order integer not null default 0,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  unique(section_id, product_id)
);

create index if not exists idx_home_curated_section_products_section on public.home_curated_section_products(section_id);
create index if not exists idx_home_curated_section_products_product on public.home_curated_section_products(product_id);
create index if not exists idx_home_curated_section_products_sort on public.home_curated_section_products(section_id, sort_order asc, created_at asc);
create index if not exists idx_home_curated_section_products_active on public.home_curated_section_products(is_active);

-- -----------------------------------------------------------------------------
-- 21) public.product_terms_templates
-- -----------------------------------------------------------------------------
create table if not exists public.product_terms_templates (
  type text primary key,
  content text not null default '',
  updated_at timestamptz not null default now()
);

alter table public.product_terms_templates enable row level security;
drop policy if exists "terms_templates_select_anon" on public.product_terms_templates;
create policy "terms_templates_select_anon" on public.product_terms_templates for select to anon using (true);
drop policy if exists "terms_templates_insert_anon" on public.product_terms_templates;
create policy "terms_templates_insert_anon" on public.product_terms_templates for insert to anon with check (true);
drop policy if exists "terms_templates_update_anon" on public.product_terms_templates;
create policy "terms_templates_update_anon" on public.product_terms_templates for update to anon using (true) with check (true);
drop policy if exists "terms_templates_delete_anon" on public.product_terms_templates;
create policy "terms_templates_delete_anon" on public.product_terms_templates for delete to anon using (true);

-- -----------------------------------------------------------------------------
-- 22) public.point_earn_requests, earn_request_attachments
-- -----------------------------------------------------------------------------
create table if not exists public.point_earn_requests (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.members(id) on delete cascade,
  status text not null default 'REQUESTED' check (status in ('REQUESTED', 'APPROVED', 'REJECTED')),
  booking_ref text not null,
  departure_date date not null,
  payer_name text not null,
  memo text,
  contact_phone text,
  admin_memo text,
  reject_reason text,
  requested_at timestamptz not null default now(),
  decided_at timestamptz,
  decided_by_admin_id text
);

create unique index if not exists uq_point_earn_requests_booking_ref on public.point_earn_requests(booking_ref);
create index if not exists idx_point_earn_requests_user_status on public.point_earn_requests(user_id, status);
create index if not exists idx_point_earn_requests_status_requested on public.point_earn_requests(status, requested_at desc);

create table if not exists public.earn_request_attachments (
  id uuid primary key default gen_random_uuid(),
  request_id uuid not null references public.point_earn_requests(id) on delete cascade,
  file_url text not null,
  file_name text not null,
  mime_type text not null,
  file_size bigint not null check (file_size >= 0),
  created_at timestamptz not null default now()
);

create index if not exists idx_earn_request_attachments_request_id on public.earn_request_attachments(request_id);

alter table public.point_earn_requests enable row level security;
alter table public.earn_request_attachments enable row level security;
drop policy if exists "Allow anon point_earn_requests" on public.point_earn_requests;
create policy "Allow anon point_earn_requests" on public.point_earn_requests for all to anon using (true) with check (true);
drop policy if exists "Allow anon earn_request_attachments" on public.earn_request_attachments;
create policy "Allow anon earn_request_attachments" on public.earn_request_attachments for all to anon using (true) with check (true);

-- =============================================================================
-- 제외/주석 처리된 객체
-- =============================================================================
-- - public.pending_points: 레거시 보류. migration 20250304에서 drop 대상. baseline 본문에는 포함하지 않음. README 참고.
-- - public.reward_redemption (단수): 레거시 호환 대상. 최종 테이블은 reward_redemptions. baseline 본문에 포함하지 않음.
-- - public.recommended_search_keywords: repo 밖 생성 가능성 있음 → supabase/schema/optional_recommended_search_keywords.sql 로 분리. 선택 적용.
-- =============================================================================
