/**
 * Short-lived Gemini tool-call metadata bridge.
 *
 * OpenAI-compatible Hermes wire cannot carry thoughtSignature.
 * Runtime remembers providerData by tool_call id so Request #2
 * (assistant.tool_calls + role=tool) can still talk to Gemini.
 * This is transport state only — Runtime never executes tools.
 */

export type GeminiToolCallState = {
  thoughtSignature?: string;
  functionCall?: { name: string; args?: Record<string, unknown> };
  savedAtMs: number;
};

const DEFAULT_TTL_MS = 30 * 60 * 1000;
const store = new Map<string, GeminiToolCallState>();

function purgeExpired(now = Date.now(), ttlMs = DEFAULT_TTL_MS): void {
  for (const [id, entry] of store.entries()) {
    if (now - entry.savedAtMs > ttlMs) store.delete(id);
  }
}

export function rememberGeminiToolCallState(
  id: string,
  data: Omit<GeminiToolCallState, "savedAtMs">,
  now = Date.now(),
): void {
  const key = id.trim();
  if (!key) return;
  purgeExpired(now);
  store.set(key, { ...data, savedAtMs: now });
}

export function recallGeminiToolCallState(
  id: string | undefined,
  now = Date.now(),
): GeminiToolCallState | undefined {
  if (!id?.trim()) return undefined;
  purgeExpired(now);
  return store.get(id.trim());
}

/** Test helper — clears in-memory bridge state. */
export function clearGeminiToolCallStateForTests(): void {
  store.clear();
}

export function geminiToolCallStateSizeForTests(): number {
  return store.size;
}
