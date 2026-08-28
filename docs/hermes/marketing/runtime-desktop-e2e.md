# Runtime Desktop E2E — STEP 2-5.4C4

> **SPIKE ONLY (**`runtime-spike`**).** Production four Bots unchanged. No Agent Handoff / Department / Group Chat / Cron production / SNS migration.

**References:** C1 [runtime-inference-boundary-spike.md](./runtime-inference-boundary-spike.md), C2 [runtime-tool-protocol.md](./runtime-tool-protocol.md), C3 [runtime-structured-output.md](./runtime-structured-output.md), Hermes Agent v0.20.5 Bot Mode guide.

---

## 1. Test environment


| Check                                                             | Result                                                                                                 |
| ----------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------ |
| Next Runtime Gateway (`POST /api/ai-runtime/v1/chat/completions`) | Running on `127.0.0.1:3000`; unauthenticated POST → **401**                                            |
| `runtime-spike` `base_url`                                        | `http://127.0.0.1:3000/api/ai-runtime/v1`                                                              |
| Hermes `fallback_providers`                                       | `[]` (disabled)                                                                                        |
| `AI_RUNTIME_INFERENCE_GATEWAY_TOKEN`                              | Configured in `.env.local`                                                                             |
| Provider credentials                                              | Present via runtime env bag / `.hermes/.env`                                                           |
| `PUBLICATION_FLOW_INACTIVE`                                       | `true`                                                                                                 |
| Production profiles                                               | **Unchanged** (`marketing-manager`, `content-strategist`, `governance-auditor`, `performance-analyst`) |


Spike-only MCP addition (read-only, C4):

- Server: `thealltour-marketing-spike` → `/api/internal/marketing/mcp`
- Tool allow-list: `get_performance_evidence` only
- Backup: `~/.hermes/profiles/runtime-spike/config.yaml.c4bak`

Automation: `scripts/c4-desktop-e2e.ts` (canonical Bot Chat via `hermes -p runtime-spike chat -c "C4 Desktop E2E"`).

---



## 2. Actual Desktop flow

```text
Hermes Desktop Bot Chat ("C4 Desktop E2E", profile runtime-spike)
  → OpenAI client POST {base_url}/chat/completions
  → Runtime Gateway (Bearer token, loopback-only)
  → request-mapper: agentId=runtime-spike, source=system, correlationId=hermes-inference-boundary:*
  → RuntimeExecutor → Router → Gemini (tool-capable when tools[])
  → OpenAI-compatible JSON back to Hermes
  → Hermes persists Bot Chat history locally
  → (tools path) Hermes executes MCP; Runtime never runs MCP/Skill tools
```

Legacy Hermes provider path is **not** used on `runtime-spike` (`provider: custom`, empty fallbacks).

---



## 3. E2E results (2026-08-28)


| Test                            | Result            | Notes                                                                       |
| ------------------------------- | ----------------- | --------------------------------------------------------------------------- |
| Plain Bot Chat                  | **PASS**          | Reply contained `C4_PLAIN_OK`                                               |
| Context persistence             | **PASS**          | Turn 2 recalled `ALPHA-27` in same Bot Chat                                 |
| Real MCP tool loop              | **PASS**          | `get_performance_evidence` + final answer with `SPIKE_MCP_OK`               |
| Gemini thoughtSignature         | **PASS**          | Indirect: full Hermes tool round-trip on Gemini succeeded                   |
| Multi tool                      | **NOT_EXERCISED** | Single read-only tool sufficient for probe                                  |
| Structured output (Desktop)     | **NOT_EXERCISED** | Main Bot Chat does not send `response_format`; C3 executor smoke sufficient |
| Runtime fallback (live Desktop) | **NOT_EXERCISED** | See §6                                                                      |
| Security                        | **PASS**          | Bad bearer → 401; good bearer → 200; no provider keys in body               |


Selected provider/model (tool probe headers):

- Provider: `gemini-main`
- Model: `gemini-flash-lite-primary`
- `X-AI-Runtime-Tool-Defs`: `1`
- `X-AI-Runtime-Fallback`: `0` (normal requests)

---



## 4. Tool loop trace (Test 3)

Expected hop sequence — **verified** on Desktop MCP run:

1. **Hermes** sends user turn + MCP tool definitions in OpenAI `tools[]`.
2. **Gateway** maps to Runtime request with `requiresToolCalling: true`, preserves definitions.
3. **Runtime Router** selects tool-capable Gemini (`gemini-flash-lite-primary`).
4. **Model** returns `tool_calls` (not executed by Runtime).
5. **Hermes** executes `get_performance_evidence` via MCP (read-only).
6. **Hermes** sends `role=tool` follow-up on OpenAI wire.
7. **Gateway / tool protocol mapper** restores Gemini `thoughtSignature` state (C2 bridge).
8. **Runtime** completes second inference; **Hermes** renders final assistant message in same Bot Chat.

Runtime did **not** execute MCP. No raw tool args/results or `thoughtSignature` in gateway response headers or Admin-facing logs from this probe.

---



## 5. Context persistence (Test 2)

- Same canonical channel: `-c "C4 Desktop E2E"`.
- Turn 1: store codeword `ALPHA-27`.
- Turn 2: model answered with `ALPHA-27`.
- **Hermes** owns conversational memory; Runtime is stateless per request (no cross-turn persistence in Runtime domain).

---



## 6. Router fallback

**Live Desktop (STEP 2-5.4C4.1): PASS**

Controlled failure method (no production credential damage):

- Spike-only OpenAI model alias: `theallcloud/auto-fallback-spike`
- Gateway sets `metadata.spikeForceFallback=true` only for `agentId=runtime-spike`
- Runtime Router fails the **first** candidate **before** adapter/credentials/inference (`detail=spike_force_fallback`)
- Second candidate (`gemini-flash-lite-secondary`) runs with real Gemini credentials
- Hermes profile `default` remains `theallcloud/auto`; Desktop E2E uses `hermes chat -m theallcloud/auto-fallback-spike`
- Optional env `AI_RUNTIME_SPIKE_FORCE_FALLBACK=1` exists but is **not** required for scoped Desktop E2E

Observed live headers:

| Field | Value |
|---|---|
| `X-AI-Runtime-Fallback` | `1` |
| `X-AI-Runtime-Attempt-Count` | `2` |
| `X-AI-Runtime-Provider` | `gemini-main` |
| `X-AI-Runtime-Model` | `gemini-flash-lite-secondary` |

Control (`theallcloud/auto`): `Fallback=0`, `Attempt-Count=1`, model `gemini-flash-lite-primary`.

Desktop Bot Chat `"C4.1 Fallback E2E"`: single assistant reply containing `C41_DESKTOP_FALLBACK_OK`.

Hermes `fallback_providers: []` unchanged.

Automation: `scripts/c4-1-desktop-fallback-e2e.ts`.

---



## 7. Tool-capability routing (Test 9)

With `requiresToolCalling: true` (gateway when `tools[]` present):

- **Includes:** `gemini-flash-lite-primary`, `gemini-flash-lite-secondary`
- **Excludes:** `openrouter-free`, `nvidia-nemotron-3-ultra`

Confirmed via registry unit tests and live gateway tool probe headers.

---



## 8. Retry ownership


| Concern                                                | Owner                                                        |
| ------------------------------------------------------ | ------------------------------------------------------------ |
| Provider/model fallback                                | **Runtime Router** (`allowFallback: true` on spike requests) |
| Hermes `fallback_providers`                            | **Disabled** (`[]`) — no stacked provider fallback           |
| MCP / Skill tool execution & native tool-loop recovery | **Hermes**                                                   |
| Logical defer/retry (quota/scheduling)                 | **Runtime Scheduler** (where applicable)                     |


No duplicate user-visible responses or stacked retry loops observed during C4 Desktop runs.

---



## 9. Observability

**Response headers (safe):** `X-AI-Runtime-Request-Id`, `X-AI-Runtime-Alias`, `X-AI-Runtime-Provider`, `X-AI-Runtime-Model`, `X-AI-Runtime-Fallback`, `X-AI-Runtime-Attempt-Count`, `X-AI-Runtime-Tool-Defs`, `X-AI-Runtime-Tool-Calls`.

**Persistence / shared telemetry fields:** `agentId=runtime-spike`, `source=system`, `correlationId` prefix `hermes-inference-boundary:`, `providerId`, `modelId`, `fallbackUsed`, `attemptCount`, `latencyMs`, token counts.

**Forbidden (stripped by design):** prompts, messages, tool arguments, tool results, full JSON schemas, `thoughtSignature`, bearer/provider secrets. `buildSafeMetadata()` allow-lists metadata keys only.

Admin Console must not surface raw MCP payloads from this path; C4 probe did not observe sensitive tool bodies in gateway JSON.

---



## 10. Security


| Check                         | Result                                                   |
| ----------------------------- | -------------------------------------------------------- |
| Missing/invalid bearer        | **401**                                                  |
| Public unauthenticated access | Blocked (auth + non-private `X-Forwarded-For` → **403**) |
| Provider keys in gateway body | **Not returned**                                         |
| Raw signatures in UI/logs     | **Not exposed**                                          |


---



## 11. Fixes applied (C4 / C4.1)

C4 Desktop tests: no Runtime code changes required; spike-only MCP for Test 3.

C4.1 controlled live fallback:

- Spike alias `theallcloud/auto-fallback-spike` + `metadata.spikeForceFallback`
- Router early-fail first candidate before inference (`spike_force_fallback`)
- Header `X-AI-Runtime-Attempt-Count`
- Spike catalog entry for the alias (profile-local; production profiles untouched)
- Scripts/tests: `scripts/c4-1-desktop-fallback-e2e.ts`, router/gateway unit coverage

---



## 12. Remaining gaps

1. **Multi-tool parallel IDs** — not naturally triggered by read-only `get_performance_evidence`; mock tests cover protocol.
2. **Structured output on Desktop auxiliary paths** — not exercised; C3 executor/gateway tests cover mapping.
3. **Production cutover** — defer until Handoff migration plan; spike validates thin proxy only.

Live Desktop Runtime fallback gap from C4 is **closed** by C4.1.

---



## 13. Production cutover recommendation

**PARTIAL readiness.**

- Plain chat, context, real MCP tool loop, and **controlled live Runtime fallback** on Desktop: **validated** (C4 / C4.1).
- Multi-tool parallel IDs and Desktop structured-output auxiliary paths: still not fully live-validated.
- Keep production Bots on native Hermes providers until Handoff migration is explicitly scheduled.

---



## 14. Regression commands (post-C4 / C4.1)

```bash
npx vitest run \
  src/ai-runtime/__tests__/runtime-structured-output.test.ts \
  src/ai-runtime/__tests__/runtime-tool-protocol.test.ts \
  src/ai-runtime/__tests__/runtime-tool-loop-mock.test.ts \
  src/ai-runtime/__tests__/hermes-inference-gateway.test.ts \
  src/ai-runtime/__tests__/router.test.ts \
  src/ai-runtime/__tests__/registry.test.ts \
  src/lib/marketing/cron/__tests__/marketingCronRuntime.test.ts

npx tsx scripts/c4-1-desktop-fallback-e2e.ts

npx eslint src/ai-runtime --max-warnings=0
```

Result (C4.1): **69/69** vitest passed; Desktop fallback E2E **PASS**.

Result: **66/66** vitest passed; ESLint clean on `src/ai-runtime`.