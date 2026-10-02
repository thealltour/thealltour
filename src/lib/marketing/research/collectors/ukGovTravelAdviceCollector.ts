import { randomUUID } from "node:crypto";

import {
  UK_GOV_TRAVEL_SOURCE,
  type ExternalResearchSourceDefinition,
} from "@/lib/marketing/research/sources/sourceRegistry";
import { fetchResearchDocument } from "@/lib/marketing/research/collectors/httpClient";
import { parseFeedFromXml } from "@/lib/marketing/research/collectors/feedParser";
import {
  extractDestinationFromTitle,
  inferOfficialSignalType,
  inferTopics,
} from "@/lib/marketing/research/collectors/mappers/helpers";
import type {
  CollectorContext,
  RawResearchItem,
  ResearchCollector,
} from "@/lib/marketing/research/collectors/types";

export type UkGovTravelAdviceCollectorDeps = {
  fetchImpl?: typeof fetch;
};

/** `uk_gov_travel_advice` mapper profile: keeps the full summary as claim (no 240-char cut). */
export function createUkGovTravelAdviceCollector(
  deps: UkGovTravelAdviceCollectorDeps = {},
  source: ExternalResearchSourceDefinition = UK_GOV_TRAVEL_SOURCE,
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

      return items.slice(0, limit).map((item) => {
        const summary = item.summary.trim();
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
          locale: source.locale,
          language: null,
          destinationHints: destinations,
          topicHints: topics,
          evidence: [
            {
              id: randomUUID(),
              sourceId: context.sourceId || source.id,
              url: item.link,
              title: item.title,
              excerpt: summary,
              publishedAt: item.publishedAt,
              observedAt,
              evidenceType: "official_statement",
            },
          ],
          metadata: {
            collectorId: source.key,
            signalTypeHint: inferOfficialSignalType(
              item.title,
              summary,
              source.semantics.classification.defaultSignalType,
            ),
            feedUrl: source.feedUrl,
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
  source: ExternalResearchSourceDefinition = UK_GOV_TRAVEL_SOURCE,
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
    locale: source.locale,
    language: null,
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
      collectorId: source.key,
      signalTypeHint: inferOfficialSignalType(title, summary, source.semantics.classification.defaultSignalType),
    },
  };
}
