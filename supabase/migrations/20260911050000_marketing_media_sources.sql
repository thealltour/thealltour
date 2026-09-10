-- SV-2: Global Marketing Source Catalog (thin identity / provenance / PICK index).
-- Service-role only. No anon/authenticated access. No API keys/secrets in rows.
-- Catalog != binary archive; Candidate HDD Package remains production artifact SoT.
-- DO NOT apply in this coding step unless a dedicated local/staging acceptance run is authorized.

create table if not exists public.marketing_media_sources (
  id uuid primary key default gen_random_uuid(),
  contract_version text not null default 'marketing-media-source-catalog-v1',

  source_kind text not null
    constraint marketing_media_sources_source_kind_check
      check (
        source_kind in (
          'own',
          'partner',
          'pexels',
          'pixabay',
          'generated_ai',
          'unknown'
        )
      ),
  storage_class text not null
    constraint marketing_media_sources_storage_class_check
      check (
        storage_class in (
          'external_ref',
          'ephemeral',
          'local_master',
          'generated_source',
          'candidate_preview',
          'unpublished_final',
          'published_final'
        )
      ),
  disposition text not null
    constraint marketing_media_sources_disposition_check
      check (disposition in ('pick_only', 'ingest', 'pin')),

  provider text
    constraint marketing_media_sources_provider_check
      check (
        provider is null
        or provider ~ '^[a-z][a-z0-9_-]{0,63}$'
      ),
  provider_asset_id text
    constraint marketing_media_sources_provider_asset_id_len
      check (
        provider_asset_id is null
        or (
          char_length(provider_asset_id) between 1 and 256
          and provider_asset_id !~ '[[:cntrl:]]'
        )
      ),

  source_page_url text,
  remote_asset_url text,
  remote_asset_url_expires_at timestamptz,

  managed_relative_path text
    constraint marketing_media_sources_managed_rel_path_check
      check (
        managed_relative_path is null
        or (
          managed_relative_path !~ '^/'
          and managed_relative_path !~ '\.\.'
          and managed_relative_path !~ '[[:cntrl:]]'
          and char_length(managed_relative_path) between 1 and 512
        )
      ),

  media_type text not null default 'unknown'
    constraint marketing_media_sources_media_type_check
      check (media_type in ('video', 'image', 'audio', 'other', 'unknown')),
  mime_type text
    constraint marketing_media_sources_mime_type_len
      check (mime_type is null or char_length(mime_type) between 1 and 128),

  width integer
    constraint marketing_media_sources_width_pos check (width is null or width > 0),
  height integer
    constraint marketing_media_sources_height_pos check (height is null or height > 0),
  duration_ms integer
    constraint marketing_media_sources_duration_nonneg
      check (duration_ms is null or duration_ms >= 0),
  orientation text
    constraint marketing_media_sources_orientation_check
      check (
        orientation is null
        or orientation in ('landscape', 'portrait', 'square', 'unknown')
      ),

  sha256 text
    constraint marketing_media_sources_sha256_hex
      check (sha256 is null or sha256 ~ '^[a-f0-9]{64}$'),

  creator_name text
    constraint marketing_media_sources_creator_name_len
      check (creator_name is null or char_length(creator_name) between 1 and 256),

  rights_kind text not null default 'unknown'
    constraint marketing_media_sources_rights_kind_check
      check (
        rights_kind in (
          'owned',
          'partner_authorized',
          'provider_license',
          'generated',
          'unknown'
        )
      ),
  license_name text
    constraint marketing_media_sources_license_name_len
      check (license_name is null or char_length(license_name) between 1 and 256),
  license_url text,
  attribution_text text
    constraint marketing_media_sources_attribution_len
      check (attribution_text is null or char_length(attribution_text) <= 2000),
  rights_note text
    constraint marketing_media_sources_rights_note_len
      check (rights_note is null or char_length(rights_note) <= 2000),

  metadata jsonb not null default '{}'::jsonb
    constraint marketing_media_sources_metadata_object
      check (jsonb_typeof(metadata) = 'object'),

  is_pinned boolean not null default false,
  status text not null default 'active'
    constraint marketing_media_sources_status_check
      check (status in ('active', 'unavailable', 'archived')),

  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),

  constraint marketing_media_sources_provider_pair_check
    check (
      (provider is null and provider_asset_id is null)
      or (provider is not null and provider_asset_id is not null)
    )
);

comment on table public.marketing_media_sources is
  'SV-2 Global Source Catalog: identity/provenance/rights/location index. Not a binary archive. Not Candidate HDD Package.';

-- Durable external identity dedupe (CDN URL is NOT the identity).
create unique index if not exists uq_marketing_media_sources_provider_asset
  on public.marketing_media_sources (provider, provider_asset_id)
  where provider is not null and provider_asset_id is not null;

create index if not exists idx_marketing_media_sources_sha256
  on public.marketing_media_sources (sha256)
  where sha256 is not null;

create index if not exists idx_marketing_media_sources_kind_status
  on public.marketing_media_sources (source_kind, status, created_at desc);

create index if not exists idx_marketing_media_sources_storage_class
  on public.marketing_media_sources (storage_class, updated_at desc);

create table if not exists public.marketing_media_source_usages (
  id uuid primary key default gen_random_uuid(),
  source_id uuid not null
    references public.marketing_media_sources (id)
    on delete cascade,

  -- Soft text correlation to domain business IDs (matches OBS / HMR convention).
  candidate_id text not null
    constraint marketing_media_source_usages_candidate_id_check
      check (
        char_length(candidate_id) between 1 and 128
        and candidate_id !~ '[[:cntrl:]]'
        and candidate_id !~ '/'
      ),
  production_request_id text
    constraint marketing_media_source_usages_prd_id_check
      check (
        production_request_id is null
        or (
          char_length(production_request_id) between 1 and 128
          and production_request_id !~ '[[:cntrl:]]'
        )
      ),
  scene_key text
    constraint marketing_media_source_usages_scene_key_check
      check (
        scene_key is null
        or (
          char_length(scene_key) between 1 and 128
          and scene_key !~ '[[:cntrl:]]'
        )
      ),

  -- Thin relation: PICK only in SV-2.
  relation text not null default 'picked'
    constraint marketing_media_source_usages_relation_check
      check (relation = 'picked'),

  created_at timestamptz not null default now()
);

comment on table public.marketing_media_source_usages is
  'SV-2 PICK relation: candidate/scene chose a catalog source. Does not imply INGEST.';

-- Treat null scene_key as empty for uniqueness (Postgres NULL uniqueness semantics).
create unique index if not exists uq_marketing_media_source_usages_pick
  on public.marketing_media_source_usages (
    source_id,
    candidate_id,
    coalesce(scene_key, '')
  );

create index if not exists idx_marketing_media_source_usages_candidate
  on public.marketing_media_source_usages (candidate_id, created_at desc);

create index if not exists idx_marketing_media_source_usages_source
  on public.marketing_media_source_usages (source_id, created_at desc);

alter table public.marketing_media_sources enable row level security;
alter table public.marketing_media_source_usages enable row level security;

drop policy if exists service_role_all_marketing_media_sources
  on public.marketing_media_sources;
create policy service_role_all_marketing_media_sources
  on public.marketing_media_sources
  for all
  to service_role
  using (true)
  with check (true);

drop policy if exists service_role_all_marketing_media_source_usages
  on public.marketing_media_source_usages;
create policy service_role_all_marketing_media_source_usages
  on public.marketing_media_source_usages
  for all
  to service_role
  using (true)
  with check (true);

revoke all on public.marketing_media_sources from anon, authenticated;
revoke all on public.marketing_media_source_usages from anon, authenticated;
grant all on public.marketing_media_sources to service_role;
grant all on public.marketing_media_source_usages to service_role;
