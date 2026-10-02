import type { ConfiguredRssCollectorConfig } from "@/lib/marketing/research/collectors/configuredRssCollector";
import {
  buildSourcePortfolioMetadata,
  type ResearchSourceRoleWeights,
} from "@/lib/marketing/research/portfolio/sourcePortfolioRoles";
import { canCollectResearchSource } from "@/lib/marketing/research/sourceLifecycle";
import { deriveLegacySourceLanguage } from "@/lib/marketing/research/sourceLanguage";
import type { AuthorityLevel, ResearchSourceType } from "@/lib/marketing/research/types/enums";
import type { ResearchSource } from "@/lib/marketing/research/types/researchSource";
import type { ResearchSourceSemantics } from "@/lib/marketing/research/types/sourceSemantics";

/**
 * Item mapping behavior per collector. Profiles are not interchangeable: claim length,
 * summary handling and metadata differ, and claim feeds the raw fingerprint.
 */
export type ExternalResearchSourceMapperProfile = "generic" | "uk_gov_travel_advice" | "nyt_travel";

type ResearchSourceDefinitionBase = {
  /** Fixed UUID for idempotent source upsert. */
  id: string;
  name: string;
  sourceType: ResearchSourceType;
  isOfficial: boolean;
  authorityLevel: AuthorityLevel;
  defaultCredibility: number;
  /**
   * Projected to `metadata.semantics`. Runtime authority for `lifecycle.status` (collection /
   * candidate / MM participation), `classification.defaultSignalType` (terminal signal type
   * fallback), `coverage` (terminal geography fallback), `languages.primary` (terminal
   * signal language fallback and the source of the legacy source-row `language`) and `commercialBias` (final MM rank seed attenuation).
   * Destination hints and scoring still come from the legacy fields.
   */
  semantics: ResearchSourceSemantics;
};

/** Pulled RSS/Atom feed; bootstrapped every cycle and collected by a registry-built collector. */
export type ExternalResearchSourceDefinition = ResearchSourceDefinitionBase & {
  kind: "feed";
  /** Collector id: env toggle key, logs, `metadata.collectorId`. */
  key: string;
  provider: string;
  /** Feed endpoint; also persisted as `research_sources.canonical_url`. */
  feedUrl: string;
  country: string;
  locale: string;
  portfolio: ResearchSourceRoleWeights;
  collector: {
    feedKind: "rss" | "atom";
    mapperProfile: ExternalResearchSourceMapperProfile;
    /** Generic profile only; the dedicated profiles fix their evidence type. */
    evidenceType?: ConfiguredRssCollectorConfig["evidenceType"];
    destinationHints?: string[];
  };
};

/** In-process source; bootstrapped, but signals come from its own loader rather than a feed collector. */
export type InternalResearchSourceDefinition = ResearchSourceDefinitionBase & {
  kind: "internal";
  /** collectorId reported in collection cycle results. */
  key: string;
  portfolio: ResearchSourceRoleWeights;
  metadata: Record<string, unknown>;
};

/** Push-ingested source; upserted by its ingestion path, never bootstrapped. */
export type PushResearchSourceDefinition = ResearchSourceDefinitionBase & {
  kind: "push";
  provider: string;
  canonicalUrl: string | null;
  country: string;
  locale: string;
  /**
   * Persisted verbatim alongside `semantics`. Carries no `portfolio` block, so role weights resolve through
   * the sourceType fallback; changing that is a scoring change, not a wiring change.
   */
  metadata: Record<string, unknown>;
};

export type ResearchSourceDefinition =
  | ExternalResearchSourceDefinition
  | InternalResearchSourceDefinition
  | PushResearchSourceDefinition;

export type ResearchSourceRow = Omit<ResearchSource, "createdAt" | "updatedAt">;

/** Korean trade press: worldwide destination coverage, partly funded by advertorial content. */
const KOREAN_TRAVEL_TRADE_PRESS_SEMANTICS: ResearchSourceSemantics = {
  commercialBias: "medium",
  coverage: { scope: "global" },
  languages: { primary: "ko" },
  classification: { defaultSignalType: "general_travel_news" },
  lifecycle: { status: "active" },
};

export const UK_GOV_TRAVEL_SOURCE: ExternalResearchSourceDefinition = {
  kind: "feed",
  id: "a3011111-1111-4111-8111-111111111101",
  key: "uk-gov-travel-advice",
  name: "UK FCDO Foreign Travel Advice",
  provider: "gov.uk",
  sourceType: "official_government",
  feedUrl: "https://www.gov.uk/foreign-travel-advice.atom",
  country: "GB",
  locale: "en-GB",
  isOfficial: true,
  authorityLevel: "official",
  defaultCredibility: 0.88,
  portfolio: {
    portfolioRole: "safety_verification",
    agendaSeedWeight: 0.18,
    koreanMarketWeight: 0.22,
  },
  collector: { feedKind: "atom", mapperProfile: "uk_gov_travel_advice" },
  semantics: {
    commercialBias: "none",
    coverage: { scope: "global" },
    languages: { primary: "en" },
    classification: { defaultSignalType: "entry_requirement" },
    lifecycle: { status: "active" },
  },
};

export const NYT_TRAVEL_SOURCE: ExternalResearchSourceDefinition = {
  kind: "feed",
  id: "a3022222-2222-4222-8222-222222222222",
  key: "nyt-travel-rss",
  name: "NYT Travel RSS",
  provider: "nytimes.com",
  sourceType: "news",
  feedUrl: "https://rss.nytimes.com/services/xml/rss/nyt/Travel.xml",
  country: "US",
  locale: "en-US",
  isOfficial: false,
  authorityLevel: "secondary",
  defaultCredibility: 0.62,
  portfolio: {
    portfolioRole: "global_travel_editorial",
    agendaSeedWeight: 0.52,
    koreanMarketWeight: 0.38,
  },
  collector: { feedKind: "rss", mapperProfile: "nyt_travel" },
  semantics: {
    commercialBias: "low",
    coverage: { scope: "global" },
    languages: { primary: "en" },
    classification: { defaultSignalType: "general_travel_news" },
    lifecycle: { status: "active" },
  },
};

export const TRAVELTIMES_SOURCE: ExternalResearchSourceDefinition = {
  kind: "feed",
  id: "a3033333-3333-4333-8333-333333333333",
  key: "traveltimes-rss",
  name: "여행신문 Traveltimes",
  provider: "traveltimes.co.kr",
  sourceType: "travel_industry",
  feedUrl: "https://www.traveltimes.co.kr/rss/allArticle.xml",
  country: "KR",
  locale: "ko-KR",
  isOfficial: false,
  authorityLevel: "secondary",
  defaultCredibility: 0.58,
  portfolio: {
    portfolioRole: "korean_travel_editorial",
    agendaSeedWeight: 0.9,
    koreanMarketWeight: 0.95,
  },
  collector: { feedKind: "rss", mapperProfile: "generic" },
  semantics: KOREAN_TRAVEL_TRADE_PRESS_SEMANTICS,
};

export const TRAVIE_SOURCE: ExternalResearchSourceDefinition = {
  kind: "feed",
  id: "a3044444-4444-4444-8444-444444444444",
  key: "travie-rss",
  name: "트래비 Travie",
  provider: "travie.com",
  sourceType: "travel_industry",
  feedUrl: "https://www.travie.com/rss/allArticle.xml",
  country: "KR",
  locale: "ko-KR",
  isOfficial: false,
  authorityLevel: "secondary",
  defaultCredibility: 0.56,
  portfolio: {
    portfolioRole: "korean_travel_editorial",
    agendaSeedWeight: 0.88,
    koreanMarketWeight: 0.93,
  },
  collector: { feedKind: "rss", mapperProfile: "generic" },
  semantics: KOREAN_TRAVEL_TRADE_PRESS_SEMANTICS,
};

export const TRAVELDAILY_SOURCE: ExternalResearchSourceDefinition = {
  kind: "feed",
  id: "a3055555-5555-4555-8555-555555555555",
  key: "traveldaily-rss",
  name: "트래블데일리 TravelDaily",
  provider: "traveldaily.co.kr",
  sourceType: "travel_industry",
  feedUrl: "https://www.traveldaily.co.kr/rss/allArticle.xml",
  country: "KR",
  locale: "ko-KR",
  isOfficial: false,
  authorityLevel: "secondary",
  defaultCredibility: 0.55,
  portfolio: {
    portfolioRole: "korean_travel_editorial",
    agendaSeedWeight: 0.86,
    koreanMarketWeight: 0.92,
  },
  collector: { feedKind: "rss", mapperProfile: "generic" },
  semantics: KOREAN_TRAVEL_TRADE_PRESS_SEMANTICS,
};

export const VIETNAM_TRAVEL_SOURCE: ExternalResearchSourceDefinition = {
  kind: "feed",
  id: "a3066666-6666-4666-8666-666666666666",
  key: "vietnam-travel-rss",
  name: "Vietnam National Tourism RSS",
  provider: "vietnam.travel",
  sourceType: "tourism_board",
  feedUrl: "https://vietnam.travel/rss.xml",
  country: "VN",
  locale: "en",
  isOfficial: true,
  authorityLevel: "official",
  defaultCredibility: 0.8,
  portfolio: {
    portfolioRole: "destination_official",
    agendaSeedWeight: 0.78,
    koreanMarketWeight: 0.82,
  },
  collector: {
    feedKind: "rss",
    mapperProfile: "generic",
    evidenceType: "official_statement",
    destinationHints: ["vietnam"],
  },
  semantics: {
    commercialBias: "medium",
    coverage: { scope: "country", countries: ["VN"] },
    languages: { primary: "en" },
    classification: { defaultSignalType: "destination_trend" },
    lifecycle: { status: "active" },
  },
};

export const PERFORMANCE_MEMORY_SOURCE_DEFINITION: InternalResearchSourceDefinition = {
  kind: "internal",
  id: "44444444-4444-4444-8444-444444444444",
  key: "performance-feedback",
  name: "Performance Analyst Memory",
  sourceType: "performance_memory",
  isOfficial: false,
  authorityLevel: "primary",
  defaultCredibility: 0.75,
  portfolio: {
    portfolioRole: "performance_memory",
    agendaSeedWeight: 0.35,
    koreanMarketWeight: 0.7,
  },
  metadata: {
    adapter: "performance_signal",
    advisoryOnly: true,
  },
  semantics: {
    commercialBias: "none",
    coverage: { scope: "global" },
    languages: { primary: "ko" },
    classification: { defaultSignalType: "content_performance" },
    lifecycle: { status: "active" },
  },
};

export const META_AI_TREND_SOURCE_DEFINITION: PushResearchSourceDefinition = {
  kind: "push",
  id: "a1000000-0000-4000-8000-000000000001",
  name: "Meta AI Trend Discovery",
  provider: "meta_ai",
  sourceType: "social",
  canonicalUrl: null,
  country: "KR",
  locale: "ko-KR",
  isOfficial: false,
  authorityLevel: "community",
  defaultCredibility: 0.35,
  metadata: {
    role: "trend_discovery_editorial_intelligence_provider",
    neverAccesses: ["agenda_finalize", "cmc", "hmr", "publication", "sns"],
  },
  semantics: {
    commercialBias: "low",
    coverage: { scope: "global" },
    languages: { primary: "ko" },
    classification: { defaultSignalType: "destination_trend" },
    lifecycle: { status: "active" },
  },
};

/** External feed sources; order is collection order. */
export const EXTERNAL_RESEARCH_SOURCE_REGISTRY: readonly ExternalResearchSourceDefinition[] = [
  UK_GOV_TRAVEL_SOURCE,
  NYT_TRAVEL_SOURCE,
  TRAVELTIMES_SOURCE,
  TRAVIE_SOURCE,
  TRAVELDAILY_SOURCE,
  VIETNAM_TRAVEL_SOURCE,
];

/** Single source of truth for every research source identity. */
export const RESEARCH_SOURCE_REGISTRY: readonly ResearchSourceDefinition[] = [
  ...EXTERNAL_RESEARCH_SOURCE_REGISTRY,
  PERFORMANCE_MEMORY_SOURCE_DEFINITION,
  META_AI_TREND_SOURCE_DEFINITION,
];

export function findResearchSourceDefinition(sourceId: string): ResearchSourceDefinition | undefined {
  return RESEARCH_SOURCE_REGISTRY.find((source) => source.id === sourceId);
}

export function projectResearchSource(source: ResearchSourceDefinition): ResearchSourceRow {
  switch (source.kind) {
    case "feed":
      return {
        id: source.id,
        sourceType: source.sourceType,
        name: source.name,
        canonicalUrl: source.feedUrl,
        provider: source.provider,
        authorityLevel: source.authorityLevel,
        defaultCredibility: source.defaultCredibility,
        locale: source.locale,
        country: source.country,
        language: deriveLegacySourceLanguage(source),
        isOfficial: source.isOfficial,
        isEnabled: canCollectResearchSource(source),
        metadata: {
          ...buildSourcePortfolioMetadata(source.portfolio, {
            feedKind: source.collector.feedKind,
            collectorId: source.key,
          }),
          semantics: structuredClone(source.semantics),
        },
      };
    case "internal":
      return {
        id: source.id,
        sourceType: source.sourceType,
        name: source.name,
        authorityLevel: source.authorityLevel,
        defaultCredibility: source.defaultCredibility,
        language: deriveLegacySourceLanguage(source),
        isOfficial: source.isOfficial,
        isEnabled: canCollectResearchSource(source),
        metadata: {
          ...buildSourcePortfolioMetadata(source.portfolio, structuredClone(source.metadata)),
          semantics: structuredClone(source.semantics),
        },
      };
    case "push":
      return {
        id: source.id,
        sourceType: source.sourceType,
        name: source.name,
        canonicalUrl: source.canonicalUrl,
        provider: source.provider,
        authorityLevel: source.authorityLevel,
        defaultCredibility: source.defaultCredibility,
        locale: source.locale,
        country: source.country,
        language: deriveLegacySourceLanguage(source),
        isOfficial: source.isOfficial,
        isEnabled: canCollectResearchSource(source),
        metadata: {
          ...structuredClone(source.metadata),
          semantics: structuredClone(source.semantics),
        },
      };
  }
}

/** Definitions bootstrapped each cycle regardless of lifecycle; push sources upsert on ingestion instead. */
export function selectBootstrapResearchSources(
  sources: readonly ResearchSourceDefinition[] = RESEARCH_SOURCE_REGISTRY,
): ResearchSourceRow[] {
  return sources.filter((source) => source.kind !== "push").map(projectResearchSource);
}

export const BOOTSTRAP_RESEARCH_SOURCES: readonly ResearchSourceRow[] = selectBootstrapResearchSources();

export function toConfiguredRssCollectorConfig(
  source: ExternalResearchSourceDefinition,
): ConfiguredRssCollectorConfig {
  const { destinationHints, evidenceType } = source.collector;
  return {
    collectorId: source.key,
    isOfficial: source.isOfficial,
    sourceId: source.id,
    feedUrl: source.feedUrl,
    sourceType: source.sourceType,
    locale: source.locale,
    language: deriveLegacySourceLanguage(source),
    ...(destinationHints ? { destinationHints: [...destinationHints] } : {}),
    ...(evidenceType ? { evidenceType } : {}),
    defaultSignalType: source.semantics.classification.defaultSignalType,
  };
}
