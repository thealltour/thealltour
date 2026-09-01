export * from "@/lib/marketing/research/collectors/types";
export * from "@/lib/marketing/research/collectors/config";
export * from "@/lib/marketing/research/collectors/httpClient";
export * from "@/lib/marketing/research/collectors/feedParser";
export * from "@/lib/marketing/research/collectors/mapRawItemToSignalInput";
export { createUkGovTravelAdviceCollector, UK_GOV_TRAVEL_COLLECTOR_ID } from "@/lib/marketing/research/collectors/ukGovTravelAdviceCollector";
export { createNytTravelRssCollector, NYT_TRAVEL_COLLECTOR_ID } from "@/lib/marketing/research/collectors/nytTravelRssCollector";

import { createNytTravelRssCollector } from "@/lib/marketing/research/collectors/nytTravelRssCollector";
import { createUkGovTravelAdviceCollector } from "@/lib/marketing/research/collectors/ukGovTravelAdviceCollector";
import type { ResearchCollector } from "@/lib/marketing/research/collectors/types";

export function createDefaultResearchCollectors(deps?: {
  fetchImpl?: typeof fetch;
}): ResearchCollector[] {
  return [
    createUkGovTravelAdviceCollector(deps),
    createNytTravelRssCollector(deps),
  ];
}
