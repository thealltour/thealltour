import "server-only";

import { createWriteStream, mkdirSync, readFileSync, statSync } from "node:fs";
import { dirname } from "node:path";
import { pipeline } from "node:stream/promises";
import { Readable } from "node:stream";

import {
  MARKETING_ASSET_TRANSFER_BASE_URL_ENV,
  MARKETING_ASSET_TRANSFER_LIMITS,
  MARKETING_ASSET_TRANSFER_TOKEN_ENV,
  SHORTFORM_FINAL_TRANSFER_RELATIVE_PATH,
  type CandidatePackageArtifactKind,
  type MarketingAssetTransport,
  type MarketingAssetTransportReadiness,
  type MaterializeManagedSourceResult,
  type PersistShortformFinalResult,
  type ReadCandidatePackageArtifactResult,
} from "@/lib/marketing/assets/transport/contracts";
import { MarketingAssetTransportError } from "@/lib/marketing/assets/transport/errors";
import {
  readMarketingAssetTransferToken,
  sha256Buffer,
} from "@/lib/marketing/assets/transport/server/auth";

function requireBaseUrl(env: NodeJS.ProcessEnv | Record<string, string | undefined>): string {
  const raw = env[MARKETING_ASSET_TRANSFER_BASE_URL_ENV]?.trim();
  if (!raw) {
    throw new MarketingAssetTransportError(
      `${MARKETING_ASSET_TRANSFER_BASE_URL_ENV} is required for http transport`,
      "TRANSFER_BASE_URL_MISSING",
    );
  }
  let url: URL;
  try {
    url = new URL(raw);
  } catch {
    throw new MarketingAssetTransportError("invalid transfer base URL", "TRANSFER_BASE_URL_INVALID");
  }
  if (url.protocol !== "http:" && url.protocol !== "https:") {
    throw new MarketingAssetTransportError("transfer base URL must be http(s)", "TRANSFER_BASE_URL_INVALID");
  }
  return raw.replace(/\/$/, "");
}

function withTimeoutSignal(signal: AbortSignal | undefined): {
  signal: AbortSignal;
  cleanup: () => void;
} {
  const controller = new AbortController();
  const onAbort = () => controller.abort();
  signal?.addEventListener("abort", onAbort, { once: true });
  const timer = setTimeout(
    () => controller.abort(),
    MARKETING_ASSET_TRANSFER_LIMITS.httpTimeoutMs,
  );
  return {
    signal: controller.signal,
    cleanup: () => {
      clearTimeout(timer);
      signal?.removeEventListener("abort", onAbort);
    },
  };
}

export function createHttpMarketingAssetTransport(input?: {
  env?: NodeJS.ProcessEnv | Record<string, string | undefined>;
  fetchImpl?: typeof fetch;
}): MarketingAssetTransport {
  const env = input?.env ?? process.env;
  const fetchImpl = input?.fetchImpl ?? fetch;

  return {
    mode: "http",

    probeReadiness(): MarketingAssetTransportReadiness {
      const hasUrl = Boolean(env[MARKETING_ASSET_TRANSFER_BASE_URL_ENV]?.trim());
      const hasToken = Boolean(readMarketingAssetTransferToken(env));
      const ready = hasUrl && hasToken;
      return {
        ready,
        reason: ready
          ? "ready"
          : `not_ready:${[!hasUrl && "transferBaseUrl", !hasToken && "transferToken"].filter(Boolean).join(",")}`,
        mode: "http",
        checks: {
          transferBaseUrl: hasUrl,
          transferToken: hasToken,
          marketingAssetRoot: true,
        },
      };
    },

    async materializeManagedSource({ sourceId, destinationAbsolutePath, signal }) {
      const base = requireBaseUrl(env);
      const token = readMarketingAssetTransferToken(env);
      if (!token) {
        throw new MarketingAssetTransportError(
          `${MARKETING_ASSET_TRANSFER_TOKEN_ENV} missing`,
          "TRANSFER_TOKEN_NOT_CONFIGURED",
        );
      }
      const { signal: timed, cleanup } = withTimeoutSignal(signal);
      try {
        const response = await fetchImpl(`${base}/v1/managed-sources/${encodeURIComponent(sourceId)}/content`, {
          method: "GET",
          headers: { Authorization: `Bearer ${token}`, Accept: "*/*" },
          signal: timed,
        });
        if (!response.ok || !response.body) {
          throw new MarketingAssetTransportError(
            `managed source fetch failed status=${response.status}`,
            mapStatusCode(response.status),
            response.status,
          );
        }
        const expectedSha = response.headers.get("x-content-sha256");
        const contentType = response.headers.get("content-type");
        const lengthHeader = response.headers.get("content-length");
        if (lengthHeader) {
          const len = Number(lengthHeader);
          if (Number.isFinite(len) && len > MARKETING_ASSET_TRANSFER_LIMITS.managedSourceMaxBytes) {
            throw new MarketingAssetTransportError("download exceeds maxBytes", "SOURCE_TOO_LARGE", 413);
          }
        }
        mkdirSync(dirname(destinationAbsolutePath), { recursive: true });
        const nodeStream = Readable.fromWeb(response.body as never);
        let written = 0;
        nodeStream.on("data", (chunk: Buffer) => {
          written += chunk.length;
          if (written > MARKETING_ASSET_TRANSFER_LIMITS.managedSourceMaxBytes) {
            nodeStream.destroy(new Error("SOURCE_TOO_LARGE"));
          }
        });
        await pipeline(nodeStream, createWriteStream(destinationAbsolutePath));
        const bytes = readFileSync(destinationAbsolutePath);
        const digest = sha256Buffer(bytes);
        if (expectedSha && expectedSha !== digest) {
          throw new MarketingAssetTransportError(
            "source integrity mismatch",
            "SOURCE_INTEGRITY_MISMATCH",
            409,
          );
        }
        return {
          absolutePath: destinationAbsolutePath,
          sourceId,
          sha256: digest,
          byteSize: bytes.byteLength,
          mediaType: contentType,
        } satisfies MaterializeManagedSourceResult;
      } catch (error) {
        if (error instanceof MarketingAssetTransportError) throw error;
        const message = error instanceof Error ? error.message : "transfer_failed";
        if (message.includes("SOURCE_TOO_LARGE")) {
          throw new MarketingAssetTransportError(message, "SOURCE_TOO_LARGE", 413);
        }
        if (/aborted/i.test(message)) {
          throw new MarketingAssetTransportError(message, "TRANSFER_ABORTED");
        }
        throw new MarketingAssetTransportError(message, "TRANSFER_DOWNLOAD_FAILED");
      } finally {
        cleanup();
      }
    },

    async readCandidatePackageArtifact({ candidateId, businessDateKst, artifactKind, signal }) {
      const base = requireBaseUrl(env);
      const token = readMarketingAssetTransferToken(env);
      if (!token) {
        throw new MarketingAssetTransportError(
          `${MARKETING_ASSET_TRANSFER_TOKEN_ENV} missing`,
          "TRANSFER_TOKEN_NOT_CONFIGURED",
        );
      }
      const { signal: timed, cleanup } = withTimeoutSignal(signal);
      try {
        const url = new URL(
          `${base}/v1/candidates/${encodeURIComponent(candidateId)}/artifacts/${encodeURIComponent(artifactKind)}`,
        );
        url.searchParams.set("businessDateKst", businessDateKst);
        const response = await fetchImpl(url.toString(), {
          method: "GET",
          headers: { Authorization: `Bearer ${token}`, Accept: "application/json" },
          signal: timed,
        });
        if (!response.ok) {
          throw new MarketingAssetTransportError(
            `candidate artifact fetch failed status=${response.status}`,
            mapStatusCode(response.status),
            response.status,
          );
        }
        const expectedSha = response.headers.get("x-content-sha256");
        const relativePath = response.headers.get("x-artifact-relative-path");
        const lengthHeader = response.headers.get("content-length");
        if (lengthHeader) {
          const len = Number(lengthHeader);
          if (Number.isFinite(len) && len > MARKETING_ASSET_TRANSFER_LIMITS.candidateArtifactMaxBytes) {
            throw new MarketingAssetTransportError(
              "candidate artifact too large",
              "CANDIDATE_ARTIFACT_TOO_LARGE",
              413,
            );
          }
        }
        const ab = await response.arrayBuffer();
        if (ab.byteLength > MARKETING_ASSET_TRANSFER_LIMITS.candidateArtifactMaxBytes) {
          throw new MarketingAssetTransportError(
            "candidate artifact too large",
            "CANDIDATE_ARTIFACT_TOO_LARGE",
            413,
          );
        }
        const bytes = Buffer.from(ab);
        const digest = sha256Buffer(bytes);
        if (expectedSha && expectedSha !== digest) {
          throw new MarketingAssetTransportError(
            "candidate artifact integrity mismatch",
            "CANDIDATE_ARTIFACT_INTEGRITY_MISMATCH",
            409,
          );
        }
        return {
          artifactKind: artifactKind as CandidatePackageArtifactKind,
          relativePath: relativePath ?? artifactKind,
          bytes,
          sha256: digest,
          byteSize: bytes.byteLength,
          mediaType: response.headers.get("content-type") ?? "application/json",
        } satisfies ReadCandidatePackageArtifactResult;
      } catch (error) {
        if (error instanceof MarketingAssetTransportError) throw error;
        const message = error instanceof Error ? error.message : "transfer_failed";
        if (/aborted/i.test(message)) {
          throw new MarketingAssetTransportError(message, "TRANSFER_ABORTED");
        }
        throw new MarketingAssetTransportError(message, "TRANSFER_ARTIFACT_DOWNLOAD_FAILED");
      } finally {
        cleanup();
      }
    },

    async persistShortformFinal({
      candidateId,
      businessDateKst,
      workspaceFinalAbsolutePath,
      signal,
    }) {
      const base = requireBaseUrl(env);
      const token = readMarketingAssetTransferToken(env);
      if (!token) {
        throw new MarketingAssetTransportError(
          `${MARKETING_ASSET_TRANSFER_TOKEN_ENV} missing`,
          "TRANSFER_TOKEN_NOT_CONFIGURED",
        );
      }
      const st = statSync(workspaceFinalAbsolutePath);
      if (st.size <= 0) {
        throw new MarketingAssetTransportError("workspace final empty", "PERSIST_EMPTY");
      }
      if (st.size > MARKETING_ASSET_TRANSFER_LIMITS.finalUploadMaxBytes) {
        throw new MarketingAssetTransportError("final upload too large", "FINAL_TOO_LARGE", 413);
      }
      const body = readFileSync(workspaceFinalAbsolutePath);
      const digest = sha256Buffer(body);
      const { signal: timed, cleanup } = withTimeoutSignal(signal);
      try {
        const url = new URL(
          `${base}/v1/candidates/${encodeURIComponent(candidateId)}/shortform-final`,
        );
        url.searchParams.set("businessDateKst", businessDateKst);
        const response = await fetchImpl(url.toString(), {
          method: "PUT",
          headers: {
            Authorization: `Bearer ${token}`,
            "Content-Type": "video/mp4",
            "Content-Length": String(body.byteLength),
            "X-Content-Sha256": digest,
          },
          body,
          signal: timed,
        });
        if (!response.ok) {
          throw new MarketingAssetTransportError(
            `final upload failed status=${response.status}`,
            mapStatusCode(response.status),
            response.status,
          );
        }
        const json = (await response.json()) as {
          relativePath?: string;
          sha256?: string;
          byteSize?: number;
          mediaType?: string;
        };
        if (json.relativePath !== SHORTFORM_FINAL_TRANSFER_RELATIVE_PATH) {
          throw new MarketingAssetTransportError(
            "unexpected final relativePath from server",
            "TRANSFER_PERSIST_INVALID_RESPONSE",
          );
        }
        if (json.sha256 && json.sha256 !== digest) {
          throw new MarketingAssetTransportError(
            "server sha256 mismatch",
            "TRANSFER_PERSIST_HASH_MISMATCH",
          );
        }
        return {
          relativePath: SHORTFORM_FINAL_TRANSFER_RELATIVE_PATH,
          sha256: json.sha256 ?? digest,
          byteSize: json.byteSize ?? body.byteLength,
          mediaType: "video/mp4",
        } satisfies PersistShortformFinalResult;
      } catch (error) {
        if (error instanceof MarketingAssetTransportError) throw error;
        const message = error instanceof Error ? error.message : "transfer_failed";
        throw new MarketingAssetTransportError(message, "TRANSFER_UPLOAD_FAILED");
      } finally {
        cleanup();
      }
    },
  };
}

function mapStatusCode(status: number): string {
  if (status === 401 || status === 403) return "TRANSFER_UNAUTHORIZED";
  if (status === 404) return "SOURCE_NOT_FOUND";
  if (status === 413) return "SOURCE_TOO_LARGE";
  if (status === 422) return "SOURCE_NOT_LOCALLY_MANAGED";
  if (status === 400) return "ARTIFACT_KIND_NOT_ALLOWED";
  return "TRANSFER_HTTP_ERROR";
}
