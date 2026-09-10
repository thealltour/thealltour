import type { MarketingMediaSourceCatalogRepository } from "@/lib/marketing/assets/sourceCatalog/repository";
import type { MarketingMediaSourceRecord } from "@/lib/marketing/assets/sourceCatalog/types";
import type {
  ShortformNormalizedHit,
  ShortformProviderSearchInput,
  ShortformProviderSearchResult,
  ShortformSourceProvider,
} from "@/lib/marketing/assets/shortform/resolver/provider";
import { inferOrientation, tokenOverlapScore } from "@/lib/marketing/assets/shortform/resolver/scoring";

function recordToHit(record: MarketingMediaSourceRecord): ShortformNormalizedHit | null {
  if (record.status !== "active") return null;
  let mediaType: ShortformNormalizedHit["mediaType"] | null = null;
  if (record.mediaType === "video") mediaType = "video";
  else if (record.mediaType === "image") mediaType = "image";
  else return null;

  const tags: string[] = [];
  const meta = record.metadata;
  if (typeof meta.subject === "string") tags.push(meta.subject);
  if (Array.isArray(meta.tags)) {
    for (const tag of meta.tags) {
      if (typeof tag === "string") tags.push(tag);
    }
  }
  if (typeof meta.destination === "string") tags.push(meta.destination);
  if (typeof meta.place === "string") tags.push(meta.place);

  return {
    origin: "internal_catalog",
    catalogSourceId: record.id,
    provider: record.provider,
    providerAssetId: record.providerAssetId,
    mediaType,
    sourcePageUrl: record.sourcePageUrl,
    remoteAssetUrl: record.remoteAssetUrl,
    remoteAssetUrlExpiresAt: record.remoteAssetUrlExpiresAt,
    previewUrl: null,
    width: record.width,
    height: record.height,
    durationMs: record.durationMs,
    orientation: record.orientation ?? inferOrientation(record.width, record.height),
    creatorName: record.creatorName,
    rightsKind: record.rightsKind,
    licenseName: record.licenseName,
    licenseUrl: record.licenseUrl,
    attributionText: record.attributionText,
    sha256: record.sha256,
    tags,
    titleOrSubject: typeof meta.subject === "string" ? meta.subject : record.creatorName,
    storageClassHint: record.storageClass,
    factualMatchHint: null,
  };
}

export function createInternalCatalogSourceProvider(input: {
  catalog: MarketingMediaSourceCatalogRepository;
}): ShortformSourceProvider {
  return {
    providerId: "internal_catalog",
    async search(params: ShortformProviderSearchInput): Promise<ShortformProviderSearchResult> {
      const rows = await input.catalog.list({ status: "active", limit: 200 });
      const queryTexts = [params.scene.visual.subject, ...params.queries, ...params.scene.visual.searchQueries];
      const scored = rows
        .map(recordToHit)
        .filter((hit): hit is ShortformNormalizedHit => hit != null)
        .map((hit) => ({
          hit,
          overlap: tokenOverlapScore(queryTexts, [
            hit.titleOrSubject ?? "",
            ...hit.tags,
            hit.attributionText ?? "",
          ]),
        }))
        .filter((row) => row.overlap > 0 || row.hit.catalogSourceId != null)
        .sort((a, b) => b.overlap - a.overlap)
        .slice(0, params.limit)
        .map((row) => row.hit);

      // Keep weak internal hits only if overlap > 0 to avoid junk reuse
      const hits = scored.filter((hit) => {
        const overlap = tokenOverlapScore(queryTexts, [hit.titleOrSubject ?? "", ...hit.tags]);
        return overlap >= 0.15;
      });

      return {
        providerId: "internal_catalog",
        status: hits.length > 0 ? "success" : "empty",
        hits,
        message: hits.length > 0 ? null : "no_internal_matches",
      };
    },
  };
}
