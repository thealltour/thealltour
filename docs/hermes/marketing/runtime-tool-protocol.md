# Runtime Tool Protocol Compatibility (STEP 2-5.4C2)

**Status:** COMPLETE (spike)  
**Date:** 2026-08-28  
**Prerequisite:** STEP 2-5.4C1 = `COMPATIBLE_WITH_THIN_PROXY`  
**Decision continuity:** Agent Handoff Runtime Migration remains **deferred**.

## 1. Hermes native tool protocol

Inspected: Hermes Agent **v0.20.5** (`03537d6`) under `~/.hermes/hermes-agent`.

Hermes owns the agent/tool loop (`agent/conversation_loop.py`). Against OpenAI-compatible custom endpoints it uses the standard chat.completions tool wire:

| Field | Wire shape | Notes |
|---|---|---|
| Request `tools[]` | `{ type: "function", function: { name, description?, parameters? } }` | MCP/Skill schemas projected as functions |
| Request `tool_choice` | `auto` / `none` / `required` / `{type:"function",function:{name}}` | |
| Assistant `tool_calls[]` | `{ id, type:"function", function:{ name, arguments:string } }` | Parallel multi-calls supported in loop |
| Tool result | `{ role:"tool", tool_call_id, content, name? }` | Hermes executes tools, then re-calls the API |
| Finish | `finish_reason: "tool_calls"` | Empty `tool_calls` is treated as recoverable anomaly |
| Malformed args | JSON retry / recovery tool results | Hermes-side; Runtime must not invent tool results |

**Ownership:** Hermes executes MCP/Skill tools. Runtime must only transport schemas and normalize provider responses.

## 2. Runtime canonical tool model

Provider-neutral domain (`src/ai-runtime/domain/tools.ts`):

- `RuntimeToolDefinition` — `type:"function"` + name/description/parameters
- `RuntimeToolChoice` — `auto` | `none` | `required` | specific function
- `RuntimeToolCall` — `id`, `type`, `function.{name,arguments}`, optional `providerData`
- `RuntimeMessage` — assistant `toolCalls?`; tool `toolCallId` + `content` (+ optional `name`)
- `RuntimeRequest.tools?` / `toolChoice?`
- `RuntimeResponse.toolCalls?` / `finishReason` includes `tool_call`

OpenAI SDK types are **not** canonical. Zod schemas extended in `domain/schemas.ts`.

`providerData` holds opaque adapter state (e.g. Gemini `thoughtSignature`). Never exposed in Admin Console / Runtime Console prompts.

## 3. Gateway mapping

`POST /api/ai-runtime/v1/chat/completions` (spike gateway):

- Preserves `tools[]`, `tool_choice`, assistant `tool_calls`, `role=tool` + `tool_call_id`
- Sets `routing.requiresToolCalling=true` when tools are present
- Maps responses to OpenAI `tool_calls` + `finish_reason: "tool_calls"`
- Observability headers/metrics only: `requiresToolCalling`, `toolDefinitionCount`, `toolCallCount`, provider/model, success/failure, latency
- Unsupported fields are **not** silently claimed supported: `response_format` / `temperature` remain compatibility flags (C3 candidate)

## 4. Provider mapping

### OpenRouter (OpenAI-compatible)

Runtime tools ↔ OpenAI `tools` / `tool_choice` / `tool_calls` / `role=tool`.  
Active free pool model remains `toolCalling: false` (not exaggerated).

### NVIDIA NIM

Protocol mapping mirrors OpenAI when enabled. Live smoke on active  
`nvidia/nemotron-3-ultra-550b-a55b` did **not** produce reliable tool calls (500 / no-tool text).  
Registry: `toolCalling: false` for Nemotron 3 Ultra. Deprecated Llama 3.3 entry may still declare toolCalling but is `enabled: false`.

### Gemini (`generateContent`)

| Runtime | Gemini |
|---|---|
| `tools[]` | `tools[].functionDeclarations` (JSON Schema types uppercased) |
| `toolChoice` | `toolConfig.functionCallingConfig` (`AUTO`/`ANY`/`NONE`) |
| assistant `toolCalls` | `model` parts `functionCall` (+ `thoughtSignature`) |
| `role=tool` | `user` parts `functionResponse` |

**Thought signature bridge:** Gemini 3.x requires `thoughtSignature` on functionCall replay. OpenAI/Hermes wire cannot carry it. Runtime keeps a short-lived in-memory map  
`tool_call_id → { thoughtSignature, functionCall }`  
(`adapters/gemini/tool-call-state.ts`). Transport only — not tool execution.

## 5. Registry capabilities

`requiresToolCalling=true` ⇒ Router/registry eligibility requires `capabilities.toolCalling === true`.

Current (active) picture:

| Model | toolCalling |
|---|---|
| Gemini Flash-Lite primary/secondary | `true` |
| OpenRouter free pool | `false` |
| NVIDIA Nemotron 3 Ultra | `false` |

## 6. Tool loop ownership

```
Request #1: Hermes → Gateway → Runtime → Provider → tool_calls → Hermes
Hermes executes MCP/Skill (Runtime does NOT)
Request #2: Hermes (messages + role=tool) → Gateway → Runtime → Provider → final text
```

Runtime does **not** implement an autonomous agent loop and does **not** act as MCP client/server.

## 7. Retry / fallback semantics

- Failure **before** tool_calls leave Runtime → Router fallback allowed.
- After tool_calls returned to Hermes → next turn is a **new** RuntimeRequest.
- Runtime does **not** re-execute tools and does **not** claim exactly-once tool side effects.

## 8. Provider compatibility matrix

| Provider | Text | Tool Request | Tool Result | Live |
|---|---|---|---|---|
| Gemini | PASS | PASS | PASS | PASS (executor-stack loop; thoughtSignature bridge) |
| OpenRouter | PASS | PASS (adapter) | PASS (adapter) | NOT_TESTED (active free model `toolCalling:false`) |
| NVIDIA (Nemotron 3 Ultra) | PASS | FAIL / UNSUPPORTED | UNSUPPORTED | FAIL (registry `toolCalling:false`) |

## 9. E2E result

Profile: **runtime-spike** only (production 4 Bots unchanged).

Executor-stack simulated Hermes loop (`scripts/smoke-runtime-tool-loop.ts`):

1. tools preserved + `requiresToolCalling`  
2. Router → Gemini tool-capable model  
3. Provider returns `tool_calls`  
4. Runtime does not execute tool (Hermes-simulated result)  
5. `providerData` stripped to simulate OpenAI wire; Gemini bridge recalls signature  
6. Final assistant content includes `SPIKE_TOOL_OK`  
7. Status: **PASS**

Desktop Hermes Bot Chat + real MCP live session: **NOT_TESTED** in this step (profile ready; Next gateway must be up). Protocol path is covered by the executor-stack E2E above.

## 10. Remaining gaps

1. Hermes Desktop/MCP live Bot Chat E2E against running Next gateway  
2. OpenRouter live tool-capable paid/pool model (when eligible)  
3. NVIDIA tool-capable active model (none today)  
4. `response_format` / structured output end-to-end → **STEP 2-5.4C3** candidate  
5. Thought-signature store is process-local (multi-instance needs shared TTL store)  
6. Production Bot `base_url` cutover still out of scope

## 11. Production readiness

**PARTIAL**

Tool protocol transport is implemented and Gemini live loop works under spike constraints. Not production-ready for Bot cutover until Desktop/MCP E2E, multi-instance signature bridge policy, and structured-output decisions are settled. Agent Handoff migration remains deferred.

## 12. Recommended next STEP

1. **STEP 2-5.4C3 — Structured Output Compatibility** — see [`runtime-structured-output.md`](./runtime-structured-output.md)  
2. Optional: Hermes Desktop `runtime-spike` + read-only MCP live E2E  
3. Continue to **defer** STEP 2-5.4C Agent Handoff Runtime Migration

## Token estimation

Token estimator includes tool name/description/JSON schema, tool-call arguments, and tool result content (heuristic; prevents large under-reservation).

## Security / observability

Allowed: requiresToolCalling, toolDefinitionCount, toolCallCount, provider/model, success/failure, latency.  
Forbidden in default console: raw tool args/results, full schemas, prompts, secrets.
