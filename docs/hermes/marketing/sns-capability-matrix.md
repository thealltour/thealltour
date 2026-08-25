# Official SNS API Capability Matrix (STEP 3-2)

Research + architecture metadata only. **SNS side effects = 0.**  
No OAuth, tokens, live API calls, adapters, collectors, or DB migrations.

STEP 3-1 ports (`PublicationAdapter` / `PerformanceCollector`) stay unchanged.  
`PUBLICATION_FLOW_INACTIVE` remains **true**.

## Capability status model

| Status | Meaning | `isPublicationSupported()` |
|---|---|---|
| `supported` | Unconditional official support | `true` |
| `conditional` | Official API exists; prerequisites required | `false` |
| `unsupported` | No suitable official surface for this use | `false` |
| `unknown` | Official docs ambiguous | `false` |

**Never collapse `conditional` / `unknown` into boolean true.**

Automation classification (independent of boolean helpers):

| Class | Meaning |
|---|---|
| `API_AUTOMATION` | Official publish API is a realistic future automated path |
| `PARTIAL_API` | Useful official capability, but incomplete for full publish+metrics automation |
| `HUMAN_PUBLISH` | AI prepares package; human posts on SNS (valid production path) |

Publish capability and performance capability are **independent**.

## Matrix

| Channel | Provider | Publication | Account metrics | Publication metrics | Media | Automation | Confidence |
|---|---|---|---|---|---|---|---|
| instagram | meta | conditional | conditional | conditional | image, carousel, video, reel, story | API_AUTOMATION | high |
| facebook | meta | conditional | conditional | conditional | text, link, image, video, carousel | API_AUTOMATION | high |
| threads | meta | conditional | conditional | conditional | text, image, video, carousel, link | API_AUTOMATION | high |
| youtube | google | conditional | conditional | conditional | video, reel | PARTIAL_API | high |
| naver_blog | naver | conditional | unsupported | unsupported | text, image, link | PARTIAL_API | medium |
| naver_band | naver | conditional | unknown | unknown | text, image | PARTIAL_API | medium |
| kakao_channel | kakao | unsupported | unsupported | unsupported | — | HUMAN_PUBLISH | medium |
| tiktok | tiktok | conditional | unknown | conditional | video, image, reel | PARTIAL_API | high |

Code source of truth: `src/lib/marketing/social/providers/capabilityRegistry.ts`

### API_AUTOMATION

- **instagram** — Content Publishing + Insights (professional account, app review, rate limits)
- **facebook** — Pages API feed/photos (Page token, tasks)
- **threads** — Threads posts + insights APIs

### PARTIAL_API

- **youtube** — video upload + Analytics APIs; no text/image feed posts
- **naver_blog** — writePost login API; no verified official insights API
- **naver_band** — write_post; marketing metrics surface unclear
- **tiktok** — Content Posting API (audit for public); account metrics unclear

### HUMAN_PUBLISH

- **kakao_channel** — Developers APIs are relationship/add-friend oriented; Biz messaging is a different product (dealer/BizMessage), not modeled as feed publish

## Official sources (primary)

| Channel | Sources |
|---|---|
| Instagram | [Content Publishing](https://developers.facebook.com/docs/instagram-platform/content-publishing), [media_publish](https://developers.facebook.com/docs/instagram-platform/instagram-graph-api/reference/ig-user/media_publish/), [Insights](https://developers.facebook.com/docs/instagram-platform/insights) |
| Facebook | [Pages posts](https://developers.facebook.com/docs/pages-api/posts/), [Page feed](https://developers.facebook.com/docs/graph-api/reference/page/feed/), [Page photos](https://developers.facebook.com/docs/graph-api/reference/page/photos/) |
| Threads | [Posts](https://developers.facebook.com/docs/threads/posts/), [Insights](https://developers.facebook.com/docs/threads/insights/) |
| YouTube | [videos.insert](https://developers.google.com/youtube/v3/docs/videos/insert), [Upload guide](https://developers.google.com/youtube/v3/guides/uploading_a_video), [Analytics](https://developers.google.com/youtube/analytics) |
| Naver Blog | [API list](https://developers.naver.com/docs/common/openapiguide/apilist.md), [writePost](https://developers.naver.com/docs/blog/post/) |
| Naver Band | [BAND API](https://developers.band.us/develop/guide/api), [write_post](https://developers.band.us/develop/guide/api/write_post) |
| Kakao Channel | [Channel](https://developers.kakao.com/docs/ko/kakaotalk-channel/common), [Message overview](https://developers.kakao.com/docs/ko/kakaotalk-message/common) |
| TikTok | [Content Posting get started](https://developers.tiktok.com/doc/content-posting-api-get-started), [Direct Post](https://developers.tiktok.com/doc/content-posting-api-reference-direct-post) |

Blogs / unofficial wrappers were **not** used as primary evidence.

## Prerequisites (codes)

Machine codes in registry (not vendor prose):

- `professional_or_business_account`
- `page_or_channel_ownership`
- `oauth_user_authorization`
- `app_review_or_permission_approval`
- `provider_app_audit`
- `page_access_token`
- `biz_partner_or_dealer_contract`
- `verified_media_host_domain`
- `quota_or_rate_limits`

## Credential families (planning only — no secrets)

| Provider | Families |
|---|---|
| meta | OAuth user + Page/IG token + app credentials |
| google | OAuth user + Google Cloud OAuth client |
| naver | Naver Login OAuth + client id/secret |
| kakao | Biz partner API key / dealer (if messaging); not feed OAuth for this matrix |
| tiktok | OAuth user + TikTok developer app; client audit |

**Do not** create env vars, tokens, or OAuth apps in this STEP.

## Future flows (inactive)

### API_AUTOMATION publication

```
Content → Governance → Human Approval
  → Publication Orchestrator → PublicationAdapter → Official API
```

Still blocked by `assertCanInvokePublicationAdapter` / `PUBLICATION_FLOW_INACTIVE`.

### HUMAN_PUBLISH

```
Content → Governance → Human Approval
  → Human Publication Package
  → Human posts on SNS
  → optional later record of external publication id
```

Browser automation is **not** the fallback (`browserAutomationAllowed: false`).

### Performance

```
Official Provider API → PerformanceCollector → normalize → persistence
  → Performance Analyst (provider-agnostic) → PerformanceBrief → Manager
```

Analyst/cron must not call SNS APIs directly.

## Why publish ≠ performance

Official products often split write scopes from insights scopes (e.g. Threads `threads_content_publish` vs `threads_manage_insights`).  
A channel can publish via API while metrics remain unsupported/unknown (Naver Blog), or have metrics paths without being the preferred publish path.

## Unknown / conditional callouts

- TikTok **account** metrics: unknown (publish path verified; account analytics product less clear)
- Naver Band metrics: unknown
- Naver Blog metrics: unsupported (no verified insights API)
- Kakao Channel feed publish: unsupported on Developers surface
- All Meta/Google/TikTok publish: **conditional** (account type, OAuth, review/audit, quotas)

## Schema notes (later STEPs)

External account IDs, publication IDs, container/creation IDs, publish status, metric windows — see `futureSchemaNotes` per channel. **No migrations in 3-2.**

## Related

- [sns-integration-architecture.md](./sns-integration-architecture.md) (STEP 3-1 contracts)
- [performance-collection.md](./performance-collection.md)
- [human-approval.md](./human-approval.md)
