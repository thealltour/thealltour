# Runtime Structured Output Compatibility (STEP 2-5.4C3)

**Status:** COMPLETE (spike)  
**Date:** 2026-08-28  
**Prerequisite:** STEP 2-5.4C2 tool protocol  
**Deferred:** Agent Handoff Runtime Migration

## 1. Hermes wire behavior (v0.20.5 / `03537d6`)

Inspected installed Hermes Agent source under `~/.hermes/hermes-agent`.

### Main Bot chat path

`agent/chat_completion_helpers.py` → `build_api_kwargs()` builds OpenAI-compatible `messages` + `tools` for custom endpoints. It does **not** attach `response_format` by default for ordinary Bot turns.

### Where structured output is used

| Path | Shape | Notes |
|---|---|---|
| `agent/title_generator.py` | `extra_body.response_format = { type: "json_schema", json_schema: { name, strict, schema } }` | Session title; loose JSON fallback if provider rejects |
| `agent/plugin_llm.py` | `json_object` **or** `json_schema` (`name: plugin_structured_output`, `strict: false`) via `extra_body` | Client-side `jsonschema.validate` after reply |
| `agent/auxiliary_client.py` | Top-level `response_format` **or** `extra_body.response_format` | Anthropic translation; rejection detector + **one retry without** the field |

Supported OpenAI shapes Hermes emits:

- `{ type: "json_object" }`
- `{ type: "json_schema", json_schema: { name, description?, schema, strict? } }`

Hermes may retry without `response_format` when the provider returns 400/422 rejecting the field. Invalid JSON / schema mismatch is primarily handled by **Hermes/plugin parsers**, not by forcing Runtime to re-execute tools.

Main Bot loop does not normally combine `tools` + `response_format` in `build_api_kwargs`. Simultaneous use is treated as a Runtime/provider compatibility concern (see matrix).

Custom OpenAI-compatible `base_url` (Runtime Gateway): if Hermes/auxiliary passes `response_format`, it arrives as a normal chat.completions body field.

## 2. Runtime canonical model

`src/ai-runtime/domain/structured-output.ts`:

```ts
RuntimeResponseFormat =
  | { type: "json_object" }
  | { type: "json_schema"; name; description?; schema; strict? }
```

`RuntimeRequest.responseFormat?: RuntimeResponseFormat`

Alignment:

- `responseFormat` present → `routing.requiresStructuredOutput = true`
- `requiresStructuredOutput = true` alone (Marketing Cron) does **not** require a schema / does **not** force provider JSON mode

Zod: `runtimeResponseFormatSchema`. OpenAI SDK types are not canonical.

## 3. Gateway mapping

`mapOpenAiResponseFormatToRuntime`:

- Preserves `json_object` / `json_schema`
- Malformed / unknown `type` → `INVALID_REQUEST` (no silent drop)
- Removed from `unsupportedFields` (temperature remains flagged)

Observability (safe only): `requiresStructuredOutput`, `responseFormatType`, `schemaPresent` boolean — never full schema / payload.

## 4. Provider mapping

### Gemini

- `json_object` → `generationConfig.responseMimeType = application/json`
- `json_schema` → same + `responseSchema` (JSON Schema types uppercased)
- Unsupported keywords (explicit reject, no silent strip): `$ref`, `$schema`, `$defs`, `definitions`, `if/then/else`, `not`, `additionalProperties`, …
- **tools + response_format** → `INVALID_REQUEST` (not silently degraded)

### OpenRouter / NVIDIA (OpenAI-compatible)

- Preserve `response_format` on chat.completions body
- Active `openrouter/free`: `structuredOutput: false` (pool does not guarantee structured backends)
- Active `nvidia/nemotron-3-ultra-550b-a55b`: `structuredOutput: true` (live json_schema smoke PASS)

## 5. Provider matrix

| Provider | json_object | json_schema | tools | tools+schema | Live |
|---|---|---|---|---|---|
| Gemini | PASS | PASS (subset; `additionalProperties` rejected) | PASS (C2) | UNSUPPORTED | PASS |
| OpenRouter | PASS (adapter) | PASS (adapter) | N/A (`toolCalling:false`) | UNSUPPORTED | NOT_TESTED (capability false for free pool) |
| NVIDIA | PASS (adapter) | PASS | FAIL/UNSUPPORTED (C2) | UNSUPPORTED | PASS (json_schema smoke) |

## 6. tools + structured-output

| Case | Behavior |
|---|---|
| A tools no / SO yes | Supported on SO-capable models |
| B tools yes / SO no | C2 tool protocol |
| C tools yes / SO yes | Gemini: hard `INVALID_REQUEST`; others not claimed |

## 7. Error / fallback

- Malformed format / Gemini unsupported keyword / Gemini tools+SO → `INVALID_REQUEST` (non-retryable)
- Provider HTTP/schema reject after send → existing `PROVIDER_ERROR` path; Router may fallback only to other `structuredOutput:true` candidates when the failure is provider-side
- Do **not** fall back to `structuredOutput:false` models for SO requests
- Business JSON parse errors stay in Content Strategist / Governance parsers (Runtime does not own them)

## 8. Token Estimator

`estimateResponseFormatTokens` adds name/description/serialized schema (heuristic). Prevents under-reservation on large schemas.

## 9. E2E (runtime-spike)

Executor-stack / adapter smokes (`scripts/smoke-runtime-structured-output.ts`):

1. **json_object** — PASS (Gemini)
2. **json_schema** — PASS (Gemini subset schema; NVIDIA full OpenAI-style also PASS)
3. **tools + structured** — UNSUPPORTED on Gemini (explicit)

Desktop Hermes Bot Chat live: NOT_TESTED (main Bot rarely sends `response_format`; auxiliary/title/plugin paths are the primary consumers).

## 10. Production readiness

**PARTIAL**

Transport + Gemini/NVIDIA live SO work under spike constraints. Cron prompt/parser path unchanged. Not ready for production Bot cutover; Agent Handoff still deferred.

## 11. Remaining gaps

1. Hermes Desktop/auxiliary live against Next gateway  
2. OpenRouter paid/tool+SO capable model when available  
3. Broader Gemini JSON Schema dialect coverage vs OpenAI strict (`additionalProperties`, `$ref`, …)  
4. Multi-provider fallback policy when first candidate rejects unsupported dialect  
5. STEP structured-output + tools simultaneous support (if ever required)

## 12. Recommended next STEP

- Optional: Hermes auxiliary/title SO live via runtime-spike gateway  
- Keep **deferring** Agent Handoff Runtime Migration  
- Or production hardening of C1–C3 thin proxy (auth, multi-instance, Desktop E2E) before any Bot cutover
