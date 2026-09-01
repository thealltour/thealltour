import { createHash } from "node:crypto";

function normalizeToken(value: string): string {
  return value.trim().toLowerCase().replace(/\s+/g, " ");
}

function normalizeList(values: string[]): string[] {
  return [...new Set(values.map(normalizeToken).filter(Boolean))].sort();
}

/** Raw fingerprint from ingestion payload (pre-normalization). */
export function computeRawFingerprint(input: {
  sourceId: string;
  title: string;
  claim?: string | null;
  canonicalUrl?: string | null;
  externalId?: string | null;
}): string {
  const payload = [
    input.sourceId,
    normalizeToken(input.title),
    normalizeToken(input.claim ?? ""),
    normalizeToken(input.canonicalUrl ?? ""),
    normalizeToken(input.externalId ?? ""),
  ].join("|");
  return createHash("sha256").update(payload).digest("hex");
}

/** Normalized fingerprint for L2 deduplication. */
export function computeNormalizedFingerprint(input: {
  signalType: string;
  title: string;
  claim?: string | null;
  destinations: string[];
  geography: string[];
}): string {
  const payload = [
    input.signalType,
    normalizeToken(input.title),
    normalizeToken(input.claim ?? ""),
    normalizeList(input.destinations).join(","),
    normalizeList(input.geography).join(","),
  ].join("|");
  return createHash("sha256").update(payload).digest("hex");
}

export function normalizeStringList(values: string[]): string[] {
  return normalizeList(values);
}

export function normalizeTitle(title: string): string {
  return normalizeToken(title);
}
