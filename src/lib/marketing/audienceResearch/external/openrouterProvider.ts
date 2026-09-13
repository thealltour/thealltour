import type {
  ResearchSearchHit,
  ResearchSearchOptions,
  ResearchSearchProvider,
} from "@/lib/marketing/audienceResearch/external/searchProvider";
import { createDisabledSearchProvider } from "@/lib/marketing/audienceResearch/external/tavilyProvider";
import { EXTERNAL_SEARCH_PER_QUERY_TIMEOUT_MS } from "@/lib/marketing/audienceResearch/external/researchPolicy";

export const OPENROUTER_FREE_MODEL = "openrouter/free" as const;
export const OPENROUTER_DEFAULT_BASE = "https://openrouter.ai/api/v1" as const;

export type OpenRouterUrlCitation = {
  url: string;
  title: string;
  content: string | null;
  startIndex: number | null;
  endIndex: number | null;
};

export type OpenRouterWebSearchUsageSnapshot = {
  promptTokens: number | null;
  completionTokens: number | null;
  totalTokens: number | null;
  cost: number | null;
  upstreamInferenceCost: number | null;
  webSearchRequests: number | null;
  actualModel: string | null;
  provider: string | null;
};

export type OpenRouterWebSearchDeps = {
  apiKey: string;
  /** Must remain a free-pool id for RA-1C4 acceptance. */
  model?: string;
  fetchImpl?: typeof fetch;
  endpointBase?: string;
  maxResults?: number;
  /**
   * Prefer deprecated plugins web first (explicit RA-1C4 smoke form).
   * If rejected, fall back to openrouter:web_search server tool (same free model).
   */
  preferDeprecatedWebPlugin?: boolean;
  httpReferer?: string;
  appTitle?: string;
  onUsage?: (usage: OpenRouterWebSearchUsageSnapshot) => void;
};

function asRecord(value: unknown): Record<string, unknown> | null {
  return value && typeof value === "object" ? (value as Record<string, unknown>) : null;
}

export function parseOpenRouterUrlCitations(message: unknown): OpenRouterUrlCitation[] {
  const msg = asRecord(message);
  const annotations = Array.isArray(msg?.annotations) ? msg!.annotations : [];
  const out: OpenRouterUrlCitation[] = [];
  for (const ann of annotations) {
    const row = asRecord(ann);
    if (!row) continue;
    const nested = asRecord(row.url_citation);
    const url =
      (typeof nested?.url === "string" && nested.url.trim()) ||
      (typeof row.url === "string" && row.url.trim()) ||
      "";
    if (!url) continue;
    const title =
      (typeof nested?.title === "string" && nested.title.trim()) ||
      (typeof row.title === "string" && row.title.trim()) ||
      url;
    const contentRaw =
      (typeof nested?.content === "string" && nested.content) ||
      (typeof row.content === "string" && row.content) ||
      null;
    out.push({
      url,
      title: title.slice(0, 240),
      content: contentRaw ? contentRaw.slice(0, 600) : null,
      startIndex: typeof nested?.start_index === "number" ? nested.start_index : null,
      endIndex: typeof nested?.end_index === "number" ? nested.end_index : null,
    });
  }
  return out;
}

export function citationsToSearchHits(
  citations: OpenRouterUrlCitation[],
  providerId = "openrouter_web_search",
): ResearchSearchHit[] {
  return citations.map((c, index) => ({
    title: c.title,
    url: c.url,
    snippet: (c.content || c.title).slice(0, 600),
    provider: providerId,
    rank: index + 1,
    publishedAt: null,
  }));
}

function extractUsageSnapshot(payload: Record<string, unknown>): OpenRouterWebSearchUsageSnapshot {
  const usage = asRecord(payload.usage);
  const costDetails = asRecord(usage?.cost_details);
  const serverTools = asRecord(usage?.server_tool_use_details);
  return {
    promptTokens: typeof usage?.prompt_tokens === "number" ? usage.prompt_tokens : null,
    completionTokens: typeof usage?.completion_tokens === "number" ? usage.completion_tokens : null,
    totalTokens: typeof usage?.total_tokens === "number" ? usage.total_tokens : null,
    cost: typeof usage?.cost === "number" ? usage.cost : null,
    upstreamInferenceCost:
      typeof costDetails?.upstream_inference_cost === "number"
        ? costDetails.upstream_inference_cost
        : null,
    webSearchRequests:
      typeof serverTools?.web_search_requests === "number"
        ? serverTools.web_search_requests
        : null,
    actualModel: typeof payload.model === "string" ? payload.model : null,
    provider: typeof payload.provider === "string" ? payload.provider : null,
  };
}

function assertFreePoolModel(model: string): void {
  const m = model.trim().toLowerCase();
  if (!(m === "openrouter/free" || m.endsWith(":free"))) {
    throw new Error(`openrouter_paid_model_forbidden:${model}`);
  }
}

async function postChatCompletions(input: {
  endpointBase: string;
  apiKey: string;
  body: Record<string, unknown>;
  fetchImpl: typeof fetch;
  timeoutMs: number;
  signal?: AbortSignal;
  httpReferer: string;
  appTitle: string;
}): Promise<{ status: number; json: Record<string, unknown> }> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), input.timeoutMs);
  if (input.signal) {
    if (input.signal.aborted) controller.abort();
    else input.signal.addEventListener("abort", () => controller.abort(), { once: true });
  }
  try {
    const response = await input.fetchImpl(
      `${input.endpointBase.replace(/\/$/, "")}/chat/completions`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${input.apiKey}`,
          "HTTP-Referer": input.httpReferer,
          "X-Title": input.appTitle,
        },
        body: JSON.stringify(input.body),
        signal: controller.signal,
      },
    );
    const json = (await response.json().catch(() => ({}))) as Record<string, unknown>;
    return { status: response.status, json };
  } finally {
    clearTimeout(timer);
  }
}

/**
 * OpenRouter free-pool web search adapter for RA-1C ResearchSearchProvider.
 * Free inference via openrouter/free; web search may incur non-zero plugin/tool cost.
 */
export function createOpenRouterWebSearchProvider(
  deps: OpenRouterWebSearchDeps,
): ResearchSearchProvider {
  const apiKey = deps.apiKey.trim();
  const model = (deps.model ?? OPENROUTER_FREE_MODEL).trim() || OPENROUTER_FREE_MODEL;
  assertFreePoolModel(model);
  const endpointBase = (deps.endpointBase ?? OPENROUTER_DEFAULT_BASE).trim();
  const fetchImpl = deps.fetchImpl ?? fetch;
  const defaultMaxResults = Math.min(Math.max(1, deps.maxResults ?? 5), 8);
  const preferPlugin = deps.preferDeprecatedWebPlugin ?? false;
  const httpReferer =
    deps.httpReferer ??
    process.env.OPENROUTER_HTTP_REFERER?.trim() ??
    "https://thealltour.local";
  const appTitle =
    deps.appTitle ?? process.env.OPENROUTER_APP_TITLE?.trim() ?? "thealltour-ra1-research";

  if (!apiKey) {
    return createDisabledSearchProvider("openrouter_api_key_missing");
  }

  return {
    id: "openrouter_web_search",
    enabled: true,
    async search(query: string, options: ResearchSearchOptions = {}): Promise<ResearchSearchHit[]> {
      const q = query.trim();
      if (!q) return [];
      const maxResults = Math.min(Math.max(1, options.maxResults ?? defaultMaxResults), 8);
      const timeoutMs = options.timeoutMs ?? EXTERNAL_SEARCH_PER_QUERY_TIMEOUT_MS;
      const userContent = [
        "You are assisting Audience & Content Research.",
        "You MUST use web search for this query before answering.",
        "Do not invent official policies, boarding times, prices, or marketing performance claims.",
        "Prefer citing public URLs.",
        `Query: ${q}`,
      ].join("\n");

      const common = {
        model,
        messages: [{ role: "user", content: userContent }],
        max_tokens: 900,
      };

      let status = 0;
      let json: Record<string, unknown> = {};

      if (preferPlugin) {
        const pluginAttempt = await postChatCompletions({
          endpointBase,
          apiKey,
          fetchImpl,
          timeoutMs,
          signal: options.signal,
          httpReferer,
          appTitle,
          body: {
            ...common,
            plugins: [{ id: "web", max_results: maxResults }],
          },
        });
        status = pluginAttempt.status;
        json = pluginAttempt.json;
        if (!pluginAttempt.status || pluginAttempt.status >= 400) {
          // Fall back to server tool on same free model — not a paid model swap.
          const toolAttempt = await postChatCompletions({
            endpointBase,
            apiKey,
            fetchImpl,
            timeoutMs,
            signal: options.signal,
            httpReferer,
            appTitle,
            body: {
              ...common,
              tools: [
                {
                  type: "openrouter:web_search",
                  parameters: { max_results: maxResults },
                },
              ],
            },
          });
          status = toolAttempt.status;
          json = toolAttempt.json;
        }
      } else {
        const toolAttempt = await postChatCompletions({
          endpointBase,
          apiKey,
          fetchImpl,
          timeoutMs,
          signal: options.signal,
          httpReferer,
          appTitle,
          body: {
            ...common,
            tools: [
              {
                type: "openrouter:web_search",
                parameters: { max_results: maxResults },
              },
            ],
          },
        });
        status = toolAttempt.status;
        json = toolAttempt.json;
      }

      if (status === 429) throw new Error("openrouter_rate_limited");
      if (status === 403) {
        const err = asRecord(json.error);
        const msg = String(err?.message || "forbidden").replace(/keys\/[a-f0-9]{16,}/gi, "keys/<redacted>");
        throw new Error(`openrouter_forbidden:${msg.slice(0, 160)}`);
      }
      if (status >= 400) throw new Error(`openrouter_http_${status}`);

      const actualModel = typeof json.model === "string" ? json.model : model;
      if (!String(actualModel).toLowerCase().includes(":free") && actualModel !== "openrouter/free") {
        // openrouter/free resolves to concrete *:free models — require :free marker.
        if (!String(actualModel).toLowerCase().endsWith(":free")) {
          throw new Error(`openrouter_non_free_model_selected:${actualModel}`);
        }
      }

      const usage = extractUsageSnapshot(json);
      deps.onUsage?.(usage);

      const choices = Array.isArray(json.choices) ? json.choices : [];
      const message = asRecord(asRecord(choices[0])?.message);
      const citations = parseOpenRouterUrlCitations(message);
      return citationsToSearchHits(citations).slice(0, maxResults);
    },
  };
}

export function resolveOpenRouterApiKey(
  env: NodeJS.ProcessEnv | Record<string, string | undefined> = process.env,
): { apiKey: string; envName: string | null } {
  const key = env.OPENROUTER_API_KEY?.trim() || "";
  return { apiKey: key, envName: key ? "OPENROUTER_API_KEY" : null };
}
