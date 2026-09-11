import { createHash, randomUUID } from "node:crypto";
import { mkdirSync, writeFileSync, existsSync, readFileSync, rmSync } from "node:fs";
import { join } from "node:path";
import { afterEach, describe, expect, it, vi } from "vitest";

import { createInMemoryMarketingMediaSourceCatalogRepository } from "@/lib/marketing/assets/sourceCatalog/inMemorySourceCatalogRepository";
import {
  createInMemoryShortformVideoRenderJobRepository,
  enqueueShortformVideoRenderJob,
} from "@/lib/marketing/assets/shortform/renderJob/inMemoryRepository";
import { SHORT_VIDEO_BRIEF_CONTRACT } from "@/lib/marketing/assets/shortVideoBrief/contracts";
import { selectShortformRendition } from "@/lib/marketing/assets/shortform/production/materialize/rendition";
import {
  createPexelsSourceMaterializer,
  createShortformSourceMaterializerRouter,
  resolveManagedAbsolutePathForTests,
} from "@/lib/marketing/assets/shortform/production/materialize";
import { downloadToFileWithAllowlist } from "@/lib/marketing/assets/shortform/production/download";
import { createTestProductionShortformVideoRenderExecutor } from "@/lib/marketing/assets/shortform/production/productionExecutor";
import { persistShortformFinalArtifact } from "@/lib/marketing/assets/shortform/production/persistFinal";
import { SHORTFORM_FINAL_RELATIVE_PATH } from "@/lib/marketing/assets/shortform/production/paths";
import { createShortformJobWorkspace } from "@/lib/marketing/assets/shortform/worker/workspace";
import { MarketingAssetPathError } from "@/lib/marketing/assets/errors";
import { createA8VerificationBrief } from "@/lib/marketing/assets/video/fixture";
import { buildShortVideoBrief } from "@/lib/marketing/assets/shortVideoBrief/buildShortVideoBrief";
import { MEDIA_BRIEF_RELATIVE_PATH } from "@/lib/marketing/assets/video/paths";
import { SHORT_VIDEO_BRIEF_RELATIVE_PATH } from "@/lib/marketing/assets/shortVideoBrief/paths";
import { createFakeShortformTtsProvider } from "@/lib/marketing/assets/shortform/production/narration";
import { ProductionShortformVideoRenderExecutor } from "@/lib/marketing/assets/shortform/production/productionExecutor";


const tempRoots: string[] = [];
afterEach(() => {
  for (const root of tempRoots.splice(0)) {
    rmSync(root, { recursive: true, force: true });
  }
});


function seedNarrationPackage(packageRoot: string, sceneId = "scene-001") {
  const mediaBrief = createA8VerificationBrief();
  const shortVideoBrief = buildShortVideoBrief({ mediaBrief, destinations: ["다낭"] });
  const base = shortVideoBrief.scenes.find((s) => s.sceneId === sceneId) ?? shortVideoBrief.scenes[0]!;
  const scene = {
    ...base,
    sceneId,
    order: 1,
  };
  // Keep ShortVideoBrief invariants: single-scene duration sum == targetDurationMs
  const brief = {
    ...shortVideoBrief,
    scenes: [scene],
    targetDurationMs: scene.targetDurationMs,
    provenance: {
      ...shortVideoBrief.provenance,
      durationPresetSource: "shot_list_nearest" as const,
    },
    narration: {
      ...shortVideoBrief.narration,
      segmentRefs: [...scene.narrationSegmentRefs],
    },
  };
  mkdirSync(join(packageRoot, "context"), { recursive: true });
  writeFileSync(join(packageRoot, MEDIA_BRIEF_RELATIVE_PATH), JSON.stringify(mediaBrief, null, 2));
  writeFileSync(join(packageRoot, SHORT_VIDEO_BRIEF_RELATIVE_PATH), JSON.stringify(brief, null, 2));
  return { mediaBrief, shortVideoBrief: brief };
}

function tempDir(prefix: string) {
  const base = join(process.cwd(), "node_modules", ".cache", "sv8a");
  mkdirSync(base, { recursive: true });
  const dir = join(base, `${prefix}-${randomUUID().slice(0, 8)}`);
  mkdirSync(dir, { recursive: true });
  tempRoots.push(dir);
  return dir;
}

describe("SV-8A materialization + download safety", () => {
  it("selects portrait-friendly renditions deterministically", () => {
    const picked = selectShortformRendition([
      { width: 3840, height: 2160, link: "https://videos.pexels.com/4k.mp4", quality: "uhd" },
      { width: 1080, height: 1920, link: "https://videos.pexels.com/vert.mp4", quality: "hd" },
      { width: 640, height: 360, link: "https://videos.pexels.com/sd.mp4", quality: "sd" },
    ]);
    expect(picked?.link).toContain("vert.mp4");
  });

  it("materializes internal managed source into workspace only", async () => {
    const assetRoot = tempDir("assets");
    const workspaceRoot = tempDir("ws");
    const managed = "source/own/clip.mp4";
    const abs = join(assetRoot, managed);
    mkdirSync(join(assetRoot, "source/own"), { recursive: true });
    writeFileSync(abs, Buffer.from("internal-video"));
    expect(resolveManagedAbsolutePathForTests(managed, assetRoot)).toBe(abs);

    const catalog = createInMemoryMarketingMediaSourceCatalogRepository();
    const source = await catalog.registerSource({
      sourceKind: "own",
      managedRelativePath: managed,
      rightsKind: "owned",
      mediaType: "video",
    });
    const workspace = createShortformJobWorkspace({
      workspaceRoot,
      jobId: "svr_internal",
    });
    const materializer = createShortformSourceMaterializerRouter({
      env: { MARKETING_ASSET_ROOT: assetRoot },
    });
    const out = await materializer.materialize({
      sceneId: "scene-001",
      source,
      origin: "internal_catalog",
      workspace,
    });
    expect(out.absolutePath.startsWith(workspace.sourceDir)).toBe(true);
    expect(readFileSync(out.absolutePath, "utf8")).toBe("internal-video");
    expect(existsSync(join(assetRoot, "source/own/clip.mp4"))).toBe(true);
  });

  it("downloads pexels via allowlisted host into workspace, not asset root", async () => {
    const assetRoot = tempDir("assets2");
    const workspaceRoot = tempDir("ws2");
    mkdirSync(assetRoot, { recursive: true });
    const catalog = createInMemoryMarketingMediaSourceCatalogRepository();
    const source = await catalog.registerExternalSource({
      sourceKind: "pexels",
      provider: "pexels",
      providerAssetId: "99",
      remoteAssetUrl: "https://videos.pexels.com/video.mp4",
      rightsKind: "provider_license",
      mediaType: "video",
    });
    const workspace = createShortformJobWorkspace({ workspaceRoot, jobId: "svr_pexels" });
    const fetchImpl = vi.fn(async () => {
      return new Response(Buffer.from("pexels-bytes"), {
        status: 200,
        headers: { "content-type": "video/mp4", "content-length": "12" },
      });
    }) as unknown as typeof fetch;
    const materializer = createPexelsSourceMaterializer({ fetchImpl });
    const out = await materializer.materialize({
      sceneId: "scene-001",
      source,
      origin: "pexels",
      workspace,
    });
    expect(out.absolutePath.startsWith(workspace.sourceDir)).toBe(true);
    expect(readFileSync(out.absolutePath)).toEqual(Buffer.from("pexels-bytes"));
    expect(existsSync(join(assetRoot, "video.mp4"))).toBe(false);
  });

  it("rejects arbitrary remote hosts (SSRF)", async () => {
    await expect(
      downloadToFileWithAllowlist({
        url: "https://evil.example/steal",
        destinationAbsolutePath: join(tempDir("dl"), "x.bin"),
        allowHosts: ["videos.pexels.com"],
      }),
    ).rejects.toMatchObject({ code: "DOWNLOAD_HOST_DENIED" });
  });

  it("rejects unknown provider materialization", async () => {
    const catalog = createInMemoryMarketingMediaSourceCatalogRepository();
    const source = await catalog.registerExternalSource({
      sourceKind: "unknown",
      provider: "randomcdn",
      providerAssetId: "1",
      remoteAssetUrl: "https://cdn.example/a.mp4",
      rightsKind: "provider_license",
    });
    const workspace = createShortformJobWorkspace({
      workspaceRoot: tempDir("ws3"),
      jobId: "svr_unk",
    });
    const materializer = createShortformSourceMaterializerRouter({
      env: { MARKETING_ASSET_ROOT: tempDir("assets3") },
    });
    await expect(
      materializer.materialize({
        sceneId: "scene-001",
        source,
        origin: "pexels",
        workspace,
      }),
    ).rejects.toMatchObject({ code: "UNKNOWN_PROVIDER" });
  });

  it("blocks generated_video_plan in materializer router", async () => {
    const catalog = createInMemoryMarketingMediaSourceCatalogRepository();
    const source = await catalog.registerSource({
      sourceKind: "generated_ai",
      rightsKind: "generated",
      mediaType: "video",
    });
    const workspace = createShortformJobWorkspace({
      workspaceRoot: tempDir("ws-gen"),
      jobId: "svr_gen",
    });
    const materializer = createShortformSourceMaterializerRouter({
      env: { MARKETING_ASSET_ROOT: tempDir("assets-gen") },
    });
    await expect(
      materializer.materialize({
        sceneId: "scene-001",
        source,
        origin: "generated_video_plan",
        workspace,
      }),
    ).rejects.toMatchObject({ code: "JOB_NOT_RENDERABLE_YET" });
  });

  it("rejects path traversal for managed relative paths", () => {
    expect(() => resolveManagedAbsolutePathForTests("../etc/passwd", tempDir("root"))).toThrow(
      MarketingAssetPathError,
    );
  });

  it("photo_motion image materializes as photo_motion mediaKind", async () => {
    const assetRoot = tempDir("pm-assets");
    mkdirSync(join(assetRoot, "source/own"), { recursive: true });
    writeFileSync(join(assetRoot, "source/own/still.jpg"), Buffer.from("jpeg"));
    const catalog = createInMemoryMarketingMediaSourceCatalogRepository();
    const source = await catalog.registerSource({
      sourceKind: "own",
      managedRelativePath: "source/own/still.jpg",
      rightsKind: "owned",
      mediaType: "image",
    });
    const workspace = createShortformJobWorkspace({
      workspaceRoot: tempDir("pm-ws"),
      jobId: "svr_pm",
    });
    const out = await createShortformSourceMaterializerRouter({
      env: { MARKETING_ASSET_ROOT: assetRoot },
    }).materialize({
      sceneId: "scene-001",
      source,
      origin: "photo_motion",
      workspace,
    });
    expect(out.mediaKind).toBe("photo_motion");
    expect(out.absolutePath.startsWith(workspace.sourceDir)).toBe(true);
  });
});

describe("SV-8A durable persist", () => {
  it("persist requires durable package write before returning path", () => {
    const packageRoot = tempDir("persist-pkg");
    mkdirSync(join(packageRoot, "reel", "final"), { recursive: true });
    const workspaceFile = join(tempDir("persist-ws"), "out.mp4");
    writeFileSync(workspaceFile, Buffer.from("mp4-bytes-here"));
    const persisted = persistShortformFinalArtifact({
      packageRoot,
      workspaceFinalAbsolutePath: workspaceFile,
    });
    expect(persisted.relativePath).toBe(SHORTFORM_FINAL_RELATIVE_PATH);
    expect(existsSync(join(packageRoot, SHORTFORM_FINAL_RELATIVE_PATH))).toBe(true);
    expect(persisted.sha256).toMatch(/^[a-f0-9]{64}$/);
  });

  it("persist failure when workspace final missing", () => {
    try {
      persistShortformFinalArtifact({
        packageRoot: tempDir("persist-miss2"),
        workspaceFinalAbsolutePath: join(tempDir("nope2"), "missing.mp4"),
      });
      expect.fail("expected throw");
    } catch (error) {
      expect((error as { code?: string }).code).toBe("PERSIST_INPUT_MISSING");
    }
  });
});

describe("SV-8A executor end-to-end with fakes", () => {
  it("returns package-relative outputArtifactPath after durable persist", async () => {
    const assetRoot = tempDir("e2e-assets");
    const packageRoot = join(assetRoot, "pkg");
    mkdirSync(join(packageRoot, "reel", "final"), { recursive: true });
    seedNarrationPackage(packageRoot, "scene-001");
    const workspaceRoot = tempDir("e2e-ws");

    const catalog = createInMemoryMarketingMediaSourceCatalogRepository();
    mkdirSync(join(assetRoot, "source/own"), { recursive: true });
    writeFileSync(join(assetRoot, "source/own/clip.mp4"), Buffer.from("vid"));
    const source = await catalog.registerSource({
      sourceKind: "own",
      managedRelativePath: "source/own/clip.mp4",
      rightsKind: "owned",
      mediaType: "video",
    });

    const jobRepo = createInMemoryShortformVideoRenderJobRepository();
    const { job } = await enqueueShortformVideoRenderJob({
      repository: jobRepo,
      candidateId: "cmc_e2e",
      businessDateKst: "2026-09-11",
      briefContract: SHORT_VIDEO_BRIEF_CONTRACT,
      briefSha256: createHash("sha256").update("e2e").digest("hex"),
      scenes: [
        {
          sceneId: "scene-001",
          factualVisualRequired: false,
          generatedVideoAllowed: false,
          pick: {
            sourceId: source.id,
            rightsKind: "owned",
            factualMatch: "generic",
            origin: "internal_catalog",
          },
        },
      ],
      scenePicks: [
        {
          sceneId: "scene-001",
          sourceId: source.id,
          origin: "internal_catalog",
          rightsKind: "owned",
          factualMatch: "generic",
          mediaType: "video",
        },
      ],
    });

    const executor = createTestProductionShortformVideoRenderExecutor({
      catalog,
      env: { MARKETING_ASSET_ROOT: assetRoot },
      pipelineOverrides: {
        materializer: createShortformSourceMaterializerRouter({
          env: { MARKETING_ASSET_ROOT: assetRoot },
        }),
        resolvePackageRoot: () => packageRoot,
        runFfmpegImpl: async ({ args }) => {
          const out = args[args.length - 1]!;
          writeFileSync(out, Buffer.from("final-mp4-bytes"));
        },
        skipFfprobeValidation: true,
      },
    });

    const workspace = createShortformJobWorkspace({
      workspaceRoot,
      jobId: job.jobId,
    });
    const result = await executor.execute({
      job,
      workspace,
      signal: new AbortController().signal,
    });
    expect(result.ok, !result.ok ? `${result.errorCode}: ${String(result.error)}` : undefined).toBe(true);
    if (result.ok) {
      expect(result.outputArtifactPath).toBe(SHORTFORM_FINAL_RELATIVE_PATH);
    }
    expect(existsSync(join(packageRoot, SHORTFORM_FINAL_RELATIVE_PATH))).toBe(true);
    expect(existsSync(join(workspace.sourceDir, "scene-001.mp4"))).toBe(true);
  });


  it("passes MediaBrief narrationText to TTS (no Scene N placeholder)", async () => {
    const assetRoot = tempDir("narr-assets");
    const packageRoot = join(assetRoot, "pkg");
    mkdirSync(join(packageRoot, "reel", "final"), { recursive: true });
    const { mediaBrief } = seedNarrationPackage(packageRoot, "scene-001");
    const expected = mediaBrief.formats.shortform.narrationSegments[0]!.narrationText;

    mkdirSync(join(assetRoot, "source/own"), { recursive: true });
    writeFileSync(join(assetRoot, "source/own/clip.mp4"), Buffer.from("vid"));
    const catalog = createInMemoryMarketingMediaSourceCatalogRepository();
    const source = await catalog.registerSource({
      sourceKind: "own",
      managedRelativePath: "source/own/clip.mp4",
      rightsKind: "owned",
      mediaType: "video",
    });
    const jobRepo = createInMemoryShortformVideoRenderJobRepository();
    const { job } = await enqueueShortformVideoRenderJob({
      repository: jobRepo,
      candidateId: "cmc_narr",
      businessDateKst: "2026-09-11",
      briefContract: SHORT_VIDEO_BRIEF_CONTRACT,
      briefSha256: createHash("sha256").update("narr").digest("hex"),
      scenes: [
        {
          sceneId: "scene-001",
          factualVisualRequired: false,
          generatedVideoAllowed: false,
          pick: {
            sourceId: source.id,
            rightsKind: "owned",
            factualMatch: "generic",
            origin: "internal_catalog",
          },
        },
      ],
      scenePicks: [
        {
          sceneId: "scene-001",
          sourceId: source.id,
          origin: "internal_catalog",
          rightsKind: "owned",
          factualMatch: "generic",
          mediaType: "video",
        },
      ],
    });

    const ttsTexts: string[] = [];
    const baseFake = createFakeShortformTtsProvider();
    const executor = new ProductionShortformVideoRenderExecutor({
      catalog,
      env: { MARKETING_ASSET_ROOT: assetRoot },
      relaxReadinessForTests: true,
      remotion: {
        async render(input) {
          expect(input.props.scenes[0]?.subtitle).toBe(expected);
          writeFileSync(input.outputAbsolutePath, Buffer.from("fake-remotion-output"));
          return { outputAbsolutePath: input.outputAbsolutePath };
        },
      },
      tts: {
        providerId: "voicestudio",
        async generate(input) {
          ttsTexts.push(input.text);
          return baseFake.generate(input);
        },
      },
      pipelineOverrides: {
        materializer: createShortformSourceMaterializerRouter({
          env: { MARKETING_ASSET_ROOT: assetRoot },
        }),
        resolvePackageRoot: () => packageRoot,
        runFfmpegImpl: async ({ args }) => {
          writeFileSync(args[args.length - 1]!, Buffer.from("final"));
        },
        skipFfprobeValidation: true,
      },
    });

    const result = await executor.execute({
      job,
      workspace: createShortformJobWorkspace({
        workspaceRoot: tempDir("narr-ws"),
        jobId: job.jobId,
      }),
      signal: new AbortController().signal,
    });
    expect(result.ok).toBe(true);
    expect(ttsTexts).toEqual([expected]);
    expect(ttsTexts[0]).not.toMatch(/^Scene \d+$/);
  });

  it("missing narration ref fails before TTS/Remotion", async () => {
    const assetRoot = tempDir("miss-assets");
    const packageRoot = join(assetRoot, "pkg");
    mkdirSync(join(packageRoot, "reel", "final"), { recursive: true });
    const mediaBrief = createA8VerificationBrief();
    const shortVideoBrief = buildShortVideoBrief({ mediaBrief, destinations: ["다낭"] });
    const baseScene = shortVideoBrief.scenes[0]!;
    const broken = {
      ...shortVideoBrief,
      scenes: [
        {
          ...baseScene,
          sceneId: "scene-001",
          order: 1,
          narrationSegmentRefs: ["missing-seg"],
        },
      ],
      targetDurationMs: baseScene.targetDurationMs,
      provenance: {
        ...shortVideoBrief.provenance,
        durationPresetSource: "shot_list_nearest" as const,
      },
      narration: { ...shortVideoBrief.narration, segmentRefs: ["missing-seg"] },
    };
    mkdirSync(join(packageRoot, "context"), { recursive: true });
    writeFileSync(join(packageRoot, MEDIA_BRIEF_RELATIVE_PATH), JSON.stringify(mediaBrief));
    writeFileSync(join(packageRoot, SHORT_VIDEO_BRIEF_RELATIVE_PATH), JSON.stringify(broken));

    mkdirSync(join(assetRoot, "source/own"), { recursive: true });
    writeFileSync(join(assetRoot, "source/own/clip.mp4"), Buffer.from("vid"));
    const catalog = createInMemoryMarketingMediaSourceCatalogRepository();
    const source = await catalog.registerSource({
      sourceKind: "own",
      managedRelativePath: "source/own/clip.mp4",
      rightsKind: "owned",
      mediaType: "video",
    });
    const jobRepo = createInMemoryShortformVideoRenderJobRepository();
    const { job } = await enqueueShortformVideoRenderJob({
      repository: jobRepo,
      candidateId: "cmc_miss",
      businessDateKst: "2026-09-11",
      briefContract: SHORT_VIDEO_BRIEF_CONTRACT,
      briefSha256: createHash("sha256").update("miss").digest("hex"),
      scenes: [
        {
          sceneId: "scene-001",
          factualVisualRequired: false,
          generatedVideoAllowed: false,
          pick: {
            sourceId: source.id,
            rightsKind: "owned",
            factualMatch: "generic",
            origin: "internal_catalog",
          },
        },
      ],
      scenePicks: [
        {
          sceneId: "scene-001",
          sourceId: source.id,
          origin: "internal_catalog",
          rightsKind: "owned",
          factualMatch: "generic",
          mediaType: "video",
        },
      ],
    });

    let ttsCalled = false;
    let remotionCalled = false;
    const baseFake = createFakeShortformTtsProvider();
    const executor = new ProductionShortformVideoRenderExecutor({
      catalog,
      env: { MARKETING_ASSET_ROOT: assetRoot },
      relaxReadinessForTests: true,
      remotion: {
        async render(input) {
          remotionCalled = true;
          writeFileSync(input.outputAbsolutePath, Buffer.from("x"));
          return { outputAbsolutePath: input.outputAbsolutePath };
        },
      },
      tts: {
        providerId: "voicestudio",
        async generate(input) {
          ttsCalled = true;
          return baseFake.generate(input);
        },
      },
      pipelineOverrides: {
        materializer: createShortformSourceMaterializerRouter({
          env: { MARKETING_ASSET_ROOT: assetRoot },
        }),
        resolvePackageRoot: () => packageRoot,
        skipFfprobeValidation: true,
      },
    });
    const result = await executor.execute({
      job,
      workspace: createShortformJobWorkspace({
        workspaceRoot: tempDir("miss-ws"),
        jobId: job.jobId,
      }),
      signal: new AbortController().signal,
    });
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.errorCode).toBe("NARRATION_SEGMENT_NOT_FOUND");
    expect(ttsCalled).toBe(false);
    expect(remotionCalled).toBe(false);
  });

  it("abort during execute returns failure without READY path", async () => {
    const assetRoot = tempDir("abort-assets");
    const packageRoot = join(assetRoot, "pkg");
    mkdirSync(join(packageRoot, "reel", "final"), { recursive: true });
    const catalog = createInMemoryMarketingMediaSourceCatalogRepository();
    mkdirSync(join(assetRoot, "source/own"), { recursive: true });
    writeFileSync(join(assetRoot, "source/own/a.mp4"), Buffer.from("a"));
    const source = await catalog.registerSource({
      sourceKind: "own",
      managedRelativePath: "source/own/a.mp4",
      rightsKind: "owned",
      mediaType: "video",
    });
    const jobRepo = createInMemoryShortformVideoRenderJobRepository();
    const { job } = await enqueueShortformVideoRenderJob({
      repository: jobRepo,
      candidateId: "cmc_abort",
      businessDateKst: "2026-09-11",
      briefContract: SHORT_VIDEO_BRIEF_CONTRACT,
      briefSha256: createHash("sha256").update("abort").digest("hex"),
      scenes: [
        {
          sceneId: "scene-001",
          factualVisualRequired: false,
          generatedVideoAllowed: false,
          pick: {
            sourceId: source.id,
            rightsKind: "owned",
            factualMatch: "generic",
            origin: "internal_catalog",
          },
        },
      ],
      scenePicks: [
        {
          sceneId: "scene-001",
          sourceId: source.id,
          origin: "internal_catalog",
          rightsKind: "owned",
          factualMatch: "generic",
          mediaType: "video",
        },
      ],
    });

    const abort = new AbortController();
    abort.abort();
    const executor = createTestProductionShortformVideoRenderExecutor({
      catalog,
      env: { MARKETING_ASSET_ROOT: assetRoot },
      pipelineOverrides: {
        materializer: createShortformSourceMaterializerRouter({
          env: { MARKETING_ASSET_ROOT: assetRoot },
        }),
        resolvePackageRoot: () => packageRoot,
        skipFfprobeValidation: true,
      },
    });
    const workspace = createShortformJobWorkspace({
      workspaceRoot: tempDir("abort-ws"),
      jobId: job.jobId,
    });
    const result = await executor.execute({
      job,
      workspace,
      signal: abort.signal,
    });
    expect(result.ok).toBe(false);
    expect(existsSync(join(packageRoot, SHORTFORM_FINAL_RELATIVE_PATH))).toBe(false);
  });
});
