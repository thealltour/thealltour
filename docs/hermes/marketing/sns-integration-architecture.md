# Official SNS Integration Architecture (STEP 3-1)

Contracts only. **Zero external SNS side effects.** No OAuth, credentials, live API calls, browser automation, or DB migrations.

## 1. Publication vs Performance Collection

| Layer | Direction | Port | Must not |
|---|---|---|---|
| Publication | AI Marketing → SNS | `PublicationAdapter` | collect metrics |
| Performance Collection | SNS → AI Marketing | `PerformanceCollector` | publish / send / post |

Do **not** merge both into one “SNS service”.

Code: `src/lib/marketing/social/`

## 2. Provider vs Channel

Provider (API vendor) ≠ Channel (marketing surface).

| Channel | Provider |
|---|---|
| instagram, facebook, threads | meta |
| youtube | google |
| naver_blog, naver_band | naver |
| kakao_channel | kakao |
| tiktok | tiktok |

See `domain/providers.ts` (`CHANNEL_PROVIDER`).

## 3. MarketingPost vs Publication vs PerformanceSnapshot

```
MarketingPost (internal content)
   ├── ExternalPublication (instagram)
   ├── ExternalPublication (facebook)
   └── ExternalPublication (youtube)

PerformanceSnapshot → belongs to publication or account
                      (not directly to MarketingPost)
```

- **MarketingPost** — governed draft / content object  
- **ExternalPublication** — one provider placement + external id  
- **PerformanceSnapshot** — metrics at a point in time  

Do **not** reuse `thread_marketing_posts` as the external publication store. Future persistence concepts (later STEPs): `social_accounts`, `social_publications`, `performance_snapshots`.

## 4. Governance boundary

No `PublicationAdapter` may be invoked by:

- Content Strategist  
- Marketing Manager  
- Governance Auditor  
- Performance Analyst  
- Cron scripts (`cron_daily_performance`, `cron_daily_plan`)  
- MCP tools  

Future flow (inactive in 3-1):

```
Content → Governance → Human Approval
  → Publication Orchestrator → Publication Adapter → Official API
```

Enforced by `assertCanInvokePublicationAdapter()` — while `PUBLICATION_FLOW_INACTIVE === true`, **every** caller is denied (including the future orchestrator).

## 5. Future provider adapter pattern

1. Survey official APIs per channel (STEP 3-2)  
2. Update `SOCIAL_CAPABILITY_REGISTRY` (publication / account metrics / publication metrics)  
3. Implement `providers/<vendor>/` adapters that satisfy the ports  
4. Wire credentials & persistence in later STEPs  
5. Activate Publication Orchestrator only after Human Approval  

STEP 3-1 ships `createUnsupportedPublicationAdapter` / `createUnsupportedPerformanceCollector` — always `unsupported` / `unavailable`, **no network**.

## 6. Why Performance Analyst does not call SNS APIs

Analyst stays **provider-agnostic**:

```
Official SNS APIs
  → PerformanceCollector
  → normalized storage
  → PerformanceMemorySource / DB counts
  → Performance Analyst → PerformanceBrief → Manager
```

`assertPerformanceAnalystDoesNotCallCollector` encodes the boundary. Cron 08:30 continues to read internal DB/artifact only.

## 7. STEP 3-1 / 3-2 / 3-3 side effects

`SNS_SIDE_EFFECTS_STEP_3_1 = 0`  
`SNS_SIDE_EFFECTS_STEP_3_2 = 0`  
`SNS_SIDE_EFFECTS_STEP_3_3 = 0`

Capability registry (STEP 3-2) uses `supported|unsupported|conditional|unknown` — see [sns-capability-matrix.md](./sns-capability-matrix.md).  
Account/credential contracts (STEP 3-3) — see [social-account-credentials.md](./social-account-credentials.md).  
`PUBLICATION_FLOW_INACTIVE` remains true.

## Related

- [performance-collection.md](./performance-collection.md)  
- [human-approval.md](./human-approval.md)  
- [cron-plan.md](./cron-plan.md)  
