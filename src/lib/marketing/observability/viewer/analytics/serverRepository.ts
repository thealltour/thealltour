import "server-only";

import { createObservabilitySupabaseClientFromEnv } from "@/ai-runtime/observability/persistence/supabase-client";
import type { MarketingObsDbClient } from "@/lib/marketing/observability/persistence/store";
import {
  createMarketingObsAnalyticsRepository,
  type MarketingObsAnalyticsRepository,
} from "@/lib/marketing/observability/viewer/analytics/repository";

export async function createServerMarketingObsAnalyticsRepository(): Promise<MarketingObsAnalyticsRepository | null> {
  const fromEnv = createObservabilitySupabaseClientFromEnv();
  if (fromEnv) {
    return createMarketingObsAnalyticsRepository(fromEnv as unknown as MarketingObsDbClient);
  }
  try {
    const mod = await import("@/lib/supabaseAdmin");
    return createMarketingObsAnalyticsRepository(
      mod.supabaseAdmin as unknown as MarketingObsDbClient,
    );
  } catch {
    return null;
  }
}
