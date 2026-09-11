import { existsSync, mkdirSync, readFileSync, statSync, unlinkSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { randomUUID } from "node:crypto";
import type { IncomingMessage, ServerResponse } from "node:http";

import { resolveMarketingAssetRoot } from "@/lib/marketing/assets/config";
import { parseMarketingAssetManifest } from "@/lib/marketing/assets/parse";
import {
  assertPathInside,
  assertSafeRelativeArtifactPath,
  resolvePackageArtifactPath,
  resolvePackageDirectory,
} from "@/lib/marketing/assets/paths";
import { persistShortformFinalArtifact } from "@/lib/marketing/assets/shortform/production/persistFinal";
import type { MarketingMediaSourceCatalogRepository } from "@/lib/marketing/assets/sourceCatalog/repository";
import {
  MARKETING_ASSET_TRANSFER_LIMITS,
  resolveCandidatePackageArtifactRelativePath,
  SHORTFORM_FINAL_TRANSFER_RELATIVE_PATH,
} from "@/lib/marketing/assets/transport/contracts";
import { MarketingAssetTransportError } from "@/lib/marketing/assets/transport/errors";
import {
  assertMarketingAssetTransferAuth,
  sha256Buffer,
} from "@/lib/marketing/assets/transport/server/auth";

export type MarketingAssetTransferServerDeps = {
  catalog: MarketingMediaSourceCatalogRepository;
  env?: NodeJS.ProcessEnv | Record<string, string | undefined>;
  serviceVersion?: string;
};

function sendJson(res: ServerResponse, status: number, body: Record<string, unknown>): void {
  const payload = JSON.stringify(body);
  res.statusCode = status;
  res.setHeader("Content-Type", "application/json; charset=utf-8");
  res.setHeader("Content-Length", Buffer.byteLength(payload));
  res.end(payload);
}

function sendError(res: ServerResponse, error: unknown): void {
  if (error instanceof MarketingAssetTransportError) {
    sendJson(res, error.httpStatus ?? 500, { error: error.code, message: error.message });
    return;
  }
  sendJson(res, 500, { error: "INTERNAL_ERROR", message: "internal_error" });
}

async function readBodyBounded(
  req: IncomingMessage,
  maxBytes: number,
): Promise<Buffer> {
  const chunks: Buffer[] = [];
  let total = 0;
  for await (const chunk of req) {
    const buf = Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk);
    total += buf.byteLength;
    if (total > maxBytes) {
      throw new MarketingAssetTransportError("upload too large", "FINAL_TOO_LARGE", 413);
    }
    chunks.push(buf);
  }
  return Buffer.concat(chunks);
}

function readManifestSha(packageRoot: string, relativePath: string): string | null {
  const manifestPath = join(packageRoot, "manifest.json");
  if (!existsSync(manifestPath)) return null;
  try {
    const manifest = parseMarketingAssetManifest(
      JSON.parse(readFileSync(manifestPath, "utf8")) as unknown,
    );
    return manifest.artifacts.find((a) => a.relativePath === relativePath)?.sha256 ?? null;
  } catch {
    return null;
  }
}

/**
 * Node http request handler for Pi Asset Transfer API.
 * No CORS. Bearer auth required except GET /health.
 */
export async function handleMarketingAssetTransferRequest(
  req: IncomingMessage,
  res: ServerResponse,
  deps: MarketingAssetTransferServerDeps,
): Promise<void> {
  const env = deps.env ?? process.env;
  const url = new URL(req.url ?? "/", "http://127.0.0.1");
  const method = (req.method ?? "GET").toUpperCase();

  try {
    if (method === "GET" && url.pathname === "/health") {
      let assetRootReady = false;
      try {
        resolveMarketingAssetRoot({ env });
        assetRootReady = true;
      } catch {
        assetRootReady = false;
      }
      sendJson(res, 200, {
        status: assetRootReady ? "ok" : "degraded",
        service: "marketing-asset-transfer",
        version: deps.serviceVersion ?? "1",
        assetRootReady,
        catalogReady: true,
      });
      return;
    }

    assertMarketingAssetTransferAuth(req.headers.authorization, env);

    const managedMatch = url.pathname.match(/^\/v1\/managed-sources\/([^/]+)\/content$/);
    if (method === "GET" && managedMatch) {
      const sourceId = decodeURIComponent(managedMatch[1]!);
      const source = await deps.catalog.getById(sourceId);
      if (!source) {
        throw new MarketingAssetTransportError("source not found", "SOURCE_NOT_FOUND", 404);
      }
      if (source.status !== "active") {
        throw new MarketingAssetTransportError("source not active", "SOURCE_NOT_ACTIVE", 409);
      }
      if (!source.managedRelativePath) {
        throw new MarketingAssetTransportError(
          "source is not locally managed",
          "SOURCE_NOT_LOCALLY_MANAGED",
          422,
        );
      }
      const relative = assertSafeRelativeArtifactPath(source.managedRelativePath);
      const assetRoot = resolveMarketingAssetRoot({ env });
      const absolute = assertPathInside(assetRoot, join(assetRoot, relative), "managedSource");
      if (!existsSync(absolute)) {
        throw new MarketingAssetTransportError("managed source file missing", "INTERNAL_SOURCE_MISSING", 404);
      }
      const st = statSync(absolute);
      if (st.size > MARKETING_ASSET_TRANSFER_LIMITS.managedSourceMaxBytes) {
        throw new MarketingAssetTransportError("managed source too large", "SOURCE_TOO_LARGE", 413);
      }
      const bytes = readFileSync(absolute);
      const digest = sha256Buffer(bytes);
      if (source.sha256 && source.sha256 !== digest) {
        throw new MarketingAssetTransportError("source integrity mismatch", "SOURCE_INTEGRITY_MISMATCH", 409);
      }
      res.statusCode = 200;
      res.setHeader("Content-Type", source.mimeType ?? "application/octet-stream");
      res.setHeader("Content-Length", String(bytes.byteLength));
      res.setHeader("X-Content-Sha256", digest);
      res.setHeader("X-Source-Id", sourceId);
      res.end(bytes);
      return;
    }

    const artifactMatch = url.pathname.match(/^\/v1\/candidates\/([^/]+)\/artifacts\/([^/]+)$/);
    if (method === "GET" && artifactMatch) {
      const candidateId = decodeURIComponent(artifactMatch[1]!);
      const kindRaw = decodeURIComponent(artifactMatch[2]!);
      const businessDateKst = url.searchParams.get("businessDateKst")?.trim() ?? "";
      if (!/^\d{4}-\d{2}-\d{2}$/.test(businessDateKst)) {
        throw new MarketingAssetTransportError(
          "businessDateKst required as YYYY-MM-DD",
          "INVALID_BUSINESS_DATE",
          400,
        );
      }
      if (!/^[a-zA-Z0-9][a-zA-Z0-9_-]{0,127}$/.test(candidateId)) {
        throw new MarketingAssetTransportError("invalid candidateId", "INVALID_CANDIDATE_ID", 400);
      }
      // Reject path-like kinds before mapping.
      if (kindRaw.includes("/") || kindRaw.includes("\\") || kindRaw.includes("..")) {
        throw new MarketingAssetTransportError(
          "path-like artifact kind rejected",
          "ARTIFACT_KIND_NOT_ALLOWED",
          400,
        );
      }
      const relativePath = resolveCandidatePackageArtifactRelativePath(kindRaw);
      const assetRoot = resolveMarketingAssetRoot({ env });
      const packageRoot = resolvePackageDirectory({
        assetRoot,
        businessDateKst,
        candidateId,
      });
      const absolute = resolvePackageArtifactPath({ packageRoot, relativePath });
      if (!existsSync(absolute)) {
        throw new MarketingAssetTransportError(
          "candidate package artifact missing",
          "CANDIDATE_ARTIFACT_MISSING",
          404,
        );
      }
      const st = statSync(absolute);
      if (st.size > MARKETING_ASSET_TRANSFER_LIMITS.candidateArtifactMaxBytes) {
        throw new MarketingAssetTransportError(
          "candidate artifact too large",
          "CANDIDATE_ARTIFACT_TOO_LARGE",
          413,
        );
      }
      const bytes = readFileSync(absolute);
      const digest = sha256Buffer(bytes);
      const expected = readManifestSha(packageRoot, relativePath);
      if (expected && expected !== digest) {
        throw new MarketingAssetTransportError(
          "candidate artifact integrity mismatch",
          "CANDIDATE_ARTIFACT_INTEGRITY_MISMATCH",
          409,
        );
      }
      res.statusCode = 200;
      res.setHeader("Content-Type", "application/json; charset=utf-8");
      res.setHeader("Content-Length", String(bytes.byteLength));
      res.setHeader("X-Content-Sha256", digest);
      res.setHeader("X-Artifact-Relative-Path", relativePath);
      res.setHeader("X-Artifact-Kind", kindRaw);
      res.end(bytes);
      return;
    }

    const finalMatch = url.pathname.match(/^\/v1\/candidates\/([^/]+)\/shortform-final$/);
    if (method === "PUT" && finalMatch) {
      const candidateId = decodeURIComponent(finalMatch[1]!);
      const businessDateKst = url.searchParams.get("businessDateKst")?.trim() ?? "";
      if (!/^\d{4}-\d{2}-\d{2}$/.test(businessDateKst)) {
        throw new MarketingAssetTransportError(
          "businessDateKst required as YYYY-MM-DD",
          "INVALID_BUSINESS_DATE",
          400,
        );
      }
      if (!/^[a-zA-Z0-9][a-zA-Z0-9_-]{0,127}$/.test(candidateId)) {
        throw new MarketingAssetTransportError("invalid candidateId", "INVALID_CANDIDATE_ID", 400);
      }
      const contentType = (req.headers["content-type"] ?? "").split(";")[0]!.trim().toLowerCase();
      if (contentType && contentType !== "video/mp4" && contentType !== "application/octet-stream") {
        throw new MarketingAssetTransportError("unexpected content-type", "INVALID_CONTENT_TYPE", 415);
      }
      const declaredLength = Number(req.headers["content-length"] ?? NaN);
      if (
        Number.isFinite(declaredLength) &&
        declaredLength > MARKETING_ASSET_TRANSFER_LIMITS.finalUploadMaxBytes
      ) {
        // Reject before buffering — avoid 150MiB downloads / test timeouts.
        sendJson(res, 413, { error: "FINAL_TOO_LARGE", message: "upload too large" });
        req.resume();
        return;
      }
      const expectedSha = String(req.headers["x-content-sha256"] ?? "").trim().toLowerCase();
      const body = await readBodyBounded(req, MARKETING_ASSET_TRANSFER_LIMITS.finalUploadMaxBytes);
      if (body.byteLength <= 0) {
        throw new MarketingAssetTransportError("empty upload", "PERSIST_EMPTY", 400);
      }
      const digest = sha256Buffer(body);
      if (expectedSha && expectedSha !== digest) {
        throw new MarketingAssetTransportError("upload hash mismatch", "UPLOAD_HASH_MISMATCH", 400);
      }

      const assetRoot = resolveMarketingAssetRoot({ env });
      const packageRoot = resolvePackageDirectory({
        assetRoot,
        businessDateKst,
        candidateId,
      });
      mkdirSync(join(packageRoot, ".transfer-tmp"), { recursive: true });
      const tmpPath = join(packageRoot, ".transfer-tmp", `shortform-${randomUUID()}.mp4`);
      try {
        writeFileSync(tmpPath, body);
        const persisted = persistShortformFinalArtifact({
          packageRoot,
          workspaceFinalAbsolutePath: tmpPath,
        });
        sendJson(res, 200, {
          relativePath: SHORTFORM_FINAL_TRANSFER_RELATIVE_PATH,
          sha256: persisted.sha256,
          byteSize: persisted.byteSize,
          mediaType: "video/mp4",
        });
      } finally {
        try {
          unlinkSync(tmpPath);
        } catch {
          /* ignore */
        }
      }
      return;
    }

    sendJson(res, 404, { error: "NOT_FOUND", message: "not_found" });
  } catch (error) {
    sendError(res, error);
  }
}
