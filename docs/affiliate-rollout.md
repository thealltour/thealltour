# Planner Affiliate percent canary (PR-9G)

## Gate order

```
MASTER kill switch (ENABLE_PLANNER_AFFILIATE_ROUTER)
  → PLANNER_AFFILIATE_ROLLOUT_PERCENT
  → deterministic sha256 bucket (0–99)
  → eligible session / routing rules
  → Aviasales (and future enabled providers)
```

- No `Math.random()`. Bucket = `sha256(key)` first 4 bytes `% 100`.
- Invalid / blank / out-of-range percent → **0** (never treat as 100).
- **Do not** gate `/r/affiliate/[token]` by percent or master — issued tokens stay valid.
- **Do not** add `provider.rolloutPercent`. Provider `enabled` flags are separate (Aviasales true; WeGoTrip/Airalo false).

## Identity

Prefer `planner_sessions.anonymous_key` when present (**user-stable** / browser-anonymous stable across sessions). Else `planner_session_id` (**session-stable**). No new cookies, IP, UA, email, or Kakao identity. Never log or send the raw rollout key to client analytics.

## Offers API excluded response

**Choice: empty DTO `200`** (`summary/preparation/days` empty, `disclosure: null`).

`PlannerAffiliateOffers` already soft-fails on `!res.ok` with no user-visible error. When master is on and percent is low, 404 for every excluded request would inflate error/404 monitoring. Empty DTO matches soft-fail / no-offer paths.

Master **false** still returns **404** (unchanged kill switch).

## Stages (manual only — no cron auto-rollout)

| Stage | MASTER | PERCENT | Notes |
|------:|--------|--------:|-------|
| 0 | false | 0 | Production safe default (committed) |
| 1 | true | 5 | First canary — watch 24h |
| 2 | true | 20 | Expand if GO |
| 3 | true | 50 | Expand if GO |
| 4 | true | 100 | Full after soak |

Rollback: set `PLANNER_AFFILIATE_ROLLOUT_PERCENT=0` (stops new issuance) and/or `ENABLE_PLANNER_AFFILIATE_ROUTER=false`. Existing redirect tokens continue to work.

## GO / NO-GO checklist

**GO** only if:

- Error rate / soft-fail rate on offers API stable vs baseline
- Click → 302 success rate healthy for issued tokens
- No secret leakage in client payloads / logs
- Aviasales only (WeGoTrip/Airalo still `enabled:false`)
- Impression volume roughly tracks expected percent × eligible traffic

**NO-GO / rollback** if:

- Provider / Partner Links error storm
- Elevated 5xx on offers or redirect
- Attribution / token persist failures
- User-visible Result regressions

## Monitoring (real columns)

Tables: `affiliate_events`, `affiliate_offer_tokens` (see `supabase/migrations/20260907110000_planner_affiliate_router_v0.sql`).

Use `docs/sql/affiliate-rollout-ops.sql` for copy-paste ops queries.

Exposed traffic proxy (migration NONE): count `affiliate_events` where `event_type = 'impression'` — excluded canary never builds tokens, so no impressions.

Optional server log: `affiliate_offer_build_failed` (structured `console.info`, no secrets / no raw keys).

## Next production canary values (manual — do NOT set in this PR)

```
ENABLE_PLANNER_AFFILIATE_ROUTER=true
PLANNER_AFFILIATE_ROLLOUT_PERCENT=5
```

Also ship a client build with `ENABLE_PLANNER_AFFILIATE_ROUTER = true` (or equivalent) so Result UI fetches offers; server env alone does not flip the client constant.

Production Vercel env is **not** changed by PR-9G implementation.
