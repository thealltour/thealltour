# Production Bot Runtime Gateway Cutover Audit — STEP 2-5.4C5

> **READ-ONLY AUDIT + CUTOVER PLAN.** This STEP does **not** change Production Bot profiles, groups, routines, credentials, Runtime routing behavior, or `PUBLICATION_FLOW_INACTIVE`.  
> Agent Handoff Runtime migration remains **DEFERRED**. Hermes source patch/fork is **forbidden**.

**Audit date:** 2026-08-28  
**Source of truth (in priority order):**

1. Installed Hermes Agent **v0.20.5** (`pyproject.toml`; git `03537d69` under `~/.hermes/hermes-agent`)
2. Live profile homes `~/.hermes/profiles/<id>/` and group store `~/.hermes/profile.yaml`
3. thealltour repo (`src/ai-runtime/**`, `src/lib/marketing/**`) as of `59527ac`
4. Prior C-series docs: C0 native audit, C1 inference boundary, C2 tool protocol, C3 structured output, C4 Desktop E2E, C4.1 live fallback

**Legend:** **CONFIRMED** = read from live install/config/code. **INFERRED** = derived from those facts with explicit reasoning. **UNKNOWN** = not observed; not guessed.

---

## C6 update (2026-08-28) — Gateway hardening complete

**C6 verdict: IMPLEMENTATION GO for C7 canary prep** (code + docs only; Production profiles still unchanged).

| C5 blocker | C6 resolution |
|---|---|
| `agentId` hardcoded `runtime-spike` | **Removed.** Alias registry maps production aliases → real `agentId`. |
| Production identity attribution | `thealltour/<profile-id>` aliases + `X-AI-Runtime-Agent-Id` header. |
| `spikeForceFallback` blast radius | Registry-gated; only `theallcloud/auto-fallback-spike`. Env flag no longer affects production or `theallcloud/auto`. |
| Workload mapping | Per-alias: `analysis`, `content_draft`, `governance`, `manager_decision`. |
| Dual fallback risk | `validateHermesRuntimeCutoverConfig()` documents `fallback_providers: []` invariant. |
| Unknown alias abuse | Allowlist → `INVALID_REQUEST`. |

**Reference:** [runtime-inference-gateway.md](./runtime-inference-gateway.md)  
**Next:** **STEP 2-5.4C7** — Performance Analyst profile canary (first Production `config.yaml` edit).

### C6.1 deploy verification (2026-08-28)

**Verdict: COMPLETE / PRODUCTION GATEWAY READY**

| Gate | Result |
|---|---|
| `npm run build` | PASS (`BUILD_ID=2fujBtd9wGTE-vPNAUG6j`) |
| HTTP alias smoke 4/4 | PASS — correct `agentId` / workload headers |
| Auth (401/403/bearer) | PASS |
| Negative (unknown alias, spike isolation, C4.1 spike fallback) | PASS |
| Shared observability | PASS — production agents only, no spike mis-attribution |
| Regression (gateway + router + C1–C4.1 related) | 59/59 PASS |
| Hermes Production profiles | **UNCHANGED** (still native Gemini) |
| `thealltour-internal.service` | **RESTORED** — PID 25907, `active (running)`, `:3000` listener under systemd |

**Final restore check (2026-08-28 ~15:03 KST):** manual `next-server` terminated; post-smoke HTTP alias smoke 4/4 PASS; unauthenticated → 401; service remains active.

### C6.2 Marketing Manager 09:00 cron path repair (2026-08-28)

**Verdict: COMPLETE / CRON PATH REPAIRED**

| Item | Detail |
|---|---|
| Root cause | `daily-marketing-plan.sh` had `cd /home/ysh/theallcloud`; repo moved to `/home/ysh/thealltour`; `cron-daily-marketing-plan.ts` exists only under thealltour |
| Repair | `cd /home/ysh/thealltour` (matches 08:30 Analyst wrapper convention) |
| File changed | `~/.hermes/profiles/marketing-manager/scripts/daily-marketing-plan.sh` line 15 only |
| Manual one-shot | **PASS** — exit 0, `inference_path: ai-runtime`, no `ERR_MODULE_NOT_FOUND`, no `/home/ysh/theallcloud` reference |
| Runtime workloads | `content-strategist` / `content_draft`, `governance-auditor` / `governance`; correlationId `marketing-cron:…:cb7fd192`; fallback=false; gemini-main |
| Publication safety | `PUBLICATION_FLOW_INACTIVE=true`; `sns_side_effect: 0`; `publishActionIncluded: false`; governance ALLOW → publish_ready (no publish) |
| Scheduled `jobs.json` | **Unchanged** by manual run — `last_status: error` (2026-08-28 09:00 failure) until next scheduled 09:00 |
| 08:30 Analyst | **Unchanged** — `9e96a94ee72f`, `30 8 * * *`, `no_agent: true`, NON_LLM, wrapper still `cd /home/ysh/thealltour`, `last_status: ok` |
| C7 impact | None — Hermes Production Bot inference configs unchanged |

### C7 Attempt #1 — Performance Analyst canary (2026-08-28) — **FAILED / ROLLED BACK**

**Verdict: NO-GO — immediate rollback to native Gemini**

| Gate | Result |
|---|---|
| Gateway HTTP alias smoke (curl + bearer) | **PASS** — 200 |
| Hermes canonical Bot Chat (`20260825_133423_f2c9b2`) | **FAIL** — HTTP 401 |
| Post-rollback native Gemini Bot Chat | **PASS** |
| Production profile state after rollback | `provider: gemini`, `default: gemini-3.5-flash-lite` |

**Applied config (rolled back; backup `config.yaml.c7bak`):**

```yaml
model:
  provider: custom                    # ← root cause branch
  default: thealltour/performance-analyst
  base_url: http://127.0.0.1:3000/api/ai-runtime/v1
  api_mode: chat_completions
fallback_providers: []
providers:
  thealltour-runtime:
    base_url: http://127.0.0.1:3000/api/ai-runtime/v1
    api_mode: chat_completions
    key_env: AI_RUNTIME_INFERENCE_GATEWAY_TOKEN   # ← never read on bare-custom path
```

**Hermes v0.20.5 root cause (source-audited):**

| Question | Answer |
|---|---|
| A. Resolver selected | `_resolve_named_custom_runtime()` **direct-alias branch** — bare `provider: custom` + `model.base_url` (`runtime_provider.py` ~1120–1151) |
| B. Bearer sent | **`no-key-required` (placeholder)** — not gateway token; classify: **placeholder/no-key** |
| C. Why `key_env` ignored | Bare-custom loopback path never calls `_getenv(key_env)`; only named provider path (`custom:<name>` → `_get_named_custom_provider`) reads `providers.*.key_env` (~1194) |
| D. Alias / models map | C7 config lacked `providers.*.models`; `-m` / session reverse-lookup unsupported |
| E. Primary cause | **Bare `provider: custom` resolver branch** (credential scope alone would not fix without named provider syntax) |

**Env scope at failure:**

| Source | `AI_RUNTIME_INFERENCE_GATEWAY_TOKEN` |
|---|---|
| `/home/ysh/thealltour/.env.local` | key present (Node/Next.js only) |
| `~/.hermes/.env` | absent |
| `~/.hermes/profiles/performance-analyst/.env` | absent |
| Hermes `build_profile_secret_scope()` | loads **profile** `<home>/.env` only — project `.env.local` **not** auto-loaded |

Exporting from `.env.local` into shell before Bot Chat **did not** fix 401 because Hermes still resolved bare-custom → `no-key-required`.

**Preflight gap:** `validateHermesRuntimeCutoverConfig()` previously accepted bare `custom` when Node `process.env` had the token — **false GO**.

### C7.1 — Hermes native custom-provider auth hardening (2026-08-28)

**Verdict: HARDENING COMPLETE / C7 RETRY PREREQS MET (non-production proof)**

Production profiles **unchanged** (native Gemini). C7 retry **not executed** in this STEP.

| Deliverable | Result |
|---|---|
| Hermes v0.20.5 resolver audit | **CONFIRMED** — see §C7 root-cause table |
| Canonical config shape derived | **`model.provider: custom:thealltour-runtime`** + `providers.thealltour-runtime` with `key_env`, `base_url`, `api_mode`, `models` |
| Preflight validator hardened | `cutover-preflight.ts` rejects bare `custom`, inline `api_key`, missing `models` alias, Node-only token |
| Hermes execution scope probe | `hermes-env-scope.ts` — profile `.env` → `~/.hermes/.env` → process env (keys only, no values) |
| Non-production Hermes auth proof | **PASS** — `runtime-spike` with `custom:theallcloud-runtime` + `key_env` (no inline `api_key`) |
| Default model resolution | **PASS** — `hermes -p runtime-spike chat …` → 200, `C71_AUTH_OK` |
| Explicit `-m` resolution | **PASS** — `hermes -p runtime-spike -m theallcloud/auto chat …` → 200, `C71_M_ALIAS_OK` |
| Wrong/missing bearer (Gateway) | **PASS** — curl → 401 |

**Canonical Production cutover shape (minimum, Hermes source-aligned):**

```yaml
model:
  provider: custom:thealltour-runtime    # NOT bare "custom"
  default: thealltour/performance-analyst
  base_url: http://127.0.0.1:3000/api/ai-runtime/v1
  api_mode: chat_completions
fallback_providers: []
providers:
  thealltour-runtime:
    base_url: http://127.0.0.1:3000/api/ai-runtime/v1
    api_mode: chat_completions
    key_env: AI_RUNTIME_INFERENCE_GATEWAY_TOKEN
    models:
      thealltour/performance-analyst:
        context_length: 128000
```

**Secret placement (C7.1 non-production proof):** `AI_RUNTIME_INFERENCE_GATEWAY_TOKEN` in `~/.hermes/profiles/runtime-spike/.env` (mode `600`). For Production canary: prefer **`~/.hermes/profiles/performance-analyst/.env`** or `~/.hermes/.env` — **never** literal in `config.yaml` / repo.

**Syntax NOT recognized:** bare `model.provider: custom` (uses direct-alias / no-key path); bare `model.provider: thealltour-runtime` without `custom:` prefix (unless matched via `providerIdentityAliases` — use explicit `custom:thealltour-runtime`).

**C7 retry prerequisites:**

1. Preflight passes canonical shape + Hermes execution scope for `performance-analyst`
2. `config.yaml.c7bak`-style backup on disk before edit
3. Gateway `:3000` healthy (C6.1)
4. Rollback owner + RTO documented
5. 24h observation plan (deferred until C7 Attempt #2)

**C7 retry readiness:** **GO** (hardening + non-production proof complete; Production profile edit still deferred to C7 Attempt #2)

### C7 Attempt #2 — Performance Analyst canary (2026-08-28) — **FINAL PASS (24h complete)**

**Immediate verdict (cutover day): TESTS PASS — Production cutover active on `performance-analyst` only**  
**24h FINAL:** see **C7 FINAL — 24h observation complete** below.

| Gate | Result |
|---|---|
| `thealltour-internal.service` | **active / running** (PID 25907) |
| Production alias HTTP smoke 4/4 | **PASS** |
| C7.1 preflight (planned + post-write) | **PASS** — `gatewayTokenSource: profile_env` |
| Backup | `config.yaml.c7a2bak` SHA256 `21f69f58…` (pre-cutover native Gemini) |
| Post-cutover config SHA256 | `1c81c008…` |
| Auth probe (`-m thealltour/performance-analyst`) | **PASS** — `C7A2_AUTH_OK` |
| Canonical Bot Chat `20260825_133423_f2c9b2` | **PASS** — `C7_ANALYST_OK`, session id unchanged |
| Context continuity | **PASS** — `C7_CONTEXT_OK`, history intact |
| Production MCP tool loop (`get_performance_evidence`) | **PASS** — `C7_MCP_OK` |
| Hermes oneshot | **PASS** — `C7_ONESHOT_OK`, exit 0 |
| Group Chat | See **C7 Group Desktop probe (2026-08-28 16:27 KST)** below |
| Runtime observability (immediate probes) | **PASS** — events `agent_id=performance-analyst`, `workload=analysis`, **0** `runtime-spike` |
| Other 3 Production Bots | **UNCHANGED** — native Gemini (checksums verified) |
| 08:30 NON_LLM routine `9e96a94ee72f` | **UNCHANGED** — not rerun |
| Rollback triggered | **no** |

**Secret scope (path only):** `~/.hermes/profiles/performance-analyst/.env` — `AI_RUNTIME_INFERENCE_GATEWAY_TOKEN` added (mode `600`). No token literal in `config.yaml` / repo.

**Exact inference diff vs `config.yaml.c7a2bak`:**

```yaml
model:
  provider: custom:thealltour-runtime          # was: gemini
  default: thealltour/performance-analyst      # was: gemini-3.5-flash-lite
  base_url: http://127.0.0.1:3000/api/ai-runtime/v1   # was: ''
  api_mode: chat_completions
fallback_providers: []                         # was: [openrouter, openai]
providers:                                     # new block
  thealltour-runtime:
    key_env: AI_RUNTIME_INFERENCE_GATEWAY_TOKEN
    base_url: http://127.0.0.1:3000/api/ai-runtime/v1
    api_mode: chat_completions
    models:
      thealltour/performance-analyst:
        context_length: 128000
```

**Fallback ownership:** Hermes `fallback_providers: []` ✓ · Runtime `allowFallback=true` (gateway mapper) ✓ · Normal probe completions: `fallback_used=false`, `attempt_count=1` on successful legs; one MCP leg showed transient Runtime provider retry before success (observed in observability, final response OK).

**Observation window:**

| | KST |
|---|---|
| Start | **2026-08-28 16:13** |
| End (minimum) | **2026-08-29 16:13** |

Monitor: canonical Bot Chat, MCP usage, oneshot, Gateway `:3000` health, Runtime error/fallback rate, next 08:30 NON_LLM routine (not inference proof).

**C7 Attempt #2 rollback:** restore `config.yaml.c7a2bak` → verify native Gemini Bot Chat on `20260825_133423_f2c9b2`.

**Do not proceed to Content Strategist** until **C7.3 session migration runbook** is complete (C7 FINAL PASS alone is insufficient for Desktop/Group Gateway coverage).

### C7 FINAL review — 24h observation (2026-08-28 16:17 KST interim)

**Verdict: KEEP OBSERVING — observation window not complete**

| Item | Status |
|---|---|
| Review timestamp | **2026-08-28 16:17 KST** (~4 min into window; end **2026-08-29 16:13 KST**) |
| Canary config | **UNCHANGED** — checksum `1c81c008…`, `custom:thealltour-runtime`, `fallback_providers: []`, profile `.env` mode 600 |
| Other 3 Bots | **native Gemini** (unchanged) |
| `thealltour-internal.service` | **active** since 2026-08-28 15:02 KST, PID 25907, no restart in window |
| Production alias smoke | **PASS** (at cutover + re-check in progress) |
| Post-canary Hermes errors (`errors.log` ≥16:13) | **0** auth/401 entries |
| Pre-canary 401s (15:17–15:18) | C7 Attempt #1 only — **outside** observation window |

**Runtime observability (2026-08-28 16:13–16:17 KST only — immediate probe traffic):**

| Metric | Value |
|---|---|
| PA events | 30 |
| Distinct correlation IDs | 4 |
| `job_completed` / `job_failed` | 3 / 1 (75% — includes MCP transient retry leg) |
| `runtime-spike` attribution | **0** |
| Wrong workload | **0** |
| Post-canary 401/403 (observability) | **0 / 0** |
| Latency p50 / p95 / max (ms) | 1984 / 2265 / 2265 (n=6) |
| Tokens in/out (aggregate) | 60596 / 40 |

**Transient retry (MCP probe):** 1× `route_failed` with `fallback_used=true` → recovered (`job_completed` ≥ `job_failed`); **isolated**, no user-visible failure (C7_MCP_OK delivered). No additional retries in window so far.

**Not yet in window:**

| Check | Status |
|---|---|
| Canonical Bot Chat ongoing stability | Immediate PASS holds; **full-window soak pending** |
| 08:30 Analyst `9e96a94ee72f` (2026-08-29) | **PENDING** — next run scheduled |
| 09:00 Marketing `edfc1815135b` (2026-08-29) | **PENDING** — last run still pre-repair error (2026-08-28 09:00) |
| Group Chat Desktop probe | **PASS (orchestration)** / **Gateway NOT OBSERVED** — see below |
| 24h Gateway soak / natural traffic | **INCOMPLETE** |

**C7 Group Desktop probe (2026-08-28 16:27 KST)** — `thealltour marketing`, user `@Performance Analyst` turn

| Check | Result |
|---|---|
| Group orchestration / UX | **PASS** — Analyst + Manager + Strategist + Auditor turns completed; no Group abort |
| Runtime Gateway traversed (PA turn) | **NO** — **0** observability events ≥16:25 KST; Hermes log: session `20260826_225600_a8ad31`, `provider=gemini`, direct Gemini API (`API call #1 … provider=gemini`) |
| Session model restore | Group session retained pre-cutover `gemini-3.5-flash-lite` snapshot — **overrode** profile `custom:thealltour-runtime` for this turn |
| Observability `agent_id` / `workload` | **N/A** (no Gateway events) |
| `runtime-spike` attribution | **0** |
| Other 3 Bots | **native Gemini** (config + log confirmed) |
| Group membership / storage | **UNCHANGED** — `profile.yaml` revision **25**, 4 members; expected log append only |
| Secret / prompt / MCP in observability | **Clean** — no events for this turn; allow-list metadata unchanged |

**Group Chat Desktop probe: PASS** (Group stability). **Gateway path for Group turn: NOT OBSERVED** — not a Gateway failure; see **C7.2** for session-model semantics. CLI `-Q` / oneshot / `-m` probes remain authoritative for **fresh-process Gateway wiring**; **Desktop-resumed** Bot/Group sessions are a separate gap until migrated.

### C7.2 Group Session Model Snapshot Finding (2026-08-28)

**STEP:** 2-5.4C7.2 — read-only Hermes v0.20.5 source audit + persisted-state inspection. **No Production config/group/storage mutation.**

#### Observed evidence (Production)

| Surface | Verdict | Detail |
|---|---|---|
| Group UX / orchestration | **PASS** | `@Performance Analyst` in `thealltour marketing` (~16:27 KST) completed multi-member turn |
| Existing Group PA → Runtime Gateway | **NOT OBSERVED / NOT PASSED** | 0 PA observability events ≥16:25 KST; remote gateway log: session `20260826_225600_a8ad31`, `provider=gemini`, native Gemini API |
| Profile config (post-cutover) | **Gateway-backed** | `custom:thealltour-runtime` + `thealltour/performance-analyst` in `performance-analyst/config.yaml` only |

Classification: **Group orchestration PASS**; **Existing Group member inference pinned to pre-cutover native Gemini snapshot** — not relabeled as Gateway failure.

#### Source root cause (Hermes v0.20.5, git `03537d69`)

Hermes treats **session rows** as durable model/provider snapshots. Profile `config.yaml` is **not** re-consulted on every Desktop/TUI turn when a session carries a pinned override.

| Stage | File / function | Behavior |
|---|---|---|
| Persist model route | `tui_gateway/server.py` → `_runtime_model_config()` | Writes `sessions.model`, `billing_provider`, JSON `model_config` (incl. `gateway_runtime`) on API calls and `/model` |
| Read stored override | `tui_gateway/server.py` → `_stored_session_runtime_overrides()` | Builds `model_override` dict from row `model` + `model_config.provider` or `billing_provider` |
| Resume (Desktop/TUI) | `tui_gateway/methods_session.py` → `@method("session.resume")` | Loads overrides via `_stored_session_runtime_overrides(found)`; stores on live session record as `model_override` |
| Agent build | `tui_gateway/server.py` → `_make_agent()` | **Prefers `model_override` over profile config** (L8516–8551) |
| Per-turn config sync | `tui_gateway/server.py` → `_sync_agent_model_with_config()` | Adopts `config.yaml` model **only when `session["model_override"]` is unset** (L6270–6277) |
| Group member session | `apps/desktop/.../hermes-bots/plugin.js` → `ensureGroupChatSession()` | `session.resume` by stored sid or title `Group: ${roomId \|\| group}`; else `session.create` |
| Group member turn | `runGroupChatMemberTurnLeased()` | Re-resumes member session, `prompt.submit` on **runtime** id; model comes from resumed override |
| CLI resume restore | `cli.py` → `_restore_session_model()` | Restores row snapshot into `self.model` / `self.provider` (unless `-m`) |
| CLI `-Q --resume` quirk | `cli.py` single-query path (~L21523–21529) | `_resolve_turn_agent_config()` runs **before** `_init_agent()` restore; passes profile model/runtime as **`model_override` arg**, which wins over restored snapshot (`effective_model = model_override or self.model`) |

**CONFIRMED:** Existing Group member sessions use the **TUI gateway resume path** → pinned `model_override` → native Gemini for PA Group session `20260826_225600_a8ad31`.

**CONFIRMED:** C7 Attempt #2 canonical Bot Chat probe used **CLI** `hermes chat --resume … -Q` (no `-m`). Gateway was reached because the `-Q` path supplies **current profile** as explicit `model_override`, not because the stored Bot Chat row already pointed at Gateway.

**INFERRED:** Desktop **Bot Chat** for the same stored session (`20260825_133423_f2c9b2`, `source: tui`) would follow the **same TUI `session.resume` + `model_override` semantics as Group**, not the CLI `-Q` probe — i.e. likely **native Gemini until session model is refreshed**, despite profile cutover.

#### Desktop Bot Chat session snapshot verification (2026-08-28 ~16:43 KST)

Read-only operator turn in existing Performance Analyst **Desktop Bot Chat** (no `/model`, no migration).

| Check | Result |
|---|---|
| Session id reused | **YES** — `20260825_133423_f2c9b2` (`agent_session_id` in multiplex gateway log; `state.db` `last_activity_at` 16:43:48 KST; message_count 18) |
| Platform | **tui** (Desktop → multiplex gateway `~/.hermes/logs/agent.log`) |
| User prompt (observed) | `현재 상태를 한 문장으로 답해줘.` (16:43:47 KST) |
| Hermes inference route | **native Gemini snapshot** — `provider=gemini`, `model=gemini-3.5-flash-lite`, `base_url=https://generativelanguage.googleapis.com/v1beta`; `Gemini native client created (chat_completion_stream_request)`; `API call #1 … provider=gemini` |
| Runtime Gateway observability | **0 events** for `agent_id=performance-analyst` ≥16:40 KST — **no** `workload=analysis` row for this turn |
| DB row after turn | `model=gemini-3.5-flash-lite`, `billing_provider=gemini` (unchanged) |

**Classification: A — Desktop existing Bot Chat → native Gemini snapshot** (C7.2 inference confirmed; replaces prior INFERRED-only Bot Chat note).

Log source: `~/.hermes/logs/agent.log` lines ~3637–3648 (multiplex TUI gateway). Profile `performance-analyst/logs/agent.log` has **no** 16:43 entry (Desktop routed via gateway host, not local CLI).

#### Bot Chat vs Group

| | Canonical Bot Chat `20260825_133423_f2c9b2` | Group PA `20260826_225600_a8ad31` |
|---|---|---|
| Title | `Bot Chat` | `Group: thealltour marketing` |
| DB `model` | `gemini-3.5-flash-lite` | `gemini-3.5-flash-lite` |
| DB `billing_provider` | `gemini` | `gemini` |
| DB `model_config` | `null` | `{"model":"gemini-3.5-flash-lite","provider":"gemini"}` |
| C7 probe path | **CLI `-Q --resume`** → Gateway (not Desktop) | **Desktop Group** → TUI resume → Gemini |
| Desktop Bot Chat (16:43 KST) | **Desktop TUI resume → Gemini (observed)** | same |
| Why different at probe time | CLI `-Q` pre-override ordering (see above) | Explicit `model_config.provider` + live `model_override` pin |

Both are **separate hidden/TUI-scoped sessions** under the same profile DB; Group does **not** share the canonical Bot Chat row.

#### Persisted state (read-only, no secrets)

| Session id | Title | model | billing_provider | base_url (billing) | source |
|---|---|---|---|---|---|
| `20260825_133423_f2c9b2` | Bot Chat | `gemini-3.5-flash-lite` | `gemini` | `https://generativelanguage.googleapis.com/v1beta` | `tui` |
| `20260826_225600_a8ad31` | Group: thealltour marketing | `gemini-3.5-flash-lite` | `gemini` | same | `tui` |
| `20260828_160530_905924` | C7A2 Auth Probe | `thealltour/performance-analyst` | `custom` | `http://127.0.0.1:3000/api/ai-runtime/v1` | `cli` |
| `20260828_161315_002310` | oneshot | `thealltour/performance-analyst` | `custom` | same | `cli` |

Group room storage (`~/.hermes/profile.yaml`): revision **25**, 4 members unchanged; member→session pointer lives in Desktop `$groupChats` state (not duplicated in YAML excerpt). Production Group storage **not modified** in C7.2.

#### Supported refresh mechanisms (Hermes-native)

| Mechanism | Supported | Preserves Group history | Preserves Group identity | Resets member session only | Destructive | Production-suitable |
|---|---|---|---|---|---|---|
| `/model thealltour/performance-analyst --provider custom:thealltour-runtime --session` (in live TUI session) | **Yes** | Yes (transcript) | Yes | Yes (model pin on that session row) | No | **Yes** — preferred if operator can open member session |
| `_sync_agent_model_with_config` (automatic on turn) | **Yes**, but only when **`model_override` unset** | Yes | Yes | No — in-place adopt | No | **Blocked** for existing Group/Bot rows that already have overrides |
| `/model … --global` | **Yes** | Yes | Yes | No — changes profile default for **new** sessions | Config write | Partial — does **not** refresh pinned existing sessions |
| `/model … --once` | **Yes** | Yes | Yes | One turn only | No | Probe/debug only |
| New Group `roomId` (`mintGroupRoomId()`) + new member `session.create` | **Yes** | **No** for old room transcript in new room | Display name can match; **new room id** | Fresh member sessions | Old room archived/disband | **Yes** as controlled migration (step 3 in policy) |
| Disband + recreate Group (same display name, new `roomId`) | **Yes** | **No** (new room log) | Name reuse only | All members fresh | High UX impact | Last resort |
| Delete Production Group / mutate `profile.yaml` room | Desktop supports disband | **No** | **No** | **No** | **Yes** | **Forbidden** during C7 (explicit constraint) |
| Hermes “model refresh” / “reload session config” command | **No dedicated command found** | — | — | — | — | — |

#### Fresh-session hypothesis

**CONFIRMED (source):** `session.create` without `model` param builds from current profile via `_make_agent()` / deferred build; Group `ensureGroupChatSession()` calls `session.create` only when resume returns **4007** (no row). A **new Group room** (`mintGroupRoomId()`) or **new member session** after 4007 would use post-cutover `custom:thealltour-runtime` + `thealltour/performance-analyst`.

**Not executed in C7.2:** Non-production Desktop Group reproduction (would write `$groupChats` / optional `runtime-spike` profile edits). Deferred to C7.3+ if needed.

#### Future cutover blast radius

If `thealltour marketing` Group member sessions are **never refreshed**:

| Profile cutover order | Individual Bot surfaces | Existing Group member turn |
|---|---|---|
| PA (C7, active) | Bot Chat Desktop, Group PA, cron, oneshot paths diverge | **PA Group: native Gemini (observed)** |
| CS / GA / MM (C8–C10) | Same pattern per profile | **Each member keeps its own pinned session snapshot** until refreshed |

**CONFIRMED:** Four profiles can be Gateway-backed in `config.yaml` while the **same Group** continues calling native Gemini for members whose session rows still snapshot Gemini.

**Other surfaces:**

| Surface | Expected after profile cutover |
|---|---|
| `@mention` / Group orchestration | Unchanged — routes to member session; **does not re-resolve model** |
| `message_agent` | Uses target Bot's session resume/create semantics — **same snapshot rules** |
| CLI oneshot `-z` | **Fresh session** → current profile (**Gateway** for PA today) |
| CLI `-Q --resume` | **Profile config wins** (override ordering) — **not representative of Desktop** |
| Telegram Manager session | Messaging gateway resume — **same `_stored_session_runtime_overrides` family** (INFERRED; same `hermes_state` readers) |
| Pre-existing TUI/Desktop sessions | Pinned until `/model --session` or new session |

#### Recommended Group migration policy (C7–C10; not implemented in C7.2)

1. **Preferred:** Operator runs `/model thealltour/<alias> --provider custom:thealltour-runtime --session` inside each affected **member hidden session** (or Desktop equivalent model picker scoped to session) after profile cutover — preserves Group history + identity.
2. **Fallback:** After cutover soak, create **new Group room** (`roomId` mint), archive old room, re-seat members — preserves profile identities, not old room transcript in-place.
3. **Last resort:** Disband/recreate Production Group — destructive UX; requires explicit approval.
4. Document per-bot **session id inventory** (`Group: …` titles in `state.db`) at cutover time for audit.

#### C7 FINAL impact (C7.2)

**Classification A (recommended):** C7 can **FINAL PASS with documented Desktop session gap** (Bot Chat **confirmed** + Group **confirmed**), because:

- Profile cutover, auth, MCP, oneshot, and **fresh-process** CLI Gateway paths are **proven**.
- Observed Desktop Bot Chat + Group behavior matches **designed Hermes session immutability**, not Runtime regression.
- **Action item:** migrate existing **Bot Chat and Group** member sessions before treating Desktop inference as cutover-complete.

**Not B:** Rollback not warranted — native Gemini Group success is expected under current session semantics.

**Rollback readiness:** `config.yaml.c7a2bak` SHA256 `21f69f58…` — present, not exercised.

### C7 FINAL — 24h observation complete (2026-08-30 ~00:14 KST)

**C7 FINAL PASS — Performance Analyst profile-level Runtime Gateway cutover validated. Legacy Desktop/TUI Bot Chat and Group member sessions remain native Gemini snapshots pending separate session migration.**

| Item | Value |
|---|---|
| Observation start | **2026-08-28 16:13 KST** |
| Minimum end | **2026-08-29 16:13 KST** |
| Review timestamp | **2026-08-30 00:14 KST** |
| Elapsed | **~32h** (≥24h) |
| Git HEAD / origin/main | `b093a4f` (includes C7.2 docs; C7.1 code ancestor `883e046`) |
| Deployed process | `thealltour-internal.service` **active**, PID **25907**, `NRestarts=0`, up since **2026-08-28 15:02 KST** (no crash loop) |
| Alias smoke (review) | **HTTP 200** — `x-ai-runtime-agent-id=performance-analyst`, `workload=analysis`, `fallback=0` |
| Profile checksum | **unchanged** `1c81c008…` — `custom:thealltour-runtime` / `thealltour/performance-analyst` / `fallback_providers: []` |
| Credential | `.env` mode **600**, token present/non-empty, **0** token literals in tracked docs/src; YAML has MCP `Authorization: Bearer ${…}` ref only |
| Backup | `config.yaml.c7a2bak` SHA256 `21f69f58…` — present, **not** exercised |

**24h Runtime observability (`agent_id=performance-analyst`, window start → review; exclude review-only smoke for soak narrative):**

| Metric | Soak (28 16:13–16:20 KST probes) | + Review smoke (30 00:15 KST) |
|---|---|---|
| Events | 30 | 36 |
| Distinct correlations | 4 | 5 |
| `job_completed` / `job_failed` | 3 / 1 | 4 / 1 |
| `route_completed` / `route_failed` | 3 / 1 | 4 / 1 |
| Workload | **analysis only** | same |
| Wrong agent / `runtime-spike` | **0 / 0** | **0 / 0** |
| Post-cutover Hermes real HTTP 401/403 | **0 / 0** | **0 / 0** |
| Overnight natural PA Gateway traffic (28 16:20 → 29 16:13) | **0 events** (expected: Desktop/Group pinned to Gemini; 08:30 NON_LLM) | — |

**Retry/fallback (soak):**

| Correlation | Outcome | Notes |
|---|---|---|
| `…:fadbe9ad` | `job_completed` | gemini-main primary, `fallback_used=false` |
| `…:5ec05aee` | `job_completed` | concurrent success |
| `…:9df4730e` | `job_failed` | nvidia `PROVIDER_ERROR` → gemini `INVALID_REQUEST`; **isolated** immediate-probe leg |
| `…:c884e48d` | `job_completed` after provider errors | nvidia fail → gemini primary `TIMEOUT` → gemini **secondary** success; `fallback_used=true`, `attempt_count=3` — **recovered**, user-visible `C7_MCP_OK` |

No escalating provider instability after 16:20 KST Aug 28. Successfully recovered / isolated immediate-probe failures are **not** rollback triggers.

**Fresh Runtime paths (prior C7 #2 evidence, still valid; profile intact):** auth `C7A2_AUTH_OK`, CLI/oneshot/MCP Gateway proofs, review alias smoke PASS.

**Desktop Bot Chat `20260825_133423_f2c9b2`:** UX **PASS**; → Gateway **NOT MIGRATED / NATIVE GEMINI SNAPSHOT** (C7.2 live test 16:43 KST; row unchanged `gemini-3.5-flash-lite` / msg_count 18).

**Group `thealltour marketing` / PA `20260826_225600_a8ad31`:** orchestration **PASS**; → Gateway **NOT MIGRATED / NATIVE GEMINI SNAPSHOT**; room revision **25**, 4 members unchanged.

**08:30 PA cron `9e96a94ee72f` (2026-08-29):** fired `08:30:55` → finished `08:31:00`; `last_status=ok`; `no_agent=true`; wrapper `daily-performance-brief.sh` → `cd /home/ysh/thealltour`; **NON_LLM regression PASS** (not Gateway inference proof).

**09:00 MM cron `edfc1815135b` (2026-08-29):** fired `09:00:05` → `09:00:13`; `last_status=ok`; prior Aug 28 `ERR_MODULE_NOT_FOUND` (**theallcloud**) **absent**; wrapper `cd /home/ysh/thealltour`; output: `inference_path: ai-runtime`, `governance: ALLOW`, `sns_side_effect: 0`, `ai_publications: 0`. Informational/regression PASS for shared Runtime infra.

**Other Bots:** marketing-manager / content-strategist / governance-auditor remain `provider=gemini` / `gemini-3.5-flash-lite`. **C8 not started.**

**Publication:** `PUBLICATION_FLOW_INACTIVE = true` (compile-time). No SNS side effects observed on cron outputs.

**C8 profile cutover:** **NOT STARTED**

**Next STEP (recommended):** **2-5.4C7.3 — Production Session Migration Runbook / Performance Analyst Session Migration** (`/model … --session` for Bot Chat + Group member; preserve history; prove Gateway reachability) before any Content Strategist profile cutover.

---

## 1. Executive Summary

**C5 overall verdict: PLAN READY / IMPLEMENTATION NO-GO until Gateway identity is production-capable.**

C1–C4.1 proved that a **non-production** Hermes profile (`runtime-spike`) can use a custom OpenAI-compatible `base_url` against `/api/ai-runtime/v1`, keep Hermes MCP/tool loop ownership, and exercise Runtime provider fallback. That path is **not** yet safe to copy onto the four Production Bots.

| Question | Answer |
|---|---|
| Can Hermes v0.20.5 point a Bot at Runtime without a fork? | **Yes (CONFIRMED).** Spike profile already does: `model.provider: custom` + `base_url` + `api_mode: chat_completions` + `fallback_providers: []`. |
| Are Production Bots on that path today? | **No (CONFIRMED).** All four: `provider: gemini`, `default: gemini-3.5-flash-lite`, `base_url: ''`, `fallback_providers: [openrouter, openai]`. |
| Would a profile-level cutover stay inside Desktop Chat? | **No (CONFIRMED).** The same profile model config is used by Bot Chat, Group Chat, Telegram (Manager), `message_agent` turns, and `hermes -p … -z` oneshot. It does **not** migrate Handoff to a Runtime *direct call* — it still goes through Hermes CLI — but oneshot inference would start hitting the Gateway. |
| Blocker for first canary? | **Yes.** Gateway `mapOpenAiCompatToRuntimeRequest` hardcodes `agentId: "runtime-spike"` and `priority: "high"`. Production traffic would be mis-tagged as spike (observability + `spikeForceFallback` blast radius). |
| SNS auto-publish risk if cutover proceeds later? | **None from publication adapters (CONFIRMED).** `PUBLICATION_FLOW_INACTIVE = true` compile-time in `governanceBoundary.ts`. |

**Recommended next implementation STEP:** **2-5.4C6 — Production-ready Gateway identity / alias / workload mapping** (code only; still no Production profile edits). Then **2-5.4C7 — Performance Analyst canary** (single profile config + backup).

---

## 2. Production Bot Inventory

Four Production marketing Bots exist as Hermes profiles. Names match the expected kebab-case ids. A fifth profile `runtime-spike` is **not** Production. `test1` is **not** Production.

Hermes version compatibility: all four share `_config_version: 39` and run under the multiplex gateway / Desktop remote `100.79.96.45:9119` (CONFIRMED in group membership). Installed agent **v0.20.5**.

Credential values are **not** recorded. Sources observed by **env var name only**:

| Env var | Typical use |
|---|---|
| `GOOGLE_API_KEY` | Gemini primary (Hermes native provider) |
| `OPENROUTER_API_KEY` | Hermes `fallback_providers` |
| `OPENAI_API_KEY` | Hermes `fallback_providers` |
| `MARKETING_BOT_INTERNAL_TOKEN` | MCP `Authorization: Bearer ${…}` |
| `MCP_THEALLTOUR_MARKETING_API_KEY` | MCP server side (same class of secret) |
| `TELEGRAM_BOT_TOKEN` / `TELEGRAM_ALLOWED_USERS` / `TELEGRAM_HOME_CHANNEL` | Manager Telegram only |
| `AI_RUNTIME_INFERENCE_GATEWAY_TOKEN` | Spike custom provider → Gateway bearer (Production profiles do **not** reference this today) |
| `NVIDIA_API_KEY` | Home `~/.hermes/.env` / Runtime NVIDIA adapter — **not** Production Bot `model.provider` |

### 2.1 marketing-manager

| Field | Value | Evidence |
|---|---|---|
| Profile name | `marketing-manager` | `~/.hermes/profiles/marketing-manager/` |
| Title | Marketing Manager | `profile.yaml` `ui_meta.hermes-bots.title` |
| Config path | `~/.hermes/profiles/marketing-manager/config.yaml` | — |
| Provider / model | `gemini` / `gemini-3.5-flash-lite` | `config.yaml` `model` |
| `base_url` | empty | CONFIRMED |
| `api_mode` | unset (native Gemini path) | CONFIRMED |
| `fallback_providers` | `openrouter`, `openai` | CONFIRMED |
| `fallback_model` | commented / unused | CONFIRMED |
| Streaming (inference) | `streaming.enabled: false` | CONFIRMED. `display.streaming: true` is UI only. |
| Telegram | **enabled: true** | Only Production Bot with Telegram on |
| Memory | `memory_enabled: true` | `MEMORY.md` present |
| Canonical Bot Chat pin | **Missing** `ui_meta.hermes-bots.chat` | CONFIRMED vs specialists. Desktop Bot Chat may still exist; **pin id UNKNOWN**. |
| MCP | `thealltour-marketing` enabled | Tools: `get_marketing_context`, `search_marketing_memory`, `build_content_brief`, `evaluate_governance`, `prepare_marketing_task`, `review_generated_content`, `get_performance_evidence`, `run_department_orchestration` |
| Skills | Bundled Hermes skills + `SOUL.md` role contract | CONFIRMED `skills/.bundled_manifest` |
| Routines/cron | One job, `--no-agent` | See §3 |
| Group | `thealltour marketing` | `profile.yaml` + `~/.hermes/profile.yaml` rooms |
| `message_agent` / `@mention` | **Possible and used in Group** | Group log shows Manager speaking and mentioning specialists (CONFIRMED). Tool availability in canonical Bot Chat is official v0.20.5 Bot Mode behavior (INFERRED from guide + `bot_mode_dm.py`; not re-probed this STEP). |

**Runtime-sensitive behavior (Manager):**

| Need | Verdict | Basis |
|---|---|---|
| Plain chat | **Yes** | Desktop / Telegram / Group |
| Tool calling | **Yes** | MCP include list + Group MCP prompts |
| Multiple sequential tool calls | **Yes** | Group log: `search_marketing_memory` then `get_marketing_context` in the same thread |
| Structured output | **UNKNOWN** | Main Bot path does not send `response_format` (C3). No live Manager `response_format` capture this STEP. |
| Tools + structured output | **UNKNOWN** | C3: main Bot loop does not normally combine them |
| Large context | **UNKNOWN** | Compression enabled; actual token sizes not measured |
| Streaming | **No (config)** | `streaming.enabled: false` |
| Provider-specific | **INFERRED likely** | Native Gemini today; C4 showed thoughtSignature matters once tools round-trip via Runtime Gemini adapter |

### 2.2 content-strategist

| Field | Value |
|---|---|
| Config | `~/.hermes/profiles/content-strategist/config.yaml` |
| Inference | Same as Manager: Gemini `gemini-3.5-flash-lite`, empty `base_url`, fallback `openrouter`+`openai` |
| Telegram | `enabled: false` |
| Canonical Bot Chat | `ui_meta.hermes-bots.chat: 20260825_133449_8b118f` **CONFIRMED** |
| Memory | enabled; no `MEMORY.md` file found (settings on, file absent) |
| MCP include | `get_marketing_context`, `search_marketing_memory`, `build_content_brief`, `evaluate_governance` |
| Cron | **None** (`jobs.json` absent) |
| Group | member of `thealltour marketing` |
| Structured output | **UNKNOWN** for Desktop; department/oneshot prompts may ask for draft shape (prompt-level, not `response_format`) |

Tool calling: **Yes**. Sequential tools: **Yes** (Group log). Streaming: **No (config)**.

### 2.3 governance-auditor

| Field | Value |
|---|---|
| Config | `~/.hermes/profiles/governance-auditor/config.yaml` |
| Inference | Same Gemini pin + Hermes fallbacks |
| Telegram | `enabled: false` |
| Canonical Bot Chat | `20260825_133439_def619` **CONFIRMED** |
| MCP include | `get_marketing_context`, `search_marketing_memory`, `evaluate_governance`, `review_generated_content` |
| Cron | **None** |
| Group | member |

Independent ALLOW/REVIEW/BLOCK inspector (SOUL / `profile.yaml` description). Does **not** publish. Tool calling **Yes**. Structured output **UNKNOWN** (governance MCP is deterministic TheAllTour; LLM review may return JSON-ish text — not proven as `response_format`).

### 2.4 performance-analyst

| Field | Value |
|---|---|
| Config | `~/.hermes/profiles/performance-analyst/config.yaml` |
| Inference | Same Gemini pin + Hermes fallbacks |
| Telegram | `enabled: false` |
| Canonical Bot Chat | `20260825_133423_f2c9b2` **CONFIRMED** |
| MCP include | `get_marketing_context`, `search_marketing_memory`, `get_performance_evidence` |
| Cron | One `--no-agent` job (NON_LLM body) |
| Group | member |

Group log shows a JSON-looking metrics reply (**CONFIRMED** text). That is **not** proof of OpenAI `response_format` (UNKNOWN). Tool calling **Yes**.

### 2.5 Non-production reference: `runtime-spike`

Already on the target inference shape (CONFIRMED `config.yaml`):

- `model.provider: custom`
- `default: theallcloud/auto`
- `base_url: http://127.0.0.1:3000/api/ai-runtime/v1`
- `api_mode: chat_completions`
- `fallback_providers: []`
- extra alias `theallcloud/auto-fallback-spike` in `providers.*.models`
- MCP spike server `thealltour-marketing-spike` (`get_performance_evidence` only)
- `agent.bot_mode_protocol: false`

This profile is the **cutover template**, not a Production Bot.

---

## 3. Invocation Topology

```mermaid
flowchart TB
  subgraph hermesOwn [Hermes owns]
    Desk[Desktop Bot Chat]
    Grp[Group Chat thealltour marketing]
    Tg[Telegram - Manager only]
    MA["message_agent / @mention"]
    CronHost[Hermes Cron host]
    Oneshot["hermes -p ... -z oneshot"]
  end

  subgraph theallOwn [TheAllTour owns]
    MCP[MCP thealltour-marketing]
    Dept[runDepartmentPipeline / orchestrate]
    Gov[Governance + Human Approval]
    Pub["PublicationAdapter - INACTIVE"]
  end

  subgraph runtimeOwn [AI Runtime owns - partial today]
    Gw["POST /api/ai-runtime/v1/chat/completions"]
    Router[Router / Quota / Fallback]
    CronRt["Marketing Cron Runtime path - flag"]
  end

  Desk --> NativeGemini[Native Gemini today]
  Grp --> NativeGemini
  Tg --> NativeGemini
  MA --> NativeGemini
  Oneshot --> NativeGemini
  Desk -.->|spike only| Gw
  Gw --> Router
  CronHost --> MMScript[daily-marketing-plan.sh]
  CronHost --> PAScript[daily-performance-brief.sh]
  MMScript -->|"intended: AI_RUNTIME_MARKETING_CRON_ENABLED"| CronRt
  PAScript --> NonLLM[NON_LLM TS brief]
  Dept --> Oneshot
  MCP --> Dept
  Dept --> Gov
  Gov --> Pub
```

### 3.1 Path inventory (all four Bots)

| Path | Used today? | Hits Production profile LLM? | Notes |
|---|---|---|---|
| 1. Desktop canonical Bot Chat | **Yes** (specialists pinned). Manager pin **UNKNOWN** | Yes | Native Gemini |
| 2. Group Chat | **Yes** | Yes (each speaker’s profile) | Room `thealltour marketing`; 4 members; `@mention` observed |
| 3. `@mention` | **Yes** in Group | Yes | Group log 2026-08-26 |
| 4. `message_agent` | **Possible**; live tool dump **UNKNOWN** this STEP | Yes if used | Official Bot Chat-only tool |
| 5. Hermes Routine/Cron | Manager 09:00, Analyst 08:30 | **No** (`no_agent: true`) | Script bodies; see below |
| 6. Shell/script | Cron wrappers | Indirect | Manager wrapper `cd /home/ysh/theallcloud` |
| 7. TheAllTour application | MCP + pipeline | Oneshot specialists | Not Gateway |
| 8. Legacy `hermes -p … -z` | **Yes** | **Yes** | `hermesHandoff.ts` / `hermesRuntime.ts` / tests |
| 9. Runtime direct invocation | Cron flag path + spike Gateway | Spike / cron specialists **not** via Bot Chat | Interactive Production Bots: **not** on Gateway |

### 3.2 Marketing Manager 09:00 cron — do not confuse with Bot cutover

| Field | CONFIRMED |
|---|---|
| Job | `AI Marketing - Daily Plan` (`edfc1815135b`) |
| Schedule | `0 9 * * *` Asia/Seoul implied by timestamps |
| `no_agent` | **true** |
| Script | `daily-marketing-plan.sh` |
| Intended Runtime path | `AI_RUNTIME_MARKETING_CRON_ENABLED` defaults to **`true`** in the wrapper |
| Observability flag | `AI_RUNTIME_SHARED_OBSERVABILITY_ENABLED` defaults **`true`** |
| Last run | 2026-08-28 09:00:32 **`last_status: error`** (pre-C6.2; path fixed 2026-08-28 ~15:13 KST) |
| Last error | `ERR_MODULE_NOT_FOUND` `/home/ysh/theallcloud/scripts/cron-daily-marketing-plan.ts` (historical) |
| Next run | 2026-08-29 09:00 |

**C6.2 repair (2026-08-28):** wrapper `cd` corrected to **thealltour**. Manual one-shot PASS (`inference_path: ai-runtime`). Scheduled `last_status` updates only on Hermes cron fire — not faked by manual run.

Interactive Bot cutover is **orthogonal**: even when 09:00 works, it is `--no-agent` + either Hermes oneshot **or** `RuntimeExecutor` inside TS — not Desktop Gateway.

### 3.3 Performance Analyst 08:30 cron

| Field | CONFIRMED |
|---|---|
| Job | `AI Marketing - Daily Performance` (`9e96a94ee72f`) |
| Schedule | `30 8 * * *` |
| `no_agent` | **true** |
| Script | `daily-performance-brief.sh` → `thealltour/scripts/cron-daily-performance-brief.ts` |
| LLM | **None** (NON_LLM) |
| Last run | 2026-08-28 08:30:17 **`last_status: ok`** |
| Next run | 2026-08-29 08:30 |

Canarying this Bot’s **inference** config does **not** change the 08:30 job body.

### 3.4 Agent Handoff / oneshot (DEFERRED migration)

Still `invokeHermesOneshot` → `hermes -p <profile> --yolo --ignore-rules -z`.  
**CONFIRMED** `HERMES_HANDOFF_CLASSIFICATION` remains application-level.  
**C5 must not** replace this with Runtime `executeAndWait`.

**Cutover coupling (INFERRED, important):** if a specialist profile’s `model.*` is pointed at the Gateway, **oneshot will also call the Gateway**, because `-z` uses that profile’s provider config. That is still Hermes-owned invocation, not a Runtime-direct Handoff rewrite.

---

## 4. Bot-by-Bot Runtime Compatibility Matrix

Scoring vs C1–C4.1 **spike** evidence. Production Bots themselves were **not** pointed at the Gateway in this STEP.

Scale: **PASS** · **PARTIAL** · **UNTESTED** · **BLOCKED** · **N/A**

Shared Gateway facts (CONFIRMED):

- Runtime does **not** execute MCP tools (C2).
- Hermes keeps tool loop / memory / Bot Chat.
- Spike: Hermes `fallback_providers: []` + Runtime `allowFallback: true` (C4.1).
- Production today: Hermes fallbacks **enabled** → dual-fallback **BLOCKED** until cleared per Bot.

| Capability | Manager | Content | Governance | Analyst | Spike evidence | Production gap |
|---|---|---|---|---|---|---|
| Plain inference | UNTESTED | UNTESTED | UNTESTED | UNTESTED | C1/C4 PASS | Profile still native Gemini |
| Context continuity | UNTESTED | UNTESTED | UNTESTED | UNTESTED | C4 PASS on spike Bot Chat | Hermes memory stays Hermes; Gateway does not store Bot memory (**PASS as design**) |
| Tool protocol | PARTIAL | PARTIAL | PARTIAL | PARTIAL | C2 PASS (wire) | Production MCP sets larger than spike |
| Actual MCP execution | UNTESTED | UNTESTED | UNTESTED | UNTESTED | C4 PASS `get_performance_evidence` | Manager `run_department_orchestration` **UNTESTED** on Gateway |
| Structured output | UNTESTED | UNTESTED | UNTESTED | UNTESTED | C3 gateway mapping PASS; Desktop Bot Chat **NOT_EXERCISED** | Aux `response_format` UNTESTED on Production |
| Streaming | N/A | N/A | N/A | N/A | C1 emulated SSE | Production `streaming.enabled: false` |
| Runtime provider fallback | UNTESTED | UNTESTED | UNTESTED | UNTESTED | C4.1 PASS (spike alias) | Requires `fallback_providers: []` + Gateway identity not spike-only |
| Observability | BLOCKED | BLOCKED | BLOCKED | BLOCKED | Headers + optional Postgres sink | `agentId` hardcoded `runtime-spike` |
| Security | PARTIAL | PARTIAL | PARTIAL | PARTIAL | Bearer 401 + private-net 403 | Token must be in canary `key_env`; not in Production yaml today |
| Rollback | PASS (design) | PASS | PASS | PASS | Restore profile `model` + `fallback_providers` | Not exercised on Production (by design) |

**Manager-specific:** `run_department_orchestration` during a Gateway-backed turn still runs inside Hermes MCP → TheAllTour TS → oneshot. That nested oneshot uses **target** profile inference. Canarying Manager without specialists still fans out to native Gemini specialists (INFERRED). Canarying specialists first is safer for isolating Gateway blast radius.

---

## 5. Failure / Risk Matrix

`PUBLICATION_FLOW_INACTIVE = true` **CONFIRMED** (`src/lib/marketing/social/publication/governanceBoundary.ts`). SNS adapter callers are denied. Cutover of inference **cannot** by itself enable SNS publish.

| Bot | Risk | Why |
|---|---|---|
| performance-analyst | **MEDIUM** | No Telegram; smallest MCP set; 08:30 cron NON_LLM. Still a Group member — Group turns for this handle would use Gateway after canary. Oneshot if department `performance` intent fires. |
| content-strategist | **MEDIUM** | Draft quality / fact invention risk; Group + oneshot from department/cron-if-Hermes-path. No Telegram. |
| governance-auditor | **HIGH** | Independent inspection; wrong routing/model could weaken ALLOW/REVIEW/BLOCK. Group + oneshot. |
| marketing-manager | **CRITICAL** | Telegram front door; Group orchestrator; full MCP including department orchestration; user-visible. 09:00 is `--no-agent` so cron host ≠ Bot LLM, but interactive failure is still high. |

Rollback difficulty: **LOW** if only `config.yaml` `model` / `fallback_providers` / `providers` stanzas change (copy/restore). **HIGH** if Gateway identity remains spike-hardcoded (bad metrics, hard to distinguish canary). History/memory/group membership are **not** in those stanzas.

Other Bots depending on a canary: Group `@mention` / `message_agent` **yes**. Cron 08:30 **no**. Cron 09:00 **no** for profile LLM (`no_agent`); specialist oneshot only if that job’s TS Hermes path runs (currently not reaching TS).

---

## 6. Recommended Canary Order

The prior hypothesis (Analyst → Strategist → Auditor → Manager) is **kept**, but **re-justified** from live inventory. It is **not** “low risk because Group is unused” — Group **is** used.

| Order | Bot | Canary suitability | Prerequisites | Blast radius | Observation window | Success criteria | Rollback trigger |
|---|---|---|---|---|---|---|---|
| 1 | performance-analyst | **Best** | C6 Gateway identity; profile backup; Next `:3000` up; `fallback_providers: []`; token via `key_env`; spikeForceFallback **off** | This Bot Chat + this handle’s Group/mention turns + performance oneshot | **24h** including one 08:30 cron (cron must stay ok / NON_LLM) | Plain + MCP `get_performance_evidence` Desktop; headers show real `agentId`; Fallback header coherent; no dual Hermes fallback | 5xx/401 Gateway; empty replies; Group analyst mute; oneshot timeouts |
| 2 | content-strategist | After Analyst green | Same + content alias → `content_draft` | Draft oneshot + Group content turns | **24–48h** | Draft still fact-bound; MCP brief tools; no publish | Hallucinated offers; tool-loop stall |
| 3 | governance-auditor | After content | Governance alias → `governance` | Review oneshot + Group | **24h** | ALLOW/REVIEW/BLOCK still via MCP `evaluate_governance` where used; LLM review coherent | Systematic ALLOW without evidence |
| 4 | marketing-manager | Last | All specialists stable **or** explicitly accepted mixed mode; Telegram probe window | Telegram + Group lead + department MCP | **48h** including one business day of Telegram | Orchestration MCP still TheAllTour; no SNS; Telegram session distinct from Bot Chat ([desktop-deployment.md](./desktop-deployment.md)) | Telegram silence; department fan-out failure |

**Do not canary Manager first.** Telegram + Group lead + largest tool set.

**Do not canary all four at once.** Profile-level switch is the isolation unit.

---

## 7. Cutover Mechanism (design only)

### 7.1 Target topology

```mermaid
flowchart LR
  Bot[Hermes Production Bot]
  Custom["custom OpenAI-compatible provider"]
  Gw["/api/ai-runtime/v1/chat/completions"]
  Alias[model alias]
  Rt[Runtime Router]
  Prov[Gemini / OpenRouter / NVIDIA]

  Bot --> Custom
  Custom --> Gw
  Gw --> Alias
  Alias --> Rt
  Rt --> Prov
```

Hermes profile keeps: identity, sessions, memory, MCP client, skills, cron **host**.  
Runtime keeps: eligibility, quota, provider/model fallback, usage.

### 7.2 What to put on Hermes vs Runtime

**Hermes (minimal per canary Bot):**

```yaml
model:
  provider: custom
  default: theallcloud/performance   # example Analyst alias
  base_url: http://127.0.0.1:3000/api/ai-runtime/v1
  api_mode: chat_completions
fallback_providers: []
providers:
  theallcloud-runtime:
    base_url: http://127.0.0.1:3000/api/ai-runtime/v1
    api_mode: chat_completions
    key_env: AI_RUNTIME_INFERENCE_GATEWAY_TOKEN
```

Do **not** paste gateway tokens into Production `config.yaml` (spike currently has an inline `api_key` — **do not copy that pattern**).

**Runtime (policy):**

| Concern | Recommendation |
|---|---|
| Shared vs Bot alias | **Bot-specific aliases.** A single `theallcloud/auto` maps to `manager_decision` today — wrong default for content (`content_draft`) and governance (`governance`). |
| `agentId` | **Must** become the Hermes profile id (`performance-analyst`, …), not `runtime-spike`. Prefer alias allowlist; optional later header if Hermes sends one **without a fork** (UNKNOWN if a supported header exists — do not patch Hermes). |
| `workloadClass` | From alias (existing `resolveWorkloadForAlias`) once Production aliases are added. |
| `requiresToolCalling` | **Yes — from `tools[]` presence** (already CONFIRMED in mapper). |
| Structured output | **Yes — from `response_format`** (already CONFIRMED). |
| `priority` | Today Gateway forces `high`. **GAP:** interactive vs cron-oneshot undistinguished. Cron 09:00 Runtime path uses its own factory (separate). For Bot Gateway, default `high` is acceptable for Desktop; oneshot-on-Gateway may need `normal` later (**not this STEP**). |
| Dual fallback | Hermes `fallback_providers` **must be `[]`** on canary. Runtime `allowFallback: true`. |

### 7.3 New operational dependency

Today Production Bots infer even if Next.js is down (native Gemini). After cutover, **Next `:3000` Gateway availability becomes a hard dependency** for that Bot’s LLM. Document SLO / Hermes service vs `next start` coupling before C7.

---

## 8. Feature Flag / Rollback Strategy

**Chosen mechanism:** Hermes-native **per-profile `config.yaml` backup/restore** of the `model` / `fallback_providers` / `providers` keys only.

| Option | Verdict |
|---|---|
| Profile config backup/restore | **Primary.** Minutes; no credential rotation; no memory/group loss |
| Model/provider alias switch | Same files; keep a commented native Gemini block or `*.c5bak` |
| Runtime-side routing flag | **Secondary.** Useful to refuse unknown aliases; cannot restore native Gemini by itself |
| Hermes source flag | **Forbidden** |

**Bot-only canary:** edit one profile home. Multiplex gateway reads per-profile config. Other Bots stay on Gemini.

**Rollback (target RTO minutes):**

1. Copy `config.yaml.c5bak` → `config.yaml` (native Gemini + original fallbacks).
2. Do **not** restart Desktop group membership.
3. Confirm next turn does not hit Gateway (no `X-AI-Runtime-*` / Hermes uses `provider: gemini`).
4. Leave Runtime code in place.

Spike already has `config.yaml.c4bak` as a precedent.

Runtime-side kill switch (optional later): reject non-spike aliases until C6 ships — **not implemented in C5**.

---

## 9. Security / Observability

### 9.1 CONFIRMED present

| Control | Status |
|---|---|
| Gateway bearer `AI_RUNTIME_INFERENCE_GATEWAY_TOKEN` | 401 mismatch / 503 if unset |
| Non-private `X-Forwarded-For` | 403 `forbidden_network`; empty header **allows** (rely on bind + bearer) |
| Safe response headers | Request-Id, Alias, Provider, Model, Fallback, Attempt-Count, Tool-Defs, Tool-Calls |
| Prompt/tool payload not in those headers | C1/C4 design |
| Shared Postgres telemetry | Flag `AI_RUNTIME_SHARED_OBSERVABILITY_ENABLED`; scalars only (see [runtime-observability.md](./runtime-observability.md)) |
| Publication blocked | `PUBLICATION_FLOW_INACTIVE` |
| MCP tools have no publish | skill matrix forbidden actions |

### 9.2 GAPs (record only — do not implement in C5)

| GAP | Impact |
|---|---|
| Gateway `agentId` hardcoded `runtime-spike` | Production canary would pollute spike metrics; `spikeForceFallback` keyed on that id |
| No profile identity on the wire from Hermes without alias convention | Need Production alias allowlist |
| `priority` always `high` | Cannot tell Desktop vs oneshot |
| `isPrivateClientAddress` allow-on-missing-header | Defense in depth weaker than bind-localhost |
| Spike `config.yaml` inline `api_key` | Bad template for Production |
| Manager Bot Chat pin missing | Harder to prove canonical session for Telegram vs Desktop |
| 09:00 cron `theallcloud` cwd | **REPAIRED (C6.2).** Manual one-shot PASS; next scheduled 09:00 confirms `last_status` |
| Latency / token usage in **HTTP headers** | In DB events when shared sink on; not all in Gateway headers |
| Error class in headers | Retryable header on failure path only |

---

## 10. Known Gaps

1. **BLOCKER — Gateway identity** (`agentId` / correlation prefix always spike).
2. **BLOCKER — dual Hermes+Runtime fallback** if Production `fallback_providers` left enabled.
3. **BLOCKER — workload alias** if all Bots send `theallcloud/auto`.
4. **Production MCP surface > spike** (`run_department_orchestration` untested through Gateway).
5. **Agent Handoff oneshot coupling** if specialists cut over (still Hermes `-z`, not Runtime-direct).
6. **Next.js process dependency** after cutover.
7. **09:00 cron entrypoint path** — **RESOLVED (C6.2)**; was theallcloud vs thealltour ops GAP
8. **Manager `chat` pin absent.**
9. **Structured output on Production Desktop** still UNTESTED (C3/C4).
10. **Streaming** N/A for this fleet (`enabled: false`).
11. Handoff → Runtime **direct** still **DEFERRED**.
12. MCP server ACL still prompt-level (pre-existing).

---

## 11. Go / No-Go Criteria

### 11.1 This STEP (C5)

| Criterion | Result |
|---|---|
| Production profiles unchanged | **GO** (audit only) |
| Groups / cron / credentials / `PUBLICATION_FLOW_INACTIVE` unchanged | **GO** |
| Documented inventory + plan | **GO** |
| Start Production canary now | **NO-GO** |

### 11.2 Before first Production canary (C7)

Must all be true:

1. Gateway maps `agentId` from a Production alias allowlist (not hardcoded spike).
2. `spikeForceFallback` cannot fire for Production aliases / ids.
3. Per-Bot aliases encode workload (`performance` / `content` / `governance` / `manager`).
4. Canary `fallback_providers: []`.
5. Gateway token via `key_env`, not committed yaml.
6. `config.yaml` backup file on disk.
7. Next.js Gateway health check documented and green.
8. Desktop Analyst MCP probe plan ready.
9. 08:30 cron still `--no-agent` / last_status observed.
10. Rollback owner assigned; RTO minutes.

---

## 12. Exact recommended next implementation step

**STEP 2-5.4C6 — Production-ready inference Gateway mapping (code, no Production profile edits)**

Implement in `src/ai-runtime/gateway` + tests:

1. Stop hardcoding `agentId: "runtime-spike"` for all requests.
2. Allowlist Production aliases (e.g. `theallcloud/performance`, `theallcloud/content`, `theallcloud/governance`, `theallcloud/manager`) plus existing spike aliases.
3. Derive `agentId` + `workload` from alias; keep spikeForceFallback **spike-only**.
4. Keep Hermes MCP/tool loop ownership; do not call Runtime from Handoff.
5. Tests only; no `~/.hermes/profiles/performance-analyst/config.yaml` writes.

**Then STEP 2-5.4C7:** Performance Analyst canary using the mechanism in §7–8.

---

## Appendix A — Current vs target (summary)

**Current (Production):** Hermes Bot → native Gemini (+ Hermes OpenRouter/OpenAI fallbacks) → MCP to TheAllTour. Runtime Gateway used only by `runtime-spike` (+ optional 09:00 TS Runtime path when that script actually runs).

**Target (per canary Bot):** Hermes Bot → custom base_url → Runtime Router (sole provider fallback) → providers. Hermes still executes tools/MCP/memory/Group/Telegram.

## Appendix B — Files read (no writes outside this document)

- `~/.hermes/profiles/{marketing-manager,content-strategist,governance-auditor,performance-analyst,runtime-spike}/config.yaml`
- matching `profile.yaml`, cron `jobs.json` / scripts
- `~/.hermes/profile.yaml` (group room)
- `src/ai-runtime/gateway/request-mapper.ts`, `auth.ts`, `src/app/api/ai-runtime/v1/chat/completions/route.ts`
- `src/lib/marketing/bot/organization/hermesRuntime.ts`, `hermesHandoff.ts`
- `src/lib/marketing/social/publication/governanceBoundary.ts`
- C0–C4.1 docs listed in the header
