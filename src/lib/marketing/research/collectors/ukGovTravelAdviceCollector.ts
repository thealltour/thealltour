import { randomUUID } from "node:crypto";

import {
  UK_GOV_TRAVEL_FEED_URL,
  UK_GOV_TRAVEL_SOURCE_ID,
} from "@/lib/marketing/research/collectors/config";
import { fetchResearchDocument } from "@/lib/marketing/research/collectors/httpClient";
import { parseFeedFromXml } from "@/lib/marketing/research/collectors/feedParser";
import {
  conservativeClaim,
  extractDestinationFromTitle,
  inferOfficialSignalType,
  inferTopics,
} from "@/lib/marketing/research/collectors/mappers/helpers";
import type {
  CollectorContext,
  RawResearchItem,
  ResearchCollector,
} from "@/lib/marketing/research/collectors/types";

export const UK_GOV_TRAVEL_COLLECTOR_ID = "uk-gov-travel-advice";

export type UkGovTravelAdviceCollectorDeps = {
  fetchImpl?: typeof fetch;
};

export function createUkGovTravelAdviceCollector(
  deps: UkGovTravelAdviceCollectorDeps = {},
): ResearchCollector {
  return {
    collectorId: UK_GOV_TRAVEL_COLLECTOR_ID,
    sourceType: "official_government",
    async collect(context: CollectorContext): Promise<RawResearchItem[]> {
      const observedAt = context.now.toISOString();
      const { body } = await fetchResearchDocument({
        url: UK_GOV_TRAVEL_FEED_URL,
        fetchImpl: deps.fetchImpl,
      });
      const items = await parseFeedFromXml(body, UK_GOV_TRAVEL_FEED_URL);
      const limit = context.maxItems ?? 25;

      return items.slice(0, limit).map((item) => {
        const summary = item.summary.trim();
        const claim = conservativeClaim(summary, item.title);
        const destinations = extractDestinationFromTitle(item.title);
        const topics = inferTopics(item.title, summary);

        return {
          externalId: item.externalId,
          title: item.title,
          summary,
          body: summary,
          canonicalUrl: item.link,
          publishedAt: item.publishedAt,
          observedAt,
          locale: "en-GB",
          language: "en",
          destinationHints: destinations,
          topicHints: topics,
          evidence: [
            {
              id: randomUUID(),
              sourceId: context.sourceId || UK_GOV_TRAVEL_SOURCE_ID,
              url: item.link,
              title: item.title,
              excerpt: summary,
              publishedAt: item.publishedAt,
              observedAt,
              evidenceType: "official_statement",
            },
          ],
          metadata: {
            collectorId: UK_GOV_TRAVEL_COLLECTOR_ID,
            signalTypeHint: inferOfficialSignalType(item.title, summary),
            feedUrl: UK_GOV_TRAVEL_FEED_URL,
          },
        };
      });
    },
  };
}

export function mapUkGovItemToRawResearchItem(
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
  if (summary.length < 8) return null;

  return {
    externalId: item.externalId,
    title,
    summary,
    body: summary,
    canonicalUrl: item.link,
    publishedAt: item.publishedAt,
    observedAt: context.observedAt,
    locale: "en-GB",
    language: "en",
    destinationHints: extractDestinationFromTitle(title),
    topicHints: inferTopics(title, summary),
    evidence: [
      {
        id: randomUUID(),
        sourceId: context.sourceId,
        url: item.link,
        title,
        excerpt: summary,
        publishedAt: item.publishedAt,
        observedAt: context.observedAt,
        evidenceType: "official_statement",
      },
    ],
    metadata: {
      collectorId: UK_GOV_TRAVEL_COLLECTOR_ID,
      signalTypeHint: inferOfficialSignalType(title, summary),
    },
  };
}
