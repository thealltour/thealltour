import { createHash } from "node:crypto";

import type { ManagerToContentHandoffResult } from "@/lib/marketing/content/types";
import type { ResearchBriefEditorialIntelligence } from "@/lib/marketing/research/types/editorialIntelligence";
import type {
  ResearchSearchHit,
  ResearchSearchProvider,
} from "@/lib/marketing/audienceResearch/external/searchProvider";
import {
  createResearchSearchProvider,
  resolveResearchSearchProviderStatus,
} from "@/lib/marketing/audienceResearch/external/createSearchProvider";
import { buildResearchQueryPlan } from "@/lib/marketing/audienceResearch/external/queryPlan";
import type { ResearchQueryPlanItem } from "@/lib/marketing/audienceResearch/external/queryPlan";
import type { StoryContentPoint } from "@/lib/marketing/storyPoint/contracts";
import {
  classifyExternalSource,
  sourceClassAllowsVerifiedFact,
  type ExternalSourceClass,
} from "@/lib/marketing/audienceResearch/external/sourceClassify";
import {
  extractPlainTextExcerpt,
  fetchPublicDocument,
} from "@/lib/marketing/audienceResearch/external/documentFetch";
import { assertPublicHttpUrl } from "@/lib/marketing/audienceResearch/external/urlSafety";
import { sanitizeResearchFindingText } from "@/lib/marketing/audienceResearch/external/researchGuards";
import type { SourceSearchCache } from "@/lib/marketing/assets/shortform/resolver/searchCache";
import { createMemorySourceSearchCache } from "@/lib/marketing/assets/shortform/resolver/searchCache";
import {
  EXTERNAL_RESEARCH_OVERALL_BUDGET_MS,
  EXTERNAL_SAFE_FETCH_TIMEOUT_MS,
  EXTERNAL_SEARCH_CONCURRENCY,
  EXTERNAL_SEARCH_MAX_PAID_REQUESTS,
  EXTERNAL_SEARCH_MAX_QUERIES,
  EXTERNAL_SEARCH_MAX_RETRY_PER_QUERY,
  EXTERNAL_SEARCH_PER_QUERY_TIMEOUT_MS,
  classifySearchFailure,
  isTransientSearchFailure,
  resolveExternalSearchStatus,
  type ExternalSearchStatus,
  type SearchFailureCategory,
} from "@/lib/marketing/audienceResearch/external/researchPolicy";

export type ExternalEvidenceItem = {
  evidenceId: string;
  url: string;
  title: string;
  excerpt: string;
  sourceClass: ExternalSourceClass;
  fromSnippetOnly: boolean;
  query: string;
  purpose: string;
};

export type ExternalResearchBundle = {
  available: boolean;
  providerId: string;
  /** Backward-compatible: attempted query count (not usable-only). */
  queryCount: number;
  resultCount: number;
  fetchedDocumentCount: number;
  failedFetchCount: number;
  totalFetchedBytes: number;
  officialSourceCount: number;
  socialCommunitySourceCount: number;
  runtimeMs: number;
  queries: string[];
  evidence: ExternalEvidenceItem[];
  observedAudienceQuestions: string[];
  observedCompetitorHooks: string[];
  limitations: string[];
  /** MQ-2 additive provenance */
  plannedQueryCount?: number;
  attemptedQueryCount?: number;
  successfulQueryCount?: number;
  failedQueryCount?: number;
  retryCount?: number;
  usableResultCount?: number;
  searchRequestCount?: number;
  externalSearchStatus?: ExternalSearchStatus;
  providerCredentialPresent?: boolean;
  providerSelected?: string;
  searchFailureCategories?: SearchFailureCategory[];
};

const SEARCH_CACHE_TTL_MS = 6 * 60 * 60 * 1000;

function evidenceIdFor(url: string): string {
  return `ext_${createHash("sha256").update(url).digest("hex").slice(0, 16)}`;
}

function cacheKey(providerId: string, query: string): string {
  return `acrb-search:v1:${providerId}:${createHash("sha256").update(query).digest("hex").slice(0, 24)}`;
}

function emptyBundle(input: {
  started: number;
  providerId: string;
  credentialPresent: boolean;
  limitations: string[];
  status: ExternalSearchStatus;
}): ExternalResearchBundle {
  return {
    available: false,
    providerId: input.providerId,
    queryCount: 0,
    resultCount: 0,
    fetchedDocumentCount: 0,
    failedFetchCount: 0,
    totalFetchedBytes: 0,
    officialSourceCount: 0,
    socialCommunitySourceCount: 0,
    runtimeMs: Date.now() - input.started,
    queries: [],
    evidence: [],
    observedAudienceQuestions: [],
    observedCompetitorHooks: [],
    limitations: input.limitations,
    plannedQueryCount: 0,
    attemptedQueryCount: 0,
    successfulQueryCount: 0,
    failedQueryCount: 0,
    retryCount: 0,
    usableResultCount: 0,
    searchRequestCount: 0,
    externalSearchStatus: input.status,
    providerCredentialPresent: input.credentialPresent,
    providerSelected: input.providerId,
    searchFailureCategories: [],
  };
}

type QueryAttemptResult = {
  item: ResearchQueryPlanItem;
  hits: ResearchSearchHit[];
  attempted: boolean;
  success: boolean;
  failed: boolean;
  retries: number;
  paidRequests: number;
  failureCategory: SearchFailureCategory | null;
  skipped: boolean;
  skipReason: string | null;
};

function coverageSufficient(input: {
  officialSourceCount: number;
  purposesHit: Set<string>;
}): boolean {
  return (
    input.officialSourceCount >= 1 &&
    input.purposesHit.has("audience_questions") &&
    input.purposesHit.has("competitor_content_gap")
  );
}

export async function runBoundedExternalResearch(input: {
  handoff: ManagerToContentHandoffResult;
  editorial?: ResearchBriefEditorialIntelligence | null;
  /** ED-2 — when set, query plan is driven by storyPoint.researchQuestions. */
  storyPoint?: StoryContentPoint | null;
  searchProvider?: ResearchSearchProvider | null;
  cache?: SourceSearchCache | null;
  maxQueries?: number;
  maxResultsPerQuery?: number;
  maxDocuments?: number;
  perQueryTimeoutMs?: number;
  overallBudgetMs?: number;
  concurrency?: number;
  maxRetryPerQuery?: number;
  maxPaidSearchRequests?: number;
  fetchImpl?: typeof fetch;
  now?: Date;
  env?: NodeJS.ProcessEnv | Record<string, string | undefined>;
}): Promise<ExternalResearchBundle> {
  const started = Date.now();
  const env = input.env ?? process.env;
  const providerStatus = resolveResearchSearchProviderStatus(env);
  const provider =
    input.searchProvider ?? createResearchSearchProvider({ fetchImpl: input.fetchImpl, env });
  const cache = input.cache ?? createMemorySourceSearchCache();
  const maxQueries = input.maxQueries ?? EXTERNAL_SEARCH_MAX_QUERIES;
  const maxResultsPerQuery = input.maxResultsPerQuery ?? 5;
  const maxDocuments = input.maxDocuments ?? 12;
  const perQueryTimeoutMs = input.perQueryTimeoutMs ?? EXTERNAL_SEARCH_PER_QUERY_TIMEOUT_MS;
  const overallBudgetMs = input.overallBudgetMs ?? EXTERNAL_RESEARCH_OVERALL_BUDGET_MS;
  const concurrency = input.concurrency ?? EXTERNAL_SEARCH_CONCURRENCY;
  const maxRetryPerQuery = input.maxRetryPerQuery ?? EXTERNAL_SEARCH_MAX_RETRY_PER_QUERY;
  const maxPaidSearchRequests = input.maxPaidSearchRequests ?? EXTERNAL_SEARCH_MAX_PAID_REQUESTS;

  const limitations: string[] = [];
  const failureCategories: SearchFailureCategory[] = [];

  if (!provider.enabled) {
    return emptyBundle({
      started,
      providerId: provider.id,
      credentialPresent: providerStatus.credentialPresent,
      limitations: [
        "external_web_search_unavailable_or_disabled",
        providerStatus.reason ? `provider_reason:${providerStatus.reason}` : null,
        `provider_selected:${provider.id}`,
        `provider_credential_present:${providerStatus.credentialPresent}`,
      ].filter(Boolean) as string[],
      status: "not_attempted",
    });
  }

  const plan = buildResearchQueryPlan({
    handoff: input.handoff,
    editorial: input.editorial,
    storyPoint: input.storyPoint ?? null,
    maxQueries,
  });

  const deadlineAt = started + overallBudgetMs;
  const overallController = new AbortController();
  const overallTimer = setTimeout(() => overallController.abort(), overallBudgetMs);

  let paidSearchRequests = 0;
  let retryCount = 0;
  let activeProvider = provider;
  let providerSwitchedForAuth = false;

  const evidence: ExternalEvidenceItem[] = [];
  const observedAudienceQuestions: string[] = [];
  const observedCompetitorHooks: string[] = [];
  const seenUrls = new Set<string>();
  const purposesHit = new Set<string>();
  let resultCount = 0;
  let fetchedDocumentCount = 0;
  let failedFetchCount = 0;
  let totalFetchedBytes = 0;
  let officialSourceCount = 0;
  let socialCommunitySourceCount = 0;
  let earlyStopped = false;
  let budgetExhausted = false;

  // Serialize paid-request accounting across concurrent batch workers.
  let paidGate: Promise<void> = Promise.resolve();
  function withPaidGate<T>(fn: () => Promise<T>): Promise<T> {
    const run = paidGate.then(fn, fn);
    paidGate = run.then(
      () => undefined,
      () => undefined,
    );
    return run;
  }

  async function searchOnce(
    query: string,
    signal: AbortSignal,
  ): Promise<ResearchSearchHit[]> {
    return activeProvider.search(query, {
      maxResults: maxResultsPerQuery,
      timeoutMs: perQueryTimeoutMs,
      signal,
    });
  }

  async function attemptQuery(item: ResearchQueryPlanItem): Promise<QueryAttemptResult> {
    if (Date.now() >= deadlineAt || overallController.signal.aborted) {
      return {
        item,
        hits: [],
        attempted: false,
        success: false,
        failed: false,
        retries: 0,
        paidRequests: 0,
        failureCategory: "timeout",
        skipped: true,
        skipReason: "overall_budget_exhausted",
      };
    }
    if (paidSearchRequests >= maxPaidSearchRequests) {
      return {
        item,
        hits: [],
        attempted: false,
        success: false,
        failed: false,
        retries: 0,
        paidRequests: 0,
        failureCategory: null,
        skipped: true,
        skipReason: "paid_search_budget_exhausted",
      };
    }
    if (earlyStopped) {
      return {
        item,
        hits: [],
        attempted: false,
        success: false,
        failed: false,
        retries: 0,
        paidRequests: 0,
        failureCategory: null,
        skipped: true,
        skipReason: "early_stop_sufficient",
      };
    }

    const key = cacheKey(activeProvider.id, item.query);
    let retries = 0;
    let paidRequests = 0;

    try {
      const cached = await cache.get(key);
      if (cached) {
        const hits = JSON.parse(cached) as ResearchSearchHit[];
        return {
          item,
          hits,
          attempted: true,
          success: true,
          failed: false,
          retries: 0,
          paidRequests: 0,
          failureCategory: null,
          skipped: false,
          skipReason: null,
        };
      }
    } catch {
      // ignore cache read errors
    }

    const runAttempt = async (): Promise<ResearchSearchHit[]> => {
      await withPaidGate(async () => {
        if (paidSearchRequests >= maxPaidSearchRequests) {
          throw new Error("paid_search_budget_exhausted");
        }
        paidSearchRequests += 1;
        paidRequests += 1;
      });
      const remainingBudget = Math.max(1, deadlineAt - Date.now());
      const queryTimeout = Math.min(perQueryTimeoutMs, remainingBudget);
      const queryController = new AbortController();
      const onOverallAbort = () => queryController.abort();
      overallController.signal.addEventListener("abort", onOverallAbort, { once: true });
      const timer = setTimeout(() => queryController.abort(), queryTimeout);
      try {
        return await searchOnce(item.query, queryController.signal);
      } finally {
        clearTimeout(timer);
        overallController.signal.removeEventListener("abort", onOverallAbort);
      }
    };

    try {
      const hits = await runAttempt();
      await cache.set(key, JSON.stringify(hits), SEARCH_CACHE_TTL_MS).catch(() => undefined);
      return {
        item,
        hits,
        attempted: true,
        success: true,
        failed: false,
        retries,
        paidRequests,
        failureCategory: hits.length === 0 ? "empty_result" : null,
        skipped: false,
        skipReason: null,
      };
    } catch (error) {
      let classified = classifySearchFailure(error);

      // Provider-level auth fallback once (not per-query fan-out to all providers).
      if (classified.category === "auth" && !providerSwitchedForAuth && !input.searchProvider) {
        providerSwitchedForAuth = true;
        const envBag: Record<string, string | undefined> = {};
        for (const [k, v] of Object.entries(env)) envBag[k] = v;
        envBag.OPENROUTER_API_KEY = "";
        envBag.RESEARCH_SEARCH_PROVIDER = "auto";
        const fallback = createResearchSearchProvider({
          fetchImpl: input.fetchImpl,
          env: envBag,
        });
        if (fallback.enabled && fallback.id !== activeProvider.id) {
          activeProvider = fallback;
          limitations.push(`provider_fallback_after_auth:${fallback.id}`);
          try {
            const hits = await runAttempt();
            await cache.set(key, JSON.stringify(hits), SEARCH_CACHE_TTL_MS).catch(() => undefined);
            return {
              item,
              hits,
              attempted: true,
              success: true,
              failed: false,
              retries,
              paidRequests,
              failureCategory: hits.length === 0 ? "empty_result" : null,
              skipped: false,
              skipReason: null,
            };
          } catch (fallbackError) {
            classified = classifySearchFailure(fallbackError);
          }
        }
      }

      if (
        isTransientSearchFailure(classified.category) &&
        retries < maxRetryPerQuery &&
        paidSearchRequests < maxPaidSearchRequests &&
        Date.now() < deadlineAt
      ) {
        retries += 1;
        retryCount += 1;
        try {
          const hits = await runAttempt();
          await cache.set(key, JSON.stringify(hits), SEARCH_CACHE_TTL_MS).catch(() => undefined);
          return {
            item,
            hits,
            attempted: true,
            success: true,
            failed: false,
            retries,
            paidRequests,
            failureCategory: hits.length === 0 ? "empty_result" : null,
            skipped: false,
            skipReason: null,
          };
        } catch (retryError) {
          classified = classifySearchFailure(retryError);
        }
      }

      return {
        item,
        hits: [],
        attempted: true,
        success: false,
        failed: true,
        retries,
        paidRequests,
        failureCategory: classified.category,
        skipped: false,
        skipReason: null,
      };
    }
  }

  // Batch concurrency: up to N queries in flight, then process hits before next batch.
  // Enables early-stop / budget checks between batches without unbounded parallelism.
  const attemptResults: QueryAttemptResult[] = [];
  for (let offset = 0; offset < plan.queries.length; offset += concurrency) {
    if (Date.now() >= deadlineAt || overallController.signal.aborted) {
      budgetExhausted = true;
      for (const item of plan.queries.slice(offset)) {
        attemptResults.push({
          item,
          hits: [],
          attempted: false,
          success: false,
          failed: false,
          retries: 0,
          paidRequests: 0,
          failureCategory: "timeout",
          skipped: true,
          skipReason: "overall_budget_exhausted",
        });
      }
      break;
    }
    if (earlyStopped) {
      for (const item of plan.queries.slice(offset)) {
        attemptResults.push({
          item,
          hits: [],
          attempted: false,
          success: false,
          failed: false,
          retries: 0,
          paidRequests: 0,
          failureCategory: null,
          skipped: true,
          skipReason: "early_stop_sufficient",
        });
      }
      break;
    }
    if (paidSearchRequests >= maxPaidSearchRequests) {
      for (const item of plan.queries.slice(offset)) {
        attemptResults.push({
          item,
          hits: [],
          attempted: false,
          success: false,
          failed: false,
          retries: 0,
          paidRequests: 0,
          failureCategory: null,
          skipped: true,
          skipReason: "paid_search_budget_exhausted",
        });
      }
      break;
    }

    const batch = plan.queries.slice(offset, offset + concurrency);
    const batchResults = await Promise.all(batch.map((item) => attemptQuery(item)));
    attemptResults.push(...batchResults);

    for (const attempt of batchResults) {
      if (attempt.skipped) {
        if (attempt.skipReason === "overall_budget_exhausted") budgetExhausted = true;
        if (attempt.skipReason) {
          limitations.push(`search_skipped:${attempt.item.purpose}:${attempt.skipReason}`);
        }
        continue;
      }
      if (attempt.failed) {
        const cat = attempt.failureCategory ?? "unknown";
        failureCategories.push(cat);
        limitations.push(`search_failed:${attempt.item.purpose}:${cat}`);
        continue;
      }
      if (attempt.failureCategory === "empty_result") {
        failureCategories.push("empty_result");
        limitations.push(`search_empty:${attempt.item.purpose}`);
      }

      resultCount += attempt.hits.length;

      for (const hit of attempt.hits) {
        if (seenUrls.has(hit.url)) continue;
        const safety = assertPublicHttpUrl(hit.url);
        if (!safety.ok) {
          failedFetchCount += 1;
          continue;
        }
        seenUrls.add(hit.url);
        const sourceClass = classifyExternalSource({
          url: hit.url,
          title: hit.title,
          snippet: hit.snippet,
        });

        let excerpt = hit.snippet.slice(0, 500);
        let fromSnippetOnly = true;

        if (fetchedDocumentCount < maxDocuments && Date.now() < deadlineAt) {
          const remaining = Math.max(1, deadlineAt - Date.now());
          const doc = await fetchPublicDocument({
            url: hit.url,
            fetchImpl: input.fetchImpl,
            maxBytes: 512 * 1024,
            timeoutMs: Math.min(EXTERNAL_SAFE_FETCH_TIMEOUT_MS, remaining),
          });
          if (doc.ok) {
            fetchedDocumentCount += 1;
            totalFetchedBytes += doc.byteLength;
            const plain = extractPlainTextExcerpt(doc.text, 900);
            if (plain.length >= 40) {
              excerpt = plain;
              fromSnippetOnly = false;
            }
          } else {
            failedFetchCount += 1;
            limitations.push(`fetch_failed:${sourceClass}:${doc.reason}`);
          }
        }

        if (sourceClass === "official") officialSourceCount += 1;
        if (sourceClass === "public_social" || sourceClass === "community") {
          socialCommunitySourceCount += 1;
        }

        evidence.push({
          evidenceId: evidenceIdFor(hit.url),
          url: hit.url,
          title: hit.title,
          excerpt,
          sourceClass,
          fromSnippetOnly,
          query: attempt.item.query,
          purpose: attempt.item.purpose,
        });
        purposesHit.add(attempt.item.purpose);

        if (attempt.item.purpose === "audience_questions" && hit.snippet) {
          observedAudienceQuestions.push(hit.title.slice(0, 80));
        }
        if (attempt.item.purpose === "competitor_content_gap" && hit.title) {
          observedCompetitorHooks.push(hit.title.slice(0, 100));
        }

        if (evidence.length >= maxDocuments + 4) break;
      }
    }

    if (coverageSufficient({ officialSourceCount, purposesHit }) && evidence.length > 0) {
      earlyStopped = true;
    }
  }

  clearTimeout(overallTimer);

  if (budgetExhausted) {
    limitations.push("external_research_overall_budget_exhausted");
  }
  if (paidSearchRequests >= maxPaidSearchRequests) {
    limitations.push(`paid_search_request_cap_reached:${maxPaidSearchRequests}`);
  }
  if (earlyStopped) {
    limitations.push("external_research_early_stop_sufficient");
  }
  if (officialSourceCount === 0 && evidence.length > 0) {
    limitations.push("no_official_sources_in_inspected_sample");
  }
  if (evidence.length > 0 && evidence.every((e) => e.fromSnippetOnly)) {
    limitations.push("document_bodies_unavailable_snippet_only");
  }

  const attemptedQueryCount = attemptResults.filter((a) => a.attempted).length;
  const successfulQueryCount = attemptResults.filter((a) => a.success).length;
  const failedQueryCount = attemptResults.filter((a) => a.failed).length;
  const usableResultCount = evidence.length;
  const externalSearchStatus = resolveExternalSearchStatus({
    attemptedQueryCount,
    successfulQueryCount,
    failedQueryCount,
    usableResultCount,
    officialSourceCount,
    purposesCovered: purposesHit,
  });

  if (usableResultCount === 0 && attemptedQueryCount > 0) {
    limitations.push("external_search_returned_no_usable_results");
  }

  return {
    available: usableResultCount > 0 || resultCount > 0,
    providerId: activeProvider.id,
    queryCount: attemptedQueryCount,
    resultCount,
    fetchedDocumentCount,
    failedFetchCount,
    totalFetchedBytes,
    officialSourceCount,
    socialCommunitySourceCount,
    runtimeMs: Date.now() - started,
    queries: attemptResults.filter((a) => a.attempted).map((a) => a.item.query),
    evidence,
    observedAudienceQuestions: [...new Set(observedAudienceQuestions)].slice(0, 8),
    observedCompetitorHooks: [...new Set(observedCompetitorHooks)].slice(0, 8),
    limitations: [...new Set(limitations)].slice(0, 16),
    plannedQueryCount: plan.queries.length,
    attemptedQueryCount,
    successfulQueryCount,
    failedQueryCount,
    retryCount,
    usableResultCount,
    searchRequestCount: paidSearchRequests,
    externalSearchStatus,
    providerCredentialPresent: providerStatus.credentialPresent,
    providerSelected: provider.id,
    searchFailureCategories: [...new Set(failureCategories)],
  };
}

/**
 * Rebuild a minimal ExternalResearchBundle from a durable ACRB so synthesis-only
 * regeneration can reuse prior external evidence without new web-search calls.
 */
export function reconstructExternalBundleFromAcrb(input: {
  brief: {
    sourceCoverage: { externalWebSearch: boolean };
    provenance: {
      externalResearchUsed?: boolean;
      searchProvider?: string | null;
      externalResultCount?: number;
      fetchedDocumentCount?: number;
      totalFetchedBytes?: number;
      externalResearchRuntimeMs?: number;
      officialSourceCount?: number;
      socialCommunitySourceCount?: number;
      plannedQueryCount?: number;
      attemptedQueryCount?: number;
      successfulQueryCount?: number;
      failedQueryCount?: number;
      retryCount?: number;
      usableResultCount?: number;
      externalSearchStatus?: ExternalSearchStatus;
    };
    researchFindings: Array<{
      findingId: string;
      text: string;
      sourceClass?: string | null;
      provenanceNote?: string | null;
      evidenceRefs: string[];
    }>;
    searchIntent: { questions: Array<{ text: string }> };
    marketSignals: { competitorHooks: Array<{ text: string }> };
    limitations: string[];
  };
}): ExternalResearchBundle | null {
  const brief = input.brief;
  if (!brief.provenance.externalResearchUsed && !brief.sourceCoverage.externalWebSearch) {
    return null;
  }

  const evidence: ExternalEvidenceItem[] = [];
  for (const finding of brief.researchFindings) {
    const note = finding.provenanceNote ?? "";
    const isExternal =
      finding.findingId.startsWith("ext_") ||
      finding.evidenceRefs.some((r) => r.startsWith("ext_")) ||
      /snippetOnly=|official\||public_social\||community\|/.test(note);
    if (!isExternal) continue;

    const urlMatch = note.match(/https?:\/\/[^\s|]+/);
    const snippetOnly = /snippetOnly=true/.test(note);
    let sourceClass: ExternalSourceClass = "unknown";
    if (note.startsWith("official|") || finding.sourceClass === "official") sourceClass = "official";
    else if (
      note.startsWith("public_social|") ||
      note.startsWith("community|") ||
      finding.sourceClass === "public_social_content"
    ) {
      sourceClass = note.startsWith("community|") ? "community" : "public_social";
    } else if (finding.sourceClass === "derived_signal") sourceClass = "unknown";

    evidence.push({
      evidenceId: finding.findingId.startsWith("ext_")
        ? finding.findingId
        : finding.evidenceRefs.find((r) => r.startsWith("ext_")) ?? finding.findingId,
      url: urlMatch?.[0] ?? "https://example.invalid/reused-external-evidence",
      title: finding.text.slice(0, 120),
      excerpt: finding.text,
      sourceClass,
      fromSnippetOnly: snippetOnly,
      query: "reused_from_durable_acrb",
      purpose: "synthesis_only_reuse",
    });
  }

  if (evidence.length === 0 && !(brief.provenance.externalResultCount ?? 0)) {
    return null;
  }

  return {
    available: true,
    providerId: brief.provenance.searchProvider ?? "reused_durable",
    queryCount: 0,
    resultCount: brief.provenance.externalResultCount ?? evidence.length,
    fetchedDocumentCount: brief.provenance.fetchedDocumentCount ?? 0,
    failedFetchCount: 0,
    totalFetchedBytes: brief.provenance.totalFetchedBytes ?? 0,
    officialSourceCount: brief.provenance.officialSourceCount ?? 0,
    socialCommunitySourceCount: brief.provenance.socialCommunitySourceCount ?? 0,
    runtimeMs: 0,
    queries: [],
    evidence,
    observedAudienceQuestions: brief.searchIntent.questions.map((q) => q.text).slice(0, 8),
    observedCompetitorHooks: brief.marketSignals.competitorHooks.map((h) => h.text).slice(0, 8),
    limitations: [
      "external_research_reused_from_durable_acrb_no_new_search",
      ...brief.limitations.filter((l) => /표본|공식|웹검색|provider/i.test(l)).slice(0, 6),
    ],
    plannedQueryCount: brief.provenance.plannedQueryCount ?? 0,
    attemptedQueryCount: 0,
    successfulQueryCount: 0,
    failedQueryCount: 0,
    retryCount: 0,
    usableResultCount: evidence.length,
    searchRequestCount: 0,
    externalSearchStatus: brief.provenance.externalSearchStatus ?? "partial",
    providerCredentialPresent: true,
    providerSelected: brief.provenance.searchProvider ?? "reused_durable",
  };
}

export function externalEvidenceToFindings(bundle: ExternalResearchBundle): Array<{
  findingId: string;
  text: string;
  type: "verified_fact" | "observed_signal" | "inference" | "hypothesis";
  confidence: number;
  evidenceRefs: string[];
  sourceClass: "official" | "public_social_content" | "derived_signal" | "first_party_internal" | "model_inference";
  provenanceNote: string;
}> {
  return bundle.evidence.slice(0, 12).map((item) => {
    const canVerify =
      sourceClassAllowsVerifiedFact(item.sourceClass) && !item.fromSnippetOnly && item.excerpt.length >= 40;
    const sanitized = sanitizeResearchFindingText(`${item.title}: ${item.excerpt.slice(0, 280)}`);
    const type =
      sanitized.downgraded
        ? ("hypothesis" as const)
        : canVerify
          ? ("verified_fact" as const)
          : ("observed_signal" as const);
    return {
      findingId: item.evidenceId,
      text: sanitized.text,
      type,
      confidence: sanitized.downgraded ? 0.25 : canVerify ? 0.75 : item.fromSnippetOnly ? 0.35 : 0.5,
      evidenceRefs: [item.evidenceId],
      sourceClass:
        item.sourceClass === "official"
          ? ("official" as const)
          : item.sourceClass === "public_social" || item.sourceClass === "community"
            ? ("public_social_content" as const)
            : ("derived_signal" as const),
      provenanceNote: [
        `${item.sourceClass}|${item.url}|snippetOnly=${item.fromSnippetOnly}`,
        sanitized.reason ? `guard:${sanitized.reason}` : null,
      ]
        .filter(Boolean)
        .join("|"),
    };
  });
}
