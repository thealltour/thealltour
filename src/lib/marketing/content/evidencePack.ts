import type {
  AssignmentEvidenceRef,
  AssignmentFact,
  ContentAssignment,
  EvidenceFreshnessHint,
  EvidencePack,
  EvidencePackItem,
  SelectedAgenda,
} from "@/lib/marketing/content/types";
import { EVIDENCE_PACK_CONTRACT } from "@/lib/marketing/content/types";

const STALE_MS = 1000 * 60 * 60 * 24 * 45;
const AGING_MS = 1000 * 60 * 60 * 24 * 14;

function freshnessHint(ref: AssignmentEvidenceRef | undefined, now: Date): EvidenceFreshnessHint {
  if (!ref) return "unknown";
  const anchor = ref.publishedAt ?? ref.observedAt;
  if (!anchor) return "unknown";
  const age = now.getTime() - new Date(anchor).getTime();
  if (!Number.isFinite(age) || age < 0) return "unknown";
  if (age > STALE_MS) return "stale";
  if (age > AGING_MS) return "aging";
  return "fresh";
}

function sourceSummary(refs: AssignmentEvidenceRef[]): string | null {
  const first = refs[0];
  if (!first) return null;
  const bits = [first.sourceName, first.sourceType, first.isOfficial ? "official" : null].filter(Boolean);
  return bits.length ? bits.join(" · ") : null;
}

function supportedTokens(text: string, candidates: string[]): string[] {
  const hay = text.toLowerCase();
  return candidates.filter((token) => {
    const needle = token.trim().toLowerCase();
    return needle.length >= 2 && hay.includes(needle);
  });
}

function refsForFact(
  fact: AssignmentFact,
  byId: Map<string, AssignmentEvidenceRef>,
): AssignmentEvidenceRef[] {
  return fact.evidenceRefs
    .map((id) => byId.get(id))
    .filter((ref): ref is AssignmentEvidenceRef => Boolean(ref));
}

/**
 * Deterministic Evidence Pack Builder — locks assignment facts for CS draft.
 * No LLM. Low-confidence or unlinkable facts are not allowedForDraft.
 */
export function buildEvidencePack(input: {
  assignment: ContentAssignment;
  selectedAgenda: SelectedAgenda;
  now?: Date;
}): EvidencePack {
  const now = input.now ?? new Date();
  const byId = new Map(
    input.assignment.evidenceRefs.map((ref) => [ref.evidenceId, ref] as const),
  );
  const destinations = input.assignment.destinations.length
    ? input.assignment.destinations
    : input.selectedAgenda.destinations;
  const topics = input.selectedAgenda.topics;

  const items: EvidencePackItem[] = input.assignment.facts.slice(0, 12).map((fact) => {
    const linked = refsForFact(fact, byId);
    const searchText = [fact.statement, ...linked.map((r) => r.excerpt ?? "")].join(" ");
    const allowedForDraft = fact.confidence !== "low" && linked.length > 0;
    return {
      factId: fact.factId,
      statement: fact.statement,
      evidenceRefIds: linked.map((r) => r.evidenceId),
      sourceSummary: sourceSummary(linked),
      freshnessHint: freshnessHint(linked[0], now),
      supportedDestinations: supportedTokens(searchText, destinations),
      supportedTopics: supportedTokens(searchText, topics),
      allowedForDraft,
      locked: true as const,
    };
  });

  return {
    contract: EVIDENCE_PACK_CONTRACT,
    assignmentId: input.assignment.assignmentId,
    items,
    availableEvidenceRefs: input.assignment.evidenceRefs.slice(0, 12),
    builtAt: now.toISOString(),
  };
}

export function allowedEvidenceIdsFromPack(pack: EvidencePack | null | undefined): string[] {
  if (!pack) return [];
  const disallowedIds = new Set(
    pack.items.filter((item) => !item.allowedForDraft).flatMap((item) => item.evidenceRefIds),
  );
  const ids = new Set<string>();
  for (const item of pack.items) {
    if (!item.allowedForDraft) continue;
    for (const id of item.evidenceRefIds) {
      // Never surface IDs that only/also back a locked-out (e.g. low-confidence) fact.
      if (disallowedIds.has(id)) continue;
      ids.add(id);
    }
  }
  return [...ids];
}

export function packHasAllowedFactualItems(pack: EvidencePack | null | undefined): boolean {
  return Boolean(pack?.items.some((item) => item.allowedForDraft && item.statement.trim().length >= 8));
}
