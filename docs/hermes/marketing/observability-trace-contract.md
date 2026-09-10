# Marketing Observability — OBS-1 Trace Contract

OTel-compatible **domain** trace/span contracts for TheAllTour Marketing production.
No vendor SDK dependency in core. No AgentPrism types in core. No DB/OTLP in OBS-1.

## Existing infrastructure (reuse / correlate — do not duplicate)

| Layer | Role |
|-------|------|
| `DailyMarketingRunObservability` | Per-run scalars on daily pipeline / candidate |
| `MarketingOperationsTrace` | Ops console correlation bag (run/candidate/review ids) |
| `ai-runtime/observability` | Provider/job/token telemetry (`RuntimeObservabilityEvent`) |
| `MarketingIncidentClass` | Incident taxonomy — map into span errors |
| `sanitizeProductionWorkerError` | Shared secret redaction for error strings |

OBS-1 adds a **span hierarchy** for MM → staff → CS → Completeness → GA → HMR that those layers do not model.

## Contracts

- `marketing-trace-v1` → `MarketingTrace`
- `marketing-span-v1` → `MarketingSpan`

Code: `src/lib/marketing/observability/*`

## Status model (separated)

| Field | Meaning |
|-------|---------|
| `MarketingTrace.status` | Workflow envelope: running / completed / failed / partial |
| `MarketingSpan.status` | Business outcome: ok / error / skipped / revision_required / blocked / running |
| `MarketingSpan.otelStatusCode` | OTel StatusCode analogue: UNSET / OK / ERROR |

Do not collapse `revision_required` or GA `blocked` into OTel ERROR unless `status === "error"`.

## Privacy

See `privacy.ts` / `MARKETING_TRACE_PRIVACY_POLICY`. Forbidden: secrets, raw env, PII, CoT, full prompts/responses. Prefer template/version, summaries, evidence IDs, structured validation, sanitized errors.

Persistence also applies `sanitizeAttributesForPersistence` (size budget `MAX_ATTRIBUTES_JSON_BYTES`) before writing `attributes jsonb`.

## Correlation (soft ids only in OBS-1)

ProductionRequest, ContentAssignment, ResearchBrief, AgendaCandidate, CompletedMarketingCandidate, HMR, AI Runtime request/job — via trace fields + `marketing.*` / `ai_runtime.*` / `gen_ai.*` attributes.

Late-arriving candidate/HMR ids are attached on `endTrace({ correlation })` after bootstrap.

## AgentPrism / OTel

`toOtelCompatibleSpan` exports `traceId`, `spanId`, `parentSpanId`, timestamps (unix nano), `name`, `status`, `attributes` without loss of those fields. AgentPrism-specific DTOs stay outside this package.

## OBS-2 Pipeline instrumentation

`runDepartmentPipeline` / daily production accept an optional `MarketingTraceRecorder`:

- default / unset → resolved via `resolveMarketingTraceRecorder()` (see OBS-3 gate)
- tests → `InMemoryMarketingTraceRecorder` or durable in-memory store

Stages: `marketing.production` → manager / deliverable_requirements / evidence_pack / content_strategist / completeness_validator / governance_auditor / human_review_boundary.

Recorder failures are swallowed (`safeRecorder`) and never fail marketing production.

## OBS-3 Durable storage

| Piece | Location |
|-------|----------|
| Tables | `marketing_observability_traces`, `marketing_observability_spans` |
| Migration | `supabase/migrations/20260910180000_marketing_observability_traces.sql` |
| Recorder | `createPersistentMarketingTraceRecorder` / Supabase store |
| Read API | `createMarketingTraceReadRepository` (`getTrace`, `listTraceSpans`, `findTraceByProductionRequestId`, `listRecentTraces`) |

### Rollout gate

`MARKETING_TRACE_ENABLED`:

| Value | Recorder |
|-------|----------|
| `true` / `1` | Supabase durable (service-role), wrapped in `safeRecorder` |
| `false` / `0` / unset | Noop (safe default; business behavior unchanged) |

Missing Supabase URL/service-role key also falls back to Noop.

### Write semantics

- `startTrace` / `startSpan` → upsert running
- `endSpan` / `failSpan` / `endTrace` → update terminal fields
- Terminal status must not regress to `running`
- Writes are fire-and-forget + serialized; failures → sanitized `console.warn` only (no recursive obs spans)
- Parent span self-FK omitted so start/end ordering cannot break inserts

### Realtime compatibility (future OBS-4+)

Row `INSERT` (span start) and `UPDATE` (span end) are standard PostgREST/Realtime-compatible shapes. This step does **not** enable Realtime publication or UI subscription. Prefer Supabase Realtime later — do not add a custom WebSocket server.

### Retention (OBS-6+)

No auto-delete cron in OBS-3. Observe growth of completed traces, `attributes` jsonb volume, and error traces. Recommended retention window: **30–90 days** (same guidance as `ai_runtime_observability_events`). Cleanup belongs in OBS-6+.

### Security

Service-role only RLS. No anon/authenticated policies. Never expose the service-role key to the browser.

## OBS-4 AgentPrism Trace Viewer

| Piece | Location |
|-------|----------|
| Admin UI | `/theall_manager_only/marketing-observability` |
| Read API | `/api/admin/marketing-observability/traces` |
| OTLP adapter | `src/lib/marketing/observability/viewer/otlpDocument.ts` (no AgentPrism import) |
| AgentPrism bridge | `viewer/agentPrismBridge.ts` (UI boundary) |
| Vendored UI | `src/components/vendor/agent-prism/` @ commit `53a9078b533b` |
| npm pin | `@evilmartians/agent-prism-data@0.0.9`, `…-types@0.0.9` |

Read-only historical viewer. No Realtime. Details panel is TheAllTour-owned (no AgentPrism In/Out/Raw tabs).
