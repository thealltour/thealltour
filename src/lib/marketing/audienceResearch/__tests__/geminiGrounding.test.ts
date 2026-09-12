import { describe, expect, it } from "vitest";

import { createResearchSearchProvider } from "@/lib/marketing/audienceResearch/external/createSearchProvider";
import {
  createGeminiGoogleSearchProvider,
  groundingChunksToSearchHits,
  normalizeGeminiGroundingMetadata,
} from "@/lib/marketing/audienceResearch/external/geminiProvider";
import {
  looksLikeUnsupportedPerformancePrediction,
  sanitizeResearchFindingText,
} from "@/lib/marketing/audienceResearch/external/researchGuards";
import { classifyExternalSource } from "@/lib/marketing/audienceResearch/external/sourceClassify";
import { externalEvidenceToFindings } from "@/lib/marketing/audienceResearch/external/runExternalResearch";

describe("RA-1C3 Gemini Google Search Grounding adapter", () => {
  it("enables openrouter as auto primary when OpenRouter key present", () => {
    const provider = createResearchSearchProvider({
      env: {
        OPENROUTER_API_KEY: "sk-or-test",
        GOOGLE_GENERATIVE_AI_API_KEY: "g-key",
      },
    });
    expect(provider.enabled).toBe(true);
    expect(provider.id).toBe("openrouter_web_search");
  });

  it("enables gemini as auto primary when Google AI key present", () => {
    const provider = createResearchSearchProvider({
      env: { GOOGLE_GENERATIVE_AI_API_KEY: "test-key" },
    });
    expect(provider.enabled).toBe(true);
    expect(provider.id).toBe("gemini_google_search");
  });

  it("falls back to tavily when gemini missing but tavily configured", () => {
    const provider = createResearchSearchProvider({
      env: { TAVILY_API_KEY: "tvly-test", RESEARCH_SEARCH_PROVIDER: "auto" },
    });
    expect(provider.enabled).toBe(true);
    expect(provider.id).toBe("tavily");
  });

  it("degrades without any search credentials", () => {
    const provider = createResearchSearchProvider({ env: {} });
    expect(provider.enabled).toBe(false);
  });

  it("does not require Tavily key when Gemini is primary", () => {
    const provider = createResearchSearchProvider({
      env: { GOOGLE_GENERATIVE_AI_API_KEY: "test-key" },
    });
    expect(provider.id).toBe("gemini_google_search");
  });

  it("normalizes groundingMetadata into URL hits without inventing fields", () => {
    const normalized = normalizeGeminiGroundingMetadata({
      modelAnswer: "부산항 안내가 공개되어 있습니다.",
      groundingMetadata: {
        webSearchQueries: ["부산 크루즈 터미널"],
        groundingChunks: [
          { web: { uri: "https://www.busanpa.com/kor/Main.do", title: "부산항만공사" } },
          { web: { uri: "https://partner-agency.example/cruise", title: "여행사 상품" } },
          { web: { title: "missing uri" } },
        ],
        groundingSupports: [
          {
            segment: { text: "국제여객터미널 이용 안내" },
            groundingChunkIndices: [0],
          },
        ],
      },
    });
    expect(normalized.googleSearchUsed).toBe(true);
    expect(normalized.chunks).toHaveLength(2);
    expect(normalized.chunks[0]?.uri).toContain("busanpa.com");
    expect(normalized.chunks[0]?.supportText).toContain("국제여객터미널");
    const hits = groundingChunksToSearchHits(normalized);
    expect(hits[0]?.provider).toBe("gemini_google_search");
    expect(hits[0]?.publishedAt).toBeNull();
  });

  it("classifier remains authoritative over model official wording", () => {
    const partner = classifyExternalSource({
      url: "https://www.hanatour.com/package/cruise",
      title: "공식 크루즈 안내",
      snippet: "this is an official source",
    });
    expect(partner).not.toBe("official");
    expect(classifyExternalSource({ url: "https://www.msc.com/ko" })).toBe("official");
  });

  it("snippet-only official URL stays observed_signal, not verified_fact", () => {
    const findings = externalEvidenceToFindings({
      available: true,
      providerId: "gemini_google_search",
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
          title: "MSC",
          excerpt: "탑승 시간 09:00 snippet",
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

  it("downgrades unsupported performance predictions to hypothesis", () => {
    expect(looksLikeUnsupportedPerformancePrediction("스크랩이 폭발한다")).toBe(true);
    const sanitized = sanitizeResearchFindingText("검색 유입이 폭발한다");
    expect(sanitized.downgraded).toBe(true);
    const findings = externalEvidenceToFindings({
      available: true,
      providerId: "gemini_google_search",
      queryCount: 1,
      resultCount: 1,
      fetchedDocumentCount: 1,
      failedFetchCount: 0,
      totalFetchedBytes: 100,
      officialSourceCount: 0,
      socialCommunitySourceCount: 1,
      runtimeMs: 1,
      queries: ["q"],
      evidence: [
        {
          evidenceId: "ext_perf",
          url: "https://blog.naver.com/x/1",
          title: "후기",
          excerpt: "스크랩이 폭발한다 수준의 반응",
          sourceClass: "community",
          fromSnippetOnly: false,
          query: "q",
          purpose: "competitor_content_gap",
        },
      ],
      observedAudienceQuestions: [],
      observedCompetitorHooks: [],
      limitations: [],
    });
    expect(findings[0]?.type).toBe("hypothesis");
    expect(findings[0]?.provenanceNote).toContain("unsupported_performance_prediction");
  });

  it("handles 429 / malformed / empty grounding isolation", async () => {
    const rateLimited = createGeminiGoogleSearchProvider({
      apiKey: "test-key",
      fetchImpl: async () => new Response("{}", { status: 429 }),
    });
    await expect(rateLimited.search("부산 크루즈")).rejects.toThrow(/rate_limited/);

    const malformed = createGeminiGoogleSearchProvider({
      apiKey: "test-key",
      fetchImpl: async () =>
        new Response(JSON.stringify({ candidates: [] }), {
          status: 200,
          headers: { "Content-Type": "application/json" },
        }),
    });
    await expect(malformed.search("부산 크루즈")).rejects.toThrow(/malformed/);

    const noGrounding = createGeminiGoogleSearchProvider({
      apiKey: "test-key",
      fetchImpl: async () =>
        new Response(
          JSON.stringify({
            candidates: [{ content: { parts: [{ text: "답변만" }] } }],
          }),
          { status: 200, headers: { "Content-Type": "application/json" } },
        ),
    });
    await expect(noGrounding.search("부산 크루즈")).resolves.toEqual([]);
  });

  it("parses successful grounding response into bounded hits", async () => {
    const provider = createGeminiGoogleSearchProvider({
      apiKey: "test-key",
      fetchImpl: async () =>
        new Response(
          JSON.stringify({
            candidates: [
              {
                content: { parts: [{ text: "요약" }] },
                groundingMetadata: {
                  webSearchQueries: ["부산 출발 크루즈"],
                  groundingChunks: [
                    { web: { uri: "https://www.msc.com/ko", title: "MSC" } },
                    { web: { uri: "https://www.busanpa.com/", title: "Busan Port" } },
                    { web: { uri: "https://blog.naver.com/a/1", title: "후기" } },
                    { web: { uri: "https://example.com/4", title: "4" } },
                    { web: { uri: "https://example.com/5", title: "5" } },
                    { web: { uri: "https://example.com/6", title: "6" } },
                  ],
                },
              },
            ],
          }),
          { status: 200, headers: { "Content-Type": "application/json" } },
        ),
    });
    const hits = await provider.search("부산 출발 크루즈 처음 탑승 준비", { maxResults: 5 });
    expect(hits).toHaveLength(5);
    expect(hits.every((h) => h.url.startsWith("http"))).toBe(true);
  });
});
