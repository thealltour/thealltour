import { MemoryValidationError } from "@/lib/marketing/memory/errors";
import type { MemoryDocument, NormalizedMemoryDocument } from "@/lib/marketing/memory/types";
import { memoryFingerprint } from "@/lib/marketing/memory/memoryFingerprint";

const ZERO_WIDTH = /[\u200B-\u200D\uFEFF\u2060]/g;

/**
 * Light cleanup for embedding/dedupe. Does not lowercase (BGE-M3 / Korean)
 * and does not strip punctuation or rewrite Korean spacing.
 */
export function normalizeMemoryText(value: string | null | undefined): string {
  if (value == null) return "";
  return value
    .replace(/\r\n/g, "\n")
    .replace(/\r/g, "\n")
    .replace(ZERO_WIDTH, "")
    .replace(/[ \t]+/g, " ")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

export function buildEmbeddingText(title: string | null, content: string): string {
  return title ? `${title}\n\n${content}` : content;
}

export function parseScoreField(value: number | null | undefined, field: string): number | null {
  if (value == null) return null;
  if (!Number.isFinite(value) || value < 0 || value > 1) {
    throw new MemoryValidationError(`${field} must be between 0 and 1`);
  }
  return value;
}

export function parseExpiresAt(value: string | null | undefined, now: Date): string | null | "expired" {
  if (value == null || value.trim() === "") return null;
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) {
    throw new MemoryValidationError("expiresAt must be an ISO date");
  }
  if (parsed.getTime() <= now.getTime()) return "expired";
  return parsed.toISOString();
}

export function normalizeMemoryDocument(
  document: MemoryDocument,
  now: Date = new Date(),
): NormalizedMemoryDocument | { skip: "expired" } {
  const memoryType = document.memoryType.trim();
  if (!memoryType) {
    throw new MemoryValidationError("memoryType is required");
  }
  const content = normalizeMemoryText(document.content);
  if (!content) {
    throw new MemoryValidationError("content is required");
  }
  const title = normalizeMemoryText(document.title) || null;
  const sourceType = normalizeMemoryText(document.sourceType) || null;
  const sourceId = normalizeMemoryText(document.sourceId) || null;
  const expiresAt = parseExpiresAt(document.expiresAt, now);
  if (expiresAt === "expired") return { skip: "expired" };

  const normalized: Omit<NormalizedMemoryDocument, "fingerprint" | "embeddingText"> = {
    memoryType,
    title,
    content,
    sourceType,
    sourceId,
    importance: parseScoreField(document.importance, "importance"),
    confidence: parseScoreField(document.confidence, "confidence"),
    expiresAt,
  };
  return {
    ...normalized,
    fingerprint: memoryFingerprint(normalized),
    embeddingText: buildEmbeddingText(title, content),
  };
}

export function hasStableSource(document: {
  sourceType: string | null;
  sourceId: string | null;
}): boolean {
  return Boolean(document.sourceType && document.sourceId);
}
