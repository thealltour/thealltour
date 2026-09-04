# Agenda Production Queue Worker (G-7)

Pi-side durable consumer for `daily_marketing_production_requests`.

## Architecture

```
Browser (Morning Review)
  -> SELECTED_TODAY + enqueue only
  -> Supabase QUEUED rows

Pi worker (this document)
  -> atomic claim QUEUED|stale RUNNING -> RUNNING
  -> runDailyMarketingProductionFromSelection (exact slate selection)
  -> CompletedMarketingCandidate + HumanMarketingReview bootstrap
  -> request COMPLETED | FAILED
```

- **Not** Hermes agent cron for polling.
- Hermes remains inside CS/GA reasoning when the production pipeline invokes specialists.
- **No SNS publish.** Human Review boundary is preserved.

## CLI

```bash
cd /home/ysh/thealltour

# Inspect only — no claim, no AI
npx tsx scripts/process-marketing-production-queue.ts --dry-run

# Process up to 3 requests sequentially
npx tsx scripts/process-marketing-production-queue.ts --max-batch 3
```

Useful flags:

| Flag | Meaning |
|------|---------|
| `--dry-run` / `--inspect` | List claimable; no mutations |
| `--max-batch N` | Cap ≤ 3 |
| `--stale-after-ms` | Default 1800000 (30m) |
| `--worker-id` | Non-secret identity |
| `--backend memory` | Local tests only |

## Atomic claim + ownership

Postgres RPC `claim_daily_marketing_production_request` uses `FOR UPDATE SKIP LOCKED`
and mints a per-claim `claim_token`.

Finalize RPCs CAS on `(claim_token, attempt_count, worker_id)` while `status=RUNNING`.
A superseded stale worker’s late COMPLETED/FAILED is rejected (`ownership_lost`).

Stale `RUNNING` (claimed older than lease) may be reclaimed because production
`logical_run_key` is idempotent. Fresh `RUNNING` is never reclaimed.

## Human Review boundary

A request becomes `COMPLETED` only after the Human Review boundary is established:

- candidate missing → run `runDailyMarketingProductionFromSelection`
- candidate exists → **do not** re-run AI; idempotently `bootstrapHumanReviewForCandidate`
- HMR recovery/bootstrap `failed` → request `FAILED` (never false COMPLETED)

## Stale lease duration

Default: **30 minutes** (`DEFAULT_PRODUCTION_REQUEST_STALE_AFTER_MS`).

Operational assumption (no live duration telemetry available to tune tighter):

- specialist Hermes timeout is **180s** (`MARKETING_CRON_HERMES_TIMEOUT_MS`)
- a full selection→CS→GA path is expected well under ~10 minutes
- 30m is intentionally above that envelope so mid-flight workers are not reclaimed

Override:

- CLI `--stale-after-ms`
- env `MARKETING_PRODUCTION_STALE_AFTER_MS`

## systemd (prepare only — do not enable in G-7 implementation)

Repo artifacts:

- `deploy/systemd/thealltour-marketing-production-queue.service`
- `deploy/systemd/thealltour-marketing-production-queue.timer`

Install later (acceptance), after review:

```bash
sudo cp deploy/systemd/thealltour-marketing-production-queue.service /etc/systemd/system/
sudo cp deploy/systemd/thealltour-marketing-production-queue.timer /etc/systemd/system/
sudo systemctl daemon-reload
# ONLY after explicit acceptance:
# sudo systemctl enable --now thealltour-marketing-production-queue.timer
```

Secrets stay in `/home/ysh/thealltour/.env.local` (same pattern as `thealltour-internal.service`).

## Migration order (before real acceptance)

1. `20260904120000_daily_marketing_agenda_slates.sql`
2. `20260904130000_daily_marketing_production_requests.sql`
3. `20260904140000_marketing_production_request_claim.sql`

Do not apply in G-7 coding step unless a dedicated local/staging acceptance run is authorized.

## Safe acceptance procedure (do not run until reviewed)

A. Apply migrations 1→3 on the target DB
B. Generate today's slate (local/staging — **not** the live 09:00 cron unless authorized)
C. Inspect 5–8 candidates in Morning Review
D. Human-select **ONE** candidate (`SELECTED_TODAY`)
E. Click production request enqueue — confirm `QUEUED`, `executedProduction: false`
F. Worker `--dry-run` — see that one claimable row; statuses unchanged
G. Worker real execution once (`--max-batch 1`)
H. Verify exactly one `CompletedMarketingCandidate` for that `logical_run_key`
I. Verify exactly one `HumanMarketingReview` for that candidate
J. Re-run worker — no duplicate candidate/HMR; request stays `COMPLETED`
K. Inspect Morning Review: request status COMPLETED + candidate link

## Non-goals

- Automatic FAILED retry loops
- Parallel production
- Manual retry UX
- Hermes queue polling
