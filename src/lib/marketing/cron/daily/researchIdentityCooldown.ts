import type { CompletedMarketingCandidate } from "@/lib/marketing/cron/daily/types";
import type {
  CompactManagerAgendaCandidate,
  CompactManagerResearchBrief,
  MarketingResearchContext,
} from "@/lib/marketing/research/manager/types";

export const DEFAULT_RESEARCH_IDENTITY_COOLDOWN_DAYS = 7;

export type ResearchIdentitySet = {
  agendaCandidateIds: Set<string>;
  researchBriefIds: Set<string>;
  /** Canonical article keys: normalized URL, else evidenceId (+ optional sourceId). Never bare publisher sourceId. */
  sourceArticleIds: Set<string>;
};

export function createEmptyResearchIdentitySet(): ResearchIdentitySet {
  return {
    agendaCandidateIds: new Set(),
    researchBriefIds: new Set(),
    sourceArticleIds: new Set(),
  };
}

export function subtractKstBusinessDays(businessDateKst: string, days: number): string {
  const [y, m, d] = businessDateKst.split("-").map(Number);
  const utc = new Date(Date.UTC(y, (m ?? 1) - 1, d ?? 1));
  utc.setUTCDate(utc.getUTCDate() - days);
  const year = utc.getUTCFullYear();
  const month = String(utc.getUTCMonth() + 1).padStart(2, "0");
  const day = String(utc.getUTCDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

const TRACKING_QUERY_PARAMS = new Set([
  "utm_source",
  "utm_medium",
  "utm_campaign",
  "utm_content",
  "utm_term",
  "fbclid",
  "gclid",
]);

/**
 * Exact article identity for cooldown — never publisher/feed alone.
 * Prefer canonical URL; else evidenceId (article-specific). Bare sourceId is
 * publisher-level and must not cool down sibling articles from the same feed.
 */
export function normalizeSourceArticleIdentity(input: {
  url?: string | null;
  sourceId?: string | null;
  evidenceId?: string | null;
}): string | null {
  const url = input.url?.trim();
  if (url) {
    try {
      const parsed = new URL(url);
      parsed.hash = "";
      for (const key of [...parsed.searchParams.keys()]) {
        if (TRACKING_QUERY_PARAMS.has(key.toLowerCase())) {
          parsed.searchParams.delete(key);
        }
      }
      return parsed.toString().replace(/\/$/, "").toLowerCase();
    } catch {
      return url.toLowerCase();
    }
  }
  const evidenceId = input.evidenceId?.trim();
  if (evidenceId) {
    const sourceId = input.sourceId?.trim();
    // Combine when both exist so identity stays article-scoped, not feed-scoped.
    return sourceId ? `source:${sourceId}|evidence:${evidenceId}` : `evidence:${evidenceId}`;
  }
  return null;
}

export function addIdentitiesFromEvidence(
  into: ResearchIdentitySet,
  evidence: Array<{ url?: string | null; sourceId?: string | null; evidenceId?: string | null }>,
): void {
  for (const ref of evidence) {
    const key = normalizeSourceArticleIdentity(ref);
    if (key) into.sourceArticleIds.add(key);
  }
}

export function extractResearchIdentitiesFromCandidate(
  candidate: CompletedMarketingCandidate,
): ResearchIdentitySet {
  const set = createEmptyResearchIdentitySet();
  const agendaId = candidate.selectedAgenda.provenance.agendaCandidateId?.trim();
  const briefId = candidate.selectedAgenda.provenance.researchBriefId?.trim();
  if (agendaId) set.agendaCandidateIds.add(agendaId);
  if (briefId) set.researchBriefIds.add(briefId);
  addIdentitiesFromEvidence(set, candidate.selectedAgenda.evidenceRefs ?? []);
  addIdentitiesFromEvidence(set, candidate.contentAssignment.evidenceRefs ?? []);
  return set;
}

export function mergeResearchIdentitySets(...sets: ResearchIdentitySet[]): ResearchIdentitySet {
  const out = createEmptyResearchIdentitySet();
  for (const set of sets) {
    for (const id of set.agendaCandidateIds) out.agendaCandidateIds.add(id);
    for (const id of set.researchBriefIds) out.researchBriefIds.add(id);
    for (const id of set.sourceArticleIds) out.sourceArticleIds.add(id);
  }
  return out;
}

/**
 * Identities used by CompletedMarketingCandidate rows in [today - cooldownDays, today).
 * Human-review status is intentionally ignored — any completed candidate counts.
 */
export function collectRecentResearchIdentities(
  candidates: CompletedMarketingCandidate[],
  businessDateKst: string,
  cooldownDays: number = DEFAULT_RESEARCH_IDENTITY_COOLDOWN_DAYS,
): ResearchIdentitySet {
  const windowStart = subtractKstBusinessDays(businessDateKst, cooldownDays);
  const recent = candidates.filter(
    (row) => row.businessDateKst >= windowStart && row.businessDateKst < businessDateKst,
  );
  return mergeResearchIdentitySets(...recent.map(extractResearchIdentitiesFromCandidate));
}

export function agendaCandidateMatchesCooldown(
  candidate: CompactManagerAgendaCandidate,
  cooled: ResearchIdentitySet,
): boolean {
  if (cooled.agendaCandidateIds.has(candidate.agendaCandidateId)) return true;
  if (candidate.researchBriefId && cooled.researchBriefIds.has(candidate.researchBriefId)) {
    return true;
  }
  for (const ref of candidate.evidence ?? []) {
    const key = normalizeSourceArticleIdentity(ref);
    if (key && cooled.sourceArticleIds.has(key)) return true;
  }
  return false;
}

export function researchBriefMatchesCooldown(
  brief: CompactManagerResearchBrief,
  cooled: ResearchIdentitySet,
): boolean {
  if (cooled.researchBriefIds.has(brief.researchBriefId)) return true;
  for (const ref of brief.evidence ?? []) {
    const key = normalizeSourceArticleIdentity(ref);
    if (key && cooled.sourceArticleIds.has(key)) return true;
  }
  return false;
}

export function applyResearchIdentityCooldown(
  context: MarketingResearchContext,
  cooled: ResearchIdentitySet,
): {
  context: MarketingResearchContext;
  excludedAgendaCandidateIds: string[];
  excludedBriefIds: string[];
} {
  const excludedAgendaCandidateIds: string[] = [];
  const excludedBriefIds: string[] = [];

  const agendaCandidates = context.agendaCandidates.filter((candidate) => {
    if (agendaCandidateMatchesCooldown(candidate, cooled)) {
      excludedAgendaCandidateIds.push(candidate.agendaCandidateId);
      return false;
    }
    return true;
  });

  const briefs = context.briefs.filter((brief) => {
    if (researchBriefMatchesCooldown(brief, cooled)) {
      excludedBriefIds.push(brief.researchBriefId);
      return false;
    }
    return true;
  });

  const notes = [...(context.notes ?? [])];
  if (excludedAgendaCandidateIds.length > 0 || excludedBriefIds.length > 0) {
    notes.push(
      `exact_research_identity_cooldown_excluded:${excludedAgendaCandidateIds.length}:${excludedBriefIds.length}`,
    );
  }

  return {
    context: {
      ...context,
      agendaCandidates,
      briefs,
      notes,
      observability: {
        ...context.observability,
        candidateCount: agendaCandidates.length,
        briefCount: briefs.length,
        duplicateExcludedCount:
          (context.observability?.duplicateExcludedCount ?? 0) + excludedAgendaCandidateIds.length,
      },
    },
    excludedAgendaCandidateIds,
    excludedBriefIds,
  };
}
