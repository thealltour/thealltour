# AI Runtime Shared Observability

STEP 2-5.UI-0.3 — process-local execution with shared historical telemetry.

## Separation of concerns

| Layer | Storage | Purpose |
|-------|---------|---------|
| **Execution control** | Process-local in-memory | Scheduler queue, active reservations, Router state, Quota Broker SoT, retry/defer |
| **Shared telemetry** | PostgreSQL `ai_runtime_observability_events` | Cross-process Admin Console history (Cron → Console) |

Admin Console:

- **Live (this process)** — Running / Active Reservations / local scheduler snapshot
- **Historical / Shared** — Last 1h activity, provider usage, recent jobs/routes from DB

Cron live `Running` jobs are **not** fake-mirrored into DB as realtime state.

## Feature flag

```bash
AI_RUNTIME_SHARED_OBSERVABILITY_ENABLED=true
```

- `true`/`1` + Supabase service role available → Postgres sink
- otherwise → Noop sink (inference still succeeds)

## What is persisted

Safe scalars only:

- event_type, request/job/correlation ids
- agent, source, workload, priority
- provider/model ids
- status, error_code, retryable
- fallback_used, attempt_count
- token counts + usage_missing
- reservation token estimates
- latency_ms
- allow-listed metadata (`cronJobId`, `departmentId`, `deferReason`, `quotaReason`, `actualBackendModel`, `availableAt`, …)

## What is never persisted

- prompts / messages / assistant content
- raw provider responses / headers
- API keys / Authorization / credential secrets
- retrieval document / personal customer content

## Event types (minimum)

`job_enqueued|started|deferred|completed|failed|cancelled`  
`route_completed|route_failed`  
`provider_success|provider_error`  
`reservation_created|reconciled|released|expired`

## Credential / env loading

| Process | Env source |
|---------|------------|
| **Next.js server** | Next auto-loads `.env` / `.env.local`; then `ensureRuntimeEnv()` (`src/lib/server/loadRuntimeEnv.ts`) fills **missing** keys from `HERMES_HOME/.env` (Admin status + instrumentation) |
| **Cron (`npx tsx scripts/...`)** | `scripts/loadLocalEnv.ts` — project `.env` / `.env.local`, then `HERMES_HOME/.env` |
| **Hermes cron wrapper** | `~/.hermes/profiles/marketing-manager/scripts/daily-marketing-plan.sh` exports Runtime flags; credentials via loadLocalEnv |
| **systemd** | No dedicated marketing unit. Hermes gateway runs cron. Prefer Hermes `.env` reuse over duplicating secrets into unit files |
| **Vercel** | No `HERMES_HOME` — set `OPENROUTER_API_KEY` / `NVIDIA_API_KEY` / Gemini keys in Vercel project env |

Never store secret values in DB/UI/migrations.

### Provider env candidates

```text
Gemini      GOOGLE_GENERATIVE_AI_API_KEY | GEMINI_API_KEY | GOOGLE_API_KEY
OpenRouter  OPENROUTER_API_KEY
NVIDIA      NVIDIA_API_KEY
```

### Production flags (hermes-pi)

```bash
AI_RUNTIME_MARKETING_CRON_ENABLED=true
AI_RUNTIME_SHARED_OBSERVABILITY_ENABLED=true
```

Rollback Marketing Cron to Hermes CLI:

```bash
AI_RUNTIME_MARKETING_CRON_ENABLED=false
```

Shared observability may remain enabled independently.

## Retention

Recommended: **30–90 days** append-only cleanup (job not implemented in this STEP).

## Admin access

- Table RLS: `service_role` only; anon/authenticated revoked
- Read path: `GET /api/admin/ai-runtime/status` with `settings.manage`
- No browser direct table access

## Persistence failure isolation

Provider success + DB insert failure ⇒ **Runtime response still succeeds**. Telemetry is best-effort.
