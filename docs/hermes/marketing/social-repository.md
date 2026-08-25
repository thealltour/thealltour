# Social Repository & Migration Verification (STEP 3-5)

Server-side data-access for STEP 3-4 social persistence.  
**No OAuth, CredentialStore secret resolution, SNS API, publishing, or performance collection.**

- `PUBLICATION_FLOW_INACTIVE=true`
- `SNS_SIDE_EFFECTS_STEP_3_5=0`

## 1. Repository boundaries

| Layer | Role |
|---|---|
| Domain (`domain/*`) | Pure types + eligibility |
| Persistence DTOs (`persistence/types.ts`) | Row-shaped records |
| **Repository** (`repository/*`) | CRUD + invariants + reauth transaction |
| Safe projections | Agent/MCP/cron-safe views (no store handles) |

Future consumers import repository APIs — not raw SQL:

- Meta OAuth / account discovery
- Publication Orchestrator
- PerformanceCollector

**Never** import repository from browser/client components. Supabase impl is `server-only`.

## 2. Authoritative IdentityGrantBinding relationship

```
SocialAccount → ProviderIdentity → IdentityGrantBinding → AuthorizationGrant → CredentialReference
```

`resolveAccountAuthorization(accountId)`:

1. Load account + identity
2. Find **active** binding for the identity
3. Load grant; require `status === active`
4. Soft pointer is **ignored** as authority

## 3. Soft-pointer behavior

`social_accounts.active_authorization_grant_id` is convenience only.

- Soft pointer alone **never** confers authorization
- Stale pointer at a revoked grant → `usable=false` when no active binding
- Null soft pointer + active binding → `usable=true`

## 4. Grant replacement / reauthorization transaction

`reauthorizeIdentity()`:

1. Create CredentialReference metadata
2. Create new AuthorizationGrant
3. Revoke old bindings + mark old grant revoked
4. Bind same ProviderIdentity to new grant
5. Update SocialAccount soft pointers

**InMemory:** snapshot rollback on failure.  
**Supabase:** application-level compensating rollback (best-effort). Prefer a future SQL RPC for true atomicity.

ProviderIdentity rows are **never** deleted.

## 5. SocialAccount / ProviderIdentity flow

1. `upsertProviderIdentity` (stable by provider+kind+external_id)
2. `registerSocialAccount` (provider/channel must match `CHANNEL_PROVIDER` and identity)
3. Bind grant → set soft pointer optionally
4. `updateSocialAccountStatus` for connected/disconnected/disabled

## 6. CredentialReference safe projection

Internal repository may return `storeHandle`.  
Agent-facing APIs must use:

- `toSafeAuthorizationProjection` → `hasCredentialReference: boolean` only
- `toSafeSocialAccountProjection` → no grant/credential fields

Do not place store handles in prompts, MCP, cron output, or AI Memory.

## 7. Publication idempotency

`createPendingPublication`:

- Requires `idempotencyKey`
- If `(social_account_id, idempotency_key)` exists → `SocialIdempotencyConflictError` (no silent duplicate)
- DB unique index enforces the same rule under concurrency

One `content_id` may map to many publications (multi-channel).

## 8. Performance persistence access

- Account-scope: `social_publication_id` must be null
- Publication-scope: publication id required
- Metrics stored as normalized `(snapshot_id, metric_type)` rows

Performance Analyst remains provider-agnostic; reads normalized data only.

## 9. RLS / server-only access

STEP 3-4 policies: **service_role only**; `anon`/`authenticated` revoked.

Repository uses `supabaseAdmin` (service role) on the server.  
Client-side Supabase anon must not read social credential/grant tables.

## 10. Migration verification result

**Runtime applied and verified** against a local Docker Postgres (`pgvector/pgvector:pg17`) with minimal FK stubs (`ai_contents`, `ai_publications`, `ai_runs`).

Verified:

- migration SQL applies (tables/indexes/FKs/checks)
- all 8 `social_*` tables created; row counts 0 (no seed)
- no token/secret columns
- RLS enabled on all social tables
- service_role policies + revoke anon/authenticated (roles created to match Supabase)
- anon lacks SELECT on credential references
- publication idempotency unique index rejects duplicate `(social_account_id, idempotency_key)`

Note: full `supabase start` stack was still downloading images on this host; verification used an equivalent local Postgres 17 container rather than claiming Supabase CLI `db reset` completed.

## 11. Implementations

| Impl | Path | Use |
|---|---|---|
| InMemory | `inMemorySocialRepository.ts` | Unit tests / local without DB |
| Supabase | `supabaseSocialRepository.ts` | Server runtime |
| Factory | `createSocialRepository()` | Picks backend |

## Related

- [social-persistence.md](./social-persistence.md)
- [social-account-credentials.md](./social-account-credentials.md)
