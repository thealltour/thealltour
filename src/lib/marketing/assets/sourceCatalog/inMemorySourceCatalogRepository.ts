import { randomUUID } from "node:crypto";

import { MarketingSourceCatalogError } from "@/lib/marketing/assets/sourceCatalog/errors";
import type { MarketingMediaSourceCatalogRepository } from "@/lib/marketing/assets/sourceCatalog/repository";
import type {
  ListMarketingMediaSourcesFilter,
  MarketingMediaSourceRecord,
  MarketingMediaSourceUsageRecord,
  RecordMarketingMediaSourcePickInput,
  RegisterExternalMarketingMediaSourceInput,
  RegisterMarketingMediaSourceInput,
  UpdateMarketingMediaSourceInput,
} from "@/lib/marketing/assets/sourceCatalog/types";
import {
  assertBusinessId,
  assertOptionalBusinessId,
  assertProviderAssetId,
  assertProviderIdentifier,
  assertSha256Hex,
  validateRegisterExternalMarketingMediaSourceInput,
  validateRegisterMarketingMediaSourceInput,
  validateUpdateMarketingMediaSourceInput,
} from "@/lib/marketing/assets/sourceCatalog/validation";

function cloneSource(row: MarketingMediaSourceRecord): MarketingMediaSourceRecord {
  return { ...row, metadata: { ...row.metadata } };
}

function cloneUsage(row: MarketingMediaSourceUsageRecord): MarketingMediaSourceUsageRecord {
  return { ...row };
}

function pickKey(sourceId: string, candidateId: string, sceneKey: string | null): string {
  return `${sourceId}\0${candidateId}\0${sceneKey ?? ""}`;
}

function providerKey(provider: string, providerAssetId: string): string {
  return `${provider}\0${providerAssetId}`;
}

export class InMemoryMarketingMediaSourceCatalogRepository
  implements MarketingMediaSourceCatalogRepository
{
  readonly #sources = new Map<string, MarketingMediaSourceRecord>();
  readonly #byProvider = new Map<string, string>();
  readonly #usages = new Map<string, MarketingMediaSourceUsageRecord>();
  readonly #pickKeys = new Set<string>();

  async registerSource(input: RegisterMarketingMediaSourceInput): Promise<MarketingMediaSourceRecord> {
    const validated = validateRegisterMarketingMediaSourceInput(input);
    if (validated.provider && validated.providerAssetId) {
      const existingId = this.#byProvider.get(
        providerKey(validated.provider, validated.providerAssetId),
      );
      if (existingId) {
        const existing = this.#sources.get(existingId);
        if (existing) return cloneSource(existing);
      }
    }
    return this.#insert(validated);
  }

  async registerExternalSource(
    input: RegisterExternalMarketingMediaSourceInput,
  ): Promise<MarketingMediaSourceRecord> {
    const validated = validateRegisterExternalMarketingMediaSourceInput(input);
    const key = providerKey(validated.provider!, validated.providerAssetId!);
    const existingId = this.#byProvider.get(key);
    if (existingId) {
      const existing = this.#sources.get(existingId);
      if (existing) return cloneSource(existing);
    }
    return this.#insert(validated);
  }

  async getById(id: string): Promise<MarketingMediaSourceRecord | null> {
    const row = this.#sources.get(assertBusinessId(id, "id"));
    return row ? cloneSource(row) : null;
  }

  async findByProviderIdentity(params: {
    provider: string;
    providerAssetId: string;
  }): Promise<MarketingMediaSourceRecord | null> {
    const provider = assertProviderIdentifier(params.provider);
    const providerAssetId = assertProviderAssetId(params.providerAssetId);
    const id = this.#byProvider.get(providerKey(provider, providerAssetId));
    if (!id) return null;
    const row = this.#sources.get(id);
    return row ? cloneSource(row) : null;
  }

  async findBySha256(sha256: string): Promise<MarketingMediaSourceRecord[]> {
    const digest = assertSha256Hex(sha256);
    return [...this.#sources.values()]
      .filter((row) => row.sha256 === digest)
      .map(cloneSource);
  }

  async list(filter: ListMarketingMediaSourcesFilter = {}): Promise<MarketingMediaSourceRecord[]> {
    const limit = filter.limit ?? 100;
    if (!Number.isInteger(limit) || limit < 1 || limit > 500) {
      throw new MarketingSourceCatalogError("limit must be an integer 1..500");
    }
    let rows = [...this.#sources.values()];
    if (filter.sourceKind) rows = rows.filter((r) => r.sourceKind === filter.sourceKind);
    if (filter.storageClass) rows = rows.filter((r) => r.storageClass === filter.storageClass);
    if (filter.status) rows = rows.filter((r) => r.status === filter.status);
    if (filter.provider) rows = rows.filter((r) => r.provider === filter.provider);
    if (filter.isPinned != null) rows = rows.filter((r) => r.isPinned === filter.isPinned);
    rows.sort((a, b) => b.createdAt.localeCompare(a.createdAt));
    return rows.slice(0, limit).map(cloneSource);
  }

  async updateSource(input: UpdateMarketingMediaSourceInput): Promise<MarketingMediaSourceRecord> {
    const patch = validateUpdateMarketingMediaSourceInput(input);
    const existing = this.#sources.get(patch.id);
    if (!existing) {
      throw new MarketingSourceCatalogError("source not found", "not_found");
    }
    const now = new Date().toISOString();
    const next: MarketingMediaSourceRecord = {
      ...existing,
      sourcePageUrl: "sourcePageUrl" in patch ? (patch.sourcePageUrl ?? null) : existing.sourcePageUrl,
      remoteAssetUrl:
        "remoteAssetUrl" in patch ? (patch.remoteAssetUrl ?? null) : existing.remoteAssetUrl,
      remoteAssetUrlExpiresAt:
        "remoteAssetUrlExpiresAt" in patch
          ? (patch.remoteAssetUrlExpiresAt ?? null)
          : existing.remoteAssetUrlExpiresAt,
      managedRelativePath:
        "managedRelativePath" in patch
          ? (patch.managedRelativePath ?? null)
          : existing.managedRelativePath,
      mediaType: patch.mediaType ?? existing.mediaType,
      mimeType: "mimeType" in patch ? (patch.mimeType ?? null) : existing.mimeType,
      width: "width" in patch ? (patch.width ?? null) : existing.width,
      height: "height" in patch ? (patch.height ?? null) : existing.height,
      durationMs: "durationMs" in patch ? (patch.durationMs ?? null) : existing.durationMs,
      orientation: "orientation" in patch ? (patch.orientation ?? null) : existing.orientation,
      sha256: "sha256" in patch ? (patch.sha256 ?? null) : existing.sha256,
      creatorName: "creatorName" in patch ? (patch.creatorName ?? null) : existing.creatorName,
      rightsKind: patch.rightsKind ?? existing.rightsKind,
      licenseName: "licenseName" in patch ? (patch.licenseName ?? null) : existing.licenseName,
      licenseUrl: "licenseUrl" in patch ? (patch.licenseUrl ?? null) : existing.licenseUrl,
      attributionText:
        "attributionText" in patch ? (patch.attributionText ?? null) : existing.attributionText,
      rightsNote: "rightsNote" in patch ? (patch.rightsNote ?? null) : existing.rightsNote,
      metadata: patch.metadata ?? existing.metadata,
      isPinned: patch.isPinned ?? existing.isPinned,
      disposition: patch.disposition ?? existing.disposition,
      storageClass: patch.storageClass ?? existing.storageClass,
      status: patch.status ?? existing.status,
      updatedAt: now,
    };

    if (next.isPinned) {
      next.disposition = "pin";
    }

    this.#sources.set(next.id, next);
    return cloneSource(next);
  }

  async recordPick(
    input: RecordMarketingMediaSourcePickInput,
  ): Promise<MarketingMediaSourceUsageRecord> {
    const sourceId = assertBusinessId(input.sourceId, "sourceId");
    const candidateId = assertBusinessId(input.candidateId, "candidateId");
    const productionRequestId = assertOptionalBusinessId(
      input.productionRequestId ?? null,
      "productionRequestId",
    );
    const sceneKey = assertOptionalBusinessId(input.sceneKey ?? null, "sceneKey");

    const source = this.#sources.get(sourceId);
    if (!source) {
      throw new MarketingSourceCatalogError("source not found", "not_found");
    }

    const key = pickKey(sourceId, candidateId, sceneKey);
    if (this.#pickKeys.has(key)) {
      throw new MarketingSourceCatalogError(
        "duplicate pick for source/candidate/scene",
        "duplicate_pick",
      );
    }

    const usage: MarketingMediaSourceUsageRecord = {
      id: randomUUID(),
      sourceId,
      candidateId,
      productionRequestId,
      sceneKey,
      relation: "picked",
      createdAt: new Date().toISOString(),
    };
    this.#usages.set(usage.id, usage);
    this.#pickKeys.add(key);
    return cloneUsage(usage);
  }

  async setScenePick(
    input: RecordMarketingMediaSourcePickInput,
  ): Promise<MarketingMediaSourceUsageRecord> {
    const sourceId = assertBusinessId(input.sourceId, "sourceId");
    const candidateId = assertBusinessId(input.candidateId, "candidateId");
    const sceneKey = assertOptionalBusinessId(input.sceneKey ?? null, "sceneKey");

    const existingForScene = [...this.#usages.values()].filter(
      (u) => u.candidateId === candidateId && (u.sceneKey ?? null) === sceneKey,
    );
    if (
      existingForScene.length === 1 &&
      existingForScene[0]!.sourceId === sourceId
    ) {
      return cloneUsage(existingForScene[0]!);
    }

    for (const usage of existingForScene) {
      this.#usages.delete(usage.id);
      this.#pickKeys.delete(pickKey(usage.sourceId, usage.candidateId, usage.sceneKey));
    }

    return this.recordPick(input);
  }

  async listUsagesForCandidate(candidateId: string): Promise<MarketingMediaSourceUsageRecord[]> {
    const id = assertBusinessId(candidateId, "candidateId");
    return [...this.#usages.values()]
      .filter((u) => u.candidateId === id)
      .sort((a, b) => b.createdAt.localeCompare(a.createdAt))
      .map(cloneUsage);
  }

  async listUsagesForSource(sourceId: string): Promise<MarketingMediaSourceUsageRecord[]> {
    const id = assertBusinessId(sourceId, "sourceId");
    return [...this.#usages.values()]
      .filter((u) => u.sourceId === id)
      .sort((a, b) => b.createdAt.localeCompare(a.createdAt))
      .map(cloneUsage);
  }

  #insert(
    validated: ReturnType<typeof validateRegisterMarketingMediaSourceInput>,
  ): MarketingMediaSourceRecord {
    const now = new Date().toISOString();
    const record: MarketingMediaSourceRecord = {
      id: randomUUID(),
      contractVersion: validated.contractVersion,
      sourceKind: validated.sourceKind,
      storageClass: validated.storageClass,
      disposition: validated.disposition,
      provider: validated.provider,
      providerAssetId: validated.providerAssetId,
      sourcePageUrl: validated.sourcePageUrl,
      remoteAssetUrl: validated.remoteAssetUrl,
      remoteAssetUrlExpiresAt: validated.remoteAssetUrlExpiresAt,
      managedRelativePath: validated.managedRelativePath,
      mediaType: validated.mediaType,
      mimeType: validated.mimeType,
      width: validated.width,
      height: validated.height,
      durationMs: validated.durationMs,
      orientation: validated.orientation,
      sha256: validated.sha256,
      creatorName: validated.creatorName,
      rightsKind: validated.rightsKind,
      licenseName: validated.licenseName,
      licenseUrl: validated.licenseUrl,
      attributionText: validated.attributionText,
      rightsNote: validated.rightsNote,
      metadata: { ...validated.metadata },
      isPinned: validated.isPinned,
      status: validated.status,
      createdAt: now,
      updatedAt: now,
    };
    this.#sources.set(record.id, record);
    if (record.provider && record.providerAssetId) {
      this.#byProvider.set(providerKey(record.provider, record.providerAssetId), record.id);
    }
    return cloneSource(record);
  }
}

export function createInMemoryMarketingMediaSourceCatalogRepository(): InMemoryMarketingMediaSourceCatalogRepository {
  return new InMemoryMarketingMediaSourceCatalogRepository();
}
