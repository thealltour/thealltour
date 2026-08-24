import {
  mapAiContentToHistory,
  mapThreadMarketingPostToHistory,
} from "@/lib/marketing/context/mappers/contentHistoryMapper";
import { mapSiteContentToHistory } from "@/lib/marketing/context/mappers/siteContentHistoryMapper";
import { fetchAiContentRows, fetchThreadMarketingPostRows } from "@/lib/marketing/context/sources/legacyContentSource";
import {
  fetchFlyerDraftRows,
  fetchGuideRows,
  fetchHomeBannerRows,
  fetchHomeHeroContentRows,
  fetchMobileGolfAdLandingRows,
  fetchNoticeRows,
} from "@/lib/marketing/context/sources/siteContentSource";
import { createContextSource } from "@/lib/marketing/context/provenance";
import { matchesExactChannel, sortContentHistory } from "@/lib/marketing/retrieval/filters";
import { requireRetrievalPeriod } from "@/lib/marketing/retrieval/validation";
import type { ContentHistoryItem } from "@/lib/marketing/context/types";
import type { ParsedMarketingRetrievalRequest, RetrievalResult } from "@/lib/marketing/retrieval/types";

function wantsChannel(requestChannel: string | undefined, sourceChannel: string): boolean {
  return !requestChannel || requestChannel === sourceChannel;
}

export async function retrieveContentHistory(
  request: ParsedMarketingRetrievalRequest,
): Promise<RetrievalResult<ContentHistoryItem[]>> {
  const period = requireRetrievalPeriod(request);
  const limit = request.limit;
  const siteInput = {
    periodStart: period.start,
    periodEnd: period.end,
    limit,
    productId: request.productId,
  };

  const jobs: Array<Promise<ContentHistoryItem[]>> = [];
  const sourceTables: string[] = [];

  if (wantsChannel(request.channel, "threads")) {
    sourceTables.push("thread_marketing_posts");
    jobs.push(
      fetchThreadMarketingPostRows({
        productId: request.productId,
        periodStart: period.start,
        periodEnd: period.end,
        limit,
      }).then((rows) => rows.map(mapThreadMarketingPostToHistory).filter((item): item is ContentHistoryItem => item != null)),
    );
  }

  sourceTables.push("ai_contents");
  jobs.push(
    fetchAiContentRows({
      productId: request.productId,
      campaignId: request.campaignId,
      agendaId: request.agendaId,
      periodStart: period.start,
      periodEnd: period.end,
      limit,
    }).then((rows) => rows.map(mapAiContentToHistory).filter((item): item is ContentHistoryItem => item != null)),
  );

  if (!request.productId && wantsChannel(request.channel, "notice")) {
    sourceTables.push("notices");
    jobs.push(
      fetchNoticeRows(siteInput).then((rows) =>
        rows.map((row) => mapSiteContentToHistory(row, "notice", "notice")).filter((item): item is ContentHistoryItem => item != null),
      ),
    );
  }
  if (!request.productId && wantsChannel(request.channel, "guide")) {
    sourceTables.push("guides");
    jobs.push(
      fetchGuideRows(siteInput).then((rows) =>
        rows.map((row) => mapSiteContentToHistory(row, "guide", "guide")).filter((item): item is ContentHistoryItem => item != null),
      ),
    );
  }
  if (wantsChannel(request.channel, "flyer")) {
    sourceTables.push("flyer_drafts");
    jobs.push(
      fetchFlyerDraftRows(siteInput).then((rows) =>
        rows.map((row) => mapSiteContentToHistory(row, "flyer_draft", "flyer")).filter((item): item is ContentHistoryItem => item != null),
      ),
    );
  }
  if (!request.productId && wantsChannel(request.channel, "home")) {
    sourceTables.push("home_hero_content", "home_banners");
    jobs.push(
      fetchHomeHeroContentRows(siteInput).then((rows) =>
        rows.map((row) => mapSiteContentToHistory(row, "home_hero_content", "home")).filter((item): item is ContentHistoryItem => item != null),
      ),
      fetchHomeBannerRows(siteInput).then((rows) =>
        rows.map((row) => mapSiteContentToHistory(row, "home_banner", "home")).filter((item): item is ContentHistoryItem => item != null),
      ),
    );
  }
  if (!request.productId && wantsChannel(request.channel, "mobile_golf_ad")) {
    sourceTables.push("mobile_golf_ad_landings");
    jobs.push(
      fetchMobileGolfAdLandingRows(siteInput).then((rows) =>
        rows
          .map((row) => mapSiteContentToHistory(row, "mobile_golf_ad_landing", "mobile_golf_ad"))
          .filter((item): item is ContentHistoryItem => item != null),
      ),
    );
  }

  const groups = await Promise.all(jobs);
  const items = sortContentHistory(
    groups.flat().filter((item) => matchesExactChannel(item.channel, request.channel) || item.sourceType === "ai_content"),
  ).slice(0, limit);

  const retrievedAt = new Date().toISOString();
  return {
    data: items,
    retrievedAt,
    sources: sourceTables.map((sourceTable) =>
      createContextSource({
        sourceType: "content_history",
        sourceTable,
        sourceId: request.productId,
        retrievedAt,
        periodStart: period.start,
        periodEnd: period.end,
      }),
    ),
  };
}
