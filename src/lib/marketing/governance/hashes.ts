import { createHash } from "node:crypto";
import { stripHtmlToMemoryText } from "@/lib/marketing/memory/contentMemoryContent";
import { buildEmbeddingText } from "@/lib/marketing/memory/normalization";

/** Visible text for exact hashing. Reuses content-memory HTML strip + whitespace normalize. */
export function canonicalGovernanceText(value: string | null | undefined): string {
  return stripHtmlToMemoryText(value);
}

/**
 * Punctuation/whitespace-only normalize. No synonym, stemming, or meaning rewrite.
 */
export function normalizedGovernanceText(value: string | null | undefined): string {
  return canonicalGovernanceText(value)
    .toLowerCase()
    .replace(/[\p{P}\p{S}]+/gu, " ")
    .replace(/\s+/g, " ")
    .trim();
}

export function governanceContentHash(title: string | null, body: string): string {
  return createHash("sha256")
    .update(JSON.stringify({ title: canonicalGovernanceText(title), body: canonicalGovernanceText(body) }))
    .digest("hex");
}

export function governanceNormalizedHash(title: string | null, body: string): string {
  return createHash("sha256")
    .update(JSON.stringify({ title: normalizedGovernanceText(title), body: normalizedGovernanceText(body) }))
    .digest("hex");
}

export function governanceEmbeddingQuery(title: string | null, body: string): string {
  const cleanedTitle = canonicalGovernanceText(title) || null;
  const cleanedBody = canonicalGovernanceText(body);
  return buildEmbeddingText(cleanedTitle, cleanedBody);
}
