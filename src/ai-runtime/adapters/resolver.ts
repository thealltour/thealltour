import { RuntimeError } from "@/ai-runtime/domain/error";
import { AI_PROVIDER_IDS } from "@/ai-runtime/registry/providers";
import type { ProviderAdapter } from "@/ai-runtime/adapters/types";
import { createGeminiAdapter } from "@/ai-runtime/adapters/gemini/adapter";
import { createOpenRouterAdapter } from "@/ai-runtime/adapters/openrouter/adapter";
import { createNvidiaAdapter } from "@/ai-runtime/adapters/nvidia/adapter";

/**
 * providerId → Adapter lookup only (not a Model Router).
 * Groq has no adapter while disabled.
 */
export function createDefaultProviderAdapters(): Map<string, ProviderAdapter> {
  const adapters = [
    createGeminiAdapter(),
    createOpenRouterAdapter(),
    createNvidiaAdapter(),
  ];
  return new Map(adapters.map((adapter) => [adapter.providerId, adapter]));
}

let defaultAdapters: Map<string, ProviderAdapter> | null = null;

export function getProviderAdapter(providerId: string): ProviderAdapter {
  if (!defaultAdapters) {
    defaultAdapters = createDefaultProviderAdapters();
  }
  const adapter = defaultAdapters.get(providerId);
  if (!adapter) {
    if (providerId === AI_PROVIDER_IDS.GROQ_MAIN) {
      throw new RuntimeError(
        "PROVIDER_ERROR",
        "Groq adapter is not available (provider disabled)",
        false,
      );
    }
    throw new RuntimeError(
      "INVALID_REQUEST",
      `No provider adapter registered for "${providerId}"`,
      false,
    );
  }
  return adapter;
}

/** Provider IDs with a registered adapter implementation (not a Model Router). */
export function listRegisteredAdapterProviderIds(): readonly string[] {
  return [...createDefaultProviderAdapters().keys()];
}

/** Test helper */
export function resetProviderAdapterCacheForTests(): void {
  defaultAdapters = null;
}
