# Social Persistence Schema (STEP 3-4)

Durable DB identities for Official SNS integration. **Schema only.**  
No OAuth, CredentialStore implementation, SNS API, publishing, or performance collection.

- `PUBLICATION_FLOW_INACTIVE=true`
- `SNS_SIDE_EFFECTS_STEP_3_4=0`
- Migration: `supabase/migrations/20260825180000_social_persistence_schema.sql`

## 1. Entity relationships (ER)

```
social_credential_references
        ▲
        │ credential_reference_id
social_authorization_grants
        ▲
        │ authorization_grant_id
social_identity_grant_bindings ◄──── social_provider_identities
        │                                     ▲
        │                                     │ provider_identity_id
        │                              social_accounts
        │                                     │
        │                                     │ social_account_id
        │                              social_publications ──► (optional) ai_contents
        │                                     │                 (optional) ai_publications
        │                                     │                 (optional) ai_runs (governance)
        │                                     ▼
        │                    social_performance_snapshots
        │                                     │
        │                                     ▼
        │                    social_performance_metric_values

Ownership chain (credentials):
  SocialAccount → ProviderIdentity → IdentityGrantBinding
    → AuthorizationGrant → CredentialReference
```

`thread_marketing_posts` is **not** the external publication model.

## 2. SocialAccount vs ProviderIdentity lifecycle

| Entity | Lifetime |
|---|---|
| **ProviderIdentity** | Stable provider-native identity (Page / IG Pro / Threads / YT channel). Survives grant revoke. |
| **SocialAccount** | Internal managed binding of one identity to one marketing **channel**. |

Deleting/revoking an AuthorizationGrant must **not** destroy ProviderIdentity rows.  
SocialAccount does **not** own credential material (`credential_reference_id` is absent).

Soft pointer only: `social_accounts.active_authorization_grant_id` (convenience; binding table is truth).

## 3. AuthorizationGrant lifecycle

Statuses (application-level text): `pending | active | expired | revoked | invalid`.

Fields include opaque `credential_reference_id`, `permissions` JSONB array, issue/expiry, `refresh_supported`, `reauthorization_required`.

**Permissions storage choice:** JSONB array of `{ "code", "label?" }` on the grant row — simplest safe model matching existing marketing JSON conventions. Not a child table; static capability prerequisites remain in the registry.

## 4. Identity ↔ authorization relationship

`social_identity_grant_bindings` unique on `(provider_identity_id, authorization_grant_id)`.

Reauthorization flow:

1. Old grant → `revoked`; old bindings → `revoked`
2. New grant → `active` with new CredentialReference
3. New active bindings to the **same** ProviderIdentity rows
4. SocialAccounts update `active_authorization_grant_id` to the new grant

## 5. CredentialReference storage boundary

`social_credential_references` stores only:

- `store_kind`
- opaque `store_handle`
- `provider`
- `credential_family`

**Never** access tokens, refresh tokens, OAuth codes, or client secrets.  
Future secret material stays behind CredentialStore (unimplemented).

## 6. MarketingPost vs ExternalPublication

| Concept | Storage |
|---|---|
| MarketingPost (master content) | `ai_contents` |
| Channel history (legacy bridge) | optional `ai_publications` |
| External SNS publication identity | **`social_publications`** |

One `content_id` may map to many `social_publications` (multi-channel / retries).  
Do not repurpose `thread_marketing_posts`.

Pending publications may omit `external_post_id` until a future publish succeeds.

## 7. PerformanceSnapshot model

`social_performance_snapshots`:

- `scope = account` ⇒ `social_publication_id` must be null
- `scope = publication` ⇒ `social_publication_id` required

Metrics in `social_performance_metric_values` as `(snapshot_id, metric_type)` unique rows — pragmatic normalization (ai_feedback-style), not unbounded EAV.

Performance belongs to account and/or publication — **not** directly to MarketingPost.  
Performance Analyst still consumes normalized artifacts only; no provider API calls in this step.

## 8. Future publication idempotency

Schema support (orchestrator not implemented):

1. Unique `(social_account_id, idempotency_key)` where key is set — retries reuse the same pending/publishing row
2. Unique `(provider, channel, external_post_id)` where external id is set — prevents double-recording the same provider post
3. Status lifecycle: `pending → publishing → published | failed | …`

## 9. Governance / approval reference strategy

Hooks on `social_publications` only — no duplicated governance system:

- `governance_decision` (text evidence of ALLOW/REVIEW/BLOCK outcome)
- `governance_run_id` → `ai_runs`
- `human_approval_ref` (opaque evidence id)

Not reducible to `approved=true`. Eligibility remains inactive.

## 10. Why secrets are not in these tables

Marketing tables are queried, logged, and joined across agents/cron. Tokens would leak into memory, MCP, and prompts. Only opaque store handles belong here; materialization is future adapter-runtime only.

## 11. Migration created

`20260825180000_social_persistence_schema.sql`

- Schema changes only (no inserts)
- uuid + timestamptz conventions (match `ai_marketing_v1`)
- RLS: `service_role` only; revoke `anon` / `authenticated`

## Related

- [social-repository.md](./social-repository.md)
- [social-account-credentials.md](./social-account-credentials.md)
- [sns-integration-architecture.md](./sns-integration-architecture.md)
- [sns-capability-matrix.md](./sns-capability-matrix.md)
- [human-approval.md](./human-approval.md)
