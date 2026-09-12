import type {
  ResearchSearchHit,
  ResearchSearchOptions,
  ResearchSearchProvider,
} from "@/lib/marketing/audienceResearch/external/searchProvider";
import { createDisabledSearchProvider } from "@/lib/marketing/audienceResearch/external/tavilyProvider";

export const DEFAULT_GEMINI_RESEARCH_MODEL = "gemini-3.5-flash-lite" as const;

export type GeminiGroundingChunk = {
  uri: string;
  title: string;
  supportText: string | null;
};

export type GeminiGroundingNormalized = {
  modelAnswer: string;
  webSearchQueries: string[];
  chunks: GeminiGroundingChunk[];
  rawGroundingKeys: string[];
  googleSearchUsed: boolean;
};

export type GeminiGoogleSearchDeps = {
  apiKey: string;
  model?: string;
  fetchImpl?: typeof fetch;
  endpointBase?: string;
};

function resolveGeminiEndpoint(base: string, model: string): string {
  return `${base.replace(/\/$/, "")}/models/${encodeURIComponent(model)}:generateContent`;
}

/**
 * Normalize Gemini generateContent + groundingMetadata into research hits.
 * Does not invent title/url; skips chunks without usable URI.
 */
export function normalizeGeminiGroundingMetadata(input: {
  modelAnswer?: string;
  groundingMetadata?: unknown;
}): GeminiGroundingNormalized {
  const gm =
    input.groundingMetadata && typeof input.groundingMetadata === "object"
      ? (input.groundingMetadata as Record<string, unknown>)
      : null;
  const webSearchQueries = Array.isArray(gm?.webSearchQueries)
    ? gm!.webSearchQueries.filter((q): q is string => typeof q === "string" && q.trim().length > 0)
    : [];
  const rawChunks = Array.isArray(gm?.groundingChunks) ? gm!.groundingChunks : [];
  const supports = Array.isArray(gm?.groundingSupports) ? gm!.groundingSupports : [];

  const supportByIndex = new Map<number, string>();
  for (const row of supports) {
    if (!row || typeof row !== "object") continue;
    const support = row as {
      segment?: { text?: unknown };
      groundingChunkIndices?: unknown;
    };
    const text =
      typeof support.segment?.text === "string" ? support.segment.text.trim().slice(0, 400) : "";
    const indices = Array.isArray(support.groundingChunkIndices)
      ? support.groundingChunkIndices.filter((i): i is number => typeof i === "number")
      : [];
    for (const idx of indices) {
      if (!supportByIndex.has(idx) && text) supportByIndex.set(idx, text);
    }
  }

  const chunks: GeminiGroundingChunk[] = [];
  for (const [index, row] of rawChunks.entries()) {
    if (!row || typeof row !== "object") continue;
    const web = (row as { web?: { uri?: unknown; title?: unknown } }).web;
    const uri = typeof web?.uri === "string" ? web.uri.trim() : "";
    const title = typeof web?.title === "string" ? web.title.trim() : "";
    if (!uri) continue;
    chunks.push({
      uri,
      title: title || uri,
      supportText: supportByIndex.get(index) ?? null,
    });
  }

  return {
    modelAnswer: (input.modelAnswer ?? "").trim(),
    webSearchQueries,
    chunks,
    rawGroundingKeys: gm ? Object.keys(gm) : [],
    googleSearchUsed: Boolean(gm) && (chunks.length > 0 || webSearchQueries.length > 0),
  };
}

export function groundingChunksToSearchHits(
  normalized: GeminiGroundingNormalized,
  providerId = "gemini_google_search",
): ResearchSearchHit[] {
  return normalized.chunks.map((chunk, index) => ({
    title: chunk.title.slice(0, 240),
    url: chunk.uri,
    snippet: (chunk.supportText || normalized.modelAnswer.slice(0, 280) || chunk.title).slice(0, 600),
    provider: providerId,
    rank: index + 1,
    publishedAt: null,
  }));
}

/**
 * Gemini Google Search Grounding adapter for RA-1C ResearchSearchProvider.
 * Uses generateContent + tools.google_search. Source class is NOT inferred here.
 */
export function createGeminiGoogleSearchProvider(
  deps: GeminiGoogleSearchDeps,
): ResearchSearchProvider {
  const apiKey = deps.apiKey.trim();
  const model = (deps.model ?? DEFAULT_GEMINI_RESEARCH_MODEL).trim() || DEFAULT_GEMINI_RESEARCH_MODEL;
  const endpointBase = (
    deps.endpointBase ??
    process.env.GEMINI_API_BASE_URL?.trim() ??
    "https://generativelanguage.googleapis.com/v1beta"
  ).trim();
  const fetchImpl = deps.fetchImpl ?? fetch;

  if (!apiKey) {
    return createDisabledSearchProvider("gemini_api_key_missing");
  }

  return {
    id: "gemini_google_search",
    enabled: true,
    async search(query: string, options: ResearchSearchOptions = {}): Promise<ResearchSearchHit[]> {
      const q = query.trim();
      if (!q) return [];
      const maxResults = Math.min(Math.max(1, options.maxResults ?? 5), 8);
      const timeoutMs = options.timeoutMs ?? 45_000;
      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), timeoutMs);
      if (options.signal) {
        if (options.signal.aborted) controller.abort();
        else options.signal.addEventListener("abort", () => controller.abort(), { once: true });
      }

      try {
        const response = await fetchImpl(resolveGeminiEndpoint(endpointBase, model), {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "x-goog-api-key": apiKey,
          },
          body: JSON.stringify({
            contents: [
              {
                role: "user",
                parts: [
                  {
                    text: [
                      "You are assisting Audience & Content Research.",
                      "Use Google Search. Return factual, source-backed notes for the query.",
                      "Do not invent official policies, boarding times, prices, or marketing performance claims.",
                      "Prefer citing public URLs.",
                      `Query: ${q}`,
                    ].join("\n"),
                  },
                ],
              },
            ],
            tools: [{ google_search: {} }],
          }),
          signal: controller.signal,
        });

        if (response.status === 429) {
          throw new Error("gemini_search_rate_limited");
        }
        if (!response.ok) {
          throw new Error(`gemini_http_${response.status}`);
        }

        const raw = (await response.json()) as {
          candidates?: Array<{
            content?: { parts?: Array<{ text?: unknown }> };
            groundingMetadata?: unknown;
          }>;
          error?: { message?: unknown };
        };

        if (!raw || !Array.isArray(raw.candidates) || raw.candidates.length === 0) {
          throw new Error("gemini_malformed_response");
        }

        const candidate = raw.candidates[0];
        const modelAnswer = (candidate?.content?.parts ?? [])
          .map((p) => (typeof p.text === "string" ? p.text : ""))
          .join("\n")
          .trim();
        const normalized = normalizeGeminiGroundingMetadata({
          modelAnswer,
          groundingMetadata: candidate?.groundingMetadata,
        });

        if (!normalized.googleSearchUsed && normalized.chunks.length === 0) {
          // Model answered without grounding metadata — not usable as web search hits.
          return [];
        }

        return groundingChunksToSearchHits(normalized).slice(0, maxResults);
      } finally {
        clearTimeout(timer);
      }
    },
  };
}

export function resolveGeminiResearchApiKey(
  env: NodeJS.ProcessEnv | Record<string, string | undefined> = process.env,
): { apiKey: string; envName: string | null } {
  const candidates = [
    "GOOGLE_GENERATIVE_AI_API_KEY",
    "GEMINI_API_KEY",
    "GOOGLE_API_KEY",
  ] as const;
  for (const name of candidates) {
    const value = env[name]?.trim() || "";
    if (value) return { apiKey: value, envName: name };
  }
  return { apiKey: "", envName: null };
}
