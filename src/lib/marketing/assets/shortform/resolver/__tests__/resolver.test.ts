import { describe, expect, it, vi } from "vitest";

import { createInMemoryMarketingMediaSourceCatalogRepository } from "@/lib/marketing/assets/sourceCatalog/inMemorySourceCatalogRepository";
import {
  SHORT_VIDEO_BRIEF_CONTRACT,
  type ShortVideoSceneRequirement,
} from "@/lib/marketing/assets/shortVideoBrief/contracts";
import { SHORTFORM_RESOLVER_FINAL_CANDIDATE_LIMIT } from "@/lib/marketing/assets/shortform/resolver/constants";
import { SHORTFORM_SOURCE_RESOLUTION_CONTRACT } from "@/lib/marketing/assets/shortform/resolver/contracts";
import { createInternalCatalogSourceProvider } from "@/lib/marketing/assets/shortform/resolver/providers/internalCatalog";
import {
  createPexelsSourceProvider,
  normalizePexelsVideoSearchResponse,
} from "@/lib/marketing/assets/shortform/resolver/providers/pexels";
import {
  createPixabaySourceProvider,
  normalizePixabayVideoSearchResponse,
} from "@/lib/marketing/assets/shortform/resolver/providers/pixabay";
import type {
  ShortformNormalizedHit,
  ShortformSourceProvider,
} from "@/lib/marketing/assets/shortform/resolver/provider";
import { resolveShortVideoSources } from "@/lib/marketing/assets/shortform/resolver/resolveBrief";
import { resolveSceneSources } from "@/lib/marketing/assets/shortform/resolver/resolveScene";
import { createMemorySourceSearchCache } from "@/lib/marketing/assets/shortform/resolver/searchCache";

function scene(overrides?: Partial<ShortVideoSceneRequirement>): ShortVideoSceneRequirement {
  const baseVisual: ShortVideoSceneRequirement["visual"] = {
    subject: "Da Nang Ba Na Hills Golden Bridge",
    searchQueries: ["Da Nang Ba Na Hills Golden Bridge", "Ba Na Hills Vietnam"],
    factualVisualRequired: true,
    mediaPreference: "video",
    photoMotionAllowed: true,
    generatedVideoAllowed: false,
    sourcePreference: { internalFirst: true, stockAllowed: true },
  };
  return {
    sceneId: "scene-001",
    order: 1,
    targetDurationMs: 6000,
    narrationSegmentRefs: ["hook"],
    purpose: "hook",
    ...overrides,
    visual: {
      ...baseVisual,
      ...(overrides?.visual ?? {}),
    },
  };
}

function staticProvider(
  providerId: string,
  hits: ShortformNormalizedHit[],
  status: "success" | "empty" | "error" | "disabled" | "unavailable" = "success",
): ShortformSourceProvider {
  return {
    providerId,
    async search() {
      return { providerId, status, hits, message: status === "success" ? null : status };
    },
  };
}

const pexelsFixture = {
  page: 1,
  per_page: 1,
  total_results: 1,
  videos: [
    {
      id: 2499611,
      width: 1080,
      height: 1920,
      url: "https://www.pexels.com/video/2499611/",
      image: "https://images.pexels.com/videos/2499611/free-video-2499611.jpg",
      duration: 22,
      user: { id: 1, name: "Joey Farina", url: "https://www.pexels.com/@joey" },
      video_files: [
        {
          id: 1,
          quality: "hd",
          file_type: "video/mp4",
          width: 1080,
          height: 1920,
          link: "https://example.com/pexels-2499611.mp4",
        },
      ],
    },
  ],
};

const pixabayFixture = {
  total: 1,
  totalHits: 1,
  hits: [
    {
      id: 125,
      pageURL: "https://pixabay.com/videos/id-125/",
      type: "film",
      tags: "bridge, mountain, vietnam",
      duration: 12,
      videos: {
        medium: {
          url: "https://cdn.pixabay.com/video/example_medium.mp4",
          width: 1080,
          height: 1920,
          size: 1000,
          thumbnail: "https://cdn.pixabay.com/video/example.jpg",
        },
      },
      user: "Coverr",
    },
  ],
};

describe("SV-4 source resolver", () => {
  it("prefers internal catalog and can short-circuit externals", async () => {
    const catalog = createInMemoryMarketingMediaSourceCatalogRepository();
    const registered = await catalog.registerSource({
      sourceKind: "own",
      mediaType: "video",
      rightsKind: "owned",
      managedRelativePath: "source/own/bana.mp4",
      width: 1080,
      height: 1920,
      durationMs: 8000,
      orientation: "portrait",
      metadata: { subject: "Da Nang Ba Na Hills Golden Bridge", tags: ["Ba Na Hills", "Golden Bridge"] },
    });

    const pexelsCalls = vi.fn(async () => ({
      providerId: "pexels",
      status: "success" as const,
      hits: normalizePexelsVideoSearchResponse(pexelsFixture),
      message: null,
    }));

    const resolution = await resolveSceneSources({
      scene: scene(),
      providers: {
        internal: createInternalCatalogSourceProvider({ catalog }),
        pexels: { providerId: "pexels", search: pexelsCalls },
        pixabay: staticProvider("pixabay", []),
      },
    });

    expect(resolution.recommendedCandidate?.catalogSourceId).toBe(registered.id);
    expect(resolution.recommendedCandidate?.origin).toBe("internal_catalog");
    expect(pexelsCalls).not.toHaveBeenCalled();
    expect(resolution.attemptedSources.some((a) => a.providerId === "pexels" && a.status === "skipped")).toBe(
      true,
    );
  });

  it("falls through internal empty → pexels → pixabay on failure", async () => {
    const catalog = createInMemoryMarketingMediaSourceCatalogRepository();
    const resolution = await resolveSceneSources({
      scene: scene({
        visual: {
          subject: "generic beach vibe",
          searchQueries: ["generic beach vibe"],
          factualVisualRequired: false,
          mediaPreference: "video",
          photoMotionAllowed: true,
          generatedVideoAllowed: true,
          sourcePreference: { internalFirst: true, stockAllowed: true },
        },
      }),
      providers: {
        internal: createInternalCatalogSourceProvider({ catalog }),
        pexels: staticProvider("pexels", [], "error"),
        pixabay: staticProvider(
          "pixabay",
          normalizePixabayVideoSearchResponse(pixabayFixture),
        ),
      },
      shortCircuitOnInternalAutoPick: false,
    });

    expect(resolution.attemptedSources.find((a) => a.providerId === "pexels")?.status).toBe("error");
    expect(resolution.candidates.some((c) => c.origin === "pixabay")).toBe(true);
  });

  it("treats missing API key as disabled and continues", async () => {
    const catalog = createInMemoryMarketingMediaSourceCatalogRepository();
    const pexels = createPexelsSourceProvider({ apiKey: "" });
    const result = await pexels.search({
      scene: scene(),
      queries: ["nature"],
      limit: 5,
    });
    expect(result.status).toBe("disabled");

    const resolution = await resolveSceneSources({
      scene: scene({
        visual: {
          subject: "ocean waves",
          searchQueries: ["ocean waves"],
          factualVisualRequired: false,
          mediaPreference: "video",
          photoMotionAllowed: false,
          generatedVideoAllowed: true,
          sourcePreference: { internalFirst: true, stockAllowed: true },
        },
      }),
      providers: {
        internal: createInternalCatalogSourceProvider({ catalog }),
        pexels,
        pixabay: staticProvider("pixabay", [], "empty"),
      },
      shortCircuitOnInternalAutoPick: false,
    });
    expect(resolution.attemptedSources.find((a) => a.providerId === "pexels")?.status).toBe("disabled");
    expect(resolution.status).toBe("generation_fallback_available");
  });

  it("forbids generated plan for factual scenes", async () => {
    const catalog = createInMemoryMarketingMediaSourceCatalogRepository();
    const resolution = await resolveSceneSources({
      scene: scene(),
      providers: {
        internal: createInternalCatalogSourceProvider({ catalog }),
        pexels: staticProvider("pexels", [], "empty"),
        pixabay: staticProvider("pixabay", [], "empty"),
      },
      shortCircuitOnInternalAutoPick: false,
    });
    expect(resolution.candidates.every((c) => c.origin !== "generated_video_plan")).toBe(true);
    expect(resolution.status).toBe("unresolved");
  });

  it("offers generated_video_plan for generic scenes when sources miss", async () => {
    const catalog = createInMemoryMarketingMediaSourceCatalogRepository();
    const resolution = await resolveSceneSources({
      scene: scene({
        visual: {
          subject: "relaxed family travel vibe",
          searchQueries: ["family travel vibe"],
          factualVisualRequired: false,
          mediaPreference: "either",
          photoMotionAllowed: true,
          generatedVideoAllowed: true,
          sourcePreference: { internalFirst: true, stockAllowed: true },
        },
      }),
      providers: {
        internal: createInternalCatalogSourceProvider({ catalog }),
        pexels: staticProvider("pexels", [], "empty"),
        pixabay: staticProvider("pixabay", [], "empty"),
      },
      shortCircuitOnInternalAutoPick: false,
    });
    expect(resolution.status).toBe("generation_fallback_available");
    expect(resolution.recommendedCandidate?.origin).toBe("generated_video_plan");
    expect(resolution.recommendedCandidate?.autoPickEligible).toBe(false);
  });

  it("supports photo_motion when allowed and rejects when forbidden", async () => {
    const imageHit: ShortformNormalizedHit = {
      origin: "pexels",
      catalogSourceId: null,
      provider: "pexels",
      providerAssetId: "img-1",
      mediaType: "image",
      sourcePageUrl: "https://www.pexels.com/photo/1/",
      remoteAssetUrl: "https://example.com/1.jpg",
      remoteAssetUrlExpiresAt: null,
      previewUrl: "https://example.com/1.jpg",
      width: 1080,
      height: 1920,
      durationMs: null,
      orientation: "portrait",
      creatorName: "A",
      rightsKind: "provider_license",
      licenseName: "Pexels License",
      licenseUrl: "https://www.pexels.com/license/",
      attributionText: null,
      sha256: null,
      tags: ["family", "travel", "vibe"],
      titleOrSubject: "family travel vibe",
      storageClassHint: "external_ref",
      factualMatchHint: "generic",
    };

    const allowed = await resolveSceneSources({
      scene: scene({
        visual: {
          subject: "family travel vibe",
          searchQueries: ["family travel vibe"],
          factualVisualRequired: false,
          mediaPreference: "video",
          photoMotionAllowed: true,
          generatedVideoAllowed: false,
          sourcePreference: { internalFirst: true, stockAllowed: true },
        },
      }),
      providers: {
        internal: staticProvider("internal_catalog", []),
        pexels: staticProvider("pexels", [imageHit]),
        pixabay: staticProvider("pixabay", [], "empty"),
      },
      shortCircuitOnInternalAutoPick: false,
    });
    expect(allowed.candidates.some((c) => c.origin === "photo_motion")).toBe(true);

    const forbidden = await resolveSceneSources({
      scene: scene({
        visual: {
          subject: "family travel vibe",
          searchQueries: ["family travel vibe"],
          factualVisualRequired: false,
          mediaPreference: "video",
          photoMotionAllowed: false,
          generatedVideoAllowed: false,
          sourcePreference: { internalFirst: true, stockAllowed: true },
        },
      }),
      providers: {
        internal: staticProvider("internal_catalog", []),
        pexels: staticProvider("pexels", [imageHit]),
        pixabay: staticProvider("pixabay", [], "empty"),
      },
      shortCircuitOnInternalAutoPick: false,
    });
    expect(forbidden.candidates.every((c) => c.origin !== "photo_motion")).toBe(true);
  });

  it("never auto-picks unknown rights and dedupes catalog over API", async () => {
    const catalog = createInMemoryMarketingMediaSourceCatalogRepository();
    const registered = await catalog.registerExternalSource({
      sourceKind: "pexels",
      provider: "pexels",
      providerAssetId: "2499611",
      sourcePageUrl: "https://www.pexels.com/video/2499611/",
      mediaType: "video",
      rightsKind: "provider_license",
      width: 1080,
      height: 1920,
      durationMs: 22000,
      orientation: "portrait",
      metadata: { subject: "Da Nang Ba Na Hills Golden Bridge", tags: ["Golden Bridge"] },
    });

    const apiHits = normalizePexelsVideoSearchResponse(pexelsFixture);
    const resolution = await resolveSceneSources({
      scene: scene(),
      providers: {
        internal: createInternalCatalogSourceProvider({ catalog }),
        pexels: staticProvider("pexels", apiHits),
        pixabay: staticProvider("pixabay", [], "empty"),
      },
      shortCircuitOnInternalAutoPick: false,
    });

    const sameIdentity = resolution.candidates.filter(
      (c) => c.provider === "pexels" && c.providerAssetId === "2499611",
    );
    expect(sameIdentity).toHaveLength(1);
    expect(sameIdentity[0]?.catalogSourceId).toBe(registered.id);

    const unknown = await resolveSceneSources({
      scene: scene({
        visual: {
          subject: "ocean",
          searchQueries: ["ocean"],
          factualVisualRequired: false,
          mediaPreference: "video",
          photoMotionAllowed: false,
          generatedVideoAllowed: false,
          sourcePreference: { internalFirst: true, stockAllowed: true },
        },
      }),
      providers: {
        internal: staticProvider("internal_catalog", []),
        pexels: staticProvider("pexels", [
          {
            ...apiHits[0]!,
            rightsKind: "unknown",
            tags: ["ocean"],
            titleOrSubject: "ocean",
          },
        ]),
        pixabay: staticProvider("pixabay", [], "empty"),
      },
      shortCircuitOnInternalAutoPick: false,
    });
    expect(unknown.candidates[0]?.autoPickEligible).toBe(false);
    expect(unknown.candidates[0]?.reviewRequired).toBe(true);
  });

  it("keeps ranking deterministic and bounds final candidates", async () => {
    const hits = Array.from({ length: 8 }, (_, i) => {
      const base = normalizePexelsVideoSearchResponse(pexelsFixture)[0]!;
      return {
        ...base,
        providerAssetId: String(1000 + i),
        tags: ["family", "travel", "vibe"],
        titleOrSubject: "family travel vibe",
      };
    });
    const a = await resolveSceneSources({
      scene: scene({
        visual: {
          subject: "family travel vibe",
          searchQueries: ["family travel vibe"],
          factualVisualRequired: false,
          mediaPreference: "video",
          photoMotionAllowed: false,
          generatedVideoAllowed: false,
          sourcePreference: { internalFirst: true, stockAllowed: true },
        },
      }),
      providers: {
        internal: staticProvider("internal_catalog", []),
        pexels: staticProvider("pexels", hits),
        pixabay: staticProvider("pixabay", [], "empty"),
      },
      shortCircuitOnInternalAutoPick: false,
    });
    const b = await resolveSceneSources({
      scene: scene({
        visual: {
          subject: "family travel vibe",
          searchQueries: ["family travel vibe"],
          factualVisualRequired: false,
          mediaPreference: "video",
          photoMotionAllowed: false,
          generatedVideoAllowed: false,
          sourcePreference: { internalFirst: true, stockAllowed: true },
        },
      }),
      providers: {
        internal: staticProvider("internal_catalog", []),
        pexels: staticProvider("pexels", hits),
        pixabay: staticProvider("pixabay", [], "empty"),
      },
      shortCircuitOnInternalAutoPick: false,
    });
    expect(a.candidates.map((c) => c.candidateKey)).toEqual(b.candidates.map((c) => c.candidateKey));
    expect(a.candidates.length).toBeLessThanOrEqual(SHORTFORM_RESOLVER_FINAL_CANDIDATE_LIMIT);
  });

  it("does not insert catalog or usage rows (resolve ≠ pick)", async () => {
    const catalog = createInMemoryMarketingMediaSourceCatalogRepository();
    const before = await catalog.list({ limit: 100 });
    await resolveSceneSources({
      scene: scene({
        visual: {
          subject: "ocean waves",
          searchQueries: ["ocean waves"],
          factualVisualRequired: false,
          mediaPreference: "video",
          photoMotionAllowed: false,
          generatedVideoAllowed: false,
          sourcePreference: { internalFirst: true, stockAllowed: true },
        },
      }),
      providers: {
        internal: createInternalCatalogSourceProvider({ catalog }),
        pexels: staticProvider("pexels", normalizePexelsVideoSearchResponse(pexelsFixture)),
        pixabay: staticProvider("pixabay", [], "empty"),
      },
      shortCircuitOnInternalAutoPick: false,
    });
    const after = await catalog.list({ limit: 100 });
    expect(after).toEqual(before);
    expect(await catalog.listUsagesForCandidate("cmc_any")).toEqual([]);
  });
});

describe("SV-4 provider adapters", () => {
  it("normalizes official Pexels fixture and handles error statuses", async () => {
    const hits = normalizePexelsVideoSearchResponse(pexelsFixture);
    expect(hits[0]?.provider).toBe("pexels");
    expect(hits[0]?.providerAssetId).toBe("2499611");
    expect(hits[0]?.durationMs).toBe(22_000);

    expect(() => normalizePexelsVideoSearchResponse({ nope: true })).toThrow(/malformed/);

    const fetch401: typeof fetch = async () =>
      new Response("nope", { status: 401 }) as unknown as Response;
    const provider = createPexelsSourceProvider({ apiKey: "test-key", fetchImpl: fetch401 as never });
    const result = await provider.search({ scene: scene(), queries: ["x"], limit: 5 });
    expect(result.status).toBe("error");
  });

  it("requires Pixabay cache and normalizes fixture", async () => {
    const hits = normalizePixabayVideoSearchResponse(pixabayFixture);
    expect(hits[0]?.provider).toBe("pixabay");
    expect(hits[0]?.providerAssetId).toBe("125");

    const disabled = createPixabaySourceProvider({ apiKey: "k", cache: null });
    expect(
      (await disabled.search({ scene: scene(), queries: ["flowers"], limit: 5 })).status,
    ).toBe("disabled");

    const cache = createMemorySourceSearchCache();
    let calls = 0;
    const fetchImpl: typeof fetch = async () => {
      calls += 1;
      return new Response(JSON.stringify(pixabayFixture), {
        status: 200,
        headers: { "content-type": "application/json" },
      }) as unknown as Response;
    };
    const provider = createPixabaySourceProvider({
      apiKey: "test-key",
      cache,
      fetchImpl: fetchImpl as never,
    });
    const first = await provider.search({ scene: scene(), queries: ["flowers"], limit: 5 });
    const second = await provider.search({ scene: scene(), queries: ["flowers"], limit: 5 });
    expect(first.status).toBe("success");
    expect(second.message).toBe("cache_hit");
    expect(calls).toBe(1);
  });
});

describe("SV-4 brief orchestration", () => {
  it("returns versioned plan without side effects", async () => {
    const catalog = createInMemoryMarketingMediaSourceCatalogRepository();
    const plan = await resolveShortVideoSources({
      brief: {
        contract: SHORT_VIDEO_BRIEF_CONTRACT,
        candidateId: "cmc_test",
        businessDateKst: "2026-09-11",
        durationPreset: "short",
        targetDurationMs: 12_000,
        aspectRatio: "9:16",
        hook: "hook",
        scenes: [
          scene(),
          scene({
            sceneId: "scene-002",
            order: 2,
            visual: {
              subject: "family travel vibe",
              searchQueries: ["family travel vibe"],
              factualVisualRequired: false,
              mediaPreference: "either",
              photoMotionAllowed: true,
              generatedVideoAllowed: true,
              sourcePreference: { internalFirst: true, stockAllowed: true },
            },
          }),
        ],
        narration: { segmentRefs: ["hook"], voiceProfileId: null, cta: null },
        provenance: {
          builtFromCandidateId: "cmc_test",
          mediaBriefArtifact: "context/media-brief.json",
          shotListArtifact: null,
          durationPresetSource: "explicit",
        },
      },
      providers: {
        internal: createInternalCatalogSourceProvider({ catalog }),
        pexels: staticProvider("pexels", [], "empty"),
        pixabay: staticProvider("pixabay", [], "empty"),
      },
      shortCircuitOnInternalAutoPick: false,
      now: new Date("2026-09-11T00:00:00.000Z"),
    });

    expect(plan.contract).toBe(SHORTFORM_SOURCE_RESOLUTION_CONTRACT);
    expect(plan.scenes).toHaveLength(2);
    expect(plan.scenes[0]?.status).toBe("unresolved");
    expect(plan.scenes[1]?.status).toBe("generation_fallback_available");
  });
});
