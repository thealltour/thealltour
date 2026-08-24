import { supabaseAdmin } from "@/lib/supabaseAdmin";
import type { AiMemoryRow } from "@/lib/marketing/context/mappers/memoryContextMapper";

export async function fetchAiMemoryRows(input: {
  memoryType?: string;
  sourceType?: string;
  sourceId?: string;
  minImportance?: number;
  minConfidence?: number;
  excludeExpired?: boolean;
  limit?: number;
}): Promise<AiMemoryRow[]> {
  let query = supabaseAdmin
    .from("ai_memory")
    .select(
      "id, memory_type, title, content, source_type, source_id, importance, confidence, embedding_model, created_at, updated_at, expires_at",
    )
    .order("importance", { ascending: false, nullsFirst: false })
    .order("confidence", { ascending: false, nullsFirst: false })
    .order("updated_at", { ascending: false, nullsFirst: false })
    .limit(input.limit ?? 50);

  if (input.memoryType) query = query.eq("memory_type", input.memoryType);
  if (input.sourceType) query = query.eq("source_type", input.sourceType);
  if (input.sourceId) query = query.eq("source_id", input.sourceId);
  if (input.minImportance != null) query = query.gte("importance", input.minImportance);
  if (input.minConfidence != null) query = query.gte("confidence", input.minConfidence);
  if (input.excludeExpired) {
    query = query.or(`expires_at.is.null,expires_at.gt.${new Date().toISOString()}`);
  }

  const { data, error } = await query;
  if (error) {
    throw new Error(`ai_memory lookup failed: ${error.message}`);
  }
  return (data as AiMemoryRow[] | null) ?? [];
}
