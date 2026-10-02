export * from "@/lib/marketing/research/collectors/types";
export * from "@/lib/marketing/research/collectors/config";
export * from "@/lib/marketing/research/collectors/httpClient";
export * from "@/lib/marketing/research/collectors/feedParser";
export * from "@/lib/marketing/research/collectors/mapRawItemToSignalInput";
export { createUkGovTravelAdviceCollector } from "@/lib/marketing/research/collectors/ukGovTravelAdviceCollector";
export { createNytTravelRssCollector } from "@/lib/marketing/research/collectors/nytTravelRssCollector";
export { createConfiguredRssCollector } from "@/lib/marketing/research/collectors/configuredRssCollector";
export * from "@/lib/marketing/research/sources/sourceRegistry";

import { createConfiguredRssCollector } from "@/lib/marketing/research/collectors/configuredRssCollector";
import { createNytTravelRssCollector } from "@/lib/marketing/research/collectors/nytTravelRssCollector";
import {
  EXTERNAL_RESEARCH_SOURCE_REGISTRY,
  toConfiguredRssCollectorConfig,
  type ExternalResearchSourceDefinition,
  type ExternalResearchSourceMapperProfile,
  type ResearchSourceDefinition,
} from "@/lib/marketing/research/sources/sourceRegistry";
import { createUkGovTravelAdviceCollector } from "@/lib/marketing/research/collectors/ukGovTravelAdviceCollector";
import type { ResearchCollector } from "@/lib/marketing/research/collectors/types";

type ResearchCollectorDeps = { fetchImpl?: typeof fetch };

const COLLECTOR_FACTORY_BY_PROFILE: Record<
  ExternalResearchSourceMapperProfile,
  (source: ExternalResearchSourceDefinition, deps?: ResearchCollectorDeps) => ResearchCollector
> = {
  generic: (source, deps) => createConfiguredRssCollector(toConfiguredRssCollectorConfig(source), deps),
  uk_gov_travel_advice: (source, deps) => createUkGovTravelAdviceCollector(deps, source),
  nyt_travel: (source, deps) => createNytTravelRssCollector(deps, source),
};

export function createResearchCollectorForSource(
  source: ExternalResearchSourceDefinition,
  deps?: ResearchCollectorDeps,
): ResearchCollector {
  return COLLECTOR_FACTORY_BY_PROFILE[source.collector.mapperProfile](source, deps);
}

/**
 * One collector per feed source regardless of lifecycle; the collection cycle gates execution
 * so inactive sources surface as explicit `skipped` results.
 */
export function createDefaultResearchCollectors(
  deps?: ResearchCollectorDeps,
  sources: readonly ResearchSourceDefinition[] = EXTERNAL_RESEARCH_SOURCE_REGISTRY,
): ResearchCollector[] {
  return sources
    .filter((source): source is ExternalResearchSourceDefinition => source.kind === "feed")
    .map((source) => createResearchCollectorForSource(source, deps));
}
