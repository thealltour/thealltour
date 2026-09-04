import type { ResearchSource } from "@/lib/marketing/research/types/researchSource";
import {
  buildSourcePortfolioMetadata,
  type ResearchSourceRoleWeights,
} from "@/lib/marketing/research/portfolio/sourcePortfolioRoles";

/** Fixed UUIDs for idempotent source bootstrap. */
export const UK_GOV_TRAVEL_SOURCE_ID = "a3011111-1111-4111-8111-111111111101";
export const NYT_TRAVEL_SOURCE_ID = "a3022222-2222-4222-8222-222222222222";
export const TRAVELTIMES_SOURCE_ID = "a3033333-3333-4333-8333-333333333333";
export const TRAVIE_SOURCE_ID = "a3044444-4444-4444-8444-444444444444";
export const TRAVELDAILY_SOURCE_ID = "a3055555-5555-4555-8555-555555555555";
export const VIETNAM_TRAVEL_SOURCE_ID = "a3066666-6666-4666-8666-666666666666";

export const UK_GOV_TRAVEL_FEED_URL =
  "https://www.gov.uk/foreign-travel-advice.atom";
export const NYT_TRAVEL_FEED_URL =
  "https://rss.nytimes.com/services/xml/rss/nyt/Travel.xml";
export const TRAVELTIMES_FEED_URL = "https://www.traveltimes.co.kr/rss/allArticle.xml";
export const TRAVIE_FEED_URL = "https://www.travie.com/rss/allArticle.xml";
export const TRAVELDAILY_FEED_URL = "https://www.traveldaily.co.kr/rss/allArticle.xml";
export const VIETNAM_TRAVEL_FEED_URL = "https://vietnam.travel/rss.xml";

function withPortfolio(
  base: Omit<ResearchSource, "createdAt" | "updatedAt" | "metadata"> & {
    metadata?: Record<string, unknown> | null;
  },
  weights: ResearchSourceRoleWeights,
  extra: Record<string, unknown>,
): Omit<ResearchSource, "createdAt" | "updatedAt"> {
  return {
    ...base,
    metadata: buildSourcePortfolioMetadata(weights, {
      ...(base.metadata ?? {}),
      ...extra,
    }),
  };
}

export const MVP_RESEARCH_SOURCES: Array<
  Omit<ResearchSource, "createdAt" | "updatedAt">
> = [
  withPortfolio(
    {
      id: UK_GOV_TRAVEL_SOURCE_ID,
      sourceType: "official_government",
      name: "UK FCDO Foreign Travel Advice",
      canonicalUrl: UK_GOV_TRAVEL_FEED_URL,
      provider: "gov.uk",
      authorityLevel: "official",
      defaultCredibility: 0.88,
      locale: "en-GB",
      country: "GB",
      language: "en",
      isOfficial: true,
      isEnabled: true,
    },
    {
      portfolioRole: "safety_verification",
      agendaSeedWeight: 0.18,
      evidenceAuthorityWeight: 0.96,
      koreanMarketWeight: 0.22,
    },
    { feedKind: "atom", collectorId: "uk-gov-travel-advice" },
  ),
  withPortfolio(
    {
      id: NYT_TRAVEL_SOURCE_ID,
      sourceType: "news",
      name: "NYT Travel RSS",
      canonicalUrl: NYT_TRAVEL_FEED_URL,
      provider: "nytimes.com",
      authorityLevel: "secondary",
      defaultCredibility: 0.62,
      locale: "en-US",
      country: "US",
      language: "en",
      isOfficial: false,
      isEnabled: true,
    },
    {
      portfolioRole: "global_travel_editorial",
      agendaSeedWeight: 0.52,
      evidenceAuthorityWeight: 0.58,
      koreanMarketWeight: 0.38,
    },
    { feedKind: "rss", collectorId: "nyt-travel-rss" },
  ),
  withPortfolio(
    {
      id: TRAVELTIMES_SOURCE_ID,
      sourceType: "travel_industry",
      name: "여행신문 Traveltimes",
      canonicalUrl: TRAVELTIMES_FEED_URL,
      provider: "traveltimes.co.kr",
      authorityLevel: "secondary",
      defaultCredibility: 0.58,
      locale: "ko-KR",
      country: "KR",
      language: "ko",
      isOfficial: false,
      isEnabled: true,
    },
    {
      portfolioRole: "korean_travel_editorial",
      agendaSeedWeight: 0.9,
      evidenceAuthorityWeight: 0.52,
      koreanMarketWeight: 0.95,
    },
    { feedKind: "rss", collectorId: "traveltimes-rss" },
  ),
  withPortfolio(
    {
      id: TRAVIE_SOURCE_ID,
      sourceType: "travel_industry",
      name: "트래비 Travie",
      canonicalUrl: TRAVIE_FEED_URL,
      provider: "travie.com",
      authorityLevel: "secondary",
      defaultCredibility: 0.56,
      locale: "ko-KR",
      country: "KR",
      language: "ko",
      isOfficial: false,
      isEnabled: true,
    },
    {
      portfolioRole: "korean_travel_editorial",
      agendaSeedWeight: 0.88,
      evidenceAuthorityWeight: 0.5,
      koreanMarketWeight: 0.93,
    },
    { feedKind: "rss", collectorId: "travie-rss" },
  ),
  withPortfolio(
    {
      id: TRAVELDAILY_SOURCE_ID,
      sourceType: "travel_industry",
      name: "트래블데일리 TravelDaily",
      canonicalUrl: TRAVELDAILY_FEED_URL,
      provider: "traveldaily.co.kr",
      authorityLevel: "secondary",
      defaultCredibility: 0.55,
      locale: "ko-KR",
      country: "KR",
      language: "ko",
      isOfficial: false,
      isEnabled: true,
    },
    {
      portfolioRole: "korean_travel_editorial",
      agendaSeedWeight: 0.86,
      evidenceAuthorityWeight: 0.5,
      koreanMarketWeight: 0.92,
    },
    { feedKind: "rss", collectorId: "traveldaily-rss" },
  ),
  withPortfolio(
    {
      id: VIETNAM_TRAVEL_SOURCE_ID,
      sourceType: "tourism_board",
      name: "Vietnam National Tourism RSS",
      canonicalUrl: VIETNAM_TRAVEL_FEED_URL,
      provider: "vietnam.travel",
      authorityLevel: "official",
      defaultCredibility: 0.8,
      locale: "en",
      country: "VN",
      language: "en",
      isOfficial: true,
      isEnabled: true,
    },
    {
      portfolioRole: "destination_official",
      agendaSeedWeight: 0.78,
      evidenceAuthorityWeight: 0.9,
      koreanMarketWeight: 0.82,
    },
    { feedKind: "rss", collectorId: "vietnam-travel-rss", destinationFocus: "vietnam" },
  ),
];

/** Deferred Source Portfolio v1 entries (no safe RSS/API path verified yet). */
export const DEFERRED_RESEARCH_SOURCES_V1 = [
  {
    name: "외교부 해외안전여행 (0404.go.kr)",
    reason: "No stable public RSS/Atom endpoint verified; HTML portal only — defer custom adapter.",
    intendedRole: "korean_official_public",
  },
  {
    name: "JNTO / japan.travel news RSS",
    reason: "Advertised RSS URL returns HTML landing page, not a feed.",
    intendedRole: "destination_official",
  },
  {
    name: "Tourism Authority of Thailand",
    reason: "RSS endpoint returned HTTP 403; needs confirmed public feed/API.",
    intendedRole: "destination_official",
  },
  {
    name: "Taiwan Tourism (eng.taiwan.net.tw/rss)",
    reason: "Endpoint returned HTML rather than RSS.",
    intendedRole: "destination_official",
  },
  {
    name: "Philippines DOT tourism.gov.ph/rss",
    reason: "Feed XML present but empty (0 items); keep watching.",
    intendedRole: "destination_official",
  },
] as const;

export function isResearchCollectionEnabled(
  env: NodeJS.ProcessEnv | Record<string, string | undefined> = process.env,
): boolean {
  return env.RESEARCH_COLLECTION_ENABLED?.trim().toLowerCase() === "true";
}

export function isCollectorEnabled(
  collectorId: string,
  env: NodeJS.ProcessEnv | Record<string, string | undefined> = process.env,
): boolean {
  const globalOff = env.RESEARCH_COLLECTION_ENABLED?.trim().toLowerCase() === "false";
  if (globalOff) return false;

  const key = `RESEARCH_${collectorId.toUpperCase().replace(/-/g, "_")}_ENABLED`;
  const value = env[key]?.trim().toLowerCase();
  if (value === "false") return false;
  return true;
}
