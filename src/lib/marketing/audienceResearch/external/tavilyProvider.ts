import type {
  ResearchSearchHit,
  ResearchSearchOptions,
  ResearchSearchProvider,
} from "@/lib/marketing/audienceResearch/external/searchProvider";

/**
 * Disabled / no-credential provider — returns empty results without network calls.
 */
export function createDisabledSearchProvider(
  reason = "search_provider_disabled",
): ResearchSearchProvider {
  return {
    id: "disabled",
    enabled: false,
    async search() {
      void reason;
      return [] as ResearchSearchHit[];
    },
  };
}

export type TavilySearchDeps = {
  apiKey: string;
  fetchImpl?: typeof fetch;
  endpoint?: string;
};

/**
 * Tavily Search API adapter.
 * Selected because Hermes ecosystem already documents Tavily-compatible web search,
 * Korean queries are supported, and results are structured JSON (no HTML SERP scraping).
 * Disabled when apiKey is empty.
 */
export function createTavilySearchProvider(deps: TavilySearchDeps): ResearchSearchProvider {
  const apiKey = deps.apiKey.trim();
  const endpoint = (deps.endpoint ?? "https://api.tavily.com/search").trim();
  const fetchImpl = deps.fetchImpl ?? fetch;

  if (!apiKey) {
    return createDisabledSearchProvider("tavily_api_key_missing");
  }

  return {
    id: "tavily",
    enabled: true,
    async search(query: string, options: ResearchSearchOptions = {}): Promise<ResearchSearchHit[]> {
      const q = query.trim();
      if (!q) return [];
      const maxResults = Math.min(Math.max(1, options.maxResults ?? 5), 8);
      const timeoutMs = options.timeoutMs ?? 12_000;
      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), timeoutMs);
      if (options.signal) {
        if (options.signal.aborted) controller.abort();
        else options.signal.addEventListener("abort", () => controller.abort(), { once: true });
      }

      try {
        const response = await fetchImpl(endpoint, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${apiKey}`,
          },
          body: JSON.stringify({
            query: q,
            max_results: maxResults,
            search_depth: "basic",
            include_answer: false,
            include_images: false,
            include_raw_content: false,
          }),
          signal: controller.signal,
        });

        if (response.status === 429) {
          throw new Error("tavily_rate_limited");
        }
        if (!response.ok) {
          throw new Error(`tavily_http_${response.status}`);
        }

        const raw = (await response.json()) as {
          results?: Array<{
            title?: unknown;
            url?: unknown;
            content?: unknown;
            published_date?: unknown;
          }>;
        };

        if (!raw || !Array.isArray(raw.results)) {
          throw new Error("tavily_malformed_response");
        }

        const hits: ResearchSearchHit[] = [];
        for (const [index, row] of raw.results.entries()) {
          const title = typeof row.title === "string" ? row.title.trim() : "";
          const url = typeof row.url === "string" ? row.url.trim() : "";
          const snippet = typeof row.content === "string" ? row.content.trim() : "";
          if (!url || !title) continue;
          hits.push({
            title: title.slice(0, 240),
            url,
            snippet: snippet.slice(0, 600),
            provider: "tavily",
            rank: index + 1,
            publishedAt:
              typeof row.published_date === "string" && row.published_date.trim()
                ? row.published_date.trim()
                : null,
          });
          if (hits.length >= maxResults) break;
        }
        return hits;
      } finally {
        clearTimeout(timer);
      }
    },
  };
}
