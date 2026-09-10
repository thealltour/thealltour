import "server-only";

import { createObservabilitySupabaseClientFromEnv } from "@/ai-runtime/observability/persistence/supabase-client";
import { createMarketingTraceReadRepository } from "@/lib/marketing/observability/persistence/repository";
import { createSupabaseMarketingTraceStore } from "@/lib/marketing/observability/persistence/supabaseStore";
import type { MarketingObsDbClient } from "@/lib/marketing/observability/persistence/store";
import type { MarketingTraceReadRepository } from "@/lib/marketing/observability/persistence/repository";

/**
 * Server-only read repository for admin APIs.
 * Uses service-role client; never expose to the browser.
 */
export async function createServerMarketingTraceReadRepository(): Promise<MarketingTraceReadRepository | null> {
  const fromEnv = createObservabilitySupabaseClientFromEnv();
  if (fromEnv) {
    return createMarketingTraceReadRepository(
      createSupabaseMarketingTraceStore(fromEnv as unknown as MarketingObsDbClient),
    );
  }
  try {
    const mod = await import("@/lib/supabaseAdmin");
    return createMarketingTraceReadRepository(
      createSupabaseMarketingTraceStore(mod.supabaseAdmin as unknown as MarketingObsDbClient),
    );
  } catch {
    return null;
  }
}
