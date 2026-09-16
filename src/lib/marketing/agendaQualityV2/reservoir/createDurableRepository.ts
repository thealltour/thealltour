import {
  createInMemoryDurableAgendaReservoir,
  type DurableAgendaReservoirRepository,
} from "@/lib/marketing/agendaQualityV2/reservoir/types";
import { createJsonFileAgendaReservoir } from "@/lib/marketing/agendaQualityV2/reservoir/jsonFileRepository";

export function isAgendaReservoirSupabaseConfigured(
  env: NodeJS.ProcessEnv | Record<string, string | undefined> = process.env,
): boolean {
  return Boolean(env.NEXT_PUBLIC_SUPABASE_URL?.trim() && env.SUPABASE_SERVICE_ROLE_KEY?.trim());
}

/**
 * Prefer memory for tests; JSON file for local shadow; Supabase when configured + requested.
 */
export async function createDurableAgendaReservoirRepository(deps: {
  backend?: "memory" | "json" | "supabase";
  jsonFilePath?: string;
  env?: NodeJS.ProcessEnv | Record<string, string | undefined>;
} = {}): Promise<DurableAgendaReservoirRepository> {
  const env = deps.env ?? process.env;
  if (deps.backend === "memory") {
    return createInMemoryDurableAgendaReservoir();
  }
  if (deps.backend === "json" || (!deps.backend && deps.jsonFilePath)) {
    return createJsonFileAgendaReservoir({
      filePath:
        deps.jsonFilePath ??
        `${process.cwd()}/data/marketing/agenda-quality-v2/reservoir.json`,
    });
  }
  if (deps.backend === "supabase" || (deps.backend !== "json" && isAgendaReservoirSupabaseConfigured(env))) {
    const { SupabaseAgendaReservoirRepository } = await import(
      "@/lib/marketing/agendaQualityV2/reservoir/supabaseRepository"
    );
    const { supabaseAdmin } = await import("@/lib/supabaseAdmin");
    return new SupabaseAgendaReservoirRepository(supabaseAdmin);
  }
  return createInMemoryDurableAgendaReservoir();
}
