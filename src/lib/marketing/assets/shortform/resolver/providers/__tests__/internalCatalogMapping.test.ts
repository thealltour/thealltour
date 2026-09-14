import { describe, expect, it } from "vitest";

import { createInMemoryMarketingMediaSourceCatalogRepository } from "@/lib/marketing/assets/sourceCatalog/inMemorySourceCatalogRepository";
import { recordToHit } from "@/lib/marketing/assets/shortform/resolver/providers/internalCatalog";

describe("internalCatalog recordToHit mapping", () => {
  it("maps metadata.previewUrl and creatorName fallbacks into resolve DTO", async () => {
    const catalog = createInMemoryMarketingMediaSourceCatalogRepository();
    const withPreview = await catalog.registerSource({
      sourceKind: "own",
      mediaType: "video",
      rightsKind: "owned",
      managedRelativePath: "source/own/bridge.mp4",
      width: 1080,
      height: 1920,
      durationMs: 8000,
      orientation: "portrait",
      metadata: {
        subject: "Ba Na Hills Golden Bridge",
        previewUrl: "https://cdn.example.com/preview/bridge.jpg",
        tags: ["Ba Na Hills"],
      },
    });

    const hit = recordToHit(withPreview);
    expect(hit).not.toBeNull();
    expect(hit!.previewUrl).toBe("https://cdn.example.com/preview/bridge.jpg");
    expect(hit!.creatorName).toBe("Ba Na Hills Golden Bridge");

    const imageNoCreator = await catalog.registerSource({
      sourceKind: "own",
      mediaType: "image",
      rightsKind: "owned",
      managedRelativePath: "source/own/beach.jpg",
      remoteAssetUrl: "https://cdn.example.com/assets/beach.jpg",
      width: 1200,
      height: 800,
      orientation: "landscape",
      metadata: { subject: "Da Nang beach", tags: ["beach"] },
    });
    const imageHit = recordToHit(imageNoCreator);
    expect(imageHit!.previewUrl).toBe("https://cdn.example.com/assets/beach.jpg");
    expect(imageHit!.creatorName).toBe("Da Nang beach");

    const ownBare = await catalog.registerSource({
      sourceKind: "own",
      mediaType: "video",
      rightsKind: "owned",
      managedRelativePath: "source/own/local-only.mp4",
      width: 1080,
      height: 1920,
      durationMs: 4000,
      orientation: "portrait",
      metadata: { tags: ["generic clip"] },
    });
    const bareHit = recordToHit(ownBare);
    expect(bareHit!.previewUrl).toBeNull();
    expect(bareHit!.creatorName).toBe("자체 소스");
  });

  it("prefers creatorName then attributionText over subject", async () => {
    const catalog = createInMemoryMarketingMediaSourceCatalogRepository();
    const named = await catalog.registerSource({
      sourceKind: "partner",
      mediaType: "image",
      rightsKind: "partner_authorized",
      managedRelativePath: "source/partner/shot.jpg",
      remoteAssetUrl: "https://cdn.example.com/shot.jpg",
      creatorName: "Studio Han",
      attributionText: "Photo courtesy Partner Co.",
      width: 800,
      height: 800,
      orientation: "square",
      metadata: {
        subject: "ignored subject",
        previewUrl: "https://cdn.example.com/preview/shot.jpg",
      },
    });
    const hit = recordToHit(named);
    expect(hit!.creatorName).toBe("Studio Han");
    expect(hit!.previewUrl).toBe("https://cdn.example.com/preview/shot.jpg");

    const attributed = await catalog.registerSource({
      sourceKind: "partner",
      mediaType: "image",
      rightsKind: "partner_authorized",
      managedRelativePath: "source/partner/shot2.jpg",
      remoteAssetUrl: "https://cdn.example.com/shot2.jpg",
      attributionText: "Photo courtesy Partner Co.",
      width: 800,
      height: 800,
      orientation: "square",
      metadata: { subject: "fallback subject" },
    });
    expect(recordToHit(attributed)!.creatorName).toBe("Photo courtesy Partner Co.");
  });
});
