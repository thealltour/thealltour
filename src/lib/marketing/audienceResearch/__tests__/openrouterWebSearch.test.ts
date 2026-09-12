import { describe, expect, it, vi } from "vitest";

import { createResearchSearchProvider } from "@/lib/marketing/audienceResearch/external/createSearchProvider";
import {
  citationsToSearchHits,
  createOpenRouterWebSearchProvider,
  parseOpenRouterUrlCitations,
} from "@/lib/marketing/audienceResearch/external/openrouterProvider";
import { classifyExternalSource } from "@/lib/marketing/audienceResearch/external/sourceClassify";
import { externalEvidenceToFindings } from "@/lib/marketing/audienceResearch/external/runExternalResearch";

describe("RA-1C4 OpenRouter free-pool web search adapter", () => {
  it("enables openrouter when explicitly requested and key present", () => {
    const provider = createResearchSearchProvider({
      env: {
        RESEARCH_SEARCH_PROVIDER: "openrouter",
        OPENROUTER_API_KEY: "sk-or-test",
      },
    });
    expect(provider.enabled).toBe(true);
    expect(provider.id).toBe("openrouter_web_search");
  });

  it("degrades when openrouter requested without credential", () => {
    const provider = createResearchSearchProvider({
      env: { RESEARCH_SEARCH_PROVIDER: "openrouter" },
    });
    expect(provider.enabled).toBe(false);
  });

  it("parses url_citation annotations and ignores missing url", () => {
    const citations = parseOpenRouterUrlCitations({
      annotations: [
        {
          type: "url_citation",
          url_citation: {
            url: "https://www.msc.com/ko",
            title: "MSC",
            content: "snippet",
            start_index: 0,
            end_index: 3,
          },
        },
        { type: "url_citation", url_citation: { title: "no url" } },
        { type: "other" },
      ],
    });
    expect(citations).toHaveLength(1);
    expect(citations[0]?.url).toContain("msc.com");
    const hits = citationsToSearchHits(citations);
    expect(hits[0]?.provider).toBe("openrouter_web_search");
    expect(hits[0]?.publishedAt).toBeNull();
  });

  it("rejects paid model ids", () => {
    expect(() =>
      createOpenRouterWebSearchProvider({
        apiKey: "sk-or-test",
        model: "openai/gpt-4o",
      }),
    ).toThrow(/paid_model_forbidden/);
  });

  it("does not treat model official wording as official class", () => {
    expect(
      classifyExternalSource({
        url: "https://www.hanatour.com/package/cruise",
        title: "파트너 상품 안내",
        snippet: "this is an official source / 공식 출처입니다",
      }),
    ).not.toBe("official");
  });

  it("keeps snippet-only official as observed_signal", () => {
    const findings = externalEvidenceToFindings({
      available: true,
      providerId: "openrouter_web_search",
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
          excerpt: "탑승 09:00",
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

  it("handles 403/429 and parses successful server-tool response", async () => {
    const forbidden = createOpenRouterWebSearchProvider({
      apiKey: "sk-or-test",
      preferDeprecatedWebPlugin: false,
      fetchImpl: async () =>
        new Response(JSON.stringify({ error: { message: "Key limit exceeded", code: 403 } }), {
          status: 403,
        }),
    });
    await expect(forbidden.search("부산 크루즈")).rejects.toThrow(/forbidden/);

    const rateLimited = createOpenRouterWebSearchProvider({
      apiKey: "sk-or-test",
      fetchImpl: async () => new Response("{}", { status: 429 }),
    });
    await expect(rateLimited.search("부산 크루즈")).rejects.toThrow(/rate_limited/);

    const usage = vi.fn();
    const ok = createOpenRouterWebSearchProvider({
      apiKey: "sk-or-test",
      onUsage: usage,
      fetchImpl: async () =>
        new Response(
          JSON.stringify({
            model: "nex-agi/nex-n2.5-pro:free",
            usage: {
              prompt_tokens: 10,
              completion_tokens: 20,
              total_tokens: 30,
              cost: 0.007,
              cost_details: { upstream_inference_cost: 0 },
              server_tool_use_details: { web_search_requests: 1 },
            },
            choices: [
              {
                message: {
                  content: "요약",
                  annotations: [
                    {
                      type: "url_citation",
                      url_citation: {
                        url: "https://www.busanpa.com/",
                        title: "부산항",
                        content: "터미널 안내",
                      },
                    },
                  ],
                },
              },
            ],
          }),
          { status: 200, headers: { "Content-Type": "application/json" } },
        ),
    });
    const hits = await ok.search("부산 출발 크루즈 처음 탑승 준비", { maxResults: 5 });
    expect(hits).toHaveLength(1);
    expect(hits[0]?.url).toContain("busanpa.com");
    expect(usage).toHaveBeenCalled();
    expect(usage.mock.calls[0]?.[0]?.webSearchRequests).toBe(1);
    expect(usage.mock.calls[0]?.[0]?.upstreamInferenceCost).toBe(0);
  });

  it("falls back from deprecated plugin 403 to server tool without paid model", async () => {
    let calls = 0;
    const provider = createOpenRouterWebSearchProvider({
      apiKey: "sk-or-test",
      preferDeprecatedWebPlugin: true,
      fetchImpl: async (_url, init) => {
        calls += 1;
        const body = JSON.parse(String(init?.body || "{}")) as {
          plugins?: unknown;
          tools?: unknown;
          model?: string;
        };
        expect(body.model).toBe("openrouter/free");
        if (calls === 1) {
          expect(body.plugins).toBeTruthy();
          return new Response(JSON.stringify({ error: { message: "Key limit exceeded", code: 403 } }), {
            status: 403,
          });
        }
        expect(body.tools).toBeTruthy();
        return new Response(
          JSON.stringify({
            model: "poolside/laguna-xs-2.1:free",
            usage: { cost: 0.007, cost_details: { upstream_inference_cost: 0 } },
            choices: [
              {
                message: {
                  annotations: [
                    {
                      type: "url_citation",
                      url_citation: { url: "https://example.com/a", title: "A", content: "c" },
                    },
                  ],
                },
              },
            ],
          }),
          { status: 200 },
        );
      },
    });
    const hits = await provider.search("부산 여행");
    expect(calls).toBe(2);
    expect(hits).toHaveLength(1);
  });
});
