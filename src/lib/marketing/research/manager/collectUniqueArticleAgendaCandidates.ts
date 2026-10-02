import { normalizeSourceArticleIdentity } from "@/lib/marketing/cron/daily/researchIdentityCooldown";
import type {
  AgendaCandidateArticleRef,
  ResearchRepository,
} from "@/lib/marketing/research/repository/contracts";
import type { MarketingResearchArticlePrePool } from "@/lib/marketing/research/manager/types";
import type { AgendaCandidate } from "@/lib/marketing/research/types/researchBrief";

export type AgendaCandidateEligibility = (
  candidate: AgendaCandidate,
  ref: AgendaCandidateArticleRef | undefined,
) => Promise<boolean>;

export const ARTICLE_PREPOOL_PAGE_SIZE = 250;
/**
 * Safety bound only: 40 × 250 rows covers far more than one lookback window of
 * candidate inserts, so it never re-truncates the pool to the top-scoring sources.
 */
export const ARTICLE_PREPOOL_MAX_PAGES = 40;

function normalizeTitle(title: string): string {
  return title.normalize("NFKC").toLowerCase().replace(/\s+/g, " ").trim();
}

/**
 * Source-article identity for one candidate row. Priority: normalized canonical URL,
 * signal id, title+source (only when a source is known), then the candidate id so
 * unrelated URL-less rows never collapse together. Title alone is never a key.
 */
export function agendaCandidateArticleIdentity(
  candidate: Pick<AgendaCandidate, "id" | "title">,
  ref: AgendaCandidateArticleRef | undefined,
): string {
  const url = normalizeSourceArticleIdentity({ url: ref?.canonicalUrl });
  if (url) return `url:${url}`;
  if (ref?.signalId) return `signal:${ref.signalId}`;
  const title = normalizeTitle(candidate.title ?? "");
  if (ref?.sourceId && title) return `title_source:${ref.sourceId}|${title}`;
  return `candidate:${candidate.id}`;
}

export type CollectUniqueArticleAgendaCandidatesInput = {
  since: string;
  targetUniqueArticles: number;
  pageSize?: number;
  maxPages?: number;
  /**
   * Applied to every fetched row before article dedup, so ineligible rows never claim an
   * article identity or a pre-pool slot. Diagnostics then describe the eligible universe only.
   */
  isCandidateEligible?: AgendaCandidateEligibility;
};

export type CollectUniqueArticleAgendaCandidatesResult = {
  candidates: AgendaCandidate[];
  diagnostics: MarketingResearchArticlePrePool;
  /** Fetched rows rejected by `isCandidateEligible`; always 0 without a predicate. */
  ineligibleRowsSkipped: number;
};

async function filterEligible(
  rows: AgendaCandidate[],
  isCandidateEligible: AgendaCandidateEligibility,
  refs?: Map<string, AgendaCandidateArticleRef>,
): Promise<AgendaCandidate[]> {
  const eligible: AgendaCandidate[] = [];
  for (const row of rows) {
    if (await isCandidateEligible(row, refs?.get(row.id))) eligible.push(row);
  }
  return eligible;
}

/** Legacy read with a predicate: widens the row limit until `target` eligible rows exist or the window ends. */
async function collectLegacyEligible(
  repo: ResearchRepository,
  input: { since: string; target: number; maxReads: number; isCandidateEligible: AgendaCandidateEligibility },
): Promise<CollectUniqueArticleAgendaCandidatesResult> {
  let limit = input.target;
  let reads = 0;
  let rows: AgendaCandidate[] = [];
  let eligible: AgendaCandidate[] = [];
  while (true) {
    rows = await repo.findRecentAgendaCandidates({ since: input.since, limit });
    reads += 1;
    eligible = await filterEligible(rows, input.isCandidateEligible);
    if (eligible.length >= input.target || rows.length < limit || reads >= input.maxReads) break;
    limit += input.target - eligible.length;
  }
  const exhausted = rows.length < limit;
  return {
    candidates: eligible,
    diagnostics: {
      mode: "legacy_row_limit",
      targetUniqueArticles: input.target,
      fetchedCandidateRows: eligible.length,
      uniqueArticleCandidates: eligible.length,
      duplicateRowsDropped: 0,
      pagesRead: reads,
      lookbackExhausted: exhausted,
      maxPagesReached: !exhausted && eligible.length < input.target,
    },
    ineligibleRowsSkipped: rows.length - eligible.length,
  };
}

/**
 * Read-only MM pre-pool: walks agenda candidates in score order and keeps the first
 * row per source article until `targetUniqueArticles` unique articles are collected
 * or the lookback window is exhausted. Repositories without paging fall back to the
 * legacy row-limited read.
 */
export async function collectUniqueArticleAgendaCandidates(
  repo: ResearchRepository,
  input: CollectUniqueArticleAgendaCandidatesInput,
): Promise<CollectUniqueArticleAgendaCandidatesResult> {
  const target = Math.max(1, Math.floor(input.targetUniqueArticles));

  if (!repo.findRecentAgendaCandidatesPage || !repo.findAgendaCandidateArticleRefs) {
    if (input.isCandidateEligible) {
      return collectLegacyEligible(repo, {
        since: input.since,
        target,
        maxReads: Math.max(1, Math.floor(input.maxPages ?? ARTICLE_PREPOOL_MAX_PAGES)),
        isCandidateEligible: input.isCandidateEligible,
      });
    }
    const rows = await repo.findRecentAgendaCandidates({ since: input.since, limit: target });
    return {
      candidates: rows,
      diagnostics: {
        mode: "legacy_row_limit",
        targetUniqueArticles: target,
        fetchedCandidateRows: rows.length,
        uniqueArticleCandidates: rows.length,
        duplicateRowsDropped: 0,
        pagesRead: 1,
        lookbackExhausted: rows.length < target,
        maxPagesReached: false,
      },
      ineligibleRowsSkipped: 0,
    };
  }

  const pageSize = Math.max(1, Math.floor(input.pageSize ?? ARTICLE_PREPOOL_PAGE_SIZE));
  const maxPages = Math.max(1, Math.floor(input.maxPages ?? ARTICLE_PREPOOL_MAX_PAGES));
  const seen = new Set<string>();
  const kept: AgendaCandidate[] = [];
  let offset = 0;
  let pagesRead = 0;
  let fetchedCandidateRows = 0;
  let duplicateRowsDropped = 0;
  let ineligibleRowsSkipped = 0;
  let lookbackExhausted = false;
  let maxPagesReached = false;

  while (kept.length < target) {
    if (pagesRead >= maxPages) {
      maxPagesReached = true;
      break;
    }
    const page = await repo.findRecentAgendaCandidatesPage({
      since: input.since,
      limit: pageSize,
      offset,
    });
    pagesRead += 1;
    offset += page.length;
    if (page.length === 0) {
      lookbackExhausted = true;
      break;
    }

    const refs = await repo.findAgendaCandidateArticleRefs(page);
    const eligiblePage = input.isCandidateEligible
      ? await filterEligible(page, input.isCandidateEligible, refs)
      : page;
    ineligibleRowsSkipped += page.length - eligiblePage.length;
    fetchedCandidateRows += eligiblePage.length;
    for (const candidate of eligiblePage) {
      const key = agendaCandidateArticleIdentity(candidate, refs.get(candidate.id));
      if (seen.has(key)) {
        duplicateRowsDropped += 1;
        continue;
      }
      seen.add(key);
      kept.push(candidate);
      if (kept.length >= target) break;
    }

    if (page.length < pageSize) {
      lookbackExhausted = true;
      break;
    }
  }

  return {
    candidates: kept,
    diagnostics: {
      mode: "unique_article_pages",
      targetUniqueArticles: target,
      fetchedCandidateRows,
      uniqueArticleCandidates: kept.length,
      duplicateRowsDropped,
      pagesRead,
      lookbackExhausted,
      maxPagesReached,
    },
    ineligibleRowsSkipped,
  };
}
