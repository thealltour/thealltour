# Production Session Migration Runbook — Performance Analyst (C7.3)

> Migrate **persisted Desktop/TUI session model snapshots** onto Runtime Gateway after a profile-level cutover (C7).  
> Does **not** change profile `config.yaml`, other bots, Group membership, or start C8.

**Executed:** 2026-08-30 (~00:34–01:00 KST)  
**Profile:** `performance-analyst` only  
**Hermes:** v0.20.5+ (Desktop multiplex dashboard)

---

## 1. Why this STEP exists

Profile cutover updates `config.yaml`, but Desktop/TUI **resume restores the session row** (`model` / `billing_*` / `model_config`) via `_stored_session_runtime_overrides`. Existing Bot Chat and Group member sessions therefore stay on **native Gemini** until their snapshots are migrated.

CLI `-Q --resume` can appear Gateway-backed due to override ordering — **not** representative of Desktop.

---

## 2. Preconditions (HARD STOP if any fail)

| Check | Expected |
|---|---|
| Profile `model.provider` | `custom:thealltour-runtime` (or matching `providers:` key identity) |
| Profile `model.default` | `thealltour/performance-analyst` |
| Profile `model.base_url` | `http://127.0.0.1:3000/api/ai-runtime/v1` |
| `fallback_providers` | `[]` |
| Gateway `:3000` | Alias smoke HTTP 200 for PA alias |
| Other production bots | Still native Gemini |
| `PUBLICATION_FLOW_INACTIVE` | `true` |
| Backup | Fresh copy of `state.db` (+ wal/shm if present) under `profiles/performance-analyst/backups/` |

Do **not** delete/recreate the Production Group. Do **not** raw-SQL rewrite session rows as the primary path.

---

## 3. Inventory

List PA `state.db` sessions with Desktop relevance:

| Session id | Title | Notes |
|---|---|---|
| `20260825_133423_f2c9b2` | Bot Chat | Primary Desktop Bot Chat |
| `20260826_225600_a8ad31` | Group: thealltour marketing | PA member hidden session |

Record pre: `model`, `billing_provider`, `billing_base_url`, `model_config`, `message_count`.

---

## 4. Migrate (Hermes-native persist)

Use the same persistence as CLI `/model … --session` / `cli._persist_model_switch_to_session`:

1. Bind `HERMES_HOME` to the **profile** home (not multiplex root `~/.hermes`).
2. `switch_model(...)` with explicit provider + Gateway `base_url` resolution from profile `providers:`.
3. Persist with `SessionDB`:
   - `update_session_model(session_id, model, provider=…)`
   - `patch_session_model_config(session_id, { model, provider, base_url, api_mode, gateway_runtime })`
   - `update_session_billing_route(session_id, provider=…, base_url=…)`
4. Assert **`message_count` unchanged**.

Target shape (example):

- `model`: `thealltour/performance-analyst`
- `provider` / `billing_provider`: durable `custom:<providers-key>` matching profile
- `base_url`: `http://127.0.0.1:3000/api/ai-runtime/v1`
- `api_mode`: `chat_completions`

**Order:** Bot Chat first → live Desktop verify → only then Group member session.

---

## 5. Live agent rebuild (critical)

DB writes do **not** rebuild an already-warm Desktop agent.

| Approach | Result (observed C7.3) |
|---|---|
| External DB migrate only | Live agent keeps old `model_override` → still Gemini |
| Desktop client reconnect alone | May reuse same `ui_session` / cached agent |
| In-session `/model` (slash worker) | Worker succeeds under **profile** `HERMES_HOME`; live sync may fail under **multiplex root** `HERMES_HOME` (`Unknown provider 'custom:…'`) |
| **Restart `hermes.service` (dashboard)** then reopen session | Cold `_make_agent` + `_stored_session_runtime_overrides` → Gateway |

**Operational rule:** After session-row migrate, **restart the Desktop dashboard process** (system `hermes.service` on this host) before verification, or ensure the live session is fully reclaimed and rebuilt under the profile home.

Known multiplex caveat: dashboard process `HERMES_HOME=/home/ysh/.hermes` while slash workers inherit `profile_home`. Live `/model` sync that calls `load_config()` without a profile override cannot resolve PA’s `providers:` entry.

---

## 6. Verification (Desktop only)

### Bot Chat

1. Reopen the **same** session id after dashboard restart.
2. Send a short confirmation prompt.
3. PASS when multiplex `~/.hermes/logs/agent.log` shows:
   - `model=thealltour/performance-analyst`
   - `provider=custom` (not `gemini`)
   - `OpenAI client … base_url=http://127.0.0.1:3000/api/ai-runtime/v1`
   - **no** `gemini_native` for that turn
4. Observability: new correlation, `agent_id=performance-analyst`, `workload=analysis`, `fallback_used=false` on success (upstream `provider_id` may still be `gemini-main` — that is Runtime’s provider, not Hermes native).

### Group

1. Same rebuild discipline.
2. `@Performance Analyst` in Production Group.
3. Same log + observability checks on session `20260826_225600_a8ad31`.
4. MCP: `POST /api/internal/marketing/mcp` **200** during agent build / tool use is sufficient smoke (full tool-loop optional if turn is text-only).

**STOP:** If Bot Chat live Gateway fails, do **not** migrate Group; do **not** start C8.

---

## 7. Rollback (session only)

Restore `state.db` (+ wal/shm) from the C7.3 backup directory. Restart dashboard. Do **not** roll back profile Gateway cutover unless a separate C7 rollback is authorized.

---

## 8. C7.3 execution record (PASS)

| Item | Result |
|---|---|
| Backup | `~/.hermes/profiles/performance-analyst/backups/c73-20260830_003437/` |
| Bot Chat DB migrate | PASS — msg **18→18** at migrate; later verify **24** |
| Bot Chat live Gateway | **PASS** 2026-08-30 **00:54** KST (`ui_session=a7badd11` after dashboard restart) |
| Group DB migrate | PASS — msg **23** preserved |
| Group live Gateway | **PASS** 2026-08-30 **00:59** KST (`ui_session=3faf53a7`) |
| MCP smoke (Group build) | `…/marketing/mcp` **200** |
| Profile checksum | Unchanged `1c81c008…` |
| Other bots | Still Gemini |
| C8 | Not started |

---

## 9. Reuse for C8–C10

Repeat per bot: inventory that bot’s Bot Chat + Group member sessions → backup → Hermes-native persist → **dashboard restart** → Desktop verify → Group member migrate → **dashboard restart** → Group `@mention` verify.

**C7.3 history preserved above.** C8 profile canary (no session migrate during soak) → C8 FINAL → **C8.1** below.

---

## 10. C8.1 — Content Strategist session migration (PASS)

**Executed:** 2026-09-02 (~00:31–00:38 KST)  
**Profile:** `content-strategist` only (C8 profile Runtime cutover already validated)  
**Hermes:** v0.20.5+ (Desktop multiplex dashboard)

### Preconditions (PASS)

| Check | Result |
|---|---|
| C8 FINAL | PASS (~71h observation) |
| CS profile checksum | `3dc57fb2…` — Runtime Gateway |
| PA / GA / MM | PA Runtime; GA/MM Gemini (unchanged) |
| `PUBLICATION_FLOW_INACTIVE` | `true` |

### Backup

`~/.hermes/profiles/content-strategist/backups/c81-20260902_003106/`

- `config.yaml` SHA256 `3dc57fb2…`
- `state.db` SHA256 `367df674…`
- `session_snapshots.json` (Desktop + Group pre-migrate)
- Prior C8 backup `c8-20260830_011218/` **not overwritten**

### Migrate (Hermes-native)

Same as §4: `parse_model_switch_args` + `switch_model` + `SessionDB.update_session_model` / `patch_session_model_config` / `update_session_billing_route`. **No raw SQL.**

| Session id | Surface | Pre | Post migrate msgs |
|---|---|---|---|
| `20260825_133449_8b118f` | Desktop Bot Chat | Gemini | Runtime · **2→2** |
| `20260826_225441_d13218` | Group CS hidden | Gemini | Runtime · **32→32** |

**Order:** Desktop DB → restart → Desktop live → Group DB → restart → Group live.

### Cold rebuild

| Event | KST | Main PID |
|---|---|---|
| Post-Desktop migrate | ~00:31:28 | 174309 → **2114060** |
| Post-Group migrate | ~00:36:43 | 2114060 → **2116108** |

### Live verification (Desktop)

1. Reopened Bot Chat `20260825_133449_8b118f` (same session; no recreate).
2. User confirmation prompt → **PASS** ~00:34 KST (`ui_session=52efd5b4`).
3. Log: `provider=custom`, `base_url=http://127.0.0.1:3000/api/ai-runtime/v1`, **no** `gemini_native`.
4. Observability: `agent_id=content-strategist`, `workload=content_draft`, `fallback_used=false`, `runtime-spike=0`.
5. History: msg **2→4**; prior greeting/intro preserved.

### Live verification (Group)

1. `@Content Strategist` in Group `thealltour marketing` → **PASS** ~00:38 KST (`ui_session=a95949bf`).
2. Log: `model=thealltour/content-strategist`, `provider=custom`, Gateway `base_url`.
3. Observability: new correlation ~00:38 KST; same attribution; `runtime-spike=0`.
4. History: msg **32→34**; response referenced prior Threads draft context (Spain/Portugal package).

### MCP / tool regression

| Surface | Result |
|---|---|
| Desktop Bot Chat | **NOT EXERCISED** — verification turn text-only (`tool_turns=0`) |
| Group @mention | Group orchestration tools only; no isolated read-only `get_marketing_context` loop |

Agent build MCP HTTP 200 observed; full Desktop read-only marketing MCP loop deferred (no side-effect tool invoked).

### Regression / isolation

| Bot | Profile | Desktop / Group persisted |
|---|---|---|
| Performance Analyst | Runtime `1c81c008…` | Runtime (unchanged routing) |
| Content Strategist | Runtime `3dc57fb2…` | **Runtime** (migrated) |
| Governance Auditor | Gemini | Gemini |
| Marketing Manager | Gemini | Gemini |

Group `thealltour marketing`: **4 members** preserved; no delete/recreate.

### Rollback

Session-only restore from `c81-20260902_003106/` if needed. C8 profile cutover + PA sessions **do not** roll back unless independently broken.

**C8.1 PASS — Content Strategist Desktop Bot Chat and Group member sessions migrated to Runtime Gateway with live Desktop verification.**

---

## 11. C9.1 — Governance Auditor session migration (PASS)

**Executed:** 2026-09-02 (~00:54–00:58 KST)  
**Profile:** `governance-auditor` (C9 FINAL-ACCEL profile Runtime validated)  
**Hermes:** v0.20.5+ (Desktop multiplex dashboard)

### Preconditions (PASS)

| Check | Result |
|---|---|
| C9 FINAL-ACCEL | PASS (evidence-based bounded canary) |
| GA profile checksum | `0821cedc…` — Runtime Gateway |
| PA / CS | Runtime (unchanged) |
| MM | Gemini (unchanged) |
| `PUBLICATION_FLOW_INACTIVE` | `true` |

### Backup

`~/.hermes/profiles/governance-auditor/backups/c91-20260902_005418/`

- config SHA256 `0821cedc…` · state.db SHA256 `c9f392d3…`
- `session_snapshots.json` (Desktop + Group pre-migrate)
- Prior C9 backup `c9-20260902_004138/` **not overwritten**

### Migrate (Hermes-native)

| Session id | Surface | Pre | Post migrate msgs |
|---|---|---|---|
| `20260825_133439_def619` | Desktop Bot Chat | Gemini | Runtime · **2→2** at migrate |
| `20260826_225428_c13669` | Group GA hidden | Gemini | Runtime · **20→20** at migrate |

**Order:** Desktop DB → restart → Desktop live → Group DB → restart → Group live.

### Cold rebuild

| Event | KST | Main PID |
|---|---|---|
| Post-Desktop migrate | ~00:54:18 | 2116108 → **2124619** |
| Post-Group migrate | ~00:56:43 | 2124619 → **2125614** |

### Live verification (Desktop)

1. Reopened Bot Chat `20260825_133439_def619` (same session).
2. User confirmation prompt → **PASS** ~00:55 KST (`ui_session=ecb2d549`).
3. Log: `provider=custom`, Gateway `base_url`, **no** `gemini_native`.
4. Observability: **1** correlation / **1** logical turn · `governance-auditor` / `governance` · **provider_errors=0** · `runtime-spike=0`.
5. History: msg **2→4**; prior intro preserved.

### Live verification (Group)

1. `@Governance Auditor` in Group `thealltour marketing` → **PASS** ~00:57–00:58 KST (`ui_session=cd03fb07`).
2. Log: `model=thealltour/governance-auditor`, `provider=custom`, Gateway path.
3. Observability: **2** logical turns · **2** correlations (1:1) · **provider_errors=0**.
4. History: msg **20→24**; response referenced Spain/Portugal Threads **REVIEW** context.
5. Governance semantics: **REVIEW** decision on group turn (policy-consistent).

### MCP / structured-output

| Surface | Result |
|---|---|
| Desktop | **NOT EXERCISED** — verification turn text-only (`tool_turns=0`) |
| Group | Group orchestration `tool_turns=3`; explicit read-only `evaluate_governance` loop **NOT EXERCISED** |
| Structured-output | **NOT EXERCISED** (main Bot path) |

### Duplicate Runtime job artifact (C9.1 live turns)

| Turn | Logical turns | Correlations | fail-only sibling |
|---|---|---|---|
| Desktop live | 1 | 1 | **0** |
| Group live | 2 | 2 | **0** |

C9 FINAL-ACCEL duplicate-enqueue artifact **not observed** on C9.1 Desktop/Group live proofs. Technical debt entry retained for CLI `-z` bounded canary path.

### Regression / final mixed mode

| Bot | Profile | Group member session |
|---|---|---|
| PA | Runtime | Runtime |
| CS | Runtime | Runtime |
| GA | Runtime | **Runtime** |
| MM | Gemini | Gemini |

**C9.1 PASS — Governance Auditor Desktop Bot Chat and Group member sessions migrated to Runtime Gateway with live Desktop verification.**

---

## 12. C10.1 — Marketing Manager session migration (PASS)

**Executed:** 2026-09-02 (~01:09–01:14 KST)  
**Profile:** `marketing-manager` (C10 FINAL PASS profile Runtime validated)  
**Hermes:** v0.20.5+ (Desktop multiplex dashboard)

### Preconditions (PASS)

| Check | Result |
|---|---|
| C10 FINAL PASS | PASS (evidence-based bounded canary) |
| MM profile checksum | `75d1c8d10cdfe7f9…` — Runtime Gateway |
| PA / CS / GA | Runtime (unchanged) |
| `PUBLICATION_FLOW_INACTIVE` | `true` |

### Backup

`~/.hermes/profiles/marketing-manager/backups/c101-20260902_010902/`

- config SHA256 `75d1c8d10cdfe7f9…` · state.db + wal/shm · session inventory + pre-migrate snapshots
- Prior C10 backup `c10-20260902_010121/` **not overwritten**

### Migrate (Hermes-native)

| Session id | Surface | Pre | Post migrate msgs |
|---|---|---|---|
| `20260825_133452_2a2379` | Desktop Bot Chat | Gemini | Runtime · **2→2** at migrate |
| `20260826_225302_4c4028` | Group MM hidden | Gemini | Runtime · **30→30** at migrate |

**Order:** Desktop DB → restart → Desktop live → Group DB → restart → Group live.

### Cold rebuild

| Event | KST | Main PID |
|---|---|---|
| Post-Desktop migrate | ~01:09:33 | 2125614 → **2130555** |
| Post-Group migrate | ~01:12:44 | 2130555 → **2131477** |

Cold rebuild via SIGTERM → systemd `Restart=always` (sudo password unavailable on host).

### Live verification (Desktop)

1. Reopened Bot Chat `20260825_133452_2a2379` (same session).
2. User confirmation prompt → **PASS** ~01:10–01:11 KST (`ui_session=dac75169`).
3. Log: `provider=custom`, Gateway `base_url`, **no** `gemini_native`.
4. Observability: **7** correlations / **1** logical turn (7 API calls, tool loop) · completed-only **7** · fail-only sibling **0**.
5. History: mc **2→16** (tool loop messages); prior context preserved.

### Live verification (Group)

1. `@Marketing Manager` in Group `thealltour marketing` → **PASS** ~01:13–01:14 KST (`ui_session=240e628d`).
2. Log: `model=thealltour/marketing-manager`, `provider=custom`, Gateway path.
3. Observability: **2** logical turns · **2** correlations (1:1) · fail-only sibling **0**.
4. History: msg **30→34**; Group orchestration context preserved.

### Telegram

| Session | Classification | Action |
|---|---|---|
| `20260826_233207_2c4ece79` | **MIGRATE_REQUIRED** (active DM resume target) | **DEFERRED** — no production inbound/outbound in this STEP |
| Historical (`20260826_231354_928ee153` etc.) | skip | not migrated |

Telegram persistent session remains separately classified; not included in Desktop/Group completion claim.

### MCP / message_agent

| Surface | Result |
|---|---|
| Desktop live | MCP tools exercised (`search_marketing_memory`, `get_marketing_context`); Runtime → Hermes tool exec ✓ |
| message_agent fan-out | **NOT EXERCISED** |
| Manager semantic (explicit REVIEW case) | **NOT EXERCISED** on Desktop (org-status verification turn only) |

### Duplicate Runtime job artifact (C10.1 live)

| Turn | Correlations | fail-only sibling |
|---|---|---|
| Desktop live | 7 (tool loop) | **0** |
| Group live | 2 (2 turns) | **0** |

CLI/oneshot duplicate-enqueue debt **not observed** on live Desktop/Group proofs.

### Final production state (all 4 Bots)

| Bot | Profile | Desktop | Group |
|---|---|---|---|
| PA | Runtime | Runtime | Runtime |
| CS | Runtime | Runtime | Runtime |
| GA | Runtime | Runtime | Runtime |
| MM | Runtime | **Runtime** | **Runtime** |

**C10.1 PASS — Marketing Manager Desktop Bot Chat and Group member sessions migrated to Runtime Gateway with live Desktop verification.**

**C10 COMPLETE — Runtime Migration COMPLETE** (Telegram DM surface deferred separately).
