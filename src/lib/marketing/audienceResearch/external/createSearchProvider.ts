import type {
  ResearchSearchProvider,
  ResearchSearchProviderStatus,
} from "@/lib/marketing/audienceResearch/external/searchProvider";
import {
  createGeminiGoogleSearchProvider,
  DEFAULT_GEMINI_RESEARCH_MODEL,
  resolveGeminiResearchApiKey,
} from "@/lib/marketing/audienceResearch/external/geminiProvider";
import {
  createOpenRouterWebSearchProvider,
  OPENROUTER_FREE_MODEL,
  resolveOpenRouterApiKey,
} from "@/lib/marketing/audienceResearch/external/openrouterProvider";
import {
  createDisabledSearchProvider,
  createTavilySearchProvider,
} from "@/lib/marketing/audienceResearch/external/tavilyProvider";

function flagDisabled(env: NodeJS.ProcessEnv | Record<string, string | undefined>): boolean {
  const enabledFlag = (env.MARKETING_RESEARCH_SEARCH_ENABLED ?? "true").trim().toLowerCase();
  return enabledFlag === "0" || enabledFlag === "false" || enabledFlag === "off";
}

/**
 * Provider resolution for RA-1C4.
 *
 * RESEARCH_SEARCH_PROVIDER:
 *   auto | openrouter | openrouter_web_search | gemini | gemini_google_search | tavily | disabled
 *
 * Auto priority (RA-1C4 accepted):
 *   OpenRouter web (free pool + server tool) → Gemini grounding → Tavily → disabled
 */
export function resolveResearchSearchProviderStatus(
  env: NodeJS.ProcessEnv | Record<string, string | undefined> = process.env,
): ResearchSearchProviderStatus {
  if (flagDisabled(env)) {
    return {
      providerId: "disabled",
      enabled: false,
      credentialPresent: false,
      reason: "marketing_research_search_disabled",
    };
  }

  const requested = (env.RESEARCH_SEARCH_PROVIDER ?? "auto").trim().toLowerCase() || "auto";
  const openrouter = resolveOpenRouterApiKey(env);
  const gemini = resolveGeminiResearchApiKey(env);
  const tavilyKey = env.TAVILY_API_KEY?.trim() || env.RESEARCH_SEARCH_API_KEY?.trim() || "";

  if (requested === "disabled" || requested === "none") {
    return {
      providerId: "disabled",
      enabled: false,
      credentialPresent: false,
      reason: "provider_explicitly_disabled",
    };
  }

  if (requested === "openrouter" || requested === "openrouter_web_search") {
    return {
      providerId: "openrouter_web_search",
      enabled: Boolean(openrouter.apiKey),
      credentialPresent: Boolean(openrouter.apiKey),
      reason: openrouter.apiKey ? null : "openrouter_api_key_missing",
    };
  }

  if (requested === "tavily") {
    return {
      providerId: "tavily",
      enabled: Boolean(tavilyKey),
      credentialPresent: Boolean(tavilyKey),
      reason: tavilyKey ? null : "tavily_api_key_missing",
    };
  }

  if (requested === "gemini" || requested === "gemini_google_search") {
    return {
      providerId: "gemini_google_search",
      enabled: Boolean(gemini.apiKey),
      credentialPresent: Boolean(gemini.apiKey),
      reason: gemini.apiKey ? null : "gemini_api_key_missing",
    };
  }

  // auto — RA-1C4: OpenRouter free-pool web search primary when key present.
  if (openrouter.apiKey) {
    return {
      providerId: "openrouter_web_search",
      enabled: true,
      credentialPresent: true,
      reason: null,
    };
  }
  if (gemini.apiKey) {
    return {
      providerId: "gemini_google_search",
      enabled: true,
      credentialPresent: true,
      reason: null,
    };
  }
  if (tavilyKey) {
    return {
      providerId: "tavily",
      enabled: true,
      credentialPresent: true,
      reason: null,
    };
  }
  return {
    providerId: "disabled",
    enabled: false,
    credentialPresent: false,
    reason: "no_search_provider_credentials",
  };
}

export function createResearchSearchProvider(input?: {
  env?: NodeJS.ProcessEnv | Record<string, string | undefined>;
  fetchImpl?: typeof fetch;
  onOpenRouterUsage?: Parameters<typeof createOpenRouterWebSearchProvider>[0]["onUsage"];
}): ResearchSearchProvider {
  const env = input?.env ?? process.env;
  const status = resolveResearchSearchProviderStatus(env);
  if (!status.enabled) {
    return createDisabledSearchProvider(status.reason ?? "disabled");
  }

  if (status.providerId === "openrouter_web_search") {
    const { apiKey } = resolveOpenRouterApiKey(env);
    return createOpenRouterWebSearchProvider({
      apiKey,
      model: env.MARKETING_RESEARCH_OPENROUTER_MODEL?.trim() || OPENROUTER_FREE_MODEL,
      fetchImpl: input?.fetchImpl,
      endpointBase: env.OPENROUTER_BASE_URL?.trim(),
      preferDeprecatedWebPlugin: false,
      onUsage: input?.onOpenRouterUsage,
    });
  }

  if (status.providerId === "gemini_google_search") {
    const { apiKey } = resolveGeminiResearchApiKey(env);
    return createGeminiGoogleSearchProvider({
      apiKey,
      model:
        env.MARKETING_RESEARCH_GEMINI_MODEL?.trim() ||
        env.GEMINI_RESEARCH_MODEL?.trim() ||
        DEFAULT_GEMINI_RESEARCH_MODEL,
      fetchImpl: input?.fetchImpl,
      endpointBase: env.GEMINI_API_BASE_URL?.trim(),
    });
  }

  if (status.providerId === "tavily") {
    const apiKey = env.TAVILY_API_KEY?.trim() || env.RESEARCH_SEARCH_API_KEY?.trim() || "";
    return createTavilySearchProvider({
      apiKey,
      fetchImpl: input?.fetchImpl,
    });
  }

  return createDisabledSearchProvider(status.reason ?? "disabled");
}
