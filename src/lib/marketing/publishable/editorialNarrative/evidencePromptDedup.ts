/**
 * Prompt-only evidence list dedupe — never mutates the source array.
 * Same normalized URL + excerpt → keep first evidenceId as representative.
 */

export type EvidenceRefForPromptDedup = {
  evidenceId: string;
  url?: string | null;
  excerpt?: string | null;
  /** CanonicalAssetEvidenceRef uses noteKo instead of excerpt. */
  noteKo?: string | null;
};

function normalizeUrl(url: string | null | undefined): string {
  return (url ?? "")
    .trim()
    .toLowerCase()
    .replace(/\/+$/, "")
    .replace(/^https?:\/\//, "");
}

function normalizeExcerpt(excerpt: string | null | undefined): string {
  return (excerpt ?? "")
    .replace(/\s+/g, " ")
    .trim()
    .toLowerCase();
}

function dedupeKey(ref: EvidenceRefForPromptDedup): string {
  const url = normalizeUrl(ref.url);
  const excerpt = normalizeExcerpt(ref.excerpt ?? ref.noteKo);
  // Without URL/excerpt identity, keep each evidenceId distinct.
  if (!url && !excerpt) return `id:${ref.evidenceId}`;
  return `${url}\0${excerpt}`;
}

/**
 * Deterministic dedupe for prompt evidence lists.
 * Returns a new array; does not mutate `refs`.
 */
export function dedupeEvidenceRefsForPrompt<T extends EvidenceRefForPromptDedup>(refs: T[]): T[] {
  const seen = new Set<string>();
  const out: T[] = [];
  for (const ref of refs) {
    if (!ref.evidenceId) continue;
    const key = dedupeKey(ref);
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(ref);
  }
  return out;
}
