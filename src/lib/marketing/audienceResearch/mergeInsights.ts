import type {
  AcrbResearchFinding,
  AcrbTypedInsight,
  ResearchFindingType,
} from "@/lib/marketing/audienceResearch/contracts";
import { lexicalOverlapRatio } from "@/lib/marketing/audienceResearch/gatherInputs";

const FINDING_TYPE_RANK: Record<ResearchFindingType, number> = {
  hypothesis: 1,
  inference: 2,
  observed_signal: 3,
  verified_fact: 4,
};

function normalizeKey(text: string): string {
  return text
    .toLowerCase()
    .replace(/[^\p{L}\p{N}\s]/gu, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function isEmptyInsightList(value: unknown): boolean {
  if (value == null) return true;
  if (!Array.isArray(value)) return true;
  if (value.length === 0) return true;
  return value.every((item) => {
    if (!item || typeof item !== "object") return true;
    const text = (item as { text?: unknown }).text;
    return typeof text !== "string" || !text.trim();
  });
}

/** Prefer longer / more specific text when choosing between near-duplicates. */
export function preferMoreSpecificText(a: string, b: string): string {
  const left = a.trim();
  const right = b.trim();
  if (!left) return right;
  if (!right) return left;
  if (left.length !== right.length) return left.length >= right.length ? left : right;
  const leftTokens = new Set(normalizeKey(left).split(" ").filter(Boolean));
  const rightTokens = new Set(normalizeKey(right).split(" ").filter(Boolean));
  return leftTokens.size >= rightTokens.size ? left : right;
}

export function mergeTypedInsightLists(
  upstream: AcrbTypedInsight[],
  llm: AcrbTypedInsight[] | null | undefined,
  options?: { max?: number },
): AcrbTypedInsight[] {
  const max = options?.max ?? 12;
  if (isEmptyInsightList(llm)) return upstream.slice(0, max);

  const merged: AcrbTypedInsight[] = [];
  const push = (item: AcrbTypedInsight) => {
    const text = item.text.trim();
    if (!text) return;
    const key = normalizeKey(text);
    const existingIdx = merged.findIndex((row) => {
      const other = normalizeKey(row.text);
      if (other === key) return true;
      if (other.includes(key) || key.includes(other)) {
        const shorter = Math.min(other.length, key.length);
        const longer = Math.max(other.length, key.length);
        if (shorter >= 6 && shorter / longer >= 0.55) return true;
      }
      return lexicalOverlapRatio(row.text, text) >= 0.72;
    });
    if (existingIdx < 0) {
      merged.push({
        ...item,
        text,
        confidence: Math.max(0, Math.min(1, item.confidence)),
        evidenceRefs: [...new Set(item.evidenceRefs.filter(Boolean))],
      });
      return;
    }
    const existing = merged[existingIdx]!;
    const preferredText = preferMoreSpecificText(existing.text, text);
    // Keep the stronger type already present; never let a weaker LLM overwrite.
    const type =
      FINDING_TYPE_RANK[item.type] > FINDING_TYPE_RANK[existing.type]
        ? item.type
        : existing.type;
    merged[existingIdx] = {
      text: preferredText,
      type,
      confidence: Math.max(existing.confidence, item.confidence),
      evidenceRefs: [...new Set([...existing.evidenceRefs, ...item.evidenceRefs].filter(Boolean))],
    };
  };

  // LLM first for strategic precedence when non-empty, then fill gaps from upstream.
  for (const item of llm ?? []) push(item);
  for (const item of upstream) push(item);
  return merged.slice(0, max);
}

/**
 * Merge findings without promoting weaker upstream types to verified_fact via LLM.
 * Empty LLM findings → keep upstream.
 */
export function mergeResearchFindings(
  upstream: AcrbResearchFinding[],
  llm: AcrbResearchFinding[] | null | undefined,
): AcrbResearchFinding[] {
  if (!llm || llm.length === 0) return upstream;

  const byId = new Map<string, AcrbResearchFinding>();
  for (const item of upstream) byId.set(item.findingId, item);

  for (const item of llm) {
    const existing = byId.get(item.findingId);
    if (!existing) {
      byId.set(item.findingId, item);
      continue;
    }
    // LLM cannot upgrade type above upstream for the same findingId.
    const safeType =
      FINDING_TYPE_RANK[item.type] > FINDING_TYPE_RANK[existing.type]
        ? existing.type
        : item.type;
    byId.set(item.findingId, {
      ...existing,
      ...item,
      type: safeType,
      text: preferMoreSpecificText(existing.text, item.text),
      confidence: Math.max(existing.confidence, item.confidence),
      evidenceRefs: [...new Set([...existing.evidenceRefs, ...item.evidenceRefs])],
      sourceClass: item.sourceClass ?? existing.sourceClass,
      provenanceNote: item.provenanceNote ?? existing.provenanceNote,
    });
  }

  const out: AcrbResearchFinding[] = [];
  const seen = new Set<string>();
  for (const item of upstream) {
    const merged = byId.get(item.findingId);
    if (merged) {
      out.push(merged);
      seen.add(item.findingId);
    }
  }
  for (const item of llm) {
    if (seen.has(item.findingId)) continue;
    out.push(item);
    seen.add(item.findingId);
  }
  return out;
}

export function hasUsefulAcrbCore(input: {
  primary: AcrbTypedInsight[];
  motivations: AcrbTypedInsight[];
  decisionTriggers: AcrbTypedInsight[];
  questions: AcrbTypedInsight[];
  contentGaps: AcrbTypedInsight[];
  angles: unknown[];
}): boolean {
  return (
    input.primary.length > 0 &&
    (input.motivations.length > 0 || input.decisionTriggers.length > 0) &&
    input.questions.length > 0 &&
    input.contentGaps.length > 0 &&
    input.angles.length >= 3
  );
}
