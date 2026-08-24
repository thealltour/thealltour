import { asNumber, asString } from "@/lib/marketing/context/json";
import type { MemoryContext } from "@/lib/marketing/context/types";

export type AiMemoryRow = {
  id?: unknown;
  memory_type?: unknown;
  title?: unknown;
  content?: unknown;
  source_type?: unknown;
  source_id?: unknown;
  importance?: unknown;
  confidence?: unknown;
  embedding_model?: unknown;
  created_at?: unknown;
  updated_at?: unknown;
  expires_at?: unknown;
};

export function mapAiMemoryRow(row: AiMemoryRow): MemoryContext | null {
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
    importance: asNumber(row.importance),
    confidence: asNumber(row.confidence),
    embeddingModel: asString(row.embedding_model),
    createdAt: asString(row.created_at),
    updatedAt: asString(row.updated_at),
    expiresAt: asString(row.expires_at),
  };
}
