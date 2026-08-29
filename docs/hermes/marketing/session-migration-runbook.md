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

Repeat per bot: inventory that bot’s Bot Chat + Group member sessions → backup → Hermes-native persist → **dashboard restart** → Desktop verify → then next profile cutover.
