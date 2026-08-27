import { AI_RUNTIME_SHARED_OBSERVABILITY_ENABLED_ENV } from "@/ai-runtime/integration/constants";
import { createNoopRuntimeObservabilitySink } from "@/ai-runtime/observability/persistence/noop-sink";
import { createPostgresRuntimeObservabilitySink } from "@/ai-runtime/observability/persistence/postgres-sink";
import {
  createRuntimeObservabilityRecorder,
  type RuntimeObservabilityRecorder,
} from "@/ai-runtime/observability/persistence/recorder";
import type { RuntimeObservabilitySink } from "@/ai-runtime/observability/persistence/sink";
import type { ObservabilityDbClient } from "@/ai-runtime/observability/persistence/types";

export { AI_RUNTIME_SHARED_OBSERVABILITY_ENABLED_ENV };

export function isAiRuntimeSharedObservabilityEnabled(
  env: Record<string, string | undefined> = process.env,
): boolean {
  const raw = env[AI_RUNTIME_SHARED_OBSERVABILITY_ENABLED_ENV]?.trim().toLowerCase();
  return raw === "true" || raw === "1";
}

export type CreateRuntimeObservabilitySinkOptions = {
  env?: Record<string, string | undefined>;
  client?: ObservabilityDbClient;
  onError?: (message: string) => void;
  /** Force a sink (tests). */
  sink?: RuntimeObservabilitySink;
};

/**
 * Flag off or missing DB → Noop. Inference must keep working.
 */
export function createRuntimeObservabilitySink(
  options: CreateRuntimeObservabilitySinkOptions = {},
): RuntimeObservabilitySink {
  if (options.sink) return options.sink;

  const env = options.env ?? process.env;
  if (!isAiRuntimeSharedObservabilityEnabled(env)) {
    return createNoopRuntimeObservabilitySink();
  }

  if (options.client) {
    return createPostgresRuntimeObservabilitySink({
      client: options.client,
      onError: options.onError,
    });
  }

  return createNoopRuntimeObservabilitySink();
}

/**
 * Async factory that can load supabaseAdmin when flag is on.
 * Safe for Cron (tsx) and Next.js server — never throws.
 */
export async function resolveRuntimeObservabilitySink(
  options: CreateRuntimeObservabilitySinkOptions = {},
): Promise<RuntimeObservabilitySink> {
  if (options.sink) return options.sink;

  const env = options.env ?? process.env;
  if (!isAiRuntimeSharedObservabilityEnabled(env)) {
    return createNoopRuntimeObservabilitySink();
  }

  if (options.client) {
    return createPostgresRuntimeObservabilitySink({
      client: options.client,
      onError: options.onError,
    });
  }

  try {
    const mod = await import("@/lib/supabaseAdmin");
    const client = mod.supabaseAdmin as unknown as ObservabilityDbClient;
    return createPostgresRuntimeObservabilitySink({
      client,
      onError: options.onError ?? ((message) => console.warn("[ai-runtime-obs]", message)),
    });
  } catch {
    return createNoopRuntimeObservabilitySink();
  }
}

let defaultRecorder: RuntimeObservabilityRecorder | null = null;

export function createDefaultRuntimeObservabilityRecorder(
  options: CreateRuntimeObservabilitySinkOptions = {},
): RuntimeObservabilityRecorder {
  return createRuntimeObservabilityRecorder(createRuntimeObservabilitySink(options));
}

export function getDefaultRuntimeObservabilityRecorder(): RuntimeObservabilityRecorder {
  if (!defaultRecorder) {
    defaultRecorder = createDefaultRuntimeObservabilityRecorder();
  }
  return defaultRecorder;
}

export function setDefaultRuntimeObservabilityRecorder(
  recorder: RuntimeObservabilityRecorder | null,
): void {
  defaultRecorder = recorder;
}

export function resetDefaultRuntimeObservabilityRecorderForTests(): void {
  defaultRecorder = null;
}

/** Cron/Next startup: resolve Postgres sink when flag enabled. */
export async function ensureSharedObservabilityRecorder(
  options: CreateRuntimeObservabilitySinkOptions = {},
): Promise<RuntimeObservabilityRecorder> {
  const sink = await resolveRuntimeObservabilitySink(options);
  const recorder = createRuntimeObservabilityRecorder(sink);
  defaultRecorder = recorder;
  return recorder;
}
