# Shortform Global Source Catalog v1 (SV-2)

Contract SoT (code):

- [`src/lib/marketing/assets/sourceCatalog/`](../../src/lib/marketing/assets/sourceCatalog/)
- migration (not applied in SV-2 coding step):
  [`supabase/migrations/20260911050000_marketing_media_sources.sql`](../../../supabase/migrations/20260911050000_marketing_media_sources.sql)

Storage / retention policy SoT remains SV-1:

- [shortform-asset-storage-policy-v1.md](./shortform-asset-storage-policy-v1.md)

## Architecture

```text
Global Catalog
        |
        | PICK (marketing_media_source_usages)
        v
Candidate HDD Package  = production artifact SoT
```

| Layer | Role |
|-------|------|
| **Global Source Catalog** | Source identity / provenance / rights / location / reuse index |
| **Candidate Package** | Production artifact SoT under `MARKETING_ASSET_ROOT` |
| Catalog | ≠ file archive, ≠ rendering system, ≠ provider search system |

SV-2 does **not** make the catalog a mandatory dependency of the existing production pipeline.

## Tables

### `marketing_media_sources`

One row = one reusable media source identity (may exist without a local binary).

Key fields:

- `source_kind` / `storage_class` / `disposition` — reuse SV-1 enums
- `provider` + `provider_asset_id` — durable external identity
- `remote_asset_url` (+ optional expiry) — temporary delivery URL (not identity)
- `managed_relative_path` — `MARKETING_ASSET_ROOT`-relative only (no absolute paths)
- rights: `rights_kind`, license/attribution notes
- `is_pinned`, `status` (`active` / `unavailable` / `archived`)
- `sha256` — searchable, **not** global-unique

### `marketing_media_source_usages`

Thin **PICK** relation:

- `source_id` → catalog row
- `candidate_id` / optional `production_request_id` — soft text business IDs
- optional `scene_key`
- `relation = picked` only in SV-2

## Invariants

```text
PICK != INGEST
provider identity != CDN URL
sha256 != provenance identity
unknown rights != commercial clearance
external_ref does not require managed_relative_path
```

- Duplicate `(provider, provider_asset_id)` prevented (partial unique index).
- Same `sha256` may exist under different provenance rows.
- PICK does **not** mutate `storage_class` / `disposition` to ingest.
- Pinned / `local_master` / SV-1 never-delete classes remain protected (judgment only; no sweeper).

## Security

- RLS enabled; `service_role` only (no anon/authenticated policies).
- No API keys / tokens in schema.
- Browser direct Supabase access is not opened.

## Out of scope (SV-2)

Provider HTTP clients, stock search/download, Asset Picker UI, Remotion, VideoRenderJob,
Mini-PC worker, cleanup executor, OBS shortform spans, Human Review / publication changes.
