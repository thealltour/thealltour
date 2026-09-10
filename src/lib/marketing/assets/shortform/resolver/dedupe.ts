import type { ShortformSourceCandidate } from "@/lib/marketing/assets/shortform/resolver/contracts";

function providerIdentityKey(provider: string | null, providerAssetId: string | null): string | null {
  if (!provider || !providerAssetId) return null;
  return `p:${provider}:${providerAssetId}`;
}

/**
 * Prefer catalog identity, then provider identity, then sha256.
 * When duplicates collide, keep the higher-ranked (already sorted) and prefer internal_catalog.
 */
export function dedupeSourceCandidates(candidates: ShortformSourceCandidate[]): ShortformSourceCandidate[] {
  const seen = new Map<string, ShortformSourceCandidate>();
  const order: string[] = [];

  for (const candidate of candidates) {
    const keys: string[] = [];
    if (candidate.catalogSourceId) keys.push(`c:${candidate.catalogSourceId}`);
    const providerKey = providerIdentityKey(candidate.provider, candidate.providerAssetId);
    if (providerKey) keys.push(providerKey);
    if (candidate.sha256) keys.push(`h:${candidate.sha256}`);
    if (keys.length === 0) keys.push(`k:${candidate.candidateKey}`);

    const existingKey = keys.find((key) => seen.has(key));
    if (!existingKey) {
      for (const key of keys) seen.set(key, candidate);
      order.push(keys[0]!);
      continue;
    }

    const existing = seen.get(existingKey)!;
    const preferIncoming =
      (candidate.origin === "internal_catalog" && existing.origin !== "internal_catalog") ||
      (candidate.catalogSourceId && !existing.catalogSourceId) ||
      candidate.score > existing.score;

    if (preferIncoming) {
      for (const [key, value] of seen.entries()) {
        if (value === existing) seen.set(key, candidate);
      }
      for (const key of keys) seen.set(key, candidate);
    }
  }

  const unique: ShortformSourceCandidate[] = [];
  const emitted = new Set<ShortformSourceCandidate>();
  for (const key of order) {
    const row = seen.get(key);
    if (!row || emitted.has(row)) continue;
    emitted.add(row);
    unique.push(row);
  }
  return unique;
}

export function candidateKeyForHit(input: {
  origin: string;
  catalogSourceId: string | null;
  provider: string | null;
  providerAssetId: string | null;
}): string {
  if (input.catalogSourceId) return `catalog:${input.catalogSourceId}`;
  if (input.provider && input.providerAssetId) {
    return `${input.origin}:${input.provider}:${input.providerAssetId}`;
  }
  return `${input.origin}:anon`;
}
