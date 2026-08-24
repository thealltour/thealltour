import "server-only";

import { asString } from "@/lib/marketing/context/json";
import { AI_MEMORY_LOOKUP_COLUMNS, AI_MEMORY_TABLE } from "@/lib/marketing/memory/constants";
import { MemoryIngestionError } from "@/lib/marketing/memory/errors";
import type { ExistingMemoryRow, MemoryInsertRow, MemoryStore, MemoryUpdateRow } from "@/lib/marketing/memory/types";

function mapExisting(row: Record<string, unknown> | null): ExistingMemoryRow | null {
  if (!row) return null;
  const id = asString(row.id);
  const memoryType = asString(row.memory_type);
  const content = asString(row.content);
  if (!id || !memoryType || !content) return null;
  return {
    id,
    memoryType,
    title: asString(row.title),
    content,
    sourceType: asString(row.source_type),
    sourceId: asString(row.source_id),
  };
}

export function createSupabaseMemoryStore(): MemoryStore {
  return {
    async findBySource(input) {
      const { supabaseAdmin } = await import("@/lib/supabaseAdmin");
      const { data, error } = await supabaseAdmin
        .from(AI_MEMORY_TABLE)
        .select(AI_MEMORY_LOOKUP_COLUMNS)
        .eq("memory_type", input.memoryType)
        .eq("source_type", input.sourceType)
        .eq("source_id", input.sourceId)
        .limit(1)
        .maybeSingle();
      if (error) throw new MemoryIngestionError(error.message);
      return mapExisting((data as Record<string, unknown> | null) ?? null);
    },
    async findSourcelessDuplicate(input) {
      const { supabaseAdmin } = await import("@/lib/supabaseAdmin");
      const { data, error } = await supabaseAdmin
        .from(AI_MEMORY_TABLE)
        .select(AI_MEMORY_LOOKUP_COLUMNS)
        .eq("memory_type", input.memoryType)
        .is("source_type", null)
        .is("source_id", null)
        .eq("content", input.content)
        .limit(1)
        .maybeSingle();
      if (error) throw new MemoryIngestionError(error.message);
      return mapExisting((data as Record<string, unknown> | null) ?? null);
    },
    async insert(row: MemoryInsertRow) {
      const { supabaseAdmin } = await import("@/lib/supabaseAdmin");
      const { data, error } = await supabaseAdmin.from(AI_MEMORY_TABLE).insert(row).select("id").single();
      if (error) throw new MemoryIngestionError(error.message);
      const id = asString((data as { id?: unknown } | null)?.id);
      if (!id) throw new MemoryIngestionError("ai_memory insert did not return id");
      return { id };
    },
    async update(id: string, row: MemoryUpdateRow) {
      const { supabaseAdmin } = await import("@/lib/supabaseAdmin");
      const { error } = await supabaseAdmin.from(AI_MEMORY_TABLE).update(row).eq("id", id);
      if (error) throw new MemoryIngestionError(error.message);
    },
  };
}
