import { beforeEach, describe, expect, it, vi } from "vitest";

import { createInMemoryMarketingMediaSourceCatalogRepository } from "@/lib/marketing/assets/sourceCatalog/inMemorySourceCatalogRepository";
import {
  SHORT_VIDEO_BRIEF_CONTRACT,
  type ShortVideoBrief,
} from "@/lib/marketing/assets/shortVideoBrief/contracts";
import {
  createShortformCandidateSelectionToken,
  selectionPayloadFromCandidate,
  verifyShortformCandidateSelectionToken,
} from "@/lib/marketing/assets/shortform/review/selectionToken";
import {
  pickShortformSourceForReview,
  resolveShortformSourcesForReview,
  ShortformSourceReviewError,
} from "@/lib/marketing/assets/shortform/review/service";
import type { ShortformSourceCandidate } from "@/lib/marketing/assets/shortform/resolver/contracts";

const TEST_ENV = {
  SHORTFORM_CANDIDATE_SELECTION_SECRET: "sv5-test-selection-secret",
  PEXELS_API_KEY: "",
  PIXABAY_API_KEY: "",
};

function sampleCandidate(
  overrides?: Partial<ShortformSourceCandidate>,
): ShortformSourceCandidate {
  return {
    candidateKey: "pexels:video:999",
    origin: "pexels",
    catalogSourceId: null,
    provider: "pexels",
    providerAssetId: "999",
    mediaType: "video",
    sourcePageUrl: "https://www.pexels.com/video/999/",
    remoteAssetUrl: "https://example.com/pexels-999.mp4",
    remoteAssetUrlExpiresAt: null,
    previewUrl: "https://images.pexels.com/videos/999.jpg",
    width: 1080,
    height: 1920,
    durationMs: 8000,
    orientation: "portrait",
    creatorName: "Tester",
    rightsKind: "provider_license",
    licenseName: "Pexels License",
    licenseUrl: "https://www.pexels.com/license/",
    attributionText: "Video by Tester on Pexels",
    sha256: null,
    score: 0.84,
    scoreBreakdown: {
      relevance: 0.8,
      mediaFit: 0.9,
      orientationFit: 1,
      durationFit: 0.7,
      provenance: 0.5,
      reuseBonus: 0,
    },
    factualMatch: "probable",
    autoPickEligible: false,
    reviewRequired: true,
    rejectionReasons: [],
    ...overrides,
  };
}

function sampleBrief(candidateId = "cmc_sv5_1"): ShortVideoBrief {
  return {
    contract: SHORT_VIDEO_BRIEF_CONTRACT,
    candidateId,
    businessDateKst: "2026-09-11",
    durationPreset: "normal",
    targetDurationMs: 18000,
    aspectRatio: "9:16",
    hook: "Ba Na Hills",
    scenes: [
      {
        sceneId: "scene-001",
        order: 1,
        targetDurationMs: 18000,
        narrationSegmentRefs: ["hook"],
        purpose: "intro",
        visual: {
          subject: "Da Nang Ba Na Hills Golden Bridge",
          searchQueries: ["Ba Na Hills Golden Bridge"],
          factualVisualRequired: true,
          mediaPreference: "video",
          photoMotionAllowed: true,
          generatedVideoAllowed: false,
          sourcePreference: { internalFirst: true, stockAllowed: true },
        },
      },
    ],
    narration: {
      segmentRefs: ["hook"],
      voiceProfileId: null,
      cta: null,
    },
    provenance: {
      builtFromCandidateId: candidateId,
      mediaBriefArtifact: null,
      shotListArtifact: null,
      durationPresetSource: "default",
    },
  };
}

describe("SV-5 selection token", () => {
  beforeEach(() => {
    process.env.SHORTFORM_CANDIDATE_SELECTION_SECRET = TEST_ENV.SHORTFORM_CANDIDATE_SELECTION_SECRET;
  });

  it("round-trips and rejects tampering", () => {
    const token = createShortformCandidateSelectionToken(
      selectionPayloadFromCandidate({
        candidateId: "cmc_sv5_1",
        sceneId: "scene-001",
        candidate: sampleCandidate(),
      }),
    );
    const ok = verifyShortformCandidateSelectionToken(token);
    expect(ok?.providerAssetId).toBe("999");

    const [payload, sig] = token.split(".");
    const tamperedPayload = Buffer.from(
      JSON.stringify({
        ...JSON.parse(Buffer.from(payload!, "base64url").toString("utf8")),
        rightsKind: "owned",
        providerAssetId: "hacked",
      }),
      "utf8",
    ).toString("base64url");
    expect(verifyShortformCandidateSelectionToken(`${tamperedPayload}.${sig}`)).toBeNull();
  });
});

describe("SV-5 pick service", () => {
  beforeEach(() => {
    process.env.SHORTFORM_CANDIDATE_SELECTION_SECRET = TEST_ENV.SHORTFORM_CANDIDATE_SELECTION_SECRET;
  });

  it("picks external candidate via trusted token without binary path", async () => {
    const catalog = createInMemoryMarketingMediaSourceCatalogRepository();
    const token = createShortformCandidateSelectionToken(
      selectionPayloadFromCandidate({
        candidateId: "cmc_sv5_1",
        sceneId: "scene-001",
        candidate: sampleCandidate(),
      }),
    );

    const result = await pickShortformSourceForReview({
      candidateId: "cmc_sv5_1",
      sceneId: "scene-001",
      selectionToken: token,
      catalog,
      env: TEST_ENV,
    });

    expect(result.managedRelativePath).toBeNull();
    expect(result.storageClass).toBe("external_ref");
    expect(result.provider).toBe("pexels");
    expect(result.providerAssetId).toBe("999");

    const source = await catalog.getById(result.sourceId);
    expect(source?.managedRelativePath).toBeNull();
    expect(source?.storageClass).toBe("external_ref");

    const usages = await catalog.listUsagesForCandidate("cmc_sv5_1");
    expect(usages).toHaveLength(1);

    const again = await pickShortformSourceForReview({
      candidateId: "cmc_sv5_1",
      sceneId: "scene-001",
      selectionToken: token,
      catalog,
      env: TEST_ENV,
    });
    expect(again.sourceId).toBe(result.sourceId);
    expect((await catalog.listUsagesForCandidate("cmc_sv5_1")).length).toBe(1);
  });

  it("picks internal catalog source by id", async () => {
    const catalog = createInMemoryMarketingMediaSourceCatalogRepository();
    const internal = await catalog.registerSource({
      sourceKind: "own",
      managedRelativePath: "source/own/ba-na.mp4",
      rightsKind: "owned",
      mediaType: "video",
    });
    const token = createShortformCandidateSelectionToken(
      selectionPayloadFromCandidate({
        candidateId: "cmc_sv5_2",
        sceneId: "scene-001",
        candidate: sampleCandidate({
          candidateKey: `internal:${internal.id}`,
          origin: "internal_catalog",
          catalogSourceId: internal.id,
          provider: null,
          providerAssetId: null,
          rightsKind: "owned",
        }),
      }),
    );

    const result = await pickShortformSourceForReview({
      candidateId: "cmc_sv5_2",
      sceneId: "scene-001",
      selectionToken: token,
      catalog,
      env: TEST_ENV,
    });
    expect(result.sourceId).toBe(internal.id);
  });

  it("blocks unknown rights even for explicit human pick", async () => {
    const catalog = createInMemoryMarketingMediaSourceCatalogRepository();
    const token = createShortformCandidateSelectionToken(
      selectionPayloadFromCandidate({
        candidateId: "cmc_sv5_1",
        sceneId: "scene-001",
        candidate: sampleCandidate({ rightsKind: "unknown" }),
      }),
    );
    await expect(
      pickShortformSourceForReview({
        candidateId: "cmc_sv5_1",
        sceneId: "scene-001",
        selectionToken: token,
        catalog,
        env: TEST_ENV,
      }),
    ).rejects.toMatchObject({ code: "UNKNOWN_RIGHTS_BLOCKED" });
  });

  it("rejects scene/candidate mismatch and forged metadata", async () => {
    const catalog = createInMemoryMarketingMediaSourceCatalogRepository();
    const token = createShortformCandidateSelectionToken(
      selectionPayloadFromCandidate({
        candidateId: "cmc_sv5_1",
        sceneId: "scene-001",
        candidate: sampleCandidate(),
      }),
    );
    await expect(
      pickShortformSourceForReview({
        candidateId: "cmc_other",
        sceneId: "scene-001",
        selectionToken: token,
        catalog,
        env: TEST_ENV,
      }),
    ).rejects.toBeInstanceOf(ShortformSourceReviewError);

    await expect(
      pickShortformSourceForReview({
        candidateId: "cmc_sv5_1",
        sceneId: "scene-001",
        selectionToken: "not.a.valid.token",
        catalog,
        env: TEST_ENV,
      }),
    ).rejects.toMatchObject({ code: "INVALID_SELECTION_TOKEN" });
  });

  it("replaces scene pick when choosing another source", async () => {
    const catalog = createInMemoryMarketingMediaSourceCatalogRepository();
    const firstToken = createShortformCandidateSelectionToken(
      selectionPayloadFromCandidate({
        candidateId: "cmc_sv5_3",
        sceneId: "scene-001",
        candidate: sampleCandidate({ providerAssetId: "111", candidateKey: "pexels:video:111" }),
      }),
    );
    const secondToken = createShortformCandidateSelectionToken(
      selectionPayloadFromCandidate({
        candidateId: "cmc_sv5_3",
        sceneId: "scene-001",
        candidate: sampleCandidate({ providerAssetId: "222", candidateKey: "pexels:video:222" }),
      }),
    );
    await pickShortformSourceForReview({
      candidateId: "cmc_sv5_3",
      sceneId: "scene-001",
      selectionToken: firstToken,
      catalog,
      env: TEST_ENV,
    });
    const replaced = await pickShortformSourceForReview({
      candidateId: "cmc_sv5_3",
      sceneId: "scene-001",
      selectionToken: secondToken,
      catalog,
      env: TEST_ENV,
    });
    expect(replaced.replaced).toBe(true);
    expect(replaced.providerAssetId).toBe("222");
    expect((await catalog.listUsagesForCandidate("cmc_sv5_3")).length).toBe(1);
  });
});

describe("SV-5 resolve service", () => {
  beforeEach(() => {
    process.env.SHORTFORM_CANDIDATE_SELECTION_SECRET = TEST_ENV.SHORTFORM_CANDIDATE_SELECTION_SECRET;
  });

  it("returns safe DTO with selection tokens and disabled providers", async () => {
    const catalog = createInMemoryMarketingMediaSourceCatalogRepository();
    const dto = await resolveShortformSourcesForReview({
      candidateId: "cmc_sv5_1",
      brief: sampleBrief(),
      catalog,
      env: TEST_ENV,
    });
    expect(dto.scenes).toHaveLength(1);
    expect(dto.scenes[0]!.factualVisualRequired).toBe(true);
    expect(dto.catalogAvailable).toBe(true);
    for (const attempt of dto.scenes[0]!.providerAttempts) {
      expect(attempt).not.toHaveProperty("message");
      if (attempt.providerId === "pexels" || attempt.providerId === "pixabay") {
        expect(["disabled", "empty", "skipped", "unavailable", "error", "success"]).toContain(
          attempt.status,
        );
      }
    }
    const anyCandidate = dto.scenes[0]!.candidates[0] ?? dto.scenes[0]!.recommended;
    if (anyCandidate) {
      expect(anyCandidate.selectionToken.includes(".")).toBe(true);
      expect(JSON.stringify(anyCandidate)).not.toMatch(/PEXELS_API_KEY|Authorization/i);
    }
  });
});
