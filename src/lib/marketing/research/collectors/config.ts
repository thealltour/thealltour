import type { ResearchSource } from "@/lib/marketing/research/types/researchSource";

/** Fixed UUIDs for idempotent source bootstrap. */
export const UK_GOV_TRAVEL_SOURCE_ID = "a3011111-1111-4111-8111-111111111101";
export const NYT_TRAVEL_SOURCE_ID = "a3022222-2222-4222-8222-222222222222";

export const UK_GOV_TRAVEL_FEED_URL =
  "https://www.gov.uk/foreign-travel-advice.atom";
export const NYT_TRAVEL_FEED_URL =
  "https://rss.nytimes.com/services/xml/rss/nyt/Travel.xml";

export const MVP_RESEARCH_SOURCES: Array<
  Omit<ResearchSource, "createdAt" | "updatedAt">
> = [
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
    metadata: {
      feedKind: "atom",
      collectorId: "uk-gov-travel-advice",
    },
  },
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
    metadata: {
      feedKind: "rss",
      collectorId: "nyt-travel-rss",
    },
  },
];

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
