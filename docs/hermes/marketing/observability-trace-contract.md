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

## Correlation (soft ids only in OBS-1)

ProductionRequest, ContentAssignment, ResearchBrief, AgendaCandidate, CompletedMarketingCandidate, HMR, AI Runtime request/job — via trace fields + `marketing.*` / `ai_runtime.*` / `gen_ai.*` attributes.

## AgentPrism / OTel

`toOtelCompatibleSpan` exports `traceId`, `spanId`, `parentSpanId`, timestamps (unix nano), `name`, `status`, `attributes` without loss of those fields. AgentPrism-specific DTOs stay outside this package.

## OBS-2 Pipeline instrumentation

`runDepartmentPipeline` / daily production accept an optional `MarketingTraceRecorder`:

- default / unset → `NoopMarketingTraceRecorder` (production behavior unchanged)
- tests → `InMemoryMarketingTraceRecorder`

Stages: `marketing.production` → manager / deliverable_requirements / evidence_pack / content_strategist / completeness_validator / governance_auditor / human_review_boundary.

Recorder failures are swallowed (`safeRecorder`) and never fail marketing production.
