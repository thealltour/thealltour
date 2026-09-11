import "server-only";

import { mkdirSync } from "node:fs";
import { extname, join, resolve } from "node:path";

import { assertPathInside, assertSafeRelativeArtifactPath } from "@/lib/marketing/assets/paths";
import type { MarketingMediaSourceRecord } from "@/lib/marketing/assets/sourceCatalog/types";
import { ShortformProductionError } from "@/lib/marketing/assets/shortform/production/errors";
import { downloadToFileWithAllowlist } from "@/lib/marketing/assets/shortform/production/download";
import {
  PEXELS_DOWNLOAD_HOST_ALLOWLIST,
  PIXABAY_DOWNLOAD_HOST_ALLOWLIST,
} from "@/lib/marketing/assets/shortform/production/paths";
import { selectShortformRendition } from "@/lib/marketing/assets/shortform/production/materialize/rendition";
import type { ShortformJobWorkspace } from "@/lib/marketing/assets/shortform/worker/workspace";
import type { MarketingAssetTransport } from "@/lib/marketing/assets/transport/contracts";
import { MarketingAssetTransportError } from "@/lib/marketing/assets/transport/errors";

export type MaterializedSceneSource = {
  sceneId: string;
  sourceId: string;
  origin: string | null;
  mediaKind: "video" | "image" | "photo_motion";
  absolutePath: string;
  provider: string | null;
  providerAssetId: string | null;
};

export type ShortformSourceMaterializer = {
  materialize(input: {
    sceneId: string;
    source: MarketingMediaSourceRecord;
    origin: string | null;
    workspace: ShortformJobWorkspace;
    signal?: AbortSignal;
  }): Promise<MaterializedSceneSource>;
};

function extensionForSource(source: MarketingMediaSourceRecord, fallback: string): string {
  if (source.mimeType?.includes("png")) return ".png";
  if (source.mimeType?.includes("jpeg") || source.mimeType?.includes("jpg")) return ".jpg";
  if (source.mimeType?.includes("webp")) return ".webp";
  if (source.mediaType === "image") return ".jpg";
  if (source.remoteAssetUrl) {
    try {
      const ext = extname(new URL(source.remoteAssetUrl).pathname);
      if (ext && ext.length <= 5) return ext;
    } catch {
      /* ignore */
    }
  }
  return fallback;
}

export function createInternalSourceMaterializer(input: {
  transport: MarketingAssetTransport;
}): ShortformSourceMaterializer {
  return {
    async materialize({ sceneId, source, origin, workspace, signal }) {
      const preferredExt =
        (source.managedRelativePath ? extname(source.managedRelativePath) : "") ||
        extensionForSource(source, ".mp4");
      const dest = join(workspace.sourceDir, `${sceneId}${preferredExt}`);
      mkdirSync(workspace.sourceDir, { recursive: true });
      try {
        const materialized = await input.transport.materializeManagedSource({
          sourceId: source.id,
          destinationAbsolutePath: dest,
          signal,
        });
        return {
          sceneId,
          sourceId: source.id,
          origin,
          mediaKind:
            origin === "photo_motion" || source.mediaType === "image" ? "photo_motion" : "video",
          absolutePath: materialized.absolutePath,
          provider: source.provider,
          providerAssetId: source.providerAssetId,
        };
      } catch (error) {
        if (error instanceof MarketingAssetTransportError) {
          throw new ShortformProductionError(error.message, error.code);
        }
        throw error;
      }
    },
  };
}

function remoteUrlUsable(source: MarketingMediaSourceRecord, now = Date.now()): boolean {
  if (!source.remoteAssetUrl) return false;
  if (!source.remoteAssetUrlExpiresAt) return true;
  const expires = Date.parse(source.remoteAssetUrlExpiresAt);
  return Number.isFinite(expires) && expires > now + 60_000;
}

export type ExternalMaterializerDeps = {
  fetchImpl?: typeof fetch;
  resolveFreshDownloadUrl?: (source: MarketingMediaSourceRecord) => Promise<{
    url: string;
    files?: Array<{
      width: number | null;
      height: number | null;
      quality?: string | null;
      link: string;
    }>;
  } | null>;
};

export function createPexelsSourceMaterializer(
  deps: ExternalMaterializerDeps = {},
): ShortformSourceMaterializer {
  return {
    async materialize({ sceneId, source, origin, workspace, signal }) {
      if (source.provider !== "pexels") {
        throw new ShortformProductionError("not a pexels source", "PROVIDER_MISMATCH");
      }
      let url = remoteUrlUsable(source) ? source.remoteAssetUrl : null;
      if (!url && deps.resolveFreshDownloadUrl) {
        const fresh = await deps.resolveFreshDownloadUrl(source);
        if (fresh?.files?.length) {
          url = selectShortformRendition(fresh.files)?.link ?? fresh.url;
        } else {
          url = fresh?.url ?? null;
        }
      }
      if (!url) {
        throw new ShortformProductionError("pexels download url unavailable", "PEXELS_URL_MISSING");
      }
      const dest = join(workspace.sourceDir, `${sceneId}${extensionForSource(source, ".mp4")}`);
      await downloadToFileWithAllowlist({
        url,
        destinationAbsolutePath: dest,
        allowHosts: PEXELS_DOWNLOAD_HOST_ALLOWLIST,
        signal,
        fetchImpl: deps.fetchImpl,
      });
      return {
        sceneId,
        sourceId: source.id,
        origin,
        mediaKind:
          origin === "photo_motion" || source.mediaType === "image" ? "photo_motion" : "video",
        absolutePath: dest,
        provider: "pexels",
        providerAssetId: source.providerAssetId,
      };
    },
  };
}

export function createPixabaySourceMaterializer(
  deps: ExternalMaterializerDeps = {},
): ShortformSourceMaterializer {
  return {
    async materialize({ sceneId, source, origin, workspace, signal }) {
      if (source.provider !== "pixabay") {
        throw new ShortformProductionError("not a pixabay source", "PROVIDER_MISMATCH");
      }
      let url = remoteUrlUsable(source) ? source.remoteAssetUrl : null;
      if (!url && deps.resolveFreshDownloadUrl) {
        const fresh = await deps.resolveFreshDownloadUrl(source);
        if (fresh?.files?.length) {
          url = selectShortformRendition(fresh.files)?.link ?? fresh.url;
        } else {
          url = fresh?.url ?? null;
        }
      }
      if (!url) {
        throw new ShortformProductionError("pixabay download url unavailable", "PIXABAY_URL_MISSING");
      }
      const dest = join(workspace.sourceDir, `${sceneId}${extensionForSource(source, ".mp4")}`);
      await downloadToFileWithAllowlist({
        url,
        destinationAbsolutePath: dest,
        allowHosts: PIXABAY_DOWNLOAD_HOST_ALLOWLIST,
        signal,
        fetchImpl: deps.fetchImpl,
      });
      return {
        sceneId,
        sourceId: source.id,
        origin,
        mediaKind:
          origin === "photo_motion" || source.mediaType === "image" ? "photo_motion" : "video",
        absolutePath: dest,
        provider: "pixabay",
        providerAssetId: source.providerAssetId,
      };
    },
  };
}

export function createShortformSourceMaterializerRouter(input: {
  transport: MarketingAssetTransport;
  fetchImpl?: typeof fetch;
  resolveFreshDownloadUrl?: ExternalMaterializerDeps["resolveFreshDownloadUrl"];
}): ShortformSourceMaterializer {
  const internal = createInternalSourceMaterializer({ transport: input.transport });
  const pexels = createPexelsSourceMaterializer({
    fetchImpl: input.fetchImpl,
    resolveFreshDownloadUrl: input.resolveFreshDownloadUrl,
  });
  const pixabay = createPixabaySourceMaterializer({
    fetchImpl: input.fetchImpl,
    resolveFreshDownloadUrl: input.resolveFreshDownloadUrl,
  });

  return {
    async materialize(args) {
      const { source, origin } = args;
      if (origin === "generated_video_plan") {
        throw new ShortformProductionError(
          "generated_video_plan not renderable yet",
          "JOB_NOT_RENDERABLE_YET",
        );
      }
      // Catalog may expose managedRelativePath metadata; bytes always via transport (local or HTTP).
      if (source.managedRelativePath) {
        return internal.materialize(args);
      }
      if (source.provider === "pexels") return pexels.materialize(args);
      if (source.provider === "pixabay") return pixabay.materialize(args);
      throw new ShortformProductionError(
        `unsupported provider for materialization: ${source.provider ?? "null"}`,
        "UNKNOWN_PROVIDER",
      );
    },
  };
}

export function resolveManagedAbsolutePathForTests(managedRelativePath: string, assetRoot: string) {
  const relative = assertSafeRelativeArtifactPath(managedRelativePath);
  return assertPathInside(assetRoot, resolve(assetRoot, relative), "managedSource");
}
