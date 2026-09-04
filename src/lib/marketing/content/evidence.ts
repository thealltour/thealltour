import type { CompactManagerEvidenceRef } from "@/lib/marketing/research/manager/types";
import type { AssignmentEvidenceRef, AssignmentFact } from "@/lib/marketing/content/types";
import { truncateBotText } from "@/lib/marketing/bot/sanitize";

const EXCERPT_MAX = 280;

export function mapManagerEvidenceRef(
  ref: CompactManagerEvidenceRef,
  credibilityHint?: number | null,
): AssignmentEvidenceRef {
  return {
    evidenceId: ref.evidenceId,
    sourceId: ref.sourceId,
    sourceType: ref.sourceType,
    sourceName: ref.sourceName,
    isOfficial: ref.isOfficial,
    evidenceType: ref.evidenceType,
    url: ref.url,
    reference: ref.reference,
    excerpt: truncateBotText(ref.excerpt, EXCERPT_MAX),
    publishedAt: ref.publishedAt,
    observedAt: ref.observedAt,
    credibilityHint: credibilityHint ?? null,
  };
}

/** Collapse surrounding/internal whitespace for exact statement identity. */
export function normalizeFactStatement(statement: string): string {
  return statement.trim().replace(/\s+/g, " ");
}

function confidenceRank(confidence: AssignmentFact["confidence"]): number {
  if (confidence === "high") return 3;
  if (confidence === "medium") return 2;
  return 1;
}

/**
 * Emit unique factual statements. Identical normalized statements merge once,
 * preserving the first human-readable form and unioning evidence refs.
 */
export function buildAssignmentFacts(
  evidenceRefs: AssignmentEvidenceRef[],
  summary: string,
): AssignmentFact[] {
  const byKey = new Map<string, AssignmentFact>();
  const order: string[] = [];

  const upsert = (input: AssignmentFact) => {
    const canonical = normalizeFactStatement(input.statement);
    if (!canonical) return;
    const existing = byKey.get(canonical);
    if (!existing) {
      byKey.set(canonical, {
        ...input,
        statement: canonical,
        evidenceRefs: [...new Set(input.evidenceRefs)],
      });
      order.push(canonical);
      return;
    }
    const mergedRefs = [...new Set([...existing.evidenceRefs, ...input.evidenceRefs])];
    byKey.set(canonical, {
      ...existing,
      evidenceRefs: mergedRefs,
      confidence:
        confidenceRank(input.confidence) > confidenceRank(existing.confidence)
          ? input.confidence
          : existing.confidence,
    });
  };

  if (summary.trim()) {
    upsert({
      factId: "summary",
      statement: summary,
      evidenceRefs: evidenceRefs.slice(0, 3).map((ref) => ref.evidenceId),
      confidence: evidenceRefs.some((ref) => ref.isOfficial) ? "high" : "medium",
    });
  }
  for (const ref of evidenceRefs.slice(0, 8)) {
    if (!ref.excerpt?.trim()) continue;
    upsert({
      factId: ref.evidenceId,
      statement: ref.excerpt,
      evidenceRefs: [ref.evidenceId],
      confidence:
        ref.isOfficial
          ? "high"
          : ref.credibilityHint != null && ref.credibilityHint < 0.4
            ? "low"
            : "medium",
    });
  }

  return order.map((key) => byKey.get(key)!).slice(0, 10);
}

export function weakEvidenceRiskNotes(evidenceRefs: AssignmentEvidenceRef[]): string[] {
  const notes: string[] = [];
  if (evidenceRefs.length === 0) {
    notes.push("no_evidence_refs_attached");
  }
  const lowCred = evidenceRefs.filter(
    (ref) => ref.credibilityHint != null && ref.credibilityHint < 0.45 && !ref.isOfficial,
  );
  if (lowCred.length > 0) {
    notes.push("low_credibility_evidence_present");
  }
  const withoutUrl = evidenceRefs.filter((ref) => !ref.url && !ref.reference);
  if (withoutUrl.length === evidenceRefs.length && evidenceRefs.length > 0) {
    notes.push("evidence_missing_url_or_reference");
  }
  return notes;
}
