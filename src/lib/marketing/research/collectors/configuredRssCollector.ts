import { randomUUID } from "node:crypto";

import { fetchResearchDocument } from "@/lib/marketing/research/collectors/httpClient";
import { parseFeedFromXml } from "@/lib/marketing/research/collectors/feedParser";
import {
  conservativeClaim,
  extractDestinationFromTitle,
  inferNewsSignalType,
  inferOfficialSignalType,
  inferTopics,
} from "@/lib/marketing/research/collectors/mappers/helpers";
import type {
  CollectorContext,
  RawResearchItem,
  ResearchCollector,
} from "@/lib/marketing/research/collectors/types";
import type { ResearchSourceType } from "@/lib/marketing/research/types/enums";

export type ConfiguredRssCollectorConfig = {
  collectorId: string;
  sourceId: string;
  feedUrl: string;
  sourceType: ResearchSourceType;
  locale?: string;
  language?: string;
  evidenceType?: "direct_source" | "official_statement";
  destinationHints?: string[];
};

export type ConfiguredRssCollectorDeps = {
  fetchImpl?: typeof fetch;
};

export function createConfiguredRssCollector(
  config: ConfiguredRssCollectorConfig,
  deps: ConfiguredRssCollectorDeps = {},
): ResearchCollector {
  return {
    collectorId: config.collectorId,
    sourceType: config.sourceType,
    async collect(context: CollectorContext): Promise<RawResearchItem[]> {
      const observedAt = context.now.toISOString();
      const { body } = await fetchResearchDocument({
        url: config.feedUrl,
        fetchImpl: deps.fetchImpl,
      });
      const items = await parseFeedFromXml(body, config.feedUrl);
      const limit = context.maxItems ?? 25;
      const official = config.sourceType === "official_government" || config.sourceType === "tourism_board";

      const mapped: Array<RawResearchItem | null> = items.slice(0, limit).map((item) => {
        const title = item.title?.trim();
        if (!title) return null;
        const summary = item.summary?.trim() || title;
        if (summary.length < 8) return null;
        const claim = conservativeClaim(summary, title);
        const destinations = [
          ...extractDestinationFromTitle(title),
          ...(config.destinationHints ?? []),
        ];
        const topics = inferTopics(title, summary);
        const row: RawResearchItem = {
          externalId: item.externalId,
          title,
          summary: claim,
          body: summary,
          canonicalUrl: item.link,
          publishedAt: item.publishedAt,
          observedAt,
          locale: config.locale ?? null,
          language: config.language ?? null,
          destinationHints: [...new Set(destinations)],
          topicHints: topics,
          evidence: [
            {
              id: randomUUID(),
              sourceId: context.sourceId || config.sourceId,
              url: item.link,
              title,
              excerpt: summary.slice(0, 400),
              publishedAt: item.publishedAt,
              observedAt,
              evidenceType: config.evidenceType ?? (official ? "official_statement" : "direct_source"),
            },
          ],
          metadata: {
            collectorId: config.collectorId,
            signalTypeHint: official
              ? inferOfficialSignalType(title, summary)
              : inferNewsSignalType(title, summary),
            claimSource: "source",
            feedUrl: config.feedUrl,
          },
        };
        return row;
      });
      return mapped.filter((item): item is RawResearchItem => item !== null);
    },
  };
}
