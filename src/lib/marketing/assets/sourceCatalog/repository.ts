import type {
  ListMarketingMediaSourcesFilter,
  MarketingMediaSourceRecord,
  MarketingMediaSourceUsageRecord,
  RecordMarketingMediaSourcePickInput,
  RegisterExternalMarketingMediaSourceInput,
  RegisterMarketingMediaSourceInput,
  UpdateMarketingMediaSourceInput,
} from "@/lib/marketing/assets/sourceCatalog/types";

/**
 * Thin Global Source Catalog repository.
 * Does not download stock, render video, or mutate Candidate HDD packages.
 */
export interface MarketingMediaSourceCatalogRepository {
  registerSource(input: RegisterMarketingMediaSourceInput): Promise<MarketingMediaSourceRecord>;

  /**
   * Idempotent on (provider, providerAssetId).
   * Returns existing row without destructive rights overwrite when identity matches.
   */
  registerExternalSource(
    input: RegisterExternalMarketingMediaSourceInput,
  ): Promise<MarketingMediaSourceRecord>;

  getById(id: string): Promise<MarketingMediaSourceRecord | null>;

  findByProviderIdentity(params: {
    provider: string;
    providerAssetId: string;
  }): Promise<MarketingMediaSourceRecord | null>;

  /** Lookup only — does not force-merge provenance rows with identical hashes. */
  findBySha256(sha256: string): Promise<MarketingMediaSourceRecord[]>;

  list(filter?: ListMarketingMediaSourcesFilter): Promise<MarketingMediaSourceRecord[]>;

  updateSource(input: UpdateMarketingMediaSourceInput): Promise<MarketingMediaSourceRecord>;

  /** Records a PICK. Does not change storageClass / disposition / ingest state. */
  recordPick(input: RecordMarketingMediaSourcePickInput): Promise<MarketingMediaSourceUsageRecord>;

  /**
   * Replace PICK for a scene: clear existing usages for (candidateId, sceneKey), then recordPick.
   * Same source+scene is idempotent (returns existing without delete churn when already sole pick).
   * No migration required — uses DELETE + INSERT under existing unique index.
   */
  setScenePick(input: RecordMarketingMediaSourcePickInput): Promise<MarketingMediaSourceUsageRecord>;

  listUsagesForCandidate(candidateId: string): Promise<MarketingMediaSourceUsageRecord[]>;

  listUsagesForSource(sourceId: string): Promise<MarketingMediaSourceUsageRecord[]>;
}
