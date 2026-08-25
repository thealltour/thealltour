import "server-only";

import { asString } from "@/lib/marketing/context/json";
import { loadProductContexts } from "@/lib/marketing/context/loadProductContext";
import { mapAiContentToHistory } from "@/lib/marketing/context/mappers/contentHistoryMapper";
import { mapAiPublicationRow, isPublishedPublication } from "@/lib/marketing/context/mappers/publicationContextMapper";
import { mapHomeHeroRowToHistory, mapSiteContentToHistory } from "@/lib/marketing/context/mappers/siteContentHistoryMapper";
import { fetchAiAgendaRowsByIds } from "@/lib/marketing/context/sources/agendaSource";
import { fetchAiPublicationRows } from "@/lib/marketing/context/sources/analyticsSource";
import { fetchAiCampaignNameRowsByIds } from "@/lib/marketing/context/sources/campaignSource";
import { fetchAiContentRows } from "@/lib/marketing/context/sources/legacyContentSource";
import {
  fetchFlyerDraftRows,
  fetchGuideRows,
  fetchHomeBannerRows,
  fetchHomeHeroContentRows,
  fetchMobileGolfAdLandingRows,
  fetchNoticeRows,
} from "@/lib/marketing/context/sources/siteContentSource";
import type { ContentHistoryItem, PublicationContext } from "@/lib/marketing/context/types";
import { CONTENT_MEMORY_MAX_SCAN } from "@/lib/marketing/memory/constants";
import { uniqueContentChannels } from "@/lib/marketing/memory/contentMemoryContent";
import type {
  ContentMemoryBundle,
  ContentMemoryFilterSourceType,
  ParsedContentMemoryLoadParams,
} from "@/lib/marketing/memory/sources/contentMemorySource";

const SITE_CHANNELS = new Set(["notice", "guide", "flyer", "home", "mobile_golf_ad"]);

function wantsSource(params: ParsedContentMemoryLoadParams, sourceType: ContentMemoryFilterSourceType): boolean {
  return !params.sourceType || params.sourceType === sourceType;
}

function wantsAi(params: ParsedContentMemoryLoadParams): boolean {
  if (!wantsSource(params, "ai_content")) return false;
  if (!params.channel) return true;
  return !SITE_CHANNELS.has(params.channel);
}

function wantsLegacyChannel(params: ParsedContentMemoryLoadParams, sourceChannel: string): boolean {
  return !params.channel || params.channel === sourceChannel;
}

function inPeriod(value: string | null | undefined, params: ParsedContentMemoryLoadParams): boolean {
  if (!params.applyPeriod || !value) return !params.applyPeriod;
  return value >= params.period.start && value <= params.period.end;
}

function latestPublishedAt(publications: PublicationContext[]): string | null {
  let latest: string | null = null;
  for (const publication of publications) {
    if (!publication.publishedAt) continue;
    if (!latest || publication.publishedAt > latest) latest = publication.publishedAt;
  }
  return latest;
}

function siteInput(params: ParsedContentMemoryLoadParams) {
  return {
    ids: params.contentIds.length > 0 ? params.contentIds : undefined,
    productId: params.productIds.length === 1 ? params.productIds[0] : undefined,
    productIds: params.productIds.length > 1 ? params.productIds : undefined,
    periodStart: params.applyPeriod ? params.period.start : undefined,
    periodEnd: params.applyPeriod ? params.period.end : undefined,
    limit: Math.min(params.limit, CONTENT_MEMORY_MAX_SCAN),
  };
}

async function loadAiBundles(params: ParsedContentMemoryLoadParams): Promise<ContentMemoryBundle[]> {
  if (!wantsAi(params)) return [];
  const contents = await fetchAiContentRows({
    ids: params.contentIds.length > 0 ? params.contentIds : undefined,
    productIds: params.productIds.length > 0 ? params.productIds : undefined,
    limit: CONTENT_MEMORY_MAX_SCAN,
  });
  const histories = contents
    .map(mapAiContentToHistory)
    .filter((item): item is ContentHistoryItem => item != null);
  if (histories.length === 0) return [];

  const contentIds = histories.map((item) => item.id);
  const publications = (
    await fetchAiPublicationRows({
      contentIds,
      channel: params.channel && !SITE_CHANNELS.has(params.channel) ? params.channel : undefined,
      limit: CONTENT_MEMORY_MAX_SCAN,
    })
  )
    .map(mapAiPublicationRow)
    .filter((item): item is PublicationContext => item != null);

  const publishedByContent = new Map<string, PublicationContext[]>();
  for (const publication of publications) {
    if (!isPublishedPublication(publication)) continue;
    if (params.applyPeriod && !inPeriod(publication.publishedAt, params)) continue;
    const list = publishedByContent.get(publication.contentId) ?? [];
    list.push(publication);
    publishedByContent.set(publication.contentId, list);
  }

  const keep = histories.filter((item) => (publishedByContent.get(item.id) ?? []).length > 0);
  if (keep.length === 0) return [];

  const productIds = [...new Set(keep.map((item) => item.productId).filter((id): id is string => Boolean(id)))];
  const campaignIds = [
    ...new Set(keep.map((item) => asString(item.metadata?.campaignId)).filter((id): id is string => Boolean(id))),
  ];
  const agendaIds = [
    ...new Set(keep.map((item) => asString(item.metadata?.agendaId)).filter((id): id is string => Boolean(id))),
  ];
  const [products, campaigns, agendas] = await Promise.all([
    loadProductContexts({ ids: productIds, limit: Math.max(productIds.length, 1) }),
    fetchAiCampaignNameRowsByIds(campaignIds),
    fetchAiAgendaRowsByIds(agendaIds),
  ]);
  const productTitle = new Map(products.map((product) => [product.id, product.title]));
  const campaignName = new Map(
    campaigns.flatMap((row) => {
      const id = asString(row.id);
      const name = asString(row.name);
      return id && name ? [[id, name] as const] : [];
    }),
  );
  const agendaById = new Map(
    agendas.flatMap((row) => {
      const id = asString(row.id);
      if (!id) return [];
      return [[id, { topic: asString(row.topic), key: asString(row.agenda_key) }] as const];
    }),
  );

  return keep.map((history) => {
    const pubs = publishedByContent.get(history.id) ?? [];
    const campaignId = asString(history.metadata?.campaignId);
    const agendaId = asString(history.metadata?.agendaId);
    const agenda = agendaId ? agendaById.get(agendaId) : undefined;
    return {
      history: { ...history, summary: null },
      channels: uniqueContentChannels(pubs.map((item) => item.channel)),
      publishedAt: latestPublishedAt(pubs),
      productTitle: history.productId ? productTitle.get(history.productId) ?? null : null,
      campaignName: campaignId ? campaignName.get(campaignId) ?? null : null,
      agendaTopic: agenda?.topic ?? null,
      agendaKey: agenda?.key ?? null,
      hook: history.summary,
      cta: asString(history.metadata?.cta),
    };
  });
}

async function loadLegacyBundles(params: ParsedContentMemoryLoadParams): Promise<ContentMemoryBundle[]> {
  const jobs: Array<Promise<ContentHistoryItem[]>> = [];
  const hasProductFilter = params.productIds.length > 0;
  const input = siteInput(params);

  if (wantsSource(params, "notice") && !hasProductFilter && wantsLegacyChannel(params, "notice")) {
    jobs.push(
      fetchNoticeRows(input).then((rows) =>
        rows.map((row) => mapSiteContentToHistory(row, "notice", "notice")).filter((item): item is ContentHistoryItem => item != null),
      ),
    );
  }
  if (wantsSource(params, "guide") && !hasProductFilter && wantsLegacyChannel(params, "guide")) {
    jobs.push(
      fetchGuideRows(input).then((rows) =>
        rows.map((row) => mapSiteContentToHistory(row, "guide", "guide")).filter((item): item is ContentHistoryItem => item != null),
      ),
    );
  }
  if (wantsSource(params, "flyer_draft") && wantsLegacyChannel(params, "flyer")) {
    jobs.push(
      fetchFlyerDraftRows(input).then((rows) =>
        rows.map((row) => mapSiteContentToHistory(row, "flyer_draft", "flyer")).filter((item): item is ContentHistoryItem => item != null),
      ),
    );
  }
  if (wantsSource(params, "home_hero_content") && !hasProductFilter && wantsLegacyChannel(params, "home")) {
    jobs.push(
      fetchHomeHeroContentRows(input).then((rows) =>
        rows.map(mapHomeHeroRowToHistory).filter((item): item is ContentHistoryItem => item != null),
      ),
    );
  }
  if (wantsSource(params, "home_banner") && !hasProductFilter && wantsLegacyChannel(params, "home")) {
    jobs.push(
      fetchHomeBannerRows(input).then((rows) =>
        rows.map((row) => mapSiteContentToHistory(row, "home_banner", "home")).filter((item): item is ContentHistoryItem => item != null),
      ),
    );
  }
  if (wantsSource(params, "mobile_golf_ad_landing") && !hasProductFilter && wantsLegacyChannel(params, "mobile_golf_ad")) {
    jobs.push(
      fetchMobileGolfAdLandingRows(input).then((rows) =>
        rows
          .map((row) => mapSiteContentToHistory(row, "mobile_golf_ad_landing", "mobile_golf_ad"))
          .filter((item): item is ContentHistoryItem => item != null),
      ),
    );
  }

  if (jobs.length === 0) return [];
  const items = (await Promise.all(jobs)).flat();
  const productIds = [...new Set(items.map((item) => item.productId).filter((id): id is string => Boolean(id)))];
  const products =
    productIds.length > 0 ? await loadProductContexts({ ids: productIds, limit: productIds.length }) : [];
  const productTitle = new Map(products.map((product) => [product.id, product.title]));

  return items.map((history) => ({
    history,
    channels: uniqueContentChannels([history.channel]),
    publishedAt: history.publishedAt ?? history.createdAt,
    productTitle: history.productId ? productTitle.get(history.productId) ?? null : null,
    campaignName: null,
    agendaTopic: null,
    agendaKey: null,
    hook: null,
    cta: null,
  }));
}

function recencyKey(bundle: ContentMemoryBundle): string {
  return bundle.publishedAt ?? bundle.history.createdAt ?? "";
}

export async function loadContentMemoryBundles(
  params: ParsedContentMemoryLoadParams,
): Promise<ContentMemoryBundle[]> {
  const [ai, legacy] = await Promise.all([loadAiBundles(params), loadLegacyBundles(params)]);
  const seen = new Set<string>();
  const merged: ContentMemoryBundle[] = [];
  for (const bundle of [...ai, ...legacy].sort((a, b) => recencyKey(b).localeCompare(recencyKey(a)))) {
    const key = `${bundle.history.sourceType}:${bundle.history.sourceId}`;
    if (seen.has(key)) continue;
    seen.add(key);
    merged.push(bundle);
  }
  return merged.slice(0, params.limit);
}
