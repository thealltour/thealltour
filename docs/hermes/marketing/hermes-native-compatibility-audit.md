# Hermes Native Compatibility Audit — STEP 2-5.4C0

> **AUDIT ONLY.** No Agent Handoff / Department / Group Chat / Hermes source / Runtime provider / Cron production / Human Approval / SNS / `PUBLICATION_FLOW_INACTIVE` behavior changes in this STEP.  
> Do **not** start STEP 2-5.4C Agent Handoff Runtime Migration until this audit is accepted.

**References (priority order):**

1. Installed Hermes Agent **v0.20.5** (`03537d69`, install: `~/.hermes/hermes-agent`)
2. Official Bot Mode guide: <https://raw.githubusercontent.com/NousResearch/hermes-agent/main/website/docs/user-guide/bot-mode.md> (local mirror: `~/.hermes/hermes-agent/website/docs/user-guide/bot-mode.md`)
3. Current theallcloud implementation (`src/lib/marketing/bot/**`, `src/ai-runtime/**`)
4. Prior project docs (`runtime-handoff.md`, `runtime-integration-audit.md`, `desktop-deployment.md`)

**Conflict rule:** When official Hermes semantics conflict with TheAllTour custom implementation, report the conflict — do **not** silently migrate.

---

## 1. Executive Summary

TheAllTour marketing already splits work along roughly the right layers, but **specialist handoff today bypasses Hermes Bot Mode session semantics**.

| Layer | Owner today | Fit vs official Bot Mode |
|---|---|---|
| Bot/Profile, Bot Chat, Group Chat, `@mention`, `message_agent`, Skills, MCP client, Routines/Cron host | **Hermes** | Compatible — keep |
| Intent routing, handoff envelope, Human Approval, SNS/governance rules, department MCP tools | **TheAllTour** | Compatible — keep as business/governance |
| Specialist LLM invoke for department/handoff | **Hermes CLI oneshot** (`hermes -p … -z`) | **Conflict risk** — not canonical Bot Chat / not `message_agent` |
| Provider Router / Quota / Scheduler | **ai-runtime** (Cron path optional via flag) | Compatible as Inference Control Plane — **must not** replace Bot orchestration |

**Primary finding:** Application-level Agent Handoff is **functionally adjacent** to Hermes `message_agent`, but **not equivalent**. Oneshot ignores target Bot Chat history/memory and is **synchronous request/response**, whereas official `message_agent` is **fire-and-forget** into the target’s canonical Bot Chat with at-most-once delivery retry and typed failure reasons.

**Architectural target (unchanged principle):**

```text
TheAllTour Business / Governance
        ↓
Hermes Agent Orchestration (Bot Chat / Group / message_agent / MCP / Cron host)
        ↓
TheAllTour AI Runtime (Inference Control Plane)
        ↓
Gemini / OpenRouter / NVIDIA
```

AI Runtime must **not** replace Hermes Bot semantics.

---

## 2. Official Hermes primitives

From Bot Mode guide + installed source (`tools/bot_mode_dm.py`, `tools/bot_relay.py`, `tools/bot_failure_reasons.py`, desktop `hermes-bots` plugin):

| Primitive | Official semantics (v0.20.5 / upstream guide) |
|---|---|
| **Bot** | A Hermes **profile** under `~/.hermes/profiles/<name>/` (config, memory, skills, credentials, chat history). Bot Mode is UI over that primitive. |
| **Bot Chat** | Canonical, persistent forever-chat per Bot. `/new` remapped to `/compact`. Routines and bot-to-bot DMs land here. |
| **Group Chat** | Rooms of 2–6 Bots; up to **3 serial rounds** / 10 messages per send; `@mention` scopes speakers; each member keeps `Group: <name>` session. Multi-group membership supported (`ui_meta.hermes-bots.groups[]`). Rooms can span machines. |
| **`message_agent`** | Tool **only** in canonical Bot Chat. Delivers into target Bot Chat with attribution. **Fire-and-forget**; reply as background completion. Cross-machine via Desktop relay or `hermes peer`. |
| **`@mention`** | Composer resolves live roster; Bot then uses `message_agent` (user text not forwarded verbatim). |
| **Routines** | Hermes cron namespaced `[bot:<name>] …`; results in Bot Chat. |
| **Skills / MCP / Memory** | Per-profile enablement; memory under profile home. |
| **Delivery retry** | At most **once**, same session; auto-retry only transient classes; context_overflow retries after compression; auth/quota/config never auto-retry. |
| **Failure taxonomy** | `provider_auth_or_access`, `provider_quota_limit`, `provider_rate_limit`, `provider_server_error`, `context_overflow`, `missing_config`, `model_unavailable`, `runtime_offline`, `queued_expired`, `delivery_timeout`, `target_busy`, `unknown` (+ platform: `agent_blocked`, `cancelled`). |
| **Provider invoke** | Per-profile `model.provider` / `model.default` / optional `base_url`; `fallback_providers` chain; custom OpenAI-compatible endpoints supported without forking Hermes. |

**Installed fleet note:** All four marketing Bots are members of group `theallcloud marketing` (`groups: ['theallcloud marketing']`). Models currently pin `provider: gemini` / `gemini-3.5-flash-lite` with `fallback_providers: ['openrouter','openai']` on Manager (specialists similar).

---

## 3. Current TheAllTour equivalents

| Official / desired | TheAllTour today | Mechanism |
|---|---|---|
| Bot/Profile roster | Profile ids + docs/contracts | `marketing-manager`, `content-strategist`, `governance-auditor`, `performance-analyst` |
| Bot Chat / Group / `@mention` / `message_agent` | **Not reimplemented** | Hermes Desktop / gateway only |
| Agent-to-agent handoff | **Application envelope + oneshot** | `createHandoffEnvelope` → `invokeHermesOneshot` (`hermes -p … -z`) |
| Department orchestration | Deterministic TS workflow via MCP | `run_department_orchestration` → `orchestrateDepartmentTask` |
| Human Approval | Governance pipeline | `approval_pending` / `applyApprovalDecision` (no DB v1) |
| Routines/Cron host | Hermes cron → shell → TS scripts | Cron 08:30 NON_LLM; Cron 09:00 Hermes or Runtime (flag) |
| Inference control | `src/ai-runtime` | Wired for Marketing Cron when `AI_RUNTIME_MARKETING_CRON_ENABLED`; interactive specialists still Hermes oneshot |
| Observability | Shared runtime status + Admin Console | Separate from Hermes Bot delivery reasons |

Code anchors:

- `src/lib/marketing/bot/organization/hermesHandoff.ts` — `HERMES_HANDOFF_CLASSIFICATION = "application_level"`
- `src/lib/marketing/bot/organization/hermesRuntime.ts` — oneshot spawn, timeout only
- `src/lib/marketing/bot/organization/orchestrate.ts` / `pipeline.ts`
- `src/lib/marketing/cron/marketingCronRuntime.ts` — exclusive Hermes **or** Runtime path
- `src/ai-runtime/router/*`, `src/ai-runtime/scheduler/*`

---

## 4. Ownership Matrix

Legend: **KEEP_HERMES** · **KEEP_THEALLTOUR** · **INTEGRATE_RUNTIME** · **REDUNDANT** · **UNCLEAR**

| Component | Classification | Notes |
|---|---|---|
| Marketing Manager | KEEP_HERMES + KEEP_THEALLTOUR | Hermes Bot identity/session; TheAllTour owns MCP policy + Telegram front door |
| Content Strategist | KEEP_HERMES + INTEGRATE_RUNTIME | Bot identity/memory KEEP_HERMES; generative draft inference → Runtime candidate |
| Governance Auditor | KEEP_HERMES + INTEGRATE_RUNTIME + KEEP_THEALLTOUR | LLM review Runtime candidate; rule-engine `evaluate_governance` KEEP_THEALLTOUR |
| Performance Analyst | KEEP_HERMES + KEEP_THEALLTOUR | Bot KEEP_HERMES; 08:30 brief NON_LLM KEEP_THEALLTOUR; interactive LLM INTEGRATE_RUNTIME |
| Bot/Profile | KEEP_HERMES | Profile = Bot |
| Bot Chat | KEEP_HERMES | Do not reimplement |
| Group Chat | KEEP_HERMES | Do not reimplement; multi-group supported natively |
| message_agent equivalent | KEEP_HERMES / **REDUNDANT** (vs handoff oneshot) | Official path is Hermes; TS oneshot is parallel channel — conflict |
| Agent Handoff | KEEP_THEALLTOUR (+ future Hermes alignment) | Envelope + approval KEEP_THEALLTOUR; delivery should eventually prefer Hermes session semantics for interactive |
| Department Orchestration | KEEP_THEALLTOUR | Deterministic business workflow — not a Group Chat clone |
| Routine/Cron | KEEP_HERMES (host) + KEEP_THEALLTOUR (job body) | Hermes schedules; TS implements marketing jobs |
| MCP | KEEP_HERMES (client) + KEEP_THEALLTOUR (server) | `theallcloud-marketing` tools |
| Skills | KEEP_HERMES | Per-profile skill enablement |
| Memory | KEEP_HERMES | Profile memory; oneshot does not preserve it |
| Human Approval | KEEP_THEALLTOUR | Must remain before publication |
| Governance | KEEP_THEALLTOUR | SNS/policy/rules + auditor prompts |
| Runtime Router | INTEGRATE_RUNTIME | Inference Control Plane |
| Quota Broker | INTEGRATE_RUNTIME | |
| Scheduler | INTEGRATE_RUNTIME | Job retry — must not stack with Hermes delivery retry on same logical request |
| Provider Adapter | INTEGRATE_RUNTIME | Under Hermes when Hermes owns the agent turn |
| Retry | **UNCLEAR / split** — propose owners in §8 | Do not change this STEP |
| Observability | KEEP_THEALLTOUR (+ Hermes typed reasons for Bot delivery) | Map codes later; no merge now |

---

## 5. Agent Handoff analysis

### Call graph (today)

```text
Manager (Hermes Bot Chat / Telegram)
  → MCP run_department_orchestration
  → orchestrateDepartmentTask / runDepartmentPipeline
  → createHandoffEnvelope(taskType)
  → invokeHermesOneshot(targetProfile)   # hermes -p … -z
  → (content path) governance oneshot → Human Approval gate
```

### Answers to audit questions

| # | Question | Answer |
|---|---|---|
| 1 | Duplicate of `message_agent`? | **Partially / conflict.** Same *intent* (ask specialist), different *semantics* (oneshot sync vs Bot Chat F&F + memory). |
| 2 | Uses target canonical Bot Chat? | **No** (orchestrator uses `-z` oneshot). Query-file Bot Chat argv exists but is unused. |
| 3 | Preserves target persistent context/memory? | **No** for oneshot path. |
| 4 | Fire-and-forget or sync R/R? | **Synchronous** wait (timeout 90s interactive / 180s cron). Official `message_agent` is F&F. |
| 5 | Where is Human Approval? | After governance in `pipeline.ts` (`approval_pending` / `toApprovalHandoff`); also rule MCP path in `mapBotResult.ts`. **Not** inside Hermes delivery. |
| 6 | Runtime migration bypass Hermes session risk? | **Yes, high** if Runtime runs prompts **instead of** Hermes Bot turns without session/tool/MCP. Cron flag path already does specialist generation outside Hermes agent loop (accepted only for batch). Interactive migration must not skip Bot Chat/MCP unless explicitly scoped. |

**Classification conflict (report, do not migrate):** Project comment “no native profile↔profile RPC” is outdated for **Bot Mode Bot Chat** (`message_agent` exists). It remains true that **CLI oneshot / MCP department path** has no native profile RPC — hence application-level orchestration.

---

## 6. Department Orchestration analysis

| # | Question | Answer |
|---|---|---|
| 1 | Deterministic business workflow? | **Yes** — intent route, fan-out budget (max 4), depth 1, synthesize, publication inactive. |
| 2 | Homegrown Group Chat? | **No.** Docs/prompts explicitly separate Group Chat / `message_agent` from department contract. |
| 3 | What could `message_agent` replace? | Optional **interactive** specialist consults that should retain Bot memory/attribution — not the whole pipeline/envelope/approval machine. |
| 4 | What must stay Group-native? | Multi-Bot deliberation rooms, `@mention` rounds, needs-you / `@user`, cross-machine rooms. |
| 5 | Overlap with Runtime Scheduler? | **Responsibility overlap risk** if department fan-out *and* Scheduler retries *and* Hermes delivery retries apply to one user request. Today interactive department does **not** use Scheduler; Cron Runtime path does. |

**KEEP_THEALLTOUR** for orchestration policy; **KEEP_HERMES** for any true multi-Bot room conversation.

---

## 7. Group Chat analysis

| Topic | Finding |
|---|---|
| Reimplementation in repo? | **None** for rooms / mentions / rounds |
| Current membership | All 4 Bots in `theallcloud marketing` |
| Multi-group support on install? | **Yes** — Desktop “Manage groups”; `groups[]` in profile `ui_meta`; plugin copy: “A bot can join multiple group chats” |
| Proposed topology | Marketing Leadership / Content Review / Performance·Strategy groups are **natively feasible**; **not created** in this STEP |
| KEEP_HERMES | Group membership, rounds, `@mention`, canonical group sessions, cross-Bot messaging |

---

## 8. Retry Ownership Matrix

### Official Hermes failure taxonomy ↔ TheAllTour layers

| Failure reason | Hermes Bot delivery | Hermes provider `fallback_providers` | Runtime Router fallback | Runtime Scheduler retry | Dept/Handoff | Cron script | **Proposed final owner** (proposal only) |
|---|---|---|---|---|---|---|---|
| `provider_auth_or_access` | surface, no auto-retry | may try next provider | usually not fallbackable | no | fail invoke | exit | **Hermes / config** (human fix) |
| `provider_quota_limit` | surface, no auto-retry | may try next | Quota Broker + optional fallback | limited | fail | exit | **Runtime Quota** when Runtime owns inference; else Hermes |
| `provider_rate_limit` | auto-retry ≤1 (delivery) | yes | yes (`RATE_LIMIT`) | yes | none | exit | **Single owner per path** — prefer Runtime if Runtime inference; else Hermes delivery |
| `provider_server_error` | auto-retry ≤1 | yes | yes | yes | none | exit | same as rate_limit |
| `context_overflow` | retry after compact | n/a | n/a | usually no | none | exit | **Hermes session** |
| `missing_config` | surface | n/a | n/a | no | fail | exit | config owner |
| `model_unavailable` | surface | fallback | yes | maybe | fail | exit | Router if Runtime path; Hermes fallback otherwise |
| `runtime_offline` | auto-retry ≤1 | n/a | n/a | defer | fail | exit | **Hermes delivery** |
| `queued_expired` | surface | n/a | n/a | n/a | n/a | n/a | **Hermes relay** |
| `delivery_timeout` | auto-retry ≤1 | n/a | TIMEOUT fallback | yes | invoke timeout kill | exit | **Hermes delivery** vs Scheduler — pick one |
| `target_busy` | refuse | n/a | n/a | n/a | n/a | n/a | **Hermes** |
| `unknown` | surface | maybe | maybe | maybe | fail | exit | surface; no multi-layer retry |

### Duplicate-execution risk (analysis only)

| Path | Stack today | Duplicate risk |
|---|---|---|
| Interactive department / handoff oneshot | Hermes CLI timeout only + business revision×1 | **Low** transport duplicate; **no** Router/Scheduler |
| Desktop `message_agent` | Hermes delivery retry ≤1 + profile `fallback_providers` | **Medium** if provider fallback also retries same turn |
| Cron Hermes path | Cron host reschedule (outside) + no script retry + revision×1 | **Low–Medium** (Hermes cron only) |
| Cron Runtime path (`AI_RUNTIME_MARKETING_CRON_ENABLED`) | Router fallback + Scheduler ≤5 + **no** Hermes invoke on failure | **Medium** internal double (Router then Scheduler) — **by design of Runtime**; must **not** also Hermes-retry |
| Future BAD migration | Hermes delivery + Router + Scheduler on one interactive request | **High** — forbid |

**Proposed ownership (do not implement now):**

1. **Bot messaging / session continuity** → Hermes delivery retry + typed reasons  
2. **Inference provider selection / quota / model fallback** → Runtime Router + Quota when Runtime is the inference plane  
3. **Job durability for batch** → Runtime Scheduler  
4. **Business revision (BLOCK)** → TheAllTour pipeline (`MAX_AUTO_REVISION_ROUNDS`)  
5. **Never** stack Hermes delivery auto-retry + Scheduler retry + Router fallback on the **same** logical interactive turn without an explicit idempotency key

---

## 9. Runtime integration boundary

### BAD vs GOOD

```text
BAD:  TheAllTour → Runtime → direct target agent prompt
      (skips Bot Chat, memory, tools, message_agent, MCP identity)

GOOD: TheAllTour → Hermes Bot → session/context/tools
                 → Runtime Inference Control → Provider
```

### Where Hermes invokes providers today

- Profile `config.yaml` → `model.provider` / `model.default` / `base_url`
- Optional `fallback_providers` (observed: `openrouter`, `openai` after Gemini)
- Agent loop inside Hermes (Desktop/gateway/CLI), not in theallcloud

### Realistic integration points (**no Hermes fork**)

| Option | Feasibility | Notes |
|---|---|---|
| **A. OpenAI-compatible custom endpoint / `base_url`** pointing at TheAllTour Runtime proxy | **Preferred long-term** | Hermes keeps agent loop/tools/MCP; Runtime enforces quota/router/adapters underneath |
| **B. `custom` / `providers:` registry** in Hermes config | Supported upstream | Same idea as A without patching Hermes |
| **C. Cron-only Runtime specialist generation** (already implemented behind flag) | **Available now** | Acceptable for batch; does **not** give Bot Chat memory |
| **D. Replace interactive oneshot with Runtime prompts** | **Discouraged** as default | Highest risk of bypassing Hermes semantics |
| **E. Fork / patch Hermes provider core** | **Out of scope / last resort** | Explicitly deprioritized |

**Current Cron flag path** is an accepted **batch exception** to GOOD shape (no Hermes agent loop for draft/governance text). Interactive Desktop/MCP path should converge on GOOD (Hermes owns turn; Runtime owns inference) before expanding Runtime.

---

## 10. Duplication / conflict risks

1. **Handoff oneshot vs `message_agent`** — parallel channels; memory/attribution diverge.  
2. **Dual governance** — rule MCP vs LLM auditor (known; keep both roles clear).  
3. **Hermes `fallback_providers` vs Runtime Router** — double fallback if both active on one request.  
4. **Runtime Scheduler vs Hermes delivery retry** — duplicate work if stacked.  
5. **Stale docs** — `runtime-integration-audit.md` still says Cron unwired; Cron Runtime flag now exists. Prefer this C0 doc for ownership.  
6. **Premature STEP 2-5.4C** — migrating handoff to Runtime without session boundary would deepen BAD shape.

---

## 11. Proposed target architecture

```text
┌─────────────────────────────────────────────┐
│ TheAllTour Business / Governance            │
│  Human Approval · SNS policy · envelopes    │
│  department MCP · publication gates         │
└───────────────────┬─────────────────────────┘
                    │ MCP / Cron scripts / APIs
┌───────────────────▼─────────────────────────┐
│ Hermes Orchestration                        │
│  Bots · Bot Chat · Group Chat · mentions    │
│  message_agent · Skills · MCP client        │
│  Routines host · typed delivery failures    │
└───────────────────┬─────────────────────────┘
                    │ model call (base_url / provider)
┌───────────────────▼─────────────────────────┐
│ TheAllTour AI Runtime (Inference CP)        │
│  Registry · Estimator · Quota · Router      │
│  Reservation · Scheduler · Adapters · Obs   │
└───────────────────┬─────────────────────────┘
                    │
        Gemini / OpenRouter / NVIDIA
```

**Transitional:** Keep application-level department orchestration; optionally route **interactive** specialist consults through Hermes Bot Chat/`message_agent` when memory matters; keep Cron Runtime behind flag for batch only until proxy integration (Option A) lands.

---

## 12. Organization topology

Proposed groups (Hermes-native capable; **not created this STEP**):

| Group | Members |
|---|---|
| Marketing Leadership Group | Manager, Strategist, Auditor, Analyst |
| Content Review Group | Strategist, Auditor |
| Performance / Strategy Group | Manager, Analyst, Strategist |

**Install verification:** Multi-group membership is supported by current Hermes Desktop plugin and `ui_meta.hermes-bots.groups`. Current single group `theallcloud marketing` already hosts all four Bots.

---

## 13. Migration recommendations

1. **Do not start** STEP 2-5.4C Agent Handoff → Runtime until session ownership is decided.  
2. Treat **Department Orchestration** as KEEP_THEALLTOUR deterministic workflow (not Group Chat rewrite).  
3. Prefer **Runtime under Hermes** (custom endpoint / providers) over Runtime-replacing-Hermes for interactive.  
4. Before enabling more Runtime paths, publish a **Retry Ownership** decision locking single auto-retry owner per failure class.  
5. Update stale “no profile RPC” wording in ops docs to: “no RPC on oneshot path; `message_agent` exists in Bot Chat.”  
6. Optional later: create the three Group topology rooms in Desktop only after product sign-off.

---

## 14. Recommended next STEP

**STEP 2-5.4C1 — Inference Boundary Spike (design + spike only)**  
Prove Option A: Hermes profile `base_url` / custom provider → TheAllTour OpenAI-compatible Runtime proxy for **one** specialist profile in a non-production experiment. Measure: tools/MCP still work; quota/router observe traffic; **no** handoff migration; **no** Group changes.

If C1 is blocked, next is **Retry Ownership Decision** (doc-only) before any 2-5.4C handoff Runtime work.

---

## Appendix A — Evidence snapshot

| Item | Value |
|---|---|
| Hermes version | v0.20.5 (2026.8.19), local `03537d69` |
| Official guide | Bot Mode (Nous Research) |
| Handoff classification constant | `application_level` |
| Max specialist dispatches | 4 |
| Max orchestration depth | 1 |
| Max auto revision | 1 |
| Cron Runtime env | `AI_RUNTIME_MARKETING_CRON_ENABLED` |
| Publication | `PUBLICATION_FLOW_INACTIVE` unchanged |

## Appendix B — Audit date

2026-08-27 — STEP 2-5.4C0
