-- STEP 3-4: Official SNS social persistence schema.
-- Architecture tables only. No OAuth seeds, no tokens, no SNS data inserts.
--
-- Conventions (match ai_marketing_v1):
--   uuid PK gen_random_uuid(), timestamptz defaults, text status (app-level),
--   RLS service_role only, revoke anon/authenticated.
--
-- Ownership:
--   SocialAccount → ProviderIdentity → (binding) → AuthorizationGrant → CredentialReference
-- ProviderIdentity lifetime is independent of AuthorizationGrant.

create extension if not exists "pgcrypto";

-- -----------------------------------------------------------------------------
-- 1) social_credential_references (opaque secure-store handles only)
-- -----------------------------------------------------------------------------
create table if not exists public.social_credential_references (
  id uuid primary key default gen_random_uuid(),
  store_kind text not null default 'future_secure_store',
  store_handle text not null,
  provider text not null,
  credential_family text not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint social_credential_references_store_handle_nonempty
    check (length(trim(store_handle)) > 0)
);

comment on table public.social_credential_references is
  'Opaque CredentialStore handles. NEVER store access/refresh tokens or client secrets here.';
comment on column public.social_credential_references.store_handle is
  'Opaque id for future CredentialStore. Not a token.';

create unique index if not exists idx_social_credential_references_provider_handle
  on public.social_credential_references (provider, store_handle);

-- -----------------------------------------------------------------------------
-- 2) social_authorization_grants
-- -----------------------------------------------------------------------------
create table if not exists public.social_authorization_grants (
  id uuid primary key default gen_random_uuid(),
  provider text not null,
  credential_reference_id uuid not null
    references public.social_credential_references (id) on delete restrict,
  credential_family text not null,
  status text not null default 'pending',
  -- JSON array of { "code": "...", "label": "..." } — simplest safe model (no child table).
  permissions jsonb not null default '[]'::jsonb,
  issued_at timestamptz,
  expires_at timestamptz,
  refresh_supported boolean not null default false,
  reauthorization_required boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint social_authorization_grants_permissions_is_array
    check (jsonb_typeof(permissions) = 'array')
);

comment on table public.social_authorization_grants is
  'Provider authorization metadata. Credentials live only via credential_reference_id.';
comment on column public.social_authorization_grants.permissions is
  'Runtime granted permission/scope codes as JSON array. Static prerequisites stay in capability registry.';
comment on column public.social_authorization_grants.status is
  'pending | active | expired | revoked | invalid (application-level).';

create index if not exists idx_social_authorization_grants_provider_status
  on public.social_authorization_grants (provider, status);
create index if not exists idx_social_authorization_grants_credential_reference_id
  on public.social_authorization_grants (credential_reference_id);
create index if not exists idx_social_authorization_grants_expires_at
  on public.social_authorization_grants (expires_at)
  where expires_at is not null;

-- -----------------------------------------------------------------------------
-- 3) social_provider_identities (stable; not destroyed when a grant is revoked)
-- -----------------------------------------------------------------------------
create table if not exists public.social_provider_identities (
  id uuid primary key default gen_random_uuid(),
  provider text not null,
  identity_kind text not null,
  external_id text not null,
  display_name text,
  channel_hints jsonb not null default '[]'::jsonb,
  extension jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint social_provider_identities_channel_hints_is_array
    check (jsonb_typeof(channel_hints) = 'array'),
  constraint social_provider_identities_extension_is_object
    check (jsonb_typeof(extension) = 'object')
);

comment on table public.social_provider_identities is
  'Stable provider-native identities (Page, IG Pro, Threads profile, YT channel). Lifetime independent of grants.';
comment on column public.social_provider_identities.external_id is
  'Provider-native id. Not a secret.';

create unique index if not exists idx_social_provider_identities_provider_kind_external
  on public.social_provider_identities (provider, identity_kind, external_id);
create index if not exists idx_social_provider_identities_provider
  on public.social_provider_identities (provider);

-- -----------------------------------------------------------------------------
-- 4) social_identity_grant_bindings (identity ↔ authorization; reauth-safe)
-- -----------------------------------------------------------------------------
create table if not exists public.social_identity_grant_bindings (
  id uuid primary key default gen_random_uuid(),
  provider_identity_id uuid not null
    references public.social_provider_identities (id) on delete cascade,
  authorization_grant_id uuid not null
    references public.social_authorization_grants (id) on delete cascade,
  status text not null default 'active',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint social_identity_grant_bindings_unique
    unique (provider_identity_id, authorization_grant_id)
);

comment on table public.social_identity_grant_bindings is
  'Which grants can access which identities. Old grant may be revoked; new grant binds same identity.';
comment on column public.social_identity_grant_bindings.status is
  'active | revoked (application-level).';

create index if not exists idx_social_identity_grant_bindings_grant
  on public.social_identity_grant_bindings (authorization_grant_id);
create index if not exists idx_social_identity_grant_bindings_identity_status
  on public.social_identity_grant_bindings (provider_identity_id, status);

-- -----------------------------------------------------------------------------
-- 5) social_accounts
-- -----------------------------------------------------------------------------
create table if not exists public.social_accounts (
  id uuid primary key default gen_random_uuid(),
  provider text not null,
  channel text not null,
  provider_identity_id uuid not null
    references public.social_provider_identities (id) on delete restrict,
  external_identity_id text not null,
  display_name text,
  status text not null default 'disconnected',
  -- Soft pointer to currently preferred grant (not credential owner).
  active_authorization_grant_id uuid
    references public.social_authorization_grants (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

comment on table public.social_accounts is
  'thealltour-managed SNS account per channel. Credentials owned by AuthorizationGrant, not this row.';
comment on column public.social_accounts.active_authorization_grant_id is
  'Optional current grant pointer for convenience. Identity↔grant truth is social_identity_grant_bindings.';

create unique index if not exists idx_social_accounts_provider_channel_external
  on public.social_accounts (provider, channel, external_identity_id);
create index if not exists idx_social_accounts_provider_identity_id
  on public.social_accounts (provider_identity_id);
create index if not exists idx_social_accounts_channel_status
  on public.social_accounts (channel, status);
create index if not exists idx_social_accounts_active_grant
  on public.social_accounts (active_authorization_grant_id)
  where active_authorization_grant_id is not null;

-- -----------------------------------------------------------------------------
-- 6) social_publications (official external placements; ≠ thread_marketing_posts)
-- -----------------------------------------------------------------------------
create table if not exists public.social_publications (
  id uuid primary key default gen_random_uuid(),
  -- MarketingPost master (ai_contents). Optional until content is linked.
  content_id uuid references public.ai_contents (id) on delete set null,
  -- Optional bridge to legacy channel history row (not the external model).
  ai_publication_id uuid references public.ai_publications (id) on delete set null,
  social_account_id uuid not null
    references public.social_accounts (id) on delete restrict,
  provider text not null,
  channel text not null,
  media_type text,
  status text not null default 'pending',
  external_post_id text,
  external_url text,
  published_at timestamptz,
  -- Idempotency for future orchestrator retries (unique per account when set).
  idempotency_key text,
  -- Governance / human approval evidence hooks (not a duplicated governance system).
  governance_decision text,
  governance_run_id uuid references public.ai_runs (id) on delete set null,
  human_approval_ref text,
  provider_status_metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint social_publications_provider_status_metadata_is_object
    check (jsonb_typeof(provider_status_metadata) = 'object')
);

comment on table public.social_publications is
  'External SNS publication identity. MarketingPost (ai_contents) may map to many rows. Not thread_marketing_posts.';
comment on column public.social_publications.idempotency_key is
  'Client/orchestrator key to prevent duplicate external posts on retry.';
comment on column public.social_publications.human_approval_ref is
  'Opaque reference to human approval evidence; not approved=true alone.';
comment on column public.social_publications.status is
  'pending | queued | publishing | published | failed | rejected_by_provider | unsupported | unknown';

create unique index if not exists idx_social_publications_account_idempotency
  on public.social_publications (social_account_id, idempotency_key)
  where idempotency_key is not null;
create unique index if not exists idx_social_publications_provider_channel_external
  on public.social_publications (provider, channel, external_post_id)
  where external_post_id is not null;
create index if not exists idx_social_publications_content_id
  on public.social_publications (content_id)
  where content_id is not null;
create index if not exists idx_social_publications_social_account_id
  on public.social_publications (social_account_id);
create index if not exists idx_social_publications_channel_status
  on public.social_publications (channel, status);
create index if not exists idx_social_publications_published_at
  on public.social_publications (published_at)
  where published_at is not null;

-- -----------------------------------------------------------------------------
-- 7) social_performance_snapshots (+ metric values)
-- -----------------------------------------------------------------------------
create table if not exists public.social_performance_snapshots (
  id uuid primary key default gen_random_uuid(),
  provider text not null,
  channel text not null,
  scope text not null,
  social_account_id uuid not null
    references public.social_accounts (id) on delete cascade,
  social_publication_id uuid
    references public.social_publications (id) on delete cascade,
  period_start timestamptz,
  period_end timestamptz,
  measured_at timestamptz not null default now(),
  data_availability text not null default 'unavailable',
  created_at timestamptz not null default now(),
  constraint social_performance_snapshots_scope_check
    check (scope in ('account', 'publication')),
  constraint social_performance_snapshots_publication_scope
    check (
      (scope = 'account' and social_publication_id is null)
      or (scope = 'publication' and social_publication_id is not null)
    )
);

comment on table public.social_performance_snapshots is
  'Normalized SNS performance window. Belongs to account and optionally publication — not MarketingPost.';
comment on column public.social_performance_snapshots.data_availability is
  'available | partial | unavailable.';

create index if not exists idx_social_performance_snapshots_account_measured
  on public.social_performance_snapshots (social_account_id, measured_at desc);
create index if not exists idx_social_performance_snapshots_publication
  on public.social_performance_snapshots (social_publication_id)
  where social_publication_id is not null;
create index if not exists idx_social_performance_snapshots_channel_scope
  on public.social_performance_snapshots (channel, scope);

create table if not exists public.social_performance_metric_values (
  id uuid primary key default gen_random_uuid(),
  snapshot_id uuid not null
    references public.social_performance_snapshots (id) on delete cascade,
  metric_type text not null,
  metric_value numeric not null default 0,
  unit text,
  created_at timestamptz not null default now(),
  constraint social_performance_metric_values_unique
    unique (snapshot_id, metric_type)
);

comment on table public.social_performance_metric_values is
  'Pragmatic normalized metrics per snapshot (ai_feedback-style rows, not unbounded EAV framework).';

create index if not exists idx_social_performance_metric_values_type
  on public.social_performance_metric_values (metric_type);

-- -----------------------------------------------------------------------------
-- RLS: service_role only
-- -----------------------------------------------------------------------------
alter table public.social_credential_references enable row level security;
alter table public.social_authorization_grants enable row level security;
alter table public.social_provider_identities enable row level security;
alter table public.social_identity_grant_bindings enable row level security;
alter table public.social_accounts enable row level security;
alter table public.social_publications enable row level security;
alter table public.social_performance_snapshots enable row level security;
alter table public.social_performance_metric_values enable row level security;

drop policy if exists service_role_all_social_credential_references on public.social_credential_references;
create policy service_role_all_social_credential_references
  on public.social_credential_references for all to service_role using (true) with check (true);

drop policy if exists service_role_all_social_authorization_grants on public.social_authorization_grants;
create policy service_role_all_social_authorization_grants
  on public.social_authorization_grants for all to service_role using (true) with check (true);

drop policy if exists service_role_all_social_provider_identities on public.social_provider_identities;
create policy service_role_all_social_provider_identities
  on public.social_provider_identities for all to service_role using (true) with check (true);

drop policy if exists service_role_all_social_identity_grant_bindings on public.social_identity_grant_bindings;
create policy service_role_all_social_identity_grant_bindings
  on public.social_identity_grant_bindings for all to service_role using (true) with check (true);

drop policy if exists service_role_all_social_accounts on public.social_accounts;
create policy service_role_all_social_accounts
  on public.social_accounts for all to service_role using (true) with check (true);

drop policy if exists service_role_all_social_publications on public.social_publications;
create policy service_role_all_social_publications
  on public.social_publications for all to service_role using (true) with check (true);

drop policy if exists service_role_all_social_performance_snapshots on public.social_performance_snapshots;
create policy service_role_all_social_performance_snapshots
  on public.social_performance_snapshots for all to service_role using (true) with check (true);

drop policy if exists service_role_all_social_performance_metric_values on public.social_performance_metric_values;
create policy service_role_all_social_performance_metric_values
  on public.social_performance_metric_values for all to service_role using (true) with check (true);

revoke all on public.social_credential_references from anon, authenticated;
revoke all on public.social_authorization_grants from anon, authenticated;
revoke all on public.social_provider_identities from anon, authenticated;
revoke all on public.social_identity_grant_bindings from anon, authenticated;
revoke all on public.social_accounts from anon, authenticated;
revoke all on public.social_publications from anon, authenticated;
revoke all on public.social_performance_snapshots from anon, authenticated;
revoke all on public.social_performance_metric_values from anon, authenticated;

grant all on public.social_credential_references to service_role;
grant all on public.social_authorization_grants to service_role;
grant all on public.social_provider_identities to service_role;
grant all on public.social_identity_grant_bindings to service_role;
grant all on public.social_accounts to service_role;
grant all on public.social_publications to service_role;
grant all on public.social_performance_snapshots to service_role;
grant all on public.social_performance_metric_values to service_role;
