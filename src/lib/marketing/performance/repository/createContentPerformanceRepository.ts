import "server-only";

import { createInMemoryContentPerformanceRepository } from "@/lib/marketing/performance/repository/inMemoryContentPerformanceRepository";
import type { ContentPerformanceRepository } from "@/lib/marketing/performance/repository/contracts";

export type ContentPerformanceRepositoryBackend = "memory" | "supabase";

export async function createContentPerformanceRepository(
  options: { backend?: ContentPerformanceRepositoryBackend } = {},
): Promise<ContentPerformanceRepository> {
  const backend = options.backend ?? (process.env.NODE_ENV === "test" ? "memory" : "supabase");
  if (backend === "memory") return createInMemoryContentPerformanceRepository();
  const { createSupabaseContentPerformanceRepository } = await import(
    "@/lib/marketing/performance/repository/supabaseContentPerformanceRepository"
  );
  return createSupabaseContentPerformanceRepository();
}
