import { hasStableSource } from "@/lib/marketing/memory/normalization";
import { memoryFingerprint } from "@/lib/marketing/memory/memoryFingerprint";
import type { DedupeDecision, ExistingMemoryRow, NormalizedMemoryDocument } from "@/lib/marketing/memory/types";

function existingFingerprint(row: ExistingMemoryRow): string {
  return memoryFingerprint({
    memoryType: row.memoryType,
    sourceType: row.sourceType,
    sourceId: row.sourceId,
    title: row.title,
    content: row.content,
  });
}

/**
 * Deterministic v1 dedupe. Semantic similarity is not used.
 * Stable upsert only when both sourceType and sourceId are present.
 * Sourceless rows are never updated — identical content is skipped, else inserted.
 */
export function decideMemoryWrite(
  document: NormalizedMemoryDocument,
  existing: ExistingMemoryRow | null,
): DedupeDecision {
  if (hasStableSource(document)) {
    if (!existing) return { action: "insert" };
    if (existingFingerprint(existing) === document.fingerprint) {
      return { action: "skip", reason: "unchanged", existingId: existing.id };
    }
    return { action: "update", existingId: existing.id };
  }
  if (existing) return { action: "skip", reason: "duplicate", existingId: existing.id };
  return { action: "insert" };
}
