# Runtime Inference Gateway — Production Aliases (STEP 2-5.4C6)

Hermes v0.20.5 custom OpenAI-compatible `base_url` → `POST /api/ai-runtime/v1/chat/completions`.

**Spike reference:** [runtime-inference-boundary-spike.md](./runtime-inference-boundary-spike.md)  
**Cutover audit:** [production-runtime-cutover-plan.md](./production-runtime-cutover-plan.md)

---

## 1. Alias registry

Hermes sends the OpenAI `model` field only. Gateway maps **allowlisted aliases** to Runtime identity.

| Alias | Kind | agentId | workload | priority | spikeForceFallback |
|---|---|---|---|---|---|
| `thealltour/performance-analyst` | production | `performance-analyst` | `analysis` | `normal` | no |
| `thealltour/content-strategist` | production | `content-strategist` | `content_draft` | `normal` | no |
| `thealltour/governance-auditor` | production | `governance-auditor` | `governance` | `normal` | no |
| `thealltour/marketing-manager` | production | `marketing-manager` | `manager_decision` | `high` | no |
| `theallcloud/auto` | spike | `runtime-spike` | `manager_decision` | `high` | no |
| `theallcloud/auto-fallback-spike` | spike | `runtime-spike` | `manager_decision` | `high` | **yes** (C4.1) |

**UNKNOWN** aliases (raw provider model names, typos) → `INVALID_REQUEST`.

Implementation: `src/ai-runtime/gateway/alias-registry.ts`

### Why Bot-specific aliases

C5 audit: a single `theallcloud/auto` maps every Bot to `manager_decision`. Production Bots need distinct `agentId` (observability) and workload routing (`analysis`, `content_draft`, `governance`, `manager_decision`).

Hermes does **not** send profile id on the wire — only `model`. Bot-specific aliases are the simplest stable mapping without Hermes patches.

---

## 2. Request derivation

| Field | Source |
|---|---|
| `agentId` | alias registry |
| `workload` | alias registry |
| `priority` | alias registry default |
| `requiresToolCalling` | `tools.length > 0` |
| `requiresStructuredOutput` | `response_format` present (C3 semantics preserved) |
| `spikeForceFallback` | registry `allowsSpikeForceFallback` only — **not** from user metadata |
| `correlationId` | `hermes-inference-boundary:<agentId>:<uuid>` |

Default `model` when omitted: `theallcloud/auto` (spike backward compatibility).

---

## 3. spikeForceFallback isolation

C4.1 controlled failure runs **only** when:

1. Alias is `theallcloud/auto-fallback-spike` (registry `allowsSpikeForceFallback: true`), and
2. Router sees `agentId === runtime-spike` **and** `metadata.spikeForceFallback === true`.

`AI_RUNTIME_SPIKE_FORCE_FALLBACK` env **does not** enable forced failure on production aliases or `theallcloud/auto`.

---

## 4. Fallback ownership

During Production canary, Hermes profile must have:

```yaml
fallback_providers: []
```

Runtime Router owns provider/model fallback (`allowFallback: true` on gateway requests).

Validator (read-only, no profile writes):

```ts
import { validateHermesRuntimeCutoverConfig } from "@/ai-runtime/gateway";
```

Checks: alias `thealltour/<profileId>`, `provider: custom`, gateway `base_url`, empty Hermes fallbacks, `key_env` for `AI_RUNTIME_INFERENCE_GATEWAY_TOKEN`.

---

## 5. Security

Unchanged from C4:

- Bearer `AI_RUNTIME_INFERENCE_GATEWAY_TOKEN`
- Private-network `X-Forwarded-For` guard
- No provider keys / prompts / tool payloads in responses or observability headers

---

## 6. Observability headers

Safe response headers (no secrets):

- `X-AI-Runtime-Request-Id`
- `X-AI-Runtime-Alias`
- `X-AI-Runtime-Agent-Id` *(C6)*
- `X-AI-Runtime-Workload` *(C6)*
- `X-AI-Runtime-Provider`
- `X-AI-Runtime-Model`
- `X-AI-Runtime-Fallback`
- `X-AI-Runtime-Attempt-Count`
- `X-AI-Runtime-Tool-Defs` / `X-AI-Runtime-Tool-Calls`

Shared Postgres telemetry (when enabled) uses `agentId` from the resolved Runtime request.

---

## 7. Regression / smoke

```bash
npx vitest run src/ai-runtime/__tests__/gateway-alias-registry.test.ts
npx vitest run src/ai-runtime/__tests__/hermes-inference-gateway.test.ts
npx vitest run src/ai-runtime/__tests__/router.test.ts

# Live (Next.js :3000 must be rebuilt/restarted for HTTP mode)
npx tsx scripts/c6-production-alias-gateway-smoke.ts

# In-process (validates C6 mapping without service restart)
npx tsx scripts/c6-production-alias-gateway-smoke.ts --local
```

C1–C4.1 spike aliases remain registered; `theallcloud/auto-fallback-spike` preserves C4.1.

---

## 8. Canary preflight (C7)

Before editing `~/.hermes/profiles/<id>/config.yaml`:

1. Run `validateHermesRuntimeCutoverConfig` against the planned yaml shape.
2. Backup `config.yaml` → `config.yaml.c6bak`.
3. Set `model.default` to `thealltour/<profile-id>`.
4. Confirm `fallback_providers: []`.
5. Smoke one Desktop turn + check `X-AI-Runtime-Agent-Id`.

Do **not** use `theallcloud/auto` for Production Bots.

---

## 9. C6.1 production deploy verification (2026-08-28)

**Host:** hermes-pi · **BUILD_ID:** `2fujBtd9wGTE-vPNAUG6j` (built 2026-08-28 ~14:55 KST)

### Build

| Item | Result |
|---|---|
| Command | `npm run build` |
| Outcome | **PASS** (after smoke-script TS fixes) |

### Service / listener

| Item | Result |
|---|---|
| Unit file | `thealltour-internal.service` → `next start -H 127.0.0.1 -p 3000` |
| systemd restore | **COMPLETE** (2026-08-28 ~15:02 KST) — PID **25907**, `active (running)`, `Ready in 2.5s` |
| Listener | `127.0.0.1:3000` → systemd-managed `next-server` (PID 25907) |
| Post-restore smoke | HTTP alias smoke **4/4 PASS**; unauthenticated → **401**; service remains active |

### HTTP alias smoke (4/4 PASS)

```bash
npx tsx scripts/c6-production-alias-gateway-smoke.ts
```

| Alias | agentId | workload | provider | fallback |
|---|---|---|---|---|
| `thealltour/performance-analyst` | `performance-analyst` | `analysis` | nvidia-main | no |
| `thealltour/content-strategist` | `content-strategist` | `content_draft` | gemini-main | no |
| `thealltour/governance-auditor` | `governance-auditor` | `governance` | gemini-main | no |
| `thealltour/marketing-manager` | `marketing-manager` | `manager_decision` | gemini-main | no |

All responses: `X-AI-Runtime-Agent-Id` / `Workload` correct; **no** `runtime-spike` attribution; no secret/prompt leakage in bodies or headers.

### Auth / negative

| Check | Result |
|---|---|
| Unauthenticated | 401 |
| Invalid bearer | 401 |
| Public `X-Forwarded-For: 8.8.8.8` | 403 |
| Valid bearer | 200, correct headers |
| Unknown alias (`openai/gpt-4o`) | 400 `invalid_request` |
| Production alias + `metadata.spikeForceFallback` | 200, no forced fallback (`X-AI-Runtime-Fallback: 0`) |
| `theallcloud/auto-fallback-spike` + spike metadata | 200, `runtime-spike`, fallback `1`, attempt `2` (C4.1 preserved) |

Script: `npx tsx scripts/c6-1-deploy-verification.ts`

### Shared observability (Postgres)

Recent smoke events (last 15m): production `agent_id` values only (`performance-analyst`, `content-strategist`, `governance-auditor`, `marketing-manager`); **0** rows with `agent_id = runtime-spike` for production-alias traffic. Fields present: provider, model, attempt_count, fallback_used, latency_ms, token counts, correlation_id.

### Regression

`vitest run` — gateway-alias-registry, hermes-inference-gateway, router, runtime-tool-protocol, runtime-structured-output, observability-persistence: **59/59 PASS**.

### Production safety (unchanged)

Hermes Production Bot `config.yaml` still `provider: gemini` (mtime 2026-08-27); no `thealltour/*` model aliases; group `thealltour marketing` unchanged; `PUBLICATION_FLOW_INACTIVE=true`; no C7 canary started.

**C6.1 verdict:** **COMPLETE / PRODUCTION GATEWAY READY** — C6 build deployed under systemd; HTTP alias smoke 4/4 PASS on PID 25907; Hermes Production profiles unchanged.
