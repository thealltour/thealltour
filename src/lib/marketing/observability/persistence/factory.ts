import { createObservabilitySupabaseClientFromEnv } from "@/ai-runtime/observability/persistence/supabase-client";
import { getRuntimeEnvBag } from "@/lib/runtimeEnvStore";
import {
  createNoopMarketingTraceRecorder,
  safeRecorder,
} from "@/lib/marketing/observability/recorderImpl";
import type { MarketingTraceRecorder } from "@/lib/marketing/observability/recorder";
import { createInMemoryMarketingTraceStore } from "@/lib/marketing/observability/persistence/inMemoryStore";
import {
  createPersistentMarketingTraceRecorder,
  type PersistentMarketingTraceRecorder,
} from "@/lib/marketing/observability/persistence/persistentRecorder";
import { createSupabaseMarketingTraceStore } from "@/lib/marketing/observability/persistence/supabaseStore";
import type { MarketingObsDbClient } from "@/lib/marketing/observability/persistence/store";
import { createMarketingTraceReadRepository } from "@/lib/marketing/observability/persistence/repository";

export const MARKETING_TRACE_ENABLED_ENV = "MARKETING_TRACE_ENABLED";

/**
 * true/1 → durable Supabase recorder.
 * false/0/unset → Noop (safe default; does not change business behavior).
 */
export function isMarketingTraceEnabled(
  env: Record<string, string | undefined> = getRuntimeEnvBag(),
): boolean {
  const raw = env[MARKETING_TRACE_ENABLED_ENV]?.trim().toLowerCase();
  return raw === "true" || raw === "1";
}

export type ResolveMarketingTraceRecorderOptions = {
  env?: Record<string, string | undefined>;
  client?: MarketingObsDbClient;
  onError?: (message: string) => void;
  /** Force a recorder (tests). */
  recorder?: MarketingTraceRecorder | null;
  /** Test-only: use in-memory durable store instead of Supabase. */
  useInMemoryStore?: boolean;
  awaitWrites?: boolean;
};

/**
 * Production selection: flag off / missing DB → Noop.
 * Always wrap with safeRecorder so persistence never fails marketing.
 */
export function resolveMarketingTraceRecorder(
  options: ResolveMarketingTraceRecorderOptions = {},
): MarketingTraceRecorder {
  if (options.recorder) return safeRecorder(options.recorder);

  const env = options.env ?? getRuntimeEnvBag();
  if (!isMarketingTraceEnabled(env)) {
    return createNoopMarketingTraceRecorder();
  }

  const onError =
    options.onError ?? ((message: string) => console.warn("[marketing-obs]", message));

  if (options.useInMemoryStore) {
    return safeRecorder(
      createPersistentMarketingTraceRecorder({
        store: createInMemoryMarketingTraceStore(),
        onError,
        awaitWrites: options.awaitWrites,
      }),
    );
  }

  const client =
    (options.client as MarketingObsDbClient | null | undefined) ??
    (createObservabilitySupabaseClientFromEnv(env) as unknown as MarketingObsDbClient | null);
  if (!client) {
    return createNoopMarketingTraceRecorder();
  }

  return safeRecorder(
    createPersistentMarketingTraceRecorder({
      store: createSupabaseMarketingTraceStore(client),
      onError,
      awaitWrites: options.awaitWrites,
    }),
  );
}

export async function resolveMarketingTraceRecorderAsync(
  options: ResolveMarketingTraceRecorderOptions = {},
): Promise<MarketingTraceRecorder> {
  if (options.recorder) return safeRecorder(options.recorder);
  const env = options.env ?? getRuntimeEnvBag();
  if (!isMarketingTraceEnabled(env)) {
    return createNoopMarketingTraceRecorder();
  }
  if (options.client || options.useInMemoryStore) {
    return resolveMarketingTraceRecorder(options);
  }
  const fromEnv = createObservabilitySupabaseClientFromEnv(env) as unknown as MarketingObsDbClient | null;
  if (fromEnv) {
    return resolveMarketingTraceRecorder({ ...options, client: fromEnv });
  }
  try {
    const mod = await import("@/lib/supabaseAdmin");
    return resolveMarketingTraceRecorder({
      ...options,
      client: mod.supabaseAdmin as unknown as MarketingObsDbClient,
    });
  } catch {
    return createNoopMarketingTraceRecorder();
  }
}

export function createTestDurableMarketingTraceStack(options?: {
  awaitWrites?: boolean;
  onError?: (message: string) => void;
}): {
  store: ReturnType<typeof createInMemoryMarketingTraceStore>;
  recorder: PersistentMarketingTraceRecorder;
  readRepo: ReturnType<typeof createMarketingTraceReadRepository>;
} {
  const store = createInMemoryMarketingTraceStore();
  const recorder = createPersistentMarketingTraceRecorder({
    store,
    awaitWrites: options?.awaitWrites ?? true,
    onError: options?.onError,
  });
  const readRepo = createMarketingTraceReadRepository(store);
  return { store, recorder, readRepo };
}
