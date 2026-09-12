import type {
  CompactManagerAgendaCandidate,
  CompactManagerResearchBrief,
} from "@/lib/marketing/research/manager/types";
import type { ResearchBrief } from "@/lib/marketing/research/types/researchBrief";
import type { ResearchBriefEditorialIntelligence } from "@/lib/marketing/research/types/editorialIntelligence";
import type {
  ContentAssignment,
  ManagerToContentHandoffResult,
  SelectedAgenda,
} from "@/lib/marketing/content/types";
import type { ExternalResearchBundle } from "@/lib/marketing/audienceResearch/external/runExternalResearch";

export type AcrbHistoricalMatch = {
  kind: "candidate" | "agenda" | "publication";
  id: string;
  title: string;
  similarityHint: number;
  reason: string;
};

export type AcrbGatheredInputs = {
  selectedAgenda: SelectedAgenda;
  assignment: ContentAssignment;
  evidencePack: ManagerToContentHandoffResult["evidencePack"];
  compactBrief: CompactManagerResearchBrief | null;
  compactCandidate: CompactManagerAgendaCandidate | null;
  fullResearchBrief: ResearchBrief | null;
  editorial: ResearchBriefEditorialIntelligence | null;
  historicalMatches: AcrbHistoricalMatch[];
  semanticAvailable: boolean;
  nearDuplicate: boolean;
  cooledIdentity: boolean;
  externalResearch: ExternalResearchBundle | null;
};

function tokenize(text: string): Set<string> {
  return new Set(
    text
      .toLowerCase()
      .replace(/[^\p{L}\p{N}\s]/gu, " ")
      .split(/\s+/)
      .filter((token) => token.length >= 2),
  );
}

export function lexicalOverlapRatio(a: string, b: string): number {
  const left = tokenize(a);
  const right = tokenize(b);
  if (left.size === 0 || right.size === 0) return 0;
  let hit = 0;
  for (const token of left) {
    if (right.has(token)) hit += 1;
  }
  return hit / Math.max(left.size, right.size);
}

export function detectNearDuplicate(input: {
  title: string;
  summary: string;
  matches: AcrbHistoricalMatch[];
}): boolean {
  if (input.matches.some((m) => m.similarityHint >= 0.82)) return true;
  const blob = `${input.title} ${input.summary}`;
  return input.matches.some((m) => lexicalOverlapRatio(blob, m.title) >= 0.75);
}

export type GatherAcrbInputsDeps = {
  loadFullResearchBrief?: (id: string) => Promise<ResearchBrief | null>;
  listRecentCandidateTitles?: () => Promise<Array<{ id: string; title: string }>>;
  /** Injected cooldown hit — when true, treat as repetition risk. */
  cooledIdentity?: boolean;
  semanticAvailable?: boolean;
  externalResearch?: ExternalResearchBundle | null;
};

export async function gatherAcrbInputs(input: {
  handoff: ManagerToContentHandoffResult;
  compactBrief?: CompactManagerResearchBrief | null;
  compactCandidate?: CompactManagerAgendaCandidate | null;
  deps?: GatherAcrbInputsDeps;
}): Promise<AcrbGatheredInputs> {
  const deps = input.deps ?? {};
  const selectedAgenda = input.handoff.selectedAgenda;
  const preselectionId =
    selectedAgenda.provenance.researchBriefId?.trim() ||
    input.compactBrief?.researchBriefId ||
    null;

  let fullResearchBrief: ResearchBrief | null = null;
  if (preselectionId && deps.loadFullResearchBrief) {
    try {
      fullResearchBrief = await deps.loadFullResearchBrief(preselectionId);
    } catch {
      fullResearchBrief = null;
    }
  }

  const editorial = fullResearchBrief?.editorialIntelligence ?? null;

  let recent: Array<{ id: string; title: string }> = [];
  let semanticAvailable = deps.semanticAvailable ?? false;
  if (deps.listRecentCandidateTitles) {
    try {
      recent = await deps.listRecentCandidateTitles();
      semanticAvailable = deps.semanticAvailable ?? true;
    } catch {
      recent = [];
      semanticAvailable = false;
    }
  }

  const topicBlob = `${selectedAgenda.title} ${selectedAgenda.summary}`;
  const historicalMatches: AcrbHistoricalMatch[] = recent.slice(0, 20).map((row) => {
    const similarityHint = lexicalOverlapRatio(topicBlob, row.title);
    return {
      kind: "candidate" as const,
      id: row.id,
      title: row.title,
      similarityHint,
      reason: similarityHint >= 0.6 ? "lexical_title_overlap" : "recent_candidate",
    };
  });
  historicalMatches.sort((a, b) => b.similarityHint - a.similarityHint);

  const nearDuplicate = detectNearDuplicate({
    title: selectedAgenda.title,
    summary: selectedAgenda.summary,
    matches: historicalMatches,
  });

  return {
    selectedAgenda,
    assignment: input.handoff.contentAssignment,
    evidencePack: input.handoff.evidencePack,
    compactBrief: input.compactBrief ?? null,
    compactCandidate: input.compactCandidate ?? null,
    fullResearchBrief,
    editorial,
    historicalMatches: historicalMatches.filter((m) => m.similarityHint >= 0.35).slice(0, 8),
    semanticAvailable,
    nearDuplicate: nearDuplicate || Boolean(deps.cooledIdentity),
    cooledIdentity: Boolean(deps.cooledIdentity),
    externalResearch: deps.externalResearch ?? null,
  };
}
