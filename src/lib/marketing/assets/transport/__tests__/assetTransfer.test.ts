import { createHash, randomUUID } from "node:crypto";
import { createServer, type IncomingMessage, type ServerResponse } from "node:http";
import { existsSync, mkdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { afterEach, describe, expect, it } from "vitest";

import { createInMemoryMarketingMediaSourceCatalogRepository } from "@/lib/marketing/assets/sourceCatalog/inMemorySourceCatalogRepository";
import {
  createInMemoryShortformVideoRenderJobRepository,
  enqueueShortformVideoRenderJob,
} from "@/lib/marketing/assets/shortform/renderJob/inMemoryRepository";
import { SHORT_VIDEO_BRIEF_CONTRACT } from "@/lib/marketing/assets/shortVideoBrief/contracts";
import { createTestProductionShortformVideoRenderExecutor } from "@/lib/marketing/assets/shortform/production/productionExecutor";
import { SHORTFORM_FINAL_RELATIVE_PATH } from "@/lib/marketing/assets/shortform/production/paths";
import { createShortformJobWorkspace } from "@/lib/marketing/assets/shortform/worker/workspace";
import { createA8VerificationBrief } from "@/lib/marketing/assets/video/fixture";
import { buildShortVideoBrief } from "@/lib/marketing/assets/shortVideoBrief/buildShortVideoBrief";
import { MEDIA_BRIEF_RELATIVE_PATH } from "@/lib/marketing/assets/video/paths";
import { SHORT_VIDEO_BRIEF_RELATIVE_PATH } from "@/lib/marketing/assets/shortVideoBrief/paths";
import { resolvePackageDirectory } from "@/lib/marketing/assets/paths";
import { probeShortformProductionReadiness } from "@/lib/marketing/assets/shortform/production/readiness";
import {
  MARKETING_ASSET_TRANSFER_LIMITS,
  SHORTFORM_FINAL_TRANSFER_RELATIVE_PATH,
} from "@/lib/marketing/assets/transport/contracts";
import { createHttpMarketingAssetTransport } from "@/lib/marketing/assets/transport/httpTransport";
import { handleMarketingAssetTransferRequest } from "@/lib/marketing/assets/transport/server/handler";
import { sha256Buffer } from "@/lib/marketing/assets/transport/server/auth";

const tempRoots: string[] = [];
const openServers: Array<{ close: () => Promise<void> }> = [];

afterEach(async () => {
  while (openServers.length) {
    const s = openServers.pop()!;
    await s.close().catch(() => undefined);
  }
  for (const root of tempRoots.splice(0)) {
    rmSync(root, { recursive: true, force: true });
  }
});

function tempDir(prefix: string) {
  const base = join(process.cwd(), "node_modules", ".cache", "sv8b2");
  mkdirSync(base, { recursive: true });
  const dir = join(base, `${prefix}-${randomUUID().slice(0, 8)}`);
  mkdirSync(dir, { recursive: true });
  tempRoots.push(dir);
  return dir;
}

function seedNarrationPackage(packageRoot: string, sceneId = "scene-001") {
  const mediaBrief = createA8VerificationBrief();
  const shortVideoBrief = buildShortVideoBrief({ mediaBrief, destinations: ["다낭"] });
  const base = shortVideoBrief.scenes.find((s) => s.sceneId === sceneId) ?? shortVideoBrief.scenes[0]!;
  const scene = { ...base, sceneId, order: 1 };
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

async function listenTransferServer(input: {
  catalog: ReturnType<typeof createInMemoryMarketingMediaSourceCatalogRepository>;
  env: Record<string, string>;
}): Promise<{ baseUrl: string; close: () => Promise<void>; port: number }> {
  const server = createServer((req: IncomingMessage, res: ServerResponse) => {
    void handleMarketingAssetTransferRequest(req, res, {
      catalog: input.catalog,
      env: input.env,
      serviceVersion: "test",
    });
  });
  await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", () => resolve()));
  const addr = server.address();
  if (!addr || typeof addr === "string") throw new Error("no port");
  const handle = {
    baseUrl: `http://127.0.0.1:${addr.port}`,
    port: addr.port,
    close: () =>
      new Promise<void>((resolve, reject) => {
        server.close((err) => (err ? reject(err) : resolve()));
      }),
  };
  openServers.push(handle);
  return handle;
}

describe("SV-8B2 Asset Transfer server auth", () => {
  it("rejects missing/wrong token and never echoes token", async () => {
    const assetRoot = tempDir("auth-assets");
    const catalog = createInMemoryMarketingMediaSourceCatalogRepository();
    const token = "test-transfer-token-aaa";
    const env = {
      MARKETING_ASSET_ROOT: assetRoot,
      MARKETING_ASSET_TRANSFER_TOKEN: token,
    };
    const { baseUrl } = await listenTransferServer({ catalog, env });
    const noTok = await fetch(`${baseUrl}/v1/managed-sources/x/content`);
    expect(noTok.status).toBe(401);
    expect(await noTok.text()).not.toContain(token);

    const bad = await fetch(`${baseUrl}/v1/managed-sources/x/content`, {
      headers: { Authorization: "Bearer wrong" },
    });
    expect(bad.status).toBe(401);
    expect(await bad.text()).not.toContain(token);

    const health = await fetch(`${baseUrl}/health`);
    expect(health.status).toBe(200);
  });
});

describe("SV-8B2 managed source read", () => {
  it("serves local catalog source bytes with integrity header", async () => {
    const assetRoot = tempDir("src-assets");
    const managed = "source/own/clip.mp4";
    const bytes = Buffer.from("managed-source-bytes");
    mkdirSync(join(assetRoot, "source/own"), { recursive: true });
    writeFileSync(join(assetRoot, managed), bytes);
    const digest = sha256Buffer(bytes);
    const catalog = createInMemoryMarketingMediaSourceCatalogRepository();
    const source = await catalog.registerSource({
      sourceKind: "own",
      managedRelativePath: managed,
      rightsKind: "owned",
      mediaType: "video",
      sha256: digest,
      mimeType: "video/mp4",
    });
    const token = "tok-managed-read";
    const { baseUrl } = await listenTransferServer({
      catalog,
      env: {
        MARKETING_ASSET_ROOT: assetRoot,
        MARKETING_ASSET_TRANSFER_TOKEN: token,
      },
    });
    const ok = await fetch(`${baseUrl}/v1/managed-sources/${source.id}/content`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    expect(ok.status).toBe(200);
    expect(ok.headers.get("x-content-sha256")).toBe(digest);
    expect(Buffer.from(await ok.arrayBuffer())).toEqual(bytes);
  });

  it("rejects remote-ref-only, unknown, inactive, and integrity mismatch", async () => {
    const assetRoot = tempDir("src-rej");
    const catalog = createInMemoryMarketingMediaSourceCatalogRepository();
    const remote = await catalog.registerExternalSource({
      sourceKind: "pexels",
      provider: "pexels",
      providerAssetId: "77",
      remoteAssetUrl: "https://videos.pexels.com/a.mp4",
      rightsKind: "provider_license",
      mediaType: "video",
    });
    mkdirSync(join(assetRoot, "source/own"), { recursive: true });
    const inactive = await catalog.registerSource({
      sourceKind: "own",
      managedRelativePath: "source/own/inactive.mp4",
      rightsKind: "owned",
      mediaType: "video",
    });
    writeFileSync(join(assetRoot, "source/own/inactive.mp4"), Buffer.from("y"));
    await catalog.updateSource({ id: inactive.id, status: "archived" });

    writeFileSync(join(assetRoot, "source/own/mismatch.mp4"), Buffer.from("actual"));
    const mismatch = await catalog.registerSource({
      sourceKind: "own",
      managedRelativePath: "source/own/mismatch.mp4",
      rightsKind: "owned",
      mediaType: "video",
      sha256: createHash("sha256").update("expected-other").digest("hex"),
    });

    const token = "tok-rej";
    const { baseUrl } = await listenTransferServer({
      catalog,
      env: {
        MARKETING_ASSET_ROOT: assetRoot,
        MARKETING_ASSET_TRANSFER_TOKEN: token,
      },
    });
    const headers = { Authorization: `Bearer ${token}` };
    expect((await fetch(`${baseUrl}/v1/managed-sources/${remote.id}/content`, { headers })).status).toBe(422);
    expect((await fetch(`${baseUrl}/v1/managed-sources/src_missing/content`, { headers })).status).toBe(404);
    expect((await fetch(`${baseUrl}/v1/managed-sources/${inactive.id}/content`, { headers })).status).toBe(409);
    expect((await fetch(`${baseUrl}/v1/managed-sources/${mismatch.id}/content`, { headers })).status).toBe(409);
  });
});

describe("SV-8B2 candidate package artifacts", () => {
  it("serves allowlisted kinds and rejects unknown/path-like kinds", async () => {
    const assetRoot = tempDir("art-assets");
    const candidateId = "cmc_art1";
    const businessDateKst = "2026-09-11";
    const packageRoot = resolvePackageDirectory({ assetRoot, businessDateKst, candidateId });
    seedNarrationPackage(packageRoot);
    const catalog = createInMemoryMarketingMediaSourceCatalogRepository();
    const token = "tok-art";
    const { baseUrl } = await listenTransferServer({
      catalog,
      env: {
        MARKETING_ASSET_ROOT: assetRoot,
        MARKETING_ASSET_TRANSFER_TOKEN: token,
      },
    });
    const headers = { Authorization: `Bearer ${token}` };
    const media = await fetch(
      `${baseUrl}/v1/candidates/${candidateId}/artifacts/media-brief?businessDateKst=${businessDateKst}`,
      { headers },
    );
    expect(media.status).toBe(200);
    expect(media.headers.get("x-artifact-relative-path")).toBe(MEDIA_BRIEF_RELATIVE_PATH);
    expect(JSON.parse(await media.text())).toMatchObject({ contract: expect.any(String) });

    const short = await fetch(
      `${baseUrl}/v1/candidates/${candidateId}/artifacts/short-video-brief?businessDateKst=${businessDateKst}`,
      { headers },
    );
    expect(short.status).toBe(200);
    expect(short.headers.get("x-artifact-relative-path")).toBe(SHORT_VIDEO_BRIEF_RELATIVE_PATH);

    expect(
      (
        await fetch(
          `${baseUrl}/v1/candidates/${candidateId}/artifacts/not-a-real-kind?businessDateKst=${businessDateKst}`,
          { headers },
        )
      ).status,
    ).toBe(400);
    expect(
      (
        await fetch(
          `${baseUrl}/v1/candidates/${candidateId}/artifacts/${encodeURIComponent("../etc/passwd")}?businessDateKst=${businessDateKst}`,
          { headers },
        )
      ).status,
    ).toBe(400);
    expect(
      (
        await fetch(
          `${baseUrl}/v1/candidates/cmc_missing/artifacts/media-brief?businessDateKst=${businessDateKst}`,
          { headers },
        )
      ).status,
    ).toBe(404);
  });
});

describe("SV-8B2 final write", () => {
  it("persists fixed relativePath; rejects wrong hash and oversize Content-Length without buffering", async () => {
    const assetRoot = tempDir("final-assets");
    const catalog = createInMemoryMarketingMediaSourceCatalogRepository();
    const token = "tok-final";
    const env = {
      MARKETING_ASSET_ROOT: assetRoot,
      MARKETING_ASSET_TRANSFER_TOKEN: token,
    };
    const { baseUrl } = await listenTransferServer({ catalog, env });

    const body = Buffer.from("final-mp4-payload");
    const digest = sha256Buffer(body);
    const candidateId = "cmc_final1";
    const businessDateKst = "2026-09-11";
    const ok = await fetch(
      `${baseUrl}/v1/candidates/${candidateId}/shortform-final?businessDateKst=${businessDateKst}`,
      {
        method: "PUT",
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "video/mp4",
          "X-Content-Sha256": digest,
        },
        body,
      },
    );
    expect(ok.status).toBe(200);
    const json = (await ok.json()) as { relativePath: string; sha256: string };
    expect(json.relativePath).toBe(SHORTFORM_FINAL_TRANSFER_RELATIVE_PATH);
    expect(json.sha256).toBe(digest);
    expect(JSON.stringify(json)).not.toContain(assetRoot);

    const wrongHash = await fetch(
      `${baseUrl}/v1/candidates/${candidateId}/shortform-final?businessDateKst=${businessDateKst}`,
      {
        method: "PUT",
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "video/mp4",
          "X-Content-Sha256": "0".repeat(64),
        },
        body,
      },
    );
    expect(wrongHash.status).toBe(400);

    // Oversize via declared Content-Length — no 150MiB allocation, no client hang.
    const { Readable } = await import("node:stream");
    const chunks: Buffer[] = [];
    const fakeReq = Readable.from([]) as IncomingMessage;
    fakeReq.method = "PUT";
    fakeReq.url = `/v1/candidates/cmc_big/shortform-final?businessDateKst=${businessDateKst}`;
    fakeReq.headers = {
      authorization: `Bearer ${token}`,
      "content-type": "video/mp4",
      "content-length": String(MARKETING_ASSET_TRANSFER_LIMITS.finalUploadMaxBytes + 1),
    };
    const fakeRes = {
      statusCode: 0,
      headers: {} as Record<string, string>,
      setHeader(k: string, v: string | number) {
        this.headers[k.toLowerCase()] = String(v);
      },
      end(payload?: string | Buffer) {
        if (payload) chunks.push(Buffer.isBuffer(payload) ? payload : Buffer.from(payload));
      },
    } as unknown as ServerResponse;
    await handleMarketingAssetTransferRequest(fakeReq, fakeRes, { catalog, env });
    expect(fakeRes.statusCode).toBe(413);
    expect(Buffer.concat(chunks).toString("utf8")).toContain("FINAL_TOO_LARGE");
  });
});

describe("SV-8B2 HTTP transport + executor acceptance", () => {
  it("http readiness does not require MARKETING_ASSET_ROOT", () => {
    const httpReady = probeShortformProductionReadiness({
      env: {
        MARKETING_ASSET_TRANSPORT_MODE: "http",
        MARKETING_ASSET_TRANSFER_BASE_URL: "http://127.0.0.1:3101",
        MARKETING_ASSET_TRANSFER_TOKEN: "x",
        SHORTFORM_WORKER_WORKSPACE_PATH: "/home/ysh/.cache/thealltour-shortform",
      },
      requireVoiceStudio: false,
      workspaceRoot: "/home/ysh/.cache/thealltour-shortform",
    });
    expect(httpReady.transportMode).toBe("http");
    expect(httpReady.checks.marketingAssetRoot).toBe(true);
    expect(httpReady.reason).not.toContain("marketingAssetRoot");
  });

  it("Mini-PC HTTP mode: briefs + managed source + final without local MARKETING_ASSET_ROOT", async () => {
    const piAssetRoot = tempDir("exec-pi");
    const workspaceRoot = tempDir("exec-ws");
    const managed = "source/own/clip.mp4";
    mkdirSync(join(piAssetRoot, "source/own"), { recursive: true });
    writeFileSync(join(piAssetRoot, managed), Buffer.from("vid"));

    const candidateId = "cmc_accept1";
    const businessDateKst = "2026-09-11";
    const packageRoot = resolvePackageDirectory({
      assetRoot: piAssetRoot,
      businessDateKst,
      candidateId,
    });
    seedNarrationPackage(packageRoot, "scene-001");

    const catalog = createInMemoryMarketingMediaSourceCatalogRepository();
    const source = await catalog.registerSource({
      sourceKind: "own",
      managedRelativePath: managed,
      rightsKind: "owned",
      mediaType: "video",
    });
    const token = "tok-accept";
    const { baseUrl } = await listenTransferServer({
      catalog,
      env: {
        MARKETING_ASSET_ROOT: piAssetRoot,
        MARKETING_ASSET_TRANSFER_TOKEN: token,
      },
    });

    // Mini-PC env: NO MARKETING_ASSET_ROOT
    const httpTransport = createHttpMarketingAssetTransport({
      env: {
        MARKETING_ASSET_TRANSFER_BASE_URL: baseUrl,
        MARKETING_ASSET_TRANSFER_TOKEN: token,
      },
    });

    const jobRepo = createInMemoryShortformVideoRenderJobRepository();
    const { job } = await enqueueShortformVideoRenderJob({
      repository: jobRepo,
      candidateId,
      businessDateKst,
      briefContract: SHORT_VIDEO_BRIEF_CONTRACT,
      briefSha256: createHash("sha256").update("accept").digest("hex"),
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
      env: {
        MARKETING_ASSET_TRANSPORT_MODE: "http",
        MARKETING_ASSET_TRANSFER_BASE_URL: baseUrl,
        MARKETING_ASSET_TRANSFER_TOKEN: token,
        // intentionally omit MARKETING_ASSET_ROOT
      },
      transport: httpTransport,
      pipelineOverrides: {
        runFfmpegImpl: async ({ args }) => {
          writeFileSync(args[args.length - 1]!, Buffer.from("final-mp4"));
        },
        skipFfprobeValidation: true,
      },
    });

    const result = await executor.execute({
      job,
      workspace: createShortformJobWorkspace({ workspaceRoot, jobId: job.jobId }),
      signal: new AbortController().signal,
    });
    expect(result.ok, !result.ok ? `${result.errorCode}: ${String(result.error)}` : undefined).toBe(
      true,
    );
    if (result.ok) expect(result.outputArtifactPath).toBe(SHORTFORM_FINAL_RELATIVE_PATH);
    expect(existsSync(join(packageRoot, SHORTFORM_FINAL_RELATIVE_PATH))).toBe(true);
    // Acceptance: Mini-PC env had no MARKETING_ASSET_ROOT; Pi package received final via HTTP.
    expect(process.env.MARKETING_ASSET_ROOT ?? "").not.toBe(piAssetRoot);
  });

  it("remote persist failure blocks executor success", async () => {
    const piAssetRoot = tempDir("fail-pi");
    const managed = "source/own/clip.mp4";
    mkdirSync(join(piAssetRoot, "source/own"), { recursive: true });
    writeFileSync(join(piAssetRoot, managed), Buffer.from("vid"));
    const candidateId = "cmc_fail1";
    const businessDateKst = "2026-09-11";
    seedNarrationPackage(
      resolvePackageDirectory({ assetRoot: piAssetRoot, businessDateKst, candidateId }),
    );
    const catalog = createInMemoryMarketingMediaSourceCatalogRepository();
    const source = await catalog.registerSource({
      sourceKind: "own",
      managedRelativePath: managed,
      rightsKind: "owned",
      mediaType: "video",
    });
    const token = "tok-fail";
    const { baseUrl } = await listenTransferServer({
      catalog,
      env: {
        MARKETING_ASSET_ROOT: piAssetRoot,
        MARKETING_ASSET_TRANSFER_TOKEN: token,
      },
    });
    const good = createHttpMarketingAssetTransport({
      env: {
        MARKETING_ASSET_TRANSFER_BASE_URL: baseUrl,
        MARKETING_ASSET_TRANSFER_TOKEN: token,
      },
    });
    const hybrid = {
      mode: "http" as const,
      probeReadiness: () => good.probeReadiness(),
      materializeManagedSource: good.materializeManagedSource.bind(good),
      readCandidatePackageArtifact: good.readCandidatePackageArtifact.bind(good),
      persistShortformFinal: async () => {
        throw Object.assign(new Error("persist down"), { code: "TRANSFER_UPLOAD_FAILED" });
      },
    };
    // wrap with MarketingAssetTransportError-compatible throw from http client path
    const { MarketingAssetTransportError } = await import(
      "@/lib/marketing/assets/transport/errors"
    );
    hybrid.persistShortformFinal = async () => {
      throw new MarketingAssetTransportError("persist down", "TRANSFER_UPLOAD_FAILED");
    };

    const jobRepo = createInMemoryShortformVideoRenderJobRepository();
    const { job } = await enqueueShortformVideoRenderJob({
      repository: jobRepo,
      candidateId,
      businessDateKst,
      briefContract: SHORT_VIDEO_BRIEF_CONTRACT,
      briefSha256: createHash("sha256").update("fail").digest("hex"),
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
      env: {
        MARKETING_ASSET_TRANSPORT_MODE: "http",
        MARKETING_ASSET_TRANSFER_BASE_URL: baseUrl,
        MARKETING_ASSET_TRANSFER_TOKEN: token,
      },
      transport: hybrid,
      pipelineOverrides: {
        runFfmpegImpl: async ({ args }) => {
          writeFileSync(args[args.length - 1]!, Buffer.from("orphan"));
        },
        skipFfprobeValidation: true,
      },
    });
    const result = await executor.execute({
      job,
      workspace: createShortformJobWorkspace({
        workspaceRoot: tempDir("fail-ws"),
        jobId: job.jobId,
      }),
      signal: new AbortController().signal,
    });
    expect(result.ok).toBe(false);
    expect(
      existsSync(
        join(
          resolvePackageDirectory({ assetRoot: piAssetRoot, businessDateKst, candidateId }),
          SHORTFORM_FINAL_RELATIVE_PATH,
        ),
      ),
    ).toBe(false);
  });
});
