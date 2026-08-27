# Runtime Integration Audit — STEP 2-5.4A

Hermes 마케팅 조직 실행 경로를 AI Runtime(`src/ai-runtime/`)에 연결하기 **전** 감사 및 통합 경계 확정.

> **이 문서는 audit + contract 설계입니다.** 기존 Cron/Hermes/Bot/Department/Group Chat 실행 코드는 STEP 2-5.4A에서 **변경하지 않았습니다.**

## Scope & classification legend

| Classification | Meaning |
|---|---|
| **RUNTIME_CANDIDATE** | Generative LLM inference — AI Runtime Router/Scheduler로 migration 대상 |
| **KEEP_DIRECT** | Runtime과 별도로 유지해야 하는 호출 (Hermes CLI, embedding 등) |
| **NON_LLM** | LLM inference 아님 (DB read, rule engine, envelope orchestration) |
| **UNCLEAR** | Repo 밖 config(Hermes profile model) 등 추가 확인 필요 |

## Executive summary

| Path | LLM today | Current invocation | ai-runtime wired? |
|---|---|---|---|
| A. Performance Cron 08:30 | **No** | TS script `--no-agent` | No |
| B. Marketing Cron 09:00 | **Yes** | Hermes CLI (`content-strategist`, `governance-auditor`) | No |
| C. Agent Handoff | Conditional | Pipeline envelope + Hermes oneshot | No |
| D. Department Orchestration | Conditional | `orchestrateDepartmentTask` fan-out | No |
| E. Desktop / Group Chat | Yes (Hermes) | Manager profile loop + MCP orchestration | No |

**핵심:** `src/ai-runtime/` (Registry, Router, Scheduler, Gemini/OpenRouter/NVIDIA adapters)는 **독립 완성** 상태이며, 마케팅 실행 경로와 **아직 연결되지 않음**. 모든 generative LLM은 **Hermes CLI subprocess** (`hermes -p <profile> -z`) 경유.

---

## A. Performance Analyst Cron (08:30 KST)

| Field | Detail |
|---|---|
| **Trigger** | Hermes profile cron `30 8 * * *`, job `AI Marketing - Daily Performance`, profile `performance-analyst`. Multiplex gateway. Doc: [cron-plan.md](./cron-plan.md) |
| **Entry Point** | `~/.hermes/profiles/performance-analyst/scripts/daily-performance-brief.sh` → `scripts/cron-daily-performance-brief.ts` → `main()` |
| **Request Builder** | N/A (no LLM). CLI: `--product-id`, `--channel` |
| **Agent/Profile** | Cron `--no-agent` — profile pin only, no agent loop |
| **Context Builder** | `buildDailyPerformanceBrief()` — `src/lib/marketing/cron/buildDailyPerformanceBrief.ts` |
| **Retrieval** | Supabase read-only sources under `src/lib/marketing/context/sources/` |
| **Provider Selection** | N/A |
| **Model Selection** | N/A |
| **LLM Invocation** | **None** |
| **Retry** | Script `process.exit(1)` on failure. Hermes cron retry is outside repo |
| **Result Consumer** | `formatDailyPerformanceBriefMarkdown()` → stdout (Hermes local delivery) |
| **Persistence** | `writeLatestPerformanceBrief()` → `data/marketing/cron/latest-performance-brief.json` via `performanceBriefArtifact.ts` |
| **Migration Risk** | **Low** for cron script itself (no LLM). Interactive performance path is separate (see D) |
| **Recommended Boundary** | Cron script **unchanged**. Interactive `performance` intent LLM → Runtime (Phase 1b) |
| **Classification** | **NON_LLM** (08:30 cron) |
| **Sync/Async** | **ASYNC_SAFE** |

**Note:** Interactive orchestration `performance` intent **does** invoke `performance-analyst` Hermes LLM — `orchestrateDepartmentTask()` in `src/lib/marketing/bot/organization/orchestrate.ts` (L312–341). That invoke is **RUNTIME_CANDIDATE**, not the 08:30 cron.

---

## B. Marketing Manager Cron (09:00 KST)

| Field | Detail |
|---|---|
| **Trigger** | Hermes cron `0 9 * * *`, job `AI Marketing - Daily Plan`, profile `marketing-manager` |
| **Entry Point** | `~/.hermes/profiles/marketing-manager/scripts/daily-marketing-plan.sh` → `scripts/cron-daily-marketing-plan.ts` → `main()` |
| **Request Builder** | Inline prompts in `requestDraft` / `requestGovernance` callbacks (L177–190) |
| **Agent/Profile** | Cron wrapper `--no-agent`; LLM via `invokeProfile("content-strategist")` and `invokeProfile("governance-auditor")` |
| **Context Builder** | `readLatestPerformanceBrief()` + `briefToPipelinePerformance()` — artifact from 08:30 job |
| **Retrieval** | Performance artifact read only. No live `get_marketing_context` in cron script |
| **Provider Selection** | Hermes profile `.env` / config under `~/.hermes/profiles/<id>/` (**outside repo**) |
| **Model Selection** | Hermes profile config (**outside repo**) |
| **LLM Invocation** | `invokeProfile()` — `spawnSync("hermes", ["-p", profile, "--yolo", "--ignore-rules", "-z", prompt])` (L38–47). Parallel: `invokeHermesOneshot()` — `src/lib/marketing/bot/organization/hermesRuntime.ts` |
| **Retry** | `HERMES_TIMEOUT_MS = 180_000`; non-zero exit → throw, **no retry**. Pipeline: `MAX_AUTO_REVISION_ROUNDS = 1` for BLOCK only — `pipeline.ts` |
| **Result Consumer** | stdout sections (`# Daily Marketing Plan`, `## Pipeline Result`, …) |
| **Persistence** | **None** (v1). `approvalHandoff` printed only. `publishActionIncluded: false` enforced |
| **Migration Risk** | **Low–Medium** — clear pipeline deps injection points |
| **Recommended Boundary** | Keep `runDepartmentPipeline()` + envelope logic; replace `requestDraft` / `requestGovernance` Hermes invokes with `RuntimeRequestFactory` → `RuntimeExecutor.submit()` |
| **Classification** | Hermes LLM steps: **KEEP_DIRECT** today → **RUNTIME_CANDIDATE** on migration |
| **Sync/Async** | **ASYNC_SAFE** |

**Target shape (not implemented yet):**

```text
Cron trigger
→ existing Agent context/prompt builder (content-strategist / governance-auditor prompts)
→ RuntimeRequestFactory (workload: content_draft / governance)
→ RuntimeExecutor.submit()
→ Scheduler → Router
```

---

## C. Application-level Agent Handoff

| Field | Detail |
|---|---|
| **Trigger** | (1) MCP `run_department_orchestration` from Manager session. (2) Cron 09:00 via `runDepartmentPipeline`. (3) Test: `scripts/test-marketing-department-handoff.ts` |
| **Entry Point** | `src/app/api/internal/marketing/mcp/route.ts` → `dispatchMarketingBotTool()` → `runDepartmentOrchestrationTool.ts` → `orchestrateDepartmentTask()` |
| **Handoff Creation** | `createHandoffEnvelope()` — `envelope.ts`. Pipeline: `runDepartmentPipeline()` — `pipeline.ts` |
| **Request Builder** | `specialistPrompt()` — `orchestrate.ts` L226–247 |
| **Agent/Profile** | Allowlist `HERMES_MARKETING_PROFILE_IDS` — `envelope.ts`. Classification `application_level` — `hermesHandoff.ts` |
| **Context Builder** | `routeDepartmentRequest()` — `routing.ts` |
| **Retrieval** | Performance: `getPerformanceEvidenceTool()`. Memory via Hermes MCP tools when Manager invokes (not automatic in pipeline) |
| **Provider Selection** | Hermes per-profile (external) |
| **Model Selection** | Hermes per-profile (external) |
| **LLM Invocation** | `invokeHermesOneshot()` / `defaultHermesAgentRuntime.invoke()` — `hermesRuntime.ts` |
| **Retry** | `DEFAULT_HERMES_INVOKE_TIMEOUT_MS = 90_000`; failed invoke → `createFailedInvokeResult()`. **No provider fallback** |
| **Approval** | `toApprovalHandoff()` → `applyPipelineApproval()` → `applyApprovalDecision()`. Doc: [human-approval.md](./human-approval.md). **No DB persistence** |
| **Result Consumer** | `DepartmentOrchestrationResult` / `DepartmentPipelineResult` → MCP JSON → Manager synthesis |
| **Persistence** | Envelopes in-memory only |
| **Migration Risk** | **Medium** — approval gate must remain after draft, before publication |
| **Recommended Boundary** | Envelope/pipeline **NON_LLM** 유지. Specialist LLM dispatch only → Runtime |
| **Classification** | Envelope/pipeline: **NON_LLM**. Specialist invoke: **RUNTIME_CANDIDATE** |
| **Sync/Async** | **CALLBACK_REQUIRED** / **INTERACTIVE_WAIT** (MCP caller waits) |

**Target shape:**

```text
Source Agent → handoff → Human Approval (unchanged)
→ target Agent context build (existing)
→ RuntimeRequestFactory
→ RuntimeExecutor
```

Human Approval flow를 Runtime migration으로 **우회하거나 약화시키면 안 됨**.

---

## D. Department Agent Orchestration

| Field | Detail |
|---|---|
| **Trigger** | MCP `run_department_orchestration` or direct `orchestrateDepartmentTask()` |
| **Entry Point** | `orchestrateDepartmentTask()` — `src/lib/marketing/bot/organization/orchestrate.ts` |
| **Routing** | `routeDepartmentRequest()` — `routing.ts`. Mandatory intents: `enforcement.ts` |
| **Fan-out** | Per intent: `performance` → evidence + 1 specialist; `content*` → pipeline (content + governance); `department_status` → cron introspection only; `governance` → governance specialist. Budget: `MAX_SPECIALIST_DISPATCHES_PER_REQUEST = 4`, `MAX_ORCHESTRATION_DEPTH = 1` |
| **Model Calls** | `invokeSpecialist(profile, specialistPrompt(...))` per allowlisted profile |
| **Aggregation** | `synthesize()` — findings, limits, recommendedActions |
| **Retrieval (non-LLM)** | `getPerformanceEvidenceTool()`, `collectDepartmentCronStatus()` — `departmentCron.ts` |
| **Retry** | Per-invoke timeout/kill. Pipeline BLOCK → 1 auto-revision round. **No cross-provider retry** |
| **Persistence** | Cron status from `~/.hermes/profiles/<id>/cron/jobs.json`. No orchestration result DB |
| **Migration Risk** | **Medium–High** — fan-out × quota; duplicate retry risk |
| **Recommended Boundary** | Future: `Invocation Policy` → selected agents only → `RuntimeRequestFactory` → Scheduler |
| **Classification** | Routing/evidence: **NON_LLM**. Specialist invokes: **RUNTIME_CANDIDATE** |
| **Sync/Async** | **INTERACTIVE_WAIT** |

**Future hook (not implemented):**

```text
Incoming organizational request
      ↓
Invocation Policy (future — before RuntimeRequest creation)
      ↓
Selected Agents only
      ↓
RuntimeRequestFactory
      ↓
Scheduler
```

---

## E. Hermes Desktop Bot Mode / Group Chat

| Field | Detail |
|---|---|
| **Trigger** | Desktop **BOTS → Marketing Manager** (`source=tui`). Telegram DM = separate session (`source=telegram`) |
| **Entry Point (repo)** | Hermes Desktop → MCP `thealltour-marketing` at `127.0.0.1:3000` → `src/app/api/internal/marketing/mcp/route.ts` |
| **Room Orchestration** | **Hermes native** — `message_agent`, Bot Chat teammate protocol. Doc: [desktop-deployment.md](./desktop-deployment.md), [runtime-handoff.md](./runtime-handoff.md). **Not in thealltour TS** |
| **Bot Invocation (repo)** | Oneshot: `buildHermesOneshotArgv()`. Query-file variant exists but orchestrator does not use it — `hermesHandoff.ts` |
| **Model Selection** | Hermes profile config (`~/.hermes/profiles/marketing-manager/`). Preview YAML in `docs/hermes/examples/` only |
| **LLM Invocation** | Primary: Manager Hermes agent loop (external). Specialist: MCP `run_department_orchestration` |
| **Group Chat fan-out** | Contract separates native `message_agent` from department policy — `prompts/marketing-manager.md`. **Exact participant fan-out semantics are Hermes-owned**; repo exposes orchestration primitives only |
| **Migration Risk** | **High** — interactive wait, room context, fan-out |
| **Recommended Boundary** | Manager loop stays Hermes until Phase 4; specialist dispatch via Runtime first |
| **Classification** | MCP/orchestration: **NON_LLM** + **KEEP_DIRECT**. Native bot loop: **KEEP_DIRECT** / **UNCLEAR** (model config external). Future central routing: **RUNTIME_CANDIDATE** |
| **Sync/Async** | **INTERACTIVE_WAIT** |

**Group Chat audit note:** One user message may trigger Manager reasoning + optional MCP `run_department_orchestration` (0–4 specialist dispatches depending on intent). Not all participants auto-invoke — routing is Manager-driven + `routeDepartmentRequest()` intent classification.

---

## Direct inference path inventory

| Location | Mechanism | Env vars (names only) | Classification |
|---|---|---|---|
| `hermesRuntime.ts` | `spawn("hermes", …)` | `HERMES_BIN`, `HERMES_HOME` | **KEEP_DIRECT** → **RUNTIME_CANDIDATE** |
| `cron-daily-marketing-plan.ts` | `spawnSync("hermes", …)` | same | **RUNTIME_CANDIDATE** |
| `src/ai-runtime/adapters/gemini/` | `generateContent` HTTP | `GOOGLE_GENERATIVE_AI_API_KEY`, `GEMINI_API_KEY`, `GOOGLE_API_KEY` | **RUNTIME_CANDIDATE** (built, unwired) |
| `src/ai-runtime/adapters/openrouter/` | `chat/completions` | `OPENROUTER_API_KEY` | **RUNTIME_CANDIDATE** (built, unwired) |
| `src/ai-runtime/adapters/nvidia/` | `chat/completions` | `NVIDIA_API_KEY` | **RUNTIME_CANDIDATE** (built, unwired) |
| `src/lib/marketing/semantic/embeddingProvider.ts` | BGE-M3 HTTP embedding | `EMBEDDING_BASE_URL`, `EMBEDDING_MODEL` | **KEEP_DIRECT** |
| `evaluateContentGovernance()` etc. | Rule-based governance | N/A | **NON_LLM** |

> Raw API key values는 문서/코드에 포함하지 않음.

---

## Dual governance paths

| Path | Implementation | LLM? |
|---|---|---|
| MCP `evaluate_governance` / `review_generated_content` | `evaluateContentGovernance()` + `applyGovernancePolicy()` | **NON_LLM** |
| Cron / orchestration `governance-auditor` profile | Hermes LLM JSON stdout | **RUNTIME_CANDIDATE** |

Migration 시 rule engine vs LLM auditor **역할 분리** 유지 필요. Runtime `governance` workload는 LLM auditor replacement 후보.

---

## Retry ownership

| Path | Existing retry owner | Future retry owner | Migration action |
|---|---|---|---|
| Hermes invoke (`hermesRuntime.ts`) | None (timeout kill only) | Remove provider retry; defer to Router fallback + Scheduler defer | **Disable Hermes-level retry duplication** |
| Cron marketing plan | None (throw on exit != 0) | Scheduler logical retry | Replace throw-with-retry-at-cron with job defer |
| Pipeline BLOCK revision | `MAX_AUTO_REVISION_ROUNDS = 1` (business) | **Caller** (business revision) | Keep — not provider retry |
| ai-runtime Router | Provider/model fallback per route | **Router** | Unchanged |
| ai-runtime Scheduler | Job defer/backoff | **Scheduler** | Used after migration |

**Principle:**

```text
Provider fallback → Router
Logical retry/defer → Scheduler
Business retry (revision rounds) → caller only when truly necessary
```

---

## Result delivery

| Path | Consumer | Async boundary risk |
|---|---|---|
| Performance Cron 08:30 | stdout + JSON artifact file | Low (no LLM) |
| Marketing Cron 09:00 | stdout plan + approval handoff print | Medium — cron expects synchronous pipeline result |
| Agent handoff / pipeline | Manager synthesis / approval state | **High** — MCP waits for full orchestration |
| Department orchestration | `DepartmentOrchestrationResult` JSON | **High** |
| Group Chat | Hermes room message (external) | **High** — interactive |

Scheduler migration introduces async boundary — cron/orchestration must either poll `getJob()` / future `awaitCompletion()` or accept fire-and-forget with callback.

---

## Governance / Human Approval / Publication safety

| Guard | Location | Runtime integration position |
|---|---|---|
| `PUBLICATION_FLOW_INACTIVE = true` | `governanceBoundary.ts` | Runtime **must not** bypass — publication adapters remain blocked |
| Human Approval | `pipeline.ts` → `applyApprovalDecision()` | Runtime produces draft/governance **before** approval gate; approval **after** LLM output |
| Governance policy (rules) | `evaluateContentGovernance()` | Stays **NON_LLM** — can run before or after LLM auditor migration |

Publication-related execution은 Runtime migration으로 **활성화되면 안 됨**.

---

## Runtime Console observability readiness

Migration requests should propagate metadata already supported on `RuntimeRequest`:

```text
correlationId, cronJobId, handoffId, departmentId, roomId, conversationId, source
```

Existing Admin UI (`/theall_manager_only/ai-runtime`) observes routing ledger + scheduler snapshot. Source/workload filters are **future UI** — metadata foundation is ready.

---

## Migration candidate map

| Path | Risk | Proposed migration phase | Mode |
|---|---|---|---|
| Marketing Manager Cron 09:00 (content + governance LLM) | Low–Medium | **Phase 1** | ASYNC_SAFE |
| Interactive performance analyst (orchestration) | Medium | **Phase 1b** | INTERACTIVE_WAIT |
| Performance Cron 08:30 | None (NON_LLM) | **No LLM migration** | ASYNC_SAFE |
| Agent handoff pipeline LLM steps | Medium | **Phase 2** | CALLBACK_REQUIRED |
| Department orchestration fan-out | Medium–High | **Phase 3** | INTERACTIVE_WAIT |
| Desktop / Group Chat specialist dispatch | High | **Phase 4** | INTERACTIVE_WAIT |
| Invocation Policy optimization | High | **Phase 5** | N/A |
| BGE-M3 embedding | N/A | **KEEP_DIRECT** | N/A |

---

## Recommended migration order

1. **Phase 1 — Cron LLM steps:** `cron-daily-marketing-plan.ts` `requestDraft` / `requestGovernance` → RuntimeRequestFactory → RuntimeExecutor (workloads: `content_draft`, `governance`, priority: `background`, source: `cron`)
2. **Phase 1b — Performance analyst interactive invoke:** `orchestrate.ts` performance intent → Runtime (workload: `analysis`, source: `department-orchestrator`)
3. **Phase 2 — Agent handoff:** Pipeline injectors in MCP + handoff tests
4. **Phase 3 — Department orchestration:** Full `orchestrateDepartmentTask` specialist dispatches
5. **Phase 4 — Desktop / Group Chat:** Interactive executor (`awaitCompletion` / `executeInteractive`) + Manager loop integration
6. **Phase 5 — Invocation Policy:** Reduce fan-out before RuntimeRequest creation

Phase 1이 Performance Cron 08:30보다 먼저인 이유: 08:30 job은 LLM이 없고, 09:00 job이 실제 generative inference를 포함하기 때문.

---

## Integration contract (STEP 2-5.4A)

Implemented (not wired to Hermes):

| Module | Path | Role |
|---|---|---|
| Types | `src/ai-runtime/integration/types.ts` | Factory input, submission, execution result, executor interfaces |
| Request factory | `src/ai-runtime/integration/runtime-request-factory.ts` | Normalize caller messages → `RuntimeRequest` |
| Executor | `src/ai-runtime/integration/runtime-executor.ts` | Thin `RuntimeExecutor` → `RuntimeScheduler.enqueue()` |

**ID policy:**

- `request.id` — new logical inference ID per factory call
- `metadata.correlationId` — caller-supplied organizational trace (preserved)
- `metadata.parentRequestId` — nested orchestration linkage

**Factory does NOT:** generate prompts, retrieve, select provider/model, enqueue, or hold credentials.

---

## Out of scope (STEP 2-5.4A)

- Actual Cron/Hermes/Bot/Department/Group Chat migration
- Invocation Policy implementation
- Persistent job/result store
- DB / Redis
- Context Budgeting
- BGE-M3 / SNS / publication changes

---

## TODO (future)

- Lint rule: marketing orchestration must not import `@/ai-runtime/adapters/*` directly (integration layer only)
- Hermes profile model audit on Pi (`~/.hermes/profiles/*`) — **UNCLEAR** items

---

## Phase 1 migration — STEP 2-5.4B (Marketing Cron 09:00)

**Status:** Implemented behind feature flag.

| Item | Detail |
|---|---|
| Legacy path | `AI_RUNTIME_MARKETING_CRON_ENABLED` unset/false → Hermes CLI `invokeHermesProfile` |
| Runtime path | flag `true` → `RuntimeRequestFactory` → `RuntimeExecutor.executeAndWait` → Scheduler → Router |
| Dual execution | **Forbidden** — exactly one path per cron run |
| Rollback | Set `AI_RUNTIME_MARKETING_CRON_ENABLED=false` (or unset) in cron wrapper / env |
| Completion | `awaitCompletion` / `executeAndWait` with 180s timeout (matches Hermes) |
| Retry ownership | Scheduler/Router only — no Hermes retry, no cron while-loop retry |
| Correlation | One `correlationId` per 09:00 run; `parentRequestId` chains draft → governance → revision |
| 08:30 Performance Cron | **Unchanged** (NON_LLM) |
| Tool dependency | Cron specialists are JSON-only oneshot — **no Hermes tools** (`MARKETING_CRON_SPECIALIST_USES_HERMES_TOOLS=false`) |
| Known limitation | Runtime failure does **not** auto-fallback to Hermes in the same run |

**Files:**

- `scripts/cron-daily-marketing-plan.ts`
- `src/lib/marketing/cron/marketingCronRuntime.ts`
- `src/lib/marketing/cron/marketingPlanSpecialists.ts`
- `src/ai-runtime/integration/runtime-executor.ts` (`awaitCompletion`)
- `src/ai-runtime/integration/runtime-stack.ts`

---

## Phase 1 production activation — STEP 2-5.4B-PROD

**Status:** Production-active on hermes-pi (2026-08-27).

| Item | Detail |
|---|---|
| Schedule entry | Hermes `marketing-manager` cron `0 9 * * *` → `daily-marketing-plan.sh` → `npx tsx scripts/cron-daily-marketing-plan.ts` |
| systemd | No dedicated marketing timer — Hermes gateway multiplex cron |
| Wrapper flags | `AI_RUNTIME_MARKETING_CRON_ENABLED=true`, `AI_RUNTIME_SHARED_OBSERVABILITY_ENABLED=true` (defaults in wrapper; overridable) |
| Credential source | Project `.env`/`.env.local` first; missing provider keys filled from `HERMES_HOME/.env` via `ensureRuntimeEnv` / `loadLocalEnv` |
| Next Admin status | `GET /api/admin/ai-runtime/status` calls `ensureRuntimeEnv()` before credential presence check |
| Observability DB | `public.ai_runtime_observability_events` (migration `20260827150000`) |
| Publication | `PUBLICATION_FLOW_INACTIVE=true` (compile-time) |
| Rollback | Set `AI_RUNTIME_MARKETING_CRON_ENABLED=false` in `~/.hermes/profiles/marketing-manager/scripts/daily-marketing-plan.sh` (or env override) → next 09:00 uses Hermes CLI only |

See also: [runtime-observability.md](./runtime-observability.md)

---

## Key file index

```
scripts/cron-daily-performance-brief.ts
scripts/cron-daily-marketing-plan.ts
src/lib/marketing/cron/buildDailyPerformanceBrief.ts
src/lib/marketing/bot/organization/orchestrate.ts
src/lib/marketing/bot/organization/pipeline.ts
src/lib/marketing/bot/organization/hermesRuntime.ts
src/lib/marketing/bot/organization/hermesHandoff.ts
src/lib/marketing/bot/runDepartmentOrchestrationTool.ts
src/lib/marketing/social/publication/governanceBoundary.ts
src/ai-runtime/integration/
src/ai-runtime/router/
src/ai-runtime/scheduler/
```

---

STEP 2-5.4A audit complete — no execution path migration performed.
