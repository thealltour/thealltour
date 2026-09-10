import { describe, expect, it } from "vitest";

import {
  defaultDispositionForSource,
  defaultStorageClassForSource,
  isAutoDeleteEligible,
} from "@/lib/marketing/assets/shortform/storagePolicy";
import { createInMemoryMarketingMediaSourceCatalogRepository } from "@/lib/marketing/assets/sourceCatalog/inMemorySourceCatalogRepository";
import { marketingMediaSourceToAutoDeleteInput } from "@/lib/marketing/assets/sourceCatalog/policyBridge";
import { MarketingSourceCatalogError } from "@/lib/marketing/assets/sourceCatalog/errors";
import {
  rightsKindImpliesCommercialClearance,
  validateRegisterMarketingMediaSourceInput,
} from "@/lib/marketing/assets/sourceCatalog/validation";

const SHA_A = "a".repeat(64);
const SHA_B = "b".repeat(64);

describe("SV-2 global source catalog", () => {
  it("registers remote-reference-only external_ref without local binary", async () => {
    const repo = createInMemoryMarketingMediaSourceCatalogRepository();
    const source = await repo.registerExternalSource({
      sourceKind: "pexels",
      provider: "pexels",
      providerAssetId: "123456",
      sourcePageUrl: "https://www.pexels.com/video/123456/",
      remoteAssetUrl: "https://cdn.example.com/v/123456.mp4",
      rightsKind: "provider_license",
      mediaType: "video",
    });

    expect(source.storageClass).toBe("external_ref");
    expect(source.disposition).toBe("pick_only");
    expect(source.managedRelativePath).toBeNull();
    expect(source.provider).toBe("pexels");
    expect(source.providerAssetId).toBe("123456");
  });

  it("dedupes provider+providerAssetId and allows same asset id under different providers", async () => {
    const repo = createInMemoryMarketingMediaSourceCatalogRepository();
    const first = await repo.registerExternalSource({
      sourceKind: "pexels",
      provider: "pexels",
      providerAssetId: "999",
      sourcePageUrl: "https://www.pexels.com/video/999/",
    });
    const again = await repo.registerExternalSource({
      sourceKind: "pexels",
      provider: "pexels",
      providerAssetId: "999",
      sourcePageUrl: "https://www.pexels.com/video/999/?utm=overwrite",
      rightsKind: "unknown",
    });
    expect(again.id).toBe(first.id);
    expect(again.sourcePageUrl).toBe(first.sourcePageUrl);
    expect(again.rightsKind).toBe(first.rightsKind);

    const pixabay = await repo.registerExternalSource({
      sourceKind: "pixabay",
      provider: "pixabay",
      providerAssetId: "999",
      sourcePageUrl: "https://pixabay.com/videos/999/",
    });
    expect(pixabay.id).not.toBe(first.id);
  });

  it("supports sha256 lookup without forcing provenance merge", async () => {
    const repo = createInMemoryMarketingMediaSourceCatalogRepository();
    const own = await repo.registerSource({
      sourceKind: "own",
      sha256: SHA_A,
      managedRelativePath: "source/own/clip-a.mp4",
      rightsKind: "owned",
    });
    const partner = await repo.registerSource({
      sourceKind: "partner",
      sha256: SHA_A,
      managedRelativePath: "source/partner/clip-a.mp4",
      rightsKind: "partner_authorized",
    });
    expect(own.id).not.toBe(partner.id);
    const hits = await repo.findBySha256(SHA_A);
    expect(hits).toHaveLength(2);
    expect(hits.map((h) => h.sourceKind).sort()).toEqual(["own", "partner"]);
    expect(await repo.findBySha256(SHA_B)).toEqual([]);
  });

  it("rejects path traversal, absolute paths, and invalid URL schemes", async () => {
    const repo = createInMemoryMarketingMediaSourceCatalogRepository();

    await expect(
      repo.registerSource({
        sourceKind: "own",
        managedRelativePath: "../escape.mp4",
      }),
    ).rejects.toBeInstanceOf(MarketingSourceCatalogError);

    await expect(
      repo.registerSource({
        sourceKind: "own",
        managedRelativePath: "/mnt/HDD2TB/secret.mp4",
      }),
    ).rejects.toBeInstanceOf(MarketingSourceCatalogError);

    await expect(
      repo.registerExternalSource({
        sourceKind: "pexels",
        provider: "pexels",
        providerAssetId: "1",
        remoteAssetUrl: "file:///etc/passwd",
      }),
    ).rejects.toMatchObject({ code: "invalid_url_scheme" });

    await expect(
      repo.registerExternalSource({
        sourceKind: "pexels",
        provider: "pexels",
        providerAssetId: "2",
        sourcePageUrl: "javascript:alert(1)",
      }),
    ).rejects.toMatchObject({ code: "invalid_url_scheme" });
  });

  it("allows unknown rights without implying commercial clearance", () => {
    const validated = validateRegisterMarketingMediaSourceInput({
      sourceKind: "unknown",
      rightsKind: "unknown",
    });
    expect(validated.rightsKind).toBe("unknown");
    expect(rightsKindImpliesCommercialClearance("unknown")).toBe(false);
    expect(rightsKindImpliesCommercialClearance("owned")).toBe(true);
  });

  it("records PICK without mutating storageClass/disposition to ingest", async () => {
    const repo = createInMemoryMarketingMediaSourceCatalogRepository();
    const source = await repo.registerExternalSource({
      sourceKind: "pexels",
      provider: "pexels",
      providerAssetId: "777",
      sourcePageUrl: "https://www.pexels.com/video/777/",
    });
    expect(source.storageClass).toBe("external_ref");
    expect(source.disposition).toBe("pick_only");

    const usage = await repo.recordPick({
      sourceId: source.id,
      candidateId: "cmc_test_candidate",
      sceneKey: "scene_01",
      productionRequestId: "mpr_test_request",
    });
    expect(usage.relation).toBe("picked");

    const after = await repo.getById(source.id);
    expect(after?.storageClass).toBe("external_ref");
    expect(after?.disposition).toBe("pick_only");
    expect(after?.managedRelativePath).toBeNull();

    await expect(
      repo.recordPick({
        sourceId: source.id,
        candidateId: "cmc_test_candidate",
        sceneKey: "scene_01",
      }),
    ).rejects.toMatchObject({ code: "duplicate_pick" });

    const usages = await repo.listUsagesForCandidate("cmc_test_candidate");
    expect(usages).toHaveLength(1);
  });

  it("setScenePick replaces another source for the same scene", async () => {
    const repo = createInMemoryMarketingMediaSourceCatalogRepository();
    const a = await repo.registerExternalSource({
      sourceKind: "pexels",
      provider: "pexels",
      providerAssetId: "111",
      sourcePageUrl: "https://www.pexels.com/video/111/",
      rightsKind: "provider_license",
    });
    const b = await repo.registerExternalSource({
      sourceKind: "pexels",
      provider: "pexels",
      providerAssetId: "222",
      sourcePageUrl: "https://www.pexels.com/video/222/",
      rightsKind: "provider_license",
    });
    await repo.setScenePick({
      sourceId: a.id,
      candidateId: "cmc_replace",
      sceneKey: "scene-001",
    });
    const replaced = await repo.setScenePick({
      sourceId: b.id,
      candidateId: "cmc_replace",
      sceneKey: "scene-001",
    });
    expect(replaced.sourceId).toBe(b.id);
    const usages = await repo.listUsagesForCandidate("cmc_replace");
    expect(usages).toHaveLength(1);
    expect(usages[0]!.sourceId).toBe(b.id);

    const again = await repo.setScenePick({
      sourceId: b.id,
      candidateId: "cmc_replace",
      sceneKey: "scene-001",
    });
    expect(again.id).toBe(replaced.id);
  });

  it("keeps own/partner compatible with SV-1 local_master never-delete", async () => {
    const repo = createInMemoryMarketingMediaSourceCatalogRepository();
    const partner = await repo.registerSource({
      sourceKind: "partner",
      managedRelativePath: "source/partner/hotel.mp4",
      rightsKind: "partner_authorized",
      isPinned: false,
    });
    expect(partner.storageClass).toBe(defaultStorageClassForSource("partner"));
    expect(partner.disposition).toBe(defaultDispositionForSource("partner"));
    expect(partner.storageClass).toBe("local_master");
    expect(partner.disposition).toBe("ingest");

    const eligibility = isAutoDeleteEligible(
      marketingMediaSourceToAutoDeleteInput(partner, {
        nowMs: Date.parse(partner.createdAt) + 365 * 24 * 60 * 60 * 1000,
      }),
    );
    expect(eligibility.eligible).toBe(false);
  });

  it("pinned catalog source remains non-auto-deletable via SV-1 bridge", async () => {
    const repo = createInMemoryMarketingMediaSourceCatalogRepository();
    const generated = await repo.registerSource({
      sourceKind: "generated_ai",
      provider: "fal",
      providerAssetId: "gen_1",
      isPinned: true,
      rightsKind: "generated",
    });
    expect(generated.disposition).toBe("pin");
    expect(generated.isPinned).toBe(true);
    expect(generated.storageClass).toBe("generated_source");

    const eligibility = isAutoDeleteEligible(
      marketingMediaSourceToAutoDeleteInput(generated, {
        nowMs: Date.parse(generated.createdAt) + 365 * 24 * 60 * 60 * 1000,
        generatedUsedInContent: true,
      }),
    );
    expect(eligibility.eligible).toBe(false);
  });
});
