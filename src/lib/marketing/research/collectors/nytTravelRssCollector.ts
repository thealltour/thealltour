import { randomUUID } from "node:crypto";

import {
  NYT_TRAVEL_FEED_URL,
  NYT_TRAVEL_SOURCE_ID,
} from "@/lib/marketing/research/collectors/config";
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

export const NYT_TRAVEL_COLLECTOR_ID = "nyt-travel-rss";

export type NytTravelRssCollectorDeps = {
  fetchImpl?: typeof fetch;
};

export function createNytTravelRssCollector(
  deps: NytTravelRssCollectorDeps = {},
): ResearchCollector {
  return {
    collectorId: NYT_TRAVEL_COLLECTOR_ID,
    sourceType: "news",
    async collect(context: CollectorContext): Promise<RawResearchItem[]> {
      const observedAt = context.now.toISOString();
      const { body } = await fetchResearchDocument({
        url: NYT_TRAVEL_FEED_URL,
        fetchImpl: deps.fetchImpl,
      });
      const items = await parseFeedFromXml(body, NYT_TRAVEL_FEED_URL);
      const limit = context.maxItems ?? 25;

      return items
        .slice(0, limit)
        .map((item) => mapNytItemToRawResearchItem(item, {
          sourceId: context.sourceId || NYT_TRAVEL_SOURCE_ID,
          observedAt,
        }))
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
    locale: "en-US",
    language: "en",
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
      collectorId: NYT_TRAVEL_COLLECTOR_ID,
      signalTypeHint: inferNewsSignalType(title, summary),
      claimSource: "source",
      feedUrl: NYT_TRAVEL_FEED_URL,
    },
  };
}
