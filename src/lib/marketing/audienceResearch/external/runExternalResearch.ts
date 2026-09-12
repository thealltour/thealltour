import { createHash } from "node:crypto";

import type { ManagerToContentHandoffResult } from "@/lib/marketing/content/types";
import type { ResearchBriefEditorialIntelligence } from "@/lib/marketing/research/types/editorialIntelligence";
import type { ResearchSearchProvider } from "@/lib/marketing/audienceResearch/external/searchProvider";
import { createResearchSearchProvider } from "@/lib/marketing/audienceResearch/external/createSearchProvider";
import { buildResearchQueryPlan } from "@/lib/marketing/audienceResearch/external/queryPlan";
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
import {
  sanitizeResearchFindingText,
} from "@/lib/marketing/audienceResearch/external/researchGuards";
import type { SourceSearchCache } from "@/lib/marketing/assets/shortform/resolver/searchCache";
import { createMemorySourceSearchCache } from "@/lib/marketing/assets/shortform/resolver/searchCache";

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
};

const DEFAULT_MAX_QUERIES = 6;
const DEFAULT_MAX_RESULTS_PER_QUERY = 5;
const DEFAULT_MAX_DOCUMENTS = 12;
const SEARCH_CACHE_TTL_MS = 6 * 60 * 60 * 1000;

function evidenceIdFor(url: string): string {
  return `ext_${createHash("sha256").update(url).digest("hex").slice(0, 16)}`;
}

function cacheKey(providerId: string, query: string): string {
  return `acrb-search:v1:${providerId}:${createHash("sha256").update(query).digest("hex").slice(0, 24)}`;
}

export async function runBoundedExternalResearch(input: {
  handoff: ManagerToContentHandoffResult;
  editorial?: ResearchBriefEditorialIntelligence | null;
  searchProvider?: ResearchSearchProvider | null;
  cache?: SourceSearchCache | null;
  maxQueries?: number;
  maxResultsPerQuery?: number;
  maxDocuments?: number;
  fetchImpl?: typeof fetch;
  now?: Date;
}): Promise<ExternalResearchBundle> {
  const started = Date.now();
  const provider = input.searchProvider ?? createResearchSearchProvider({ fetchImpl: input.fetchImpl });
  const cache = input.cache ?? createMemorySourceSearchCache();
  const maxQueries = input.maxQueries ?? DEFAULT_MAX_QUERIES;
  const maxResultsPerQuery = input.maxResultsPerQuery ?? DEFAULT_MAX_RESULTS_PER_QUERY;
  const maxDocuments = input.maxDocuments ?? DEFAULT_MAX_DOCUMENTS;

  const limitations: string[] = [];
  if (!provider.enabled) {
    return {
      available: false,
      providerId: provider.id,
      queryCount: 0,
      resultCount: 0,
      fetchedDocumentCount: 0,
      failedFetchCount: 0,
      totalFetchedBytes: 0,
      officialSourceCount: 0,
      socialCommunitySourceCount: 0,
      runtimeMs: Date.now() - started,
      queries: [],
      evidence: [],
      observedAudienceQuestions: [],
      observedCompetitorHooks: [],
      limitations: ["external_web_search_unavailable_or_disabled"],
    };
  }

  const plan = buildResearchQueryPlan({
    handoff: input.handoff,
    editorial: input.editorial,
    maxQueries,
  });

  const evidence: ExternalEvidenceItem[] = [];
  const observedAudienceQuestions: string[] = [];
  const observedCompetitorHooks: string[] = [];
  const seenUrls = new Set<string>();
  let resultCount = 0;
  let fetchedDocumentCount = 0;
  let failedFetchCount = 0;
  let totalFetchedBytes = 0;
  let officialSourceCount = 0;
  let socialCommunitySourceCount = 0;

  for (const item of plan.queries) {
    let hits;
    const key = cacheKey(provider.id, item.query);
    try {
      const cached = await cache.get(key);
      if (cached) {
        hits = JSON.parse(cached) as Awaited<ReturnType<ResearchSearchProvider["search"]>>;
      } else {
        hits = await provider.search(item.query, {
          maxResults: maxResultsPerQuery,
          timeoutMs: 12_000,
        });
        await cache.set(key, JSON.stringify(hits), SEARCH_CACHE_TTL_MS);
      }
    } catch (error) {
      limitations.push(
        `search_failed:${item.purpose}:${error instanceof Error ? error.message.slice(0, 80) : "error"}`,
      );
      continue;
    }

    resultCount += hits.length;

    for (const hit of hits) {
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

      if (fetchedDocumentCount < maxDocuments) {
        const doc = await fetchPublicDocument({
          url: hit.url,
          fetchImpl: input.fetchImpl,
          maxBytes: 512 * 1024,
          timeoutMs: 12_000,
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
        query: item.query,
        purpose: item.purpose,
      });

      if (item.purpose === "audience_questions" && hit.snippet) {
        observedAudienceQuestions.push(hit.title.slice(0, 80));
      }
      if (item.purpose === "competitor_content_gap" && hit.title) {
        observedCompetitorHooks.push(hit.title.slice(0, 100));
      }

      if (evidence.length >= maxDocuments + 4) break;
    }
    if (evidence.length >= maxDocuments + 4) break;
  }

  if (officialSourceCount === 0) {
    limitations.push("no_official_sources_in_inspected_sample");
  }
  if (evidence.length > 0 && evidence.every((e) => e.fromSnippetOnly)) {
    limitations.push("document_bodies_unavailable_snippet_only");
  }
  if (resultCount === 0 && evidence.length === 0) {
    limitations.push("external_search_returned_no_usable_results");
  }

  return {
    available: evidence.length > 0 || resultCount > 0,
    providerId: provider.id,
    queryCount: plan.queries.length,
    resultCount,
    fetchedDocumentCount,
    failedFetchCount,
    totalFetchedBytes,
    officialSourceCount,
    socialCommunitySourceCount,
    runtimeMs: Date.now() - started,
    queries: plan.queries.map((q) => q.query),
    evidence,
    observedAudienceQuestions: [...new Set(observedAudienceQuestions)].slice(0, 8),
    observedCompetitorHooks: [...new Set(observedCompetitorHooks)].slice(0, 8),
    limitations: [...new Set(limitations)].slice(0, 12),
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
