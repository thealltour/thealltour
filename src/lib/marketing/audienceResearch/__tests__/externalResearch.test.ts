import { describe, expect, it, vi } from "vitest";

import { applyAngleQualityGate, isGenericAngleText } from "@/lib/marketing/audienceResearch/angleQuality";
import { createResearchSearchProvider } from "@/lib/marketing/audienceResearch/external/createSearchProvider";
import { fetchPublicDocument } from "@/lib/marketing/audienceResearch/external/documentFetch";
import { buildResearchQueryPlan } from "@/lib/marketing/audienceResearch/external/queryPlan";
import {
  externalEvidenceToFindings,
  runBoundedExternalResearch,
} from "@/lib/marketing/audienceResearch/external/runExternalResearch";
import type { ResearchSearchProvider } from "@/lib/marketing/audienceResearch/external/searchProvider";
import {
  classifyExternalSource,
  sourceClassAllowsVerifiedFact,
} from "@/lib/marketing/audienceResearch/external/sourceClassify";
import { createDisabledSearchProvider, createTavilySearchProvider } from "@/lib/marketing/audienceResearch/external/tavilyProvider";
import { assertPublicHttpUrl } from "@/lib/marketing/audienceResearch/external/urlSafety";
import { buildDeterministicAcrb } from "@/lib/marketing/audienceResearch/deterministicSkeleton";
import { ensureAudienceContentResearch } from "@/lib/marketing/audienceResearch/ensureAudienceContentResearch";
import { synthesizeAudienceContentResearch } from "@/lib/marketing/audienceResearch/synthesize";
import { prepareManagerToContentHandoff } from "@/lib/marketing/content/prepareManagerToContentHandoff";
import { createInMemoryContentAssignmentStore } from "@/lib/marketing/content/store/contentAssignmentStore";
import {
  MARKETING_PRODUCTION_REQUEST_CONTRACT,
  createInMemoryMarketingProductionRequestRepository,
} from "@/lib/marketing/cron/daily/repository/createMarketingProductionRequestRepository";
import type { MarketingProductionRequest } from "@/lib/marketing/cron/daily/agendaSlate/productionRequestTypes";
import type { ResearchBriefEditorialIntelligence } from "@/lib/marketing/research/types/editorialIntelligence";
import type { AcrbContentAngle } from "@/lib/marketing/audienceResearch/contracts";

function busanSelection() {
  return {
    title: "부산 출발 크루즈 추석 탑승 가이드 콘텐츠 관측",
    summary:
      "공개 인스타그램에서 부산 출발 MSC 벨리시마 크루즈의 탑승 동선과 가족 동반 체험을 소개하는 콘텐츠가 관측됨",
    contentObjective: "inform_travelers" as const,
    commercialIntent: "informational" as const,
    destinations: ["부산"],
    topics: ["크루즈", "추석", "탑승"],
    entities: ["MSC 벨리시마"],
    researchBriefId: "rb_busan_cruise_ra1c",
    agendaCandidateId: "ac_busan_cruise_ra1c",
    evidenceRefs: [
      {
        evidenceId: "f4e6f641-d2cd-4704-8d01-2fbc890a516b",
        sourceId: "a1000000-0000-4000-8000-000000000001",
        sourceType: "social",
        sourceName: "Meta AI Trend Discovery",
        isOfficial: false,
        evidenceType: "derived_signal",
        url: "https://www.instagram.com/reel/DdEgr-UyM2S/",
        reference: "meta_ai:obs_test",
        excerpt: "공개 인스타그램에서 부산 출발 MSC 벨리시마 크루즈의 탑승 동선이 관측됨",
        publishedAt: null,
        observedAt: "2026-09-09T15:10:00.000Z",
        credibilityHint: 0.35,
      },
    ],
  };
}

function editorial(): ResearchBriefEditorialIntelligence {
  return {
    hookSignals: ["첫 크루즈 탑승 전 동선"],
    formatSignals: ["checklist"],
    audiencePainPoints: ["탑승 절차 막막함"],
    audienceQuestions: ["부산항 탑승 동선은?"],
    personaHints: ["첫 크루즈 초보"],
    contentAngles: ["가족 해상 휴가"],
  };
}

function makeMpr(logicalRunKey: string): MarketingProductionRequest {
  const iso = "2026-09-12T12:00:00.000Z";
  return {
    contract: MARKETING_PRODUCTION_REQUEST_CONTRACT,
    requestId: `mpr_${logicalRunKey.slice(-12)}`,
    logicalRunKey,
    slateId: "slate_test",
    slateItemId: "item_1",
    businessDateKst: "2026-09-12",
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
      title: busanSelection().title,
      summary: busanSelection().summary,
      agendaCandidateId: "ac_busan_cruise_ra1c",
      researchBriefId: "rb_busan_cruise_ra1c",
      rationale: [],
      recommendedChannel: "threads",
      recommendedFormats: [],
    },
    errorMessage: null,
    completedCandidateId: null,
    metadata: { productId: "prod_test" },
  };
}

function angle(partial: Partial<AcrbContentAngle> & Pick<AcrbContentAngle, "angle" | "hook" | "audienceTension">): AcrbContentAngle {
  return {
    angleId: partial.angleId ?? "a1",
    angle: partial.angle,
    hook: partial.hook,
    audienceTension: partial.audienceTension,
    interestScore: partial.interestScore ?? 0.7,
    noveltyScore: partial.noveltyScore ?? 0.6,
    evidenceStrength: partial.evidenceStrength ?? 0.5,
    channelFit: partial.channelFit ?? {
      threads: 0.7,
      naver_blog: 0.5,
      naver_band: 0.4,
      kakao_channel: 0.4,
      shortform: 0.6,
      cardnews: 0.4,
    },
    rationale: partial.rationale ?? "test",
    supportingFindingRefs: partial.supportingFindingRefs ?? [],
    limitations: partial.limitations ?? [],
  };
}

describe("RA-1C bounded external research", () => {
  it("disables search provider without credentials", () => {
    const provider = createResearchSearchProvider({
      env: { RESEARCH_SEARCH_PROVIDER: "tavily" },
    });
    expect(provider.enabled).toBe(false);
    expect(provider.id).toBe("disabled");
  });

  it("tavily adapter handles 429 / malformed / timeout isolation", async () => {
    const rateLimited = createTavilySearchProvider({
      apiKey: "test-key",
      fetchImpl: async () => new Response("{}", { status: 429 }),
    });
    await expect(rateLimited.search("부산 크루즈")).rejects.toThrow(/rate_limited/);

    const malformed = createTavilySearchProvider({
      apiKey: "test-key",
      fetchImpl: async () =>
        new Response(JSON.stringify({ results: "nope" }), {
          status: 200,
          headers: { "Content-Type": "application/json" },
        }),
    });
    await expect(malformed.search("부산 크루즈")).rejects.toThrow(/malformed/);

    const timedOut = createTavilySearchProvider({
      apiKey: "test-key",
      fetchImpl: async (_url, init) =>
        new Promise((_resolve, reject) => {
          init?.signal?.addEventListener("abort", () => {
            const err = new Error("aborted");
            err.name = "AbortError";
            reject(err);
          });
        }),
    });
    await expect(timedOut.search("부산 크루즈", { timeoutMs: 20 })).rejects.toThrow();
  });

  it("enforces SSRF / localhost / metadata / scheme blocks", () => {
    expect(assertPublicHttpUrl("http://127.0.0.1/").ok).toBe(false);
    expect(assertPublicHttpUrl("http://localhost/x").ok).toBe(false);
    expect(assertPublicHttpUrl("http://169.254.169.254/latest").ok).toBe(false);
    expect(assertPublicHttpUrl("http://10.0.0.5/").ok).toBe(false);
    expect(assertPublicHttpUrl("file:///etc/passwd").ok).toBe(false);
    expect(assertPublicHttpUrl("https://www.msc.com/ko").ok).toBe(true);
  });

  it("blocks redirect-to-private and oversized responses", async () => {
    const redirectFetch: typeof fetch = async () =>
      new Response(null, {
        status: 302,
        headers: { Location: "http://127.0.0.1/secret" },
      });
    const redirected = await fetchPublicDocument({
      url: "https://example.com/start",
      fetchImpl: redirectFetch,
    });
    expect(redirected.ok).toBe(false);
    if (!redirected.ok) expect(redirected.reason).toMatch(/redirect_localhost|redirect_private/);

    const big = "x".repeat(2000);
    const oversized = await fetchPublicDocument({
      url: "https://example.com/big",
      maxBytes: 100,
      fetchImpl: async () =>
        new Response(big, { status: 200, headers: { "Content-Type": "text/plain" } }),
    });
    expect(oversized.ok).toBe(false);
    if (!oversized.ok) expect(oversized.reason).toBe("oversized_response");
  });

  it("classifies sources and forbids snippet-only verified facts", () => {
    expect(classifyExternalSource({ url: "https://www.msc.com/ko/cruises" })).toBe("official");
    expect(classifyExternalSource({ url: "https://www.instagram.com/p/abc" })).toBe("public_social");
    expect(classifyExternalSource({ url: "https://blog.naver.com/foo/1" })).toBe("community");
    expect(sourceClassAllowsVerifiedFact("official")).toBe(true);
    expect(sourceClassAllowsVerifiedFact("community")).toBe(false);

    const findings = externalEvidenceToFindings({
      available: true,
      providerId: "tavily",
      queryCount: 1,
      resultCount: 1,
      fetchedDocumentCount: 0,
      failedFetchCount: 0,
      totalFetchedBytes: 0,
      officialSourceCount: 1,
      socialCommunitySourceCount: 0,
      runtimeMs: 1,
      queries: ["q"],
      evidence: [
        {
          evidenceId: "ext_1",
          url: "https://www.msc.com/ko",
          title: "MSC 공식",
          excerpt: "snippet only text about boarding",
          sourceClass: "official",
          fromSnippetOnly: true,
          query: "q",
          purpose: "factual_verification",
        },
      ],
      observedAudienceQuestions: [],
      observedCompetitorHooks: [],
      limitations: [],
    });
    expect(findings[0]?.type).toBe("observed_signal");
  });

  it("plans bounded Korean research queries from agenda", () => {
    const handoff = prepareManagerToContentHandoff(busanSelection(), {
      store: createInMemoryContentAssignmentStore(),
    });
    const plan = buildResearchQueryPlan({ handoff, editorial: editorial(), maxQueries: 6 });
    expect(plan.queries.length).toBeGreaterThan(0);
    expect(plan.queries.length).toBeLessThanOrEqual(6);
    expect(plan.queries.every((q) => q.language === "ko")).toBe(true);
    expect(plan.queries.some((q) => q.purpose === "factual_verification")).toBe(true);
    expect(plan.queries.some((q) => q.purpose === "audience_questions")).toBe(true);
    expect(plan.queries.some((q) => q.purpose === "competitor_content_gap")).toBe(true);
  });

  it("enforces query and document budgets", async () => {
    let searchCalls = 0;
    const provider: ResearchSearchProvider = {
      id: "mock",
      enabled: true,
      async search(query) {
        searchCalls += 1;
        return [
          {
            title: `Hit for ${query}`,
            url: `https://www.msc.com/page-${searchCalls}`,
            snippet: "공식 안내 snippet ".repeat(5),
            provider: "mock",
            rank: 1,
            publishedAt: null,
          },
        ];
      },
    };
    let fetchCalls = 0;
    const handoff = prepareManagerToContentHandoff(busanSelection(), {
      store: createInMemoryContentAssignmentStore(),
    });
    const bundle = await runBoundedExternalResearch({
      handoff,
      editorial: editorial(),
      searchProvider: provider,
      maxQueries: 3,
      maxResultsPerQuery: 2,
      maxDocuments: 2,
      fetchImpl: async (url) => {
        fetchCalls += 1;
        return new Response(`<html><body>공식 부산항 안내 ${String(url)}</body></html>`, {
          status: 200,
          headers: { "Content-Type": "text/html" },
        });
      },
    });
    expect(bundle.queryCount).toBeLessThanOrEqual(3);
    expect(searchCalls).toBeLessThanOrEqual(3);
    expect(bundle.fetchedDocumentCount).toBeLessThanOrEqual(2);
    expect(fetchCalls).toBeLessThanOrEqual(2);
    expect(bundle.available).toBe(true);
  });

  it("degrades to RA-1B when search disabled and still builds ACRB", async () => {
    const handoff = prepareManagerToContentHandoff(busanSelection(), {
      store: createInMemoryContentAssignmentStore(),
    });
    const bundle = await runBoundedExternalResearch({
      handoff,
      searchProvider: createDisabledSearchProvider("no_key"),
    });
    expect(bundle.available).toBe(false);
    const brief = buildDeterministicAcrb({
      gathered: {
        selectedAgenda: handoff.selectedAgenda,
        assignment: handoff.contentAssignment,
        evidencePack: handoff.evidencePack,
        compactBrief: null,
        compactCandidate: null,
        fullResearchBrief: null,
        editorial: editorial(),
        historicalMatches: [],
        semanticAvailable: false,
        nearDuplicate: false,
        cooledIdentity: false,
        externalResearch: bundle,
      },
    });
    expect(brief.sourceCoverage.externalWebSearch).toBe(false);
    expect(brief.researchVerdict).toBe("PROCEED_WITH_CAUTION");
  });

  it("enriches psychology/gaps from external sample without fabricating market saturation", () => {
    const handoff = prepareManagerToContentHandoff(busanSelection(), {
      store: createInMemoryContentAssignmentStore(),
    });
    const brief = buildDeterministicAcrb({
      gathered: {
        selectedAgenda: handoff.selectedAgenda,
        assignment: handoff.contentAssignment,
        evidencePack: handoff.evidencePack,
        compactBrief: null,
        compactCandidate: null,
        fullResearchBrief: null,
        editorial: editorial(),
        historicalMatches: [],
        semanticAvailable: false,
        nearDuplicate: false,
        cooledIdentity: false,
        externalResearch: {
          available: true,
          providerId: "tavily",
          queryCount: 3,
          resultCount: 4,
          fetchedDocumentCount: 1,
          failedFetchCount: 1,
          totalFetchedBytes: 1200,
          officialSourceCount: 0,
          socialCommunitySourceCount: 2,
          runtimeMs: 40,
          queries: ["부산 출발 크루즈 처음 탑승 준비"],
          evidence: [
            {
              evidenceId: "ext_social",
              url: "https://www.instagram.com/p/x",
              title: "탑승 동선 후기",
              excerpt: "처음이라 터미널 입구에서 헤맸어요",
              sourceClass: "public_social",
              fromSnippetOnly: false,
              query: "q",
              purpose: "audience_questions",
            },
          ],
          observedAudienceQuestions: ["터미널 입구는 어디인가요"],
          observedCompetitorHooks: ["선내 시설 투어"],
          limitations: ["no_official_sources_in_inspected_sample"],
        },
      },
    });
    expect(brief.sourceCoverage.externalWebSearch).toBe(true);
    expect(brief.audience.anxieties.some((a) => /탑승|준비/.test(a.text))).toBe(true);
    expect(brief.marketSignals.contentGaps.some((g) => /표본/.test(g.text))).toBe(true);
    expect(brief.researchFindings.some((f) => f.type === "verified_fact" && f.findingId.startsWith("ext_"))).toBe(
      false,
    );
    expect(brief.researchVerdict).toBe("PROCEED_WITH_CAUTION");
    expect(brief.provenance.externalResearchUsed).toBe(true);
  });

  it("penalizes generic angles and keeps 3–5 contract", () => {
    expect(isGenericAngleText("MSC 벨리시마 알아보기")).toBe(true);
    const gated = applyAngleQualityGate([
      angle({
        angleId: "weak",
        angle: "부산 출발 크루즈 소개",
        hook: "유용한 정보를 제공합니다",
        audienceTension: "",
        interestScore: 0.9,
        noveltyScore: 0.9,
      }),
      angle({
        angleId: "strong",
        angle: "첫 크루즈에서 배 안보다 출항 전에 더 헷갈리는 이유",
        hook: "터미널·수하물 질문이 반복되는 표본",
        audienceTension: "초보 탑승객의 출항 직전 동선 불안",
        interestScore: 0.6,
        noveltyScore: 0.55,
      }),
      angle({
        angleId: "mid",
        angle: "부모님과 부산 크루즈 탈 때 먼저 확인할 탑승 동선",
        hook: "여행상품보다 동선 확인",
        audienceTension: "가족 동반 첫 탑승 준비 부담",
      }),
      angle({
        angleId: "a4",
        angle: "추석 연휴 부산 출항 전 체크리스트 긴장",
        hook: "연휴 타이밍 준비 실수",
        audienceTension: "연휴 일정 확정 불안",
      }),
    ]);
    expect(gated.every((a) => a.angleId !== "weak" || a.interestScore < 0.5)).toBe(true);
    expect(gated.map((a) => a.angleId)).toContain("strong");
    expect(gated[0]?.angleId).not.toBe("weak");
    expect(gated.length).toBeGreaterThanOrEqual(3);
    expect(gated.length).toBeLessThanOrEqual(5);
  });

  it("LLM structured output merges once with repair, then deterministic fallback", async () => {
    const handoff = prepareManagerToContentHandoff(busanSelection(), {
      store: createInMemoryContentAssignmentStore(),
    });
    const skeletonBase = {
      selectedAgenda: handoff.selectedAgenda,
      assignment: handoff.contentAssignment,
      evidencePack: handoff.evidencePack,
      compactBrief: null,
      compactCandidate: null,
      fullResearchBrief: null,
      editorial: editorial(),
      historicalMatches: [],
      semanticAvailable: false,
      nearDuplicate: false,
      cooledIdentity: false,
      externalResearch: null,
    };
    const skeleton = buildDeterministicAcrb({ gathered: skeletonBase });
    let calls = 0;
    const ok = await synthesizeAudienceContentResearch({
      gathered: skeletonBase,
      invoke: async () => {
        calls += 1;
        if (calls === 1) return "not-json";
        return JSON.stringify({
          ...skeleton,
          researchVerdict: "PROCEED",
          contentAngles: skeleton.contentAngles,
        });
      },
    });
    expect(calls).toBe(2);
    expect(ok.provenance.synthesisMode).toBe("llm");
    // Without official resolution, PROCEED upgrade is blocked.
    expect(ok.researchVerdict).toBe("PROCEED_WITH_CAUTION");

    const failed = await synthesizeAudienceContentResearch({
      gathered: skeletonBase,
      invoke: async () => "still-bad",
    });
    expect(failed.provenance.synthesisMode).toBe("deterministic_fallback");
  });

  it("queue retry does not re-search when ACRB reused", async () => {
    const handoff = prepareManagerToContentHandoff(
      { ...busanSelection(), idempotencyKey: "acrb-ra1c-retry" },
      { store: createInMemoryContentAssignmentStore() },
    );
    const mprRepo = createInMemoryMarketingProductionRequestRepository();
    const logicalRunKey = "daily-marketing-production:2026-09-12:acrbra1cretry00000001";
    await mprRepo.enqueue(makeMpr(logicalRunKey));

    let searchCalls = 0;
    const provider: ResearchSearchProvider = {
      id: "mock",
      enabled: true,
      async search() {
        searchCalls += 1;
        return [];
      },
    };

    const first = await ensureAudienceContentResearch({
      handoff,
      logicalRunKey,
      productionRequestRepo: mprRepo,
      searchProvider: provider,
      listRecentCandidateTitles: async () => [],
    });
    expect(first.reused).toBe(false);
    expect(searchCalls).toBeGreaterThan(0);
    const afterFirst = searchCalls;

    const second = await ensureAudienceContentResearch({
      handoff,
      logicalRunKey,
      productionRequestRepo: mprRepo,
      searchProvider: provider,
      invoke: async () => {
        throw new Error("should_not_invoke");
      },
    });
    expect(second.reused).toBe(true);
    expect(searchCalls).toBe(afterFirst);
  });

  it("PROCEED only when official inspected evidence resolves limitations", () => {
    const handoff = prepareManagerToContentHandoff(busanSelection(), {
      store: createInMemoryContentAssignmentStore(),
    });
    const proceed = buildDeterministicAcrb({
      gathered: {
        selectedAgenda: handoff.selectedAgenda,
        assignment: {
          ...handoff.contentAssignment,
          evidenceRefs: [
            ...handoff.contentAssignment.evidenceRefs,
            {
              evidenceId: "official_1",
              sourceId: "official_src",
              sourceType: "official",
              sourceName: "Busan Port",
              isOfficial: true,
              evidenceType: "document",
              url: "https://www.busanpa.com/",
              reference: "port",
              excerpt: "부산항 국제여객터미널 안내",
              publishedAt: null,
              observedAt: "2026-09-09T15:10:00.000Z",
              credibilityHint: 0.9,
            },
          ],
        },
        evidencePack: handoff.evidencePack,
        compactBrief: null,
        compactCandidate: null,
        fullResearchBrief: null,
        editorial: editorial(),
        historicalMatches: [],
        semanticAvailable: true,
        nearDuplicate: false,
        cooledIdentity: false,
        externalResearch: {
          available: true,
          providerId: "tavily",
          queryCount: 2,
          resultCount: 2,
          fetchedDocumentCount: 1,
          failedFetchCount: 0,
          totalFetchedBytes: 800,
          officialSourceCount: 1,
          socialCommunitySourceCount: 0,
          runtimeMs: 30,
          queries: ["부산항 크루즈 터미널 공식"],
          evidence: [
            {
              evidenceId: "ext_official",
              url: "https://www.busanpa.com/kor/Main.do",
              title: "부산항만공사",
              excerpt: "국제여객터미널 이용 안내와 출항 관련 공지 ".repeat(3),
              sourceClass: "official",
              fromSnippetOnly: false,
              query: "부산항 크루즈 터미널 공식",
              purpose: "factual_verification",
            },
          ],
          observedAudienceQuestions: [],
          observedCompetitorHooks: ["시설 투어"],
          limitations: [],
        },
      },
    });
    expect(proceed.researchFindings.some((f) => f.type === "verified_fact")).toBe(true);
    expect(proceed.researchVerdict).toBe("PROCEED");
  });
});
