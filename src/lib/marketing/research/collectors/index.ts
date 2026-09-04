export * from "@/lib/marketing/research/collectors/types";
export * from "@/lib/marketing/research/collectors/config";
export * from "@/lib/marketing/research/collectors/httpClient";
export * from "@/lib/marketing/research/collectors/feedParser";
export * from "@/lib/marketing/research/collectors/mapRawItemToSignalInput";
export { createUkGovTravelAdviceCollector, UK_GOV_TRAVEL_COLLECTOR_ID } from "@/lib/marketing/research/collectors/ukGovTravelAdviceCollector";
export { createNytTravelRssCollector, NYT_TRAVEL_COLLECTOR_ID } from "@/lib/marketing/research/collectors/nytTravelRssCollector";
export { createConfiguredRssCollector } from "@/lib/marketing/research/collectors/configuredRssCollector";

import {
  TRAVELDAILY_FEED_URL,
  TRAVELDAILY_SOURCE_ID,
  TRAVELTIMES_FEED_URL,
  TRAVELTIMES_SOURCE_ID,
  TRAVIE_FEED_URL,
  TRAVIE_SOURCE_ID,
  VIETNAM_TRAVEL_FEED_URL,
  VIETNAM_TRAVEL_SOURCE_ID,
} from "@/lib/marketing/research/collectors/config";
import { createConfiguredRssCollector } from "@/lib/marketing/research/collectors/configuredRssCollector";
import { createNytTravelRssCollector } from "@/lib/marketing/research/collectors/nytTravelRssCollector";
import { createUkGovTravelAdviceCollector } from "@/lib/marketing/research/collectors/ukGovTravelAdviceCollector";
import type { ResearchCollector } from "@/lib/marketing/research/collectors/types";

export function createDefaultResearchCollectors(deps?: {
  fetchImpl?: typeof fetch;
}): ResearchCollector[] {
  return [
    createUkGovTravelAdviceCollector(deps),
    createNytTravelRssCollector(deps),
    createConfiguredRssCollector(
      {
        collectorId: "traveltimes-rss",
        sourceId: TRAVELTIMES_SOURCE_ID,
        feedUrl: TRAVELTIMES_FEED_URL,
        sourceType: "travel_industry",
        locale: "ko-KR",
        language: "ko",
      },
      deps,
    ),
    createConfiguredRssCollector(
      {
        collectorId: "travie-rss",
        sourceId: TRAVIE_SOURCE_ID,
        feedUrl: TRAVIE_FEED_URL,
        sourceType: "travel_industry",
        locale: "ko-KR",
        language: "ko",
      },
      deps,
    ),
    createConfiguredRssCollector(
      {
        collectorId: "traveldaily-rss",
        sourceId: TRAVELDAILY_SOURCE_ID,
        feedUrl: TRAVELDAILY_FEED_URL,
        sourceType: "travel_industry",
        locale: "ko-KR",
        language: "ko",
      },
      deps,
    ),
    createConfiguredRssCollector(
      {
        collectorId: "vietnam-travel-rss",
        sourceId: VIETNAM_TRAVEL_SOURCE_ID,
        feedUrl: VIETNAM_TRAVEL_FEED_URL,
        sourceType: "tourism_board",
        locale: "en",
        language: "en",
        destinationHints: ["vietnam"],
        evidenceType: "official_statement",
      },
      deps,
    ),
  ];
}
