import { describe, expect, it } from "vitest";

import {
  EXTERNAL_RESEARCH_OVERALL_BUDGET_MS,
  EXTERNAL_SEARCH_PER_QUERY_TIMEOUT_MS,
  LEGACY_ORCHESTRATOR_SEARCH_TIMEOUT_MS,
  LEGACY_OPENROUTER_PROVIDER_TIMEOUT_MS,
  classifySearchFailure,
  isTransientSearchFailure,
  resolveExternalSearchStatus,
} from "@/lib/marketing/audienceResearch/external/researchPolicy";
import { runBoundedExternalResearch } from "@/lib/marketing/audienceResearch/external/runExternalResearch";
import { buildResearchQueryPlan } from "@/lib/marketing/audienceResearch/external/queryPlan";
import { buildDeterministicAcrb } from "@/lib/marketing/audienceResearch/deterministicSkeleton";
import { ensureAudienceContentResearch } from "@/lib/marketing/audienceResearch/ensureAudienceContentResearch";
import type { ResearchSearchProvider } from "@/lib/marketing/audienceResearch/external/searchProvider";
import { createDisabledSearchProvider } from "@/lib/marketing/audienceResearch/external/tavilyProvider";
import { prepareManagerToContentHandoff } from "@/lib/marketing/content/prepareManagerToContentHandoff";
import { createInMemoryContentAssignmentStore } from "@/lib/marketing/content/store/contentAssignmentStore";
import { createInMemoryMarketingProductionRequestRepository } from "@/lib/marketing/cron/daily/repository/createMarketingProductionRequestRepository";
import { MARKETING_PRODUCTION_REQUEST_CONTRACT } from "@/lib/marketing/cron/daily/repository/createMarketingProductionRequestRepository";
import { createMemorySourceSearchCache } from "@/lib/marketing/assets/shortform/resolver/searchCache";

function packageSelection() {
  return {
    title: "부산 출발 나트랑 추석 가족 패키지 프로모션 관측",
    summary: "부산 기반 여행사의 나트랑·판랑 추석 가족 패키지 프로모션",
    contentObjective: "inform_travelers" as const,
    commercialIntent: "informational" as const,
    destinations: [],
    topics: [],
    entities: [],
    researchBriefId: "rb_mq2_pkg",
    agendaCandidateId: "ac_mq2_pkg",
    evidenceRefs: [
      {
        evidenceId: "f4e6f641-d2cd-4704-8d01-2fbc890a516b",
        sourceId: "a1000000-0000-4000-8000-000000000001",
        sourceType: "social",
        sourceName: "Meta",
        isOfficial: false,
        evidenceType: "derived_signal",
        url: "https://www.instagram.com/reel/example/",
        reference: "meta_ai:obs_mq2",
        excerpt: "부산 기반 여행사의 나트랑·판랑 추석 가족 패키지 프로모션",
        publishedAt: null,
        observedAt: "2026-09-13T00:00:00.000Z",
        credibilityHint: 0.35,
      },
    ],
  };
}

function cruiseSelection() {
  return {
    title: "부산 출발 MSC 벨리시마 첫 크루즈 탑승 가이드",
    summary: "부산 출발 MSC 벨리시마 첫 크루즈 탑승 동선",
    contentObjective: "inform_travelers" as const,
    commercialIntent: "informational" as const,
    destinations: ["부산"],
    topics: ["크루즈", "탑승"],
    entities: ["MSC 벨리시마"],
    researchBriefId: "rb_mq2_cruise",
    agendaCandidateId: "ac_mq2_cruise",
    evidenceRefs: [
      {
        evidenceId: "f4e6f641-d2cd-4704-8d01-2fbc890a516b",
        sourceId: "a1000000-0000-4000-8000-000000000001",
        sourceType: "social",
        sourceName: "Meta",
        isOfficial: false,
        evidenceType: "derived_signal",
        url: "https://www.instagram.com/reel/cruise/",
        reference: "meta_ai:obs_mq2c",
        excerpt: "부산 출발 MSC 벨리시마 첫 크루즈 탑승 동선",
        publishedAt: null,
        observedAt: "2026-09-13T00:00:00.000Z",
        credibilityHint: 0.35,
      },
    ],
  };
}

describe("MQ-2 research policy", () => {
  it("removes orchestrator < provider timeout mismatch", () => {
    expect(EXTERNAL_SEARCH_PER_QUERY_TIMEOUT_MS).toBeGreaterThan(LEGACY_ORCHESTRATOR_SEARCH_TIMEOUT_MS);
    expect(EXTERNAL_SEARCH_PER_QUERY_TIMEOUT_MS).toBeLessThan(LEGACY_OPENROUTER_PROVIDER_TIMEOUT_MS);
    expect(EXTERNAL_SEARCH_PER_QUERY_TIMEOUT_MS).toBeGreaterThanOrEqual(25_000);
    expect(EXTERNAL_SEARCH_PER_QUERY_TIMEOUT_MS).toBeLessThanOrEqual(40_000);
    expect(EXTERNAL_RESEARCH_OVERALL_BUDGET_MS).toBeGreaterThanOrEqual(60_000);
    expect(EXTERNAL_RESEARCH_OVERALL_BUDGET_MS).toBeLessThanOrEqual(90_000);
  });

  it("classifies failures and retry eligibility", () => {
    expect(classifySearchFailure(Object.assign(new Error("aborted"), { name: "AbortError" })).category).toBe(
      "timeout",
    );
    expect(classifySearchFailure(new Error("This operation was aborted")).category).toBe("timeout");
    expect(classifySearchFailure(new Error("openrouter_rate_limited")).category).toBe("rate_limited");
    expect(classifySearchFailure(new Error("openrouter_http_503")).category).toBe("upstream_5xx");
    expect(classifySearchFailure(new Error("openrouter_http_401")).category).toBe("auth");
    expect(classifySearchFailure(new Error("openrouter_http_400")).category).toBe("invalid_response");
    expect(isTransientSearchFailure("timeout")).toBe(true);
    expect(isTransientSearchFailure("rate_limited")).toBe(true);
    expect(isTransientSearchFailure("auth")).toBe(false);
    expect(isTransientSearchFailure("invalid_response")).toBe(false);
  });

  it("resolves externalSearchStatus", () => {
    expect(
      resolveExternalSearchStatus({
        attemptedQueryCount: 0,
        successfulQueryCount: 0,
        failedQueryCount: 0,
        usableResultCount: 0,
        officialSourceCount: 0,
        purposesCovered: [],
      }),
    ).toBe("not_attempted");
    expect(
      resolveExternalSearchStatus({
        attemptedQueryCount: 2,
        successfulQueryCount: 0,
        failedQueryCount: 2,
        usableResultCount: 0,
        officialSourceCount: 0,
        purposesCovered: [],
      }),
    ).toBe("failed");
    expect(
      resolveExternalSearchStatus({
        attemptedQueryCount: 2,
        successfulQueryCount: 2,
        failedQueryCount: 0,
        usableResultCount: 0,
        officialSourceCount: 0,
        purposesCovered: [],
      }),
    ).toBe("attempted_no_results");
    expect(
      resolveExternalSearchStatus({
        attemptedQueryCount: 2,
        successfulQueryCount: 1,
        failedQueryCount: 1,
        usableResultCount: 1,
        officialSourceCount: 0,
        purposesCovered: ["audience_questions"],
      }),
    ).toBe("partial");
    expect(
      resolveExternalSearchStatus({
        attemptedQueryCount: 3,
        successfulQueryCount: 3,
        failedQueryCount: 0,
        usableResultCount: 3,
        officialSourceCount: 1,
        purposesCovered: ["audience_questions", "competitor_content_gap"],
      }),
    ).toBe("sufficient");
  });
});

describe("MQ-2 runBoundedExternalResearch reliability", () => {
  it("retries timeout once and counts toward paid budget", async () => {
    let calls = 0;
    const provider: ResearchSearchProvider = {
      id: "mock",
      enabled: true,
      async search() {
        calls += 1;
        if (calls === 1) {
          const err = new Error("This operation was aborted");
          err.name = "AbortError";
          throw err;
        }
        return [
          {
            title: "공식 안내",
            url: "https://www.vietnam.travel/nhatrang",
            snippet: "나트랑 공식 여행 안내 ".repeat(5),
            provider: "mock",
            rank: 1,
            publishedAt: null,
          },
        ];
      },
    };
    const handoff = prepareManagerToContentHandoff(packageSelection(), {
      store: createInMemoryContentAssignmentStore(),
    });
    const bundle = await runBoundedExternalResearch({
      handoff,
      searchProvider: provider,
      maxQueries: 1,
      maxPaidSearchRequests: 2,
      maxRetryPerQuery: 1,
      concurrency: 1,
      fetchImpl: async () =>
        new Response("<html><body>공식 나트랑 안내 본문 충분히 길게</body></html>", {
          status: 200,
          headers: { "Content-Type": "text/html" },
        }),
    });
    expect(calls).toBe(2);
    expect(bundle.retryCount).toBe(1);
    expect(bundle.searchRequestCount).toBe(2);
    expect(bundle.attemptedQueryCount).toBe(1);
    expect(bundle.successfulQueryCount).toBe(1);
    expect(bundle.queryCount).toBe(1);
    expect(bundle.usableResultCount).toBeGreaterThan(0);
    expect(bundle.externalSearchStatus).not.toBe("not_attempted");
  });

  it("does not retry auth or 400", async () => {
    let authCalls = 0;
    const authProvider: ResearchSearchProvider = {
      id: "mock_auth",
      enabled: true,
      async search() {
        authCalls += 1;
        throw new Error("openrouter_http_401");
      },
    };
    const handoff = prepareManagerToContentHandoff(packageSelection(), {
      store: createInMemoryContentAssignmentStore(),
    });
    const authBundle = await runBoundedExternalResearch({
      handoff,
      searchProvider: authProvider,
      maxQueries: 1,
      maxRetryPerQuery: 1,
      concurrency: 1,
    });
    expect(authCalls).toBe(1);
    expect(authBundle.retryCount).toBe(0);
    expect(authBundle.failedQueryCount).toBe(1);
    expect(authBundle.searchFailureCategories).toContain("auth");

    let badCalls = 0;
    const badProvider: ResearchSearchProvider = {
      id: "mock_400",
      enabled: true,
      async search() {
        badCalls += 1;
        throw new Error("openrouter_http_400");
      },
    };
    const badBundle = await runBoundedExternalResearch({
      handoff,
      searchProvider: badProvider,
      maxQueries: 1,
      maxRetryPerQuery: 1,
      concurrency: 1,
    });
    expect(badCalls).toBe(1);
    expect(badBundle.retryCount).toBe(0);
  });

  it("retries 429 once", async () => {
    let calls = 0;
    const provider: ResearchSearchProvider = {
      id: "mock_429",
      enabled: true,
      async search() {
        calls += 1;
        if (calls === 1) throw new Error("openrouter_rate_limited");
        return [];
      },
    };
    const handoff = prepareManagerToContentHandoff(packageSelection(), {
      store: createInMemoryContentAssignmentStore(),
    });
    const bundle = await runBoundedExternalResearch({
      handoff,
      searchProvider: provider,
      maxQueries: 1,
      maxRetryPerQuery: 1,
      concurrency: 1,
    });
    expect(calls).toBe(2);
    expect(bundle.retryCount).toBe(1);
    expect(bundle.externalSearchStatus).toBe("attempted_no_results");
  });

  it("enforces overall budget and paid request cap", async () => {
    let calls = 0;
    const provider: ResearchSearchProvider = {
      id: "mock_slow",
      enabled: true,
      async search() {
        calls += 1;
        await new Promise((r) => setTimeout(r, 30));
        return [
          {
            title: `Hit ${calls}`,
            url: `https://www.example.com/page-${calls}`,
            snippet: "snippet ".repeat(20),
            provider: "mock",
            rank: 1,
            publishedAt: null,
          },
        ];
      },
    };
    const handoff = prepareManagerToContentHandoff(packageSelection(), {
      store: createInMemoryContentAssignmentStore(),
    });
    const bundle = await runBoundedExternalResearch({
      handoff,
      searchProvider: provider,
      maxQueries: 6,
      concurrency: 2,
      maxPaidSearchRequests: 3,
      overallBudgetMs: 5_000,
      perQueryTimeoutMs: 2_000,
      fetchImpl: async () =>
        new Response("<html><body>body text enough length for excerpt extraction here</body></html>", {
          status: 200,
          headers: { "Content-Type": "text/html" },
        }),
    });
    expect(bundle.searchRequestCount ?? 0).toBeLessThanOrEqual(3);
    expect(calls).toBeLessThanOrEqual(3);
    expect(bundle.plannedQueryCount).toBeGreaterThan(0);
  });

  it("keeps concurrency bounded and isolates query failures", async () => {
    let inFlight = 0;
    let maxInFlight = 0;
    const provider: ResearchSearchProvider = {
      id: "mock_conc",
      enabled: true,
      async search(query) {
        inFlight += 1;
        maxInFlight = Math.max(maxInFlight, inFlight);
        await new Promise((r) => setTimeout(r, 40));
        inFlight -= 1;
        if (/후기/.test(query)) throw new Error("openrouter_http_503");
        return [
          {
            title: query,
            url: `https://www.example.com/${encodeURIComponent(query).slice(0, 40)}`,
            snippet: "ok ".repeat(30),
            provider: "mock",
            rank: 1,
            publishedAt: null,
          },
        ];
      },
    };
    const handoff = prepareManagerToContentHandoff(packageSelection(), {
      store: createInMemoryContentAssignmentStore(),
    });
    const bundle = await runBoundedExternalResearch({
      handoff,
      searchProvider: provider,
      maxQueries: 4,
      concurrency: 2,
      maxRetryPerQuery: 0,
      fetchImpl: async () =>
        new Response("<html><body>document body with enough characters</body></html>", {
          status: 200,
          headers: { "Content-Type": "text/html" },
        }),
    });
    expect(maxInFlight).toBeLessThanOrEqual(2);
    expect(bundle.successfulQueryCount ?? 0).toBeGreaterThan(0);
    expect(bundle.failedQueryCount ?? 0).toBeGreaterThanOrEqual(0);
  });

  it("records attempted queries even when all fail (no queryCount=0 lie)", async () => {
    const provider: ResearchSearchProvider = {
      id: "mock_fail",
      enabled: true,
      async search() {
        const err = new Error("This operation was aborted");
        err.name = "AbortError";
        throw err;
      },
    };
    const handoff = prepareManagerToContentHandoff(packageSelection(), {
      store: createInMemoryContentAssignmentStore(),
    });
    const bundle = await runBoundedExternalResearch({
      handoff,
      searchProvider: provider,
      maxQueries: 2,
      maxRetryPerQuery: 0,
      concurrency: 1,
    });
    expect(bundle.attemptedQueryCount).toBe(2);
    expect(bundle.queryCount).toBe(2);
    expect(bundle.usableResultCount).toBe(0);
    expect(bundle.externalSearchStatus).toBe("failed");
    expect(bundle.limitations.some((l) => /search_failed:.*:timeout/.test(l))).toBe(true);

    const brief = buildDeterministicAcrb({
      gathered: {
        selectedAgenda: handoff.selectedAgenda,
        assignment: handoff.contentAssignment,
        evidencePack: handoff.evidencePack,
        compactBrief: null,
        compactCandidate: null,
        fullResearchBrief: null,
        editorial: null,
        historicalMatches: [],
        semanticAvailable: false,
        nearDuplicate: false,
        cooledIdentity: false,
        externalResearch: bundle,
      },
    });
    expect(brief.provenance.queryCount).toBe(2);
    expect(brief.provenance.attemptedQueryCount).toBe(2);
    expect(brief.provenance.externalResearchUsed).toBe(false);
    expect(brief.sourceCoverage.externalWebSearch).toBe(false);
  });

  it("skips quickly when provider disabled / credential absent", async () => {
    const handoff = prepareManagerToContentHandoff(packageSelection(), {
      store: createInMemoryContentAssignmentStore(),
    });
    const bundle = await runBoundedExternalResearch({
      handoff,
      searchProvider: createDisabledSearchProvider("openrouter_api_key_missing"),
      env: { RESEARCH_SEARCH_PROVIDER: "openrouter" },
    });
    expect(bundle.externalSearchStatus).toBe("not_attempted");
    expect(bundle.runtimeMs).toBeLessThan(2_000);
    expect(bundle.providerCredentialPresent).toBe(false);
  });
});

describe("MQ-2 MQ-1 regression + durability", () => {
  it("package agenda still has zero cruise queries", () => {
    const handoff = prepareManagerToContentHandoff(packageSelection(), {
      store: createInMemoryContentAssignmentStore(),
    });
    const plan = buildResearchQueryPlan({ handoff, maxQueries: 6 });
    expect(plan.queries.every((q) => !/크루즈|cruise|벨리시마|msc|부산항/i.test(q.query))).toBe(true);
  });

  it("cruise agenda may still produce cruise queries", () => {
    const handoff = prepareManagerToContentHandoff(cruiseSelection(), {
      store: createInMemoryContentAssignmentStore(),
    });
    const plan = buildResearchQueryPlan({ handoff, maxQueries: 6 });
    expect(plan.queries.some((q) => /크루즈|출항|터미널|탑승/i.test(q.query))).toBe(true);
  });

  it("second ensureAudienceContentResearch reuses without new search calls", async () => {
    let searchCalls = 0;
    const provider: ResearchSearchProvider = {
      id: "mock_reuse",
      enabled: true,
      async search() {
        searchCalls += 1;
        return [
          {
            title: "공식",
            url: "https://www.vietnam.travel/package",
            snippet: "패키지 안내 ".repeat(10),
            provider: "mock",
            rank: 1,
            publishedAt: null,
          },
        ];
      },
    };
    const handoff = prepareManagerToContentHandoff(
      { ...packageSelection(), idempotencyKey: "mq2-reuse-1" },
      { store: createInMemoryContentAssignmentStore() },
    );
    const repo = createInMemoryMarketingProductionRequestRepository();
    const logicalRunKey = "daily-marketing-production:2026-09-13:mq2reuse000000000001";
    const iso = "2026-09-13T00:00:00.000Z";
    await repo.enqueue({
      contract: MARKETING_PRODUCTION_REQUEST_CONTRACT,
      requestId: "mpr_mq2_reuse",
      logicalRunKey,
      slateId: "slate",
      slateItemId: "item",
      businessDateKst: "2026-09-13",
      status: "QUEUED",
      createdAt: iso,
      updatedAt: iso,
      claimedAt: null,
      startedAt: null,
      completedAt: null,
      failedAt: null,
      attemptCount: 0,
      claimToken: null,
      lastError: null,
      workerId: null,
      selection: {
        title: packageSelection().title,
        summary: packageSelection().summary,
        agendaCandidateId: "ac_mq2_pkg",
        researchBriefId: "rb_mq2_pkg",
        rationale: [],
        recommendedChannel: "threads",
        recommendedFormats: [],
      },
      errorMessage: null,
      completedCandidateId: null,
      metadata: { productId: "prod" },
    });

    const cache = createMemorySourceSearchCache();
    const first = await ensureAudienceContentResearch({
      handoff,
      logicalRunKey,
      productionRequestRepo: repo,
      searchProvider: provider,
      searchCache: cache,
      fetchImpl: async () =>
        new Response("<html><body>공식 패키지 안내 본문 충분히</body></html>", {
          status: 200,
          headers: { "Content-Type": "text/html" },
        }),
    });
    const callsAfterFirst = searchCalls;
    expect(first.reused).toBe(false);
    expect(callsAfterFirst).toBeGreaterThan(0);

    const second = await ensureAudienceContentResearch({
      handoff,
      logicalRunKey,
      productionRequestRepo: repo,
      searchProvider: provider,
      searchCache: cache,
    });
    expect(second.reused).toBe(true);
    expect(searchCalls).toBe(callsAfterFirst);
    expect(second.brief.logicalIdentity).toBe(first.brief.logicalIdentity);
  });
});
