import { randomUUID } from "node:crypto";

import {
  NYT_TRAVEL_SOURCE,
  type ExternalResearchSourceDefinition,
} from "@/lib/marketing/research/sources/sourceRegistry";
import { fetchResearchDocument } from "@/lib/marketing/research/collectors/httpClient";
import { parseFeedFromXml } from "@/lib/marketing/research/collectors/feedParser";
import {
  conservativeClaim,
  extractDestinationFromTitle,
  inferNewsSignalType,
  inferTopics,
} from "@/lib/marketing/research/collectors/mappers/helpers";
import type {
  CollectorContext,
  RawResearchItem,
  ResearchCollector,
} from "@/lib/marketing/research/collectors/types";

export type NytTravelRssCollectorDeps = {
  fetchImpl?: typeof fetch;
};

/** `nyt_travel` mapper profile: 12-char summary floor, always `direct_source` evidence. */
export function createNytTravelRssCollector(
  deps: NytTravelRssCollectorDeps = {},
  source: ExternalResearchSourceDefinition = NYT_TRAVEL_SOURCE,
): ResearchCollector {
  return {
    collectorId: source.key,
    sourceId: source.id,
    sourceType: source.sourceType,
    async collect(context: CollectorContext): Promise<RawResearchItem[]> {
      const observedAt = context.now.toISOString();
      const { body } = await fetchResearchDocument({
        url: source.feedUrl,
        fetchImpl: deps.fetchImpl,
      });
      const items = await parseFeedFromXml(body, source.feedUrl);
      const limit = context.maxItems ?? 25;

      return items
        .slice(0, limit)
        .map((item) => mapNytItemToRawResearchItem(
          item,
          { sourceId: context.sourceId || source.id, observedAt },
          source,
        ))
        .filter((item): item is RawResearchItem => item !== null);
    },
  };
}

export function mapNytItemToRawResearchItem(
  item: {
    externalId: string;
    title: string;
    link: string | null;
    summary: string;
    publishedAt: string | null;
  },
  context: { sourceId: string; observedAt: string },
  source: ExternalResearchSourceDefinition = NYT_TRAVEL_SOURCE,
): RawResearchItem | null {
  const title = item.title?.trim();
  if (!title) return null;

  const summary = item.summary?.trim() || title;
  if (summary.length < 12) return null;

  const claim = conservativeClaim(summary, title);
  const destinations = extractDestinationFromTitle(title);
  const topics = inferTopics(title, summary);

  return {
    externalId: item.externalId,
    title,
    summary: claim,
    body: summary,
    canonicalUrl: item.link,
    publishedAt: item.publishedAt,
    observedAt: context.observedAt,
    locale: source.locale,
    language: null,
    destinationHints: destinations,
    topicHints: topics,
    evidence: [
      {
        id: randomUUID(),
        sourceId: context.sourceId,
        url: item.link,
        title,
        excerpt: summary.slice(0, 400),
        publishedAt: item.publishedAt,
        observedAt: context.observedAt,
        evidenceType: "direct_source",
      },
    ],
    metadata: {
      collectorId: source.key,
      signalTypeHint: inferNewsSignalType(title, summary, source.semantics.classification.defaultSignalType),
      claimSource: "source",
      feedUrl: source.feedUrl,
    },
  };
}
