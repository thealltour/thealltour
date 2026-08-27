# Runtime Inference Boundary Spike — STEP 2-5.4C1

> **SPIKE ONLY.** No production Bot/profile provider changes. No Agent Handoff / Department / Group Chat / Human Approval / Cron production / SNS / Hermes fork.

**References:** Hermes Agent v0.20.5 (`03537d69`), official Bot Mode guide, [hermes-native-compatibility-audit.md](./hermes-native-compatibility-audit.md).

---

## 1. Hermes source findings

| Question | Answer (installed v0.20.5) |
|---|---|
| 1. Custom OpenAI-compatible `base_url`? | **Yes.** `model.provider: custom` + `model.base_url`, or named `providers:` / `custom_providers` entries (`hermes_cli/runtime_provider.py`, `hermes_cli/config.py`). |
| 2. localhost / LAN allowed? | **Yes.** Loopback explicitly trusted; LAN allowed when provider is `custom` / custom-resolving aliases (`_config_base_url_trustworthy_for_bare_custom`). |
| 3. Arbitrary model slug? | **Yes.** Custom endpoints accept caller model strings; catalog optional via `providers.*.models`. |
| 4. Expect `/v1/chat/completions`? | **Yes** for `api_mode: chat_completions`. OpenAI SDK appends `/chat/completions` to `base_url` (so base should end at `/v1`). |
| 5. Streaming required? | **No.** Preferred when stream consumers exist; non-stream and aggregated paths exist. Spike uses thin SSE emulation when `stream=true`. |
| 6. tool_calls format? | OpenAI-style `tools[]` / `tool_calls` on chat.completions for custom endpoints. |
| 7. `response_format`? | Used on some paths; not required for basic Bot turns. Spike flags but does not enforce structured output. |
| 8. Disable `fallback_providers`? | **Yes.** Set `fallback_providers: []` (empty list). |
| 9. Avoid dual fallback with Runtime? | **Yes** on spike profile: empty Hermes fallback + Runtime `allowFallback: true`. |
| 10. Retry boundary? | Hermes delivery/provider retry stays on Hermes side for Bot messaging; this spike path is **direct custom inference** — Runtime Router/Scheduler own provider retry/fallback. Do not stack Hermes `fallback_providers` on the same logical turn. |

Provider invoke site: Hermes agent loop → OpenAI-compatible client → `{base_url}/chat/completions`.

---

## 2. Compatibility decision

**`COMPATIBLE_WITH_THIN_PROXY`**

- Hermes can point a **non-production** profile at a custom `base_url` without patches (**DIRECT_COMPATIBLE** for transport).
- TheAllTour Runtime had **no** inbound OpenAI HTTP surface → thin facade required (**PROXY**).
- Full interactive Bot tool/MCP round-trip through Runtime adapters is **not** ready → gap, not a Hermes patch requirement.

Not `REQUIRES_HERMES_PATCH`. Not default-recommended for production Bots until tool protocol lands.

---

## 3. Gateway architecture

```text
Hermes Bot (runtime-spike)
  → model.base_url = http://127.0.0.1:3000/api/ai-runtime/v1
  → POST /chat/completions  (Bearer AI_RUNTIME_INFERENCE_GATEWAY_TOKEN)
  → src/app/api/ai-runtime/v1/chat/completions/route.ts
  → src/ai-runtime/gateway/*  (map → RuntimeExecutor.executeAndWait)
  → Router → Quota → Scheduler → Gemini / OpenRouter / NVIDIA
  → OpenAI JSON or thin SSE response
```

Code:

- `src/ai-runtime/gateway/{types,auth,request-mapper,response-mapper,error-mapper,openai-compat,index}.ts`
- Route: `src/app/api/ai-runtime/v1/chat/completions/route.ts`

Spike profile (outside repo): `~/.hermes/profiles/runtime-spike/`  
Production profiles **unchanged** (`provider: gemini`).

---

## 4. Request compatibility matrix

| OpenAI field | Spike support | Notes |
|---|---|---|
| `model` | Yes | Logical alias; min `theallcloud/auto` → workload `manager_decision` |
| `messages` system/user/assistant/tool | Yes | Content flattened to string; tool role kept |
| `temperature` | Ignored | Flagged unsupported (domain has no field) |
| `max_tokens` / `max_completion_tokens` | Partial | Mapped to `expectedOutputTokens` |
| `stream` | Emulated | Aggregated SSE after full Runtime completion |
| `tools` / `tool_choice` | Preserved (C2) | See `runtime-tool-protocol.md` |
| `response_format` | Hint only | Sets `requiresStructuredOutput`; adapters limited |

Observability (no prompts/secrets): headers `X-AI-Runtime-Request-Id|Alias|Provider|Model|Fallback|Tools-Dropped`; `correlationId` prefix `hermes-inference-boundary:`.

---

## 5. Tool calling compatibility

| Layer | Status |
|---|---|
| Hermes sends `tools[]` | Yes (agent loop) |
| Gateway preserves tools to Runtime | **Yes** (STEP 2-5.4C2) |
| Gemini/OpenRouter/NVIDIA adapters round-trip `tool_calls` | **No** (text completion only; capability flags are routing metadata) |
| Spike verdict | **COMPATIBILITY_GAP** — interactive Bot+MCP migration blocked until Domain+Adapter tool protocol |

Plain text Bot turns still succeed when tools are stripped (provider answers in text).

---

## 6. Streaming compatibility

| Mode | Behavior |
|---|---|
| `stream=false` | Full OpenAI `chat.completion` JSON |
| `stream=true` | Thin SSE: one content chunk + `[DONE]` after Runtime finishes |

True token streaming **not** implemented (out of scope). Sufficient for Hermes custom client in spike tests.

---

## 7. Error / retry ownership

| Concern | Owner on spike path |
|---|---|
| Gateway auth / misconfig | TheAllTour gateway |
| Provider rate/quota/server after Hermes call leaves | **Runtime Router** (+ Scheduler if job retry) |
| Hermes `fallback_providers` | **Disabled** on `runtime-spike` |
| Bot delivery / `message_agent` retry | N/A for oneshot/custom inference; remains Hermes for native Bot DM |

Error mapping: Runtime codes → OpenAI-ish HTTP (`401/429/400/502/503/504`) via `error-mapper.ts`.

---

## 8. Security boundary

- Bearer `AI_RUNTIME_INFERENCE_GATEWAY_TOKEN` required
- Private-network heuristic on `X-Forwarded-For` (defense in depth)
- Intended bind: localhost / LAN / Tailscale — **not** public Internet
- Provider credentials never returned to Hermes
- No raw secrets in logs/headers/body errors
- Spike token lives in `.env.local` + profile `.env` (mode 0600), not committed

---

## 9. E2E results

| Test | Result | Evidence |
|---|---|---|
| Plain inference (curl gateway) | **PASS** | `SPIKE_OK`; provider `gemini-main` / model `gemini-flash-lite-primary`; fallback `0` |
| Plain Hermes oneshot | **PASS** | `hermes -p runtime-spike -z` → `HERMES_SPIKE_OK` |
| Bot Chat context (2 turns) | **PASS** | Turn2 returned `ALPHA-27` on resumed `Bot Chat` session |
| Tool/MCP round-trip | **COMPATIBILITY_GAP** | Tools dropped; adapters lack tool protocol |
| Router fallback | **PASS (controlled)** | Unit test: `fallbackUsed=true`, 2 attempts, Hermes fallback not involved |

---

## 10. Gaps

1. Runtime Domain/Adapters: no `tools` / `tool_calls` preservation  
2. No true SSE token streaming  
3. `temperature` / full `response_format` enforcement  
4. In-process executor stack per HTTP request (no shared scheduler across Next isolates) — acceptable for spike  
5. Source tagged `system` (avoided domain enum change); correlationId carries `hermes-inference-boundary`

---

## 11. Production migration feasibility

| Path | Feasible now? |
|---|---|
| Batch / text-only specialist behind Hermes custom endpoint | **Yes** (spike proven) |
| Production Marketing Bots with Skills/MCP | **Not yet** — tool gap |
| Replace Agent Handoff with Runtime | **Do not** (C0) |
| Point production profiles at gateway | **Forbidden until** tool protocol + retry ownership signed off |

---

## 12. Recommended next STEP

**STEP 2-5.4C2 — Runtime Tool Protocol (Domain + Adapters)**  
Add request/response tool schemas and adapter round-trip for at least one provider; extend gateway to pass `tools` / `tool_calls`. Only then reconsider production Bot `base_url` pilots.

Until then: keep `runtime-spike` as the only Hermes profile on the gateway; leave STEP 2-5.4C Handoff Runtime Migration **unstarted**.

---

## Appendix — Spike profile sketch

```yaml
# ~/.hermes/profiles/runtime-spike/config.yaml (local only)
model:
  provider: custom
  default: theallcloud/auto
  base_url: http://127.0.0.1:3000/api/ai-runtime/v1
  api_mode: chat_completions
fallback_providers: []
```

```bash
# .env.local
AI_RUNTIME_INFERENCE_GATEWAY_TOKEN=<secret>
```

Audit date: 2026-08-27 — STEP 2-5.4C1


## Follow-up (C3)

Structured output: [`runtime-structured-output.md`](./runtime-structured-output.md).
