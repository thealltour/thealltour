# Social Account & Credential Architecture (STEP 3-3)

Architecture/contracts only. **OAuth / tokens / SNS API / migrations = 0.**  
`PUBLICATION_FLOW_INACTIVE=true`. `SNS_SIDE_EFFECTS_STEP_3_3=0`.

## 1. SocialAccount vs ProviderIdentity

| Concept | Role |
|---|---|
| **ProviderIdentity** | External entity returned by a provider (Facebook Page, IG Professional, Threads profile, YouTube channel, …) |
| **SocialAccount** | thealltour marketing binding of one ProviderIdentity to one **channel** |

Rules:

- One `AuthorizationGrant` may expose **many** ProviderIdentities.
- One credential/login is **not** one channel and **not** one SocialAccount.
- SocialAccount carries `provider` + `channel` (must match `CHANNEL_PROVIDER`) and optional `activeAuthorizationGrantId` (soft pointer).
- Credentials live on **AuthorizationGrant → CredentialReference** only.
- **No raw tokens on SocialAccount.**

## 2. AuthorizationGrant

Runtime authorization state:

- `status`: `pending | active | expired | revoked | invalid`
- `permissions[]`: provider-native permission/scope/task **codes** (not static capability prerequisites)
- `credentialRef`: opaque handle
- `providerIdentityIds[]`: identities under this grant
- optional `expiresAt` / `refreshSupported` / lifecycle hints

Static required prerequisites stay in the **capability registry**.  
Runtime granted permissions stay on the **grant**.

## 3. CredentialReference / CredentialStore

```
CredentialReference { kind, storeHandle, provider, family }
```

- Opaque `storeHandle` only (rejects token-like substrings).
- Future `CredentialStore`: resolve / rotate / revoke — **not implemented**.
- Do **not** default to plaintext DB, `.env`, Hermes config, AI Memory, prompts, cron output, or MCP responses as the production store (`DISALLOWED_DEFAULT_CREDENTIAL_STORE_TARGETS`).

`assertNoRawCredentialMaterial()` rejects forbidden keys (`access_token`, `refresh_token`, `client_secret`, …) on public domain trees.

## 4. Static capability vs runtime state

| Layer | Answers |
|---|---|
| Capability registry (3-2) | What *can* this channel support, with which prerequisites? |
| Account / grant / credential ref (3-3) | Does *this* connected identity currently satisfy runtime state? |

Conditional capability ≠ active support. Eligibility still requires independent runtime evidence.

## 5. Scope / permission model

`PermissionGrant.code` holds provider strings (`instagram_content_publish`, YouTube OAuth scope URI, etc.).  
Naming is provider-neutral; values are provider-specific. Not all providers call these “scopes”.

## 6. Meta-first example

`buildMetaMultiIdentityExample()`:

```
AuthorizationGrant (meta, active) → CredentialReference
  bindings → ProviderIdentity facebook_page  → SocialAccount(facebook)
  bindings → ProviderIdentity instagram_professional → SocialAccount(instagram)
  bindings → ProviderIdentity threads_profile → SocialAccount(threads)
```

Same opaque credential reference; three channels. No Graph/OAuth calls.  
Grant replacement keeps ProviderIdentity rows; new bindings + new CredentialReference.


## 7. Credential lifecycle (future)

Modelled as metadata only:

- expiration awareness (`expiresAt`)
- refresh/renewal where provider supports it (`refreshSupported`)
- revoked / invalid grant status
- credential rotation via CredentialStore
- re-authorization flag

No refresh cron in STEP 3-3.

## 8. Security boundary

Raw credentials must not enter:

MarketingPost · ExternalPublication · PerformanceSnapshot · capability registry · Hermes prompts · cron output · AI Memory · logs · MCP normal responses · fixtures

Performance Analyst stays provider-agnostic and never receives tokens.

## 9. Publication eligibility factors

`evaluatePublicationEligibility()` requires **all** of:

1. publication flow active (`PUBLICATION_FLOW_INACTIVE === false`) — currently **false**
2. channel capability actionable (`supported` or `conditional`)
3. SocialAccount connected
4. ProviderIdentity linked
5. AuthorizationGrant active
6. CredentialReference present
7. Governance ALLOW
8. Human Approval

Not reducible to `approved=true` or `hasToken=true`.  
While flow is inactive, **eligible is always false**.

Future path:

```
Content → Governance → Human Approval
  → Publication Orchestrator → Credential Resolution
  → PublicationAdapter → Official API
```

## 10. Why credentials stay out of AI Memory / prompts

Memory and prompts are retrieved, logged, and handed across agents. Tokens would leak across roles, cron artifacts, and Desktop sessions. Only an opaque store handle may appear in marketing domain objects; materialization is adapter-runtime only (future).

## Persistence (STEP 3-4)

Implemented in [social-persistence.md](./social-persistence.md) / migration `20260825180000_social_persistence_schema.sql`.  
Identity↔grant via `social_identity_grant_bindings`. Do not store raw tokens. Do not reuse `thread_marketing_posts`.

## Related

- [social-persistence.md](./social-persistence.md)
- [sns-integration-architecture.md](./sns-integration-architecture.md)
- [sns-capability-matrix.md](./sns-capability-matrix.md)
- [human-approval.md](./human-approval.md)
