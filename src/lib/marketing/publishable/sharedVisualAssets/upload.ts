/**
 * Server-side Shared Visual upload — visualId slot mapping.
 * Browser filename is never authoritative.
 */

import { existsSync, unlinkSync } from "node:fs";

import { detectImageMime } from "@/lib/admin/bandImport/bandImportImageConstants";
import { resolvePackageArtifactPath } from "@/lib/marketing/assets/paths";
import { overwritePackageArtifact } from "@/lib/marketing/assets/writeArtifact";
import type { ManualAstraHandoff } from "@/lib/marketing/publishable/manualAstraHandoff/contracts";
import { isStableSocialVisualId } from "@/lib/marketing/publishable/socialVisualPlan";
import type { SharedVisualAsset } from "@/lib/marketing/publishable/sharedVisualAssets/contracts";
import { computeManualAstraHandoffFingerprint } from "@/lib/marketing/publishable/sharedVisualAssets/handoffFingerprint";
import {
  MAX_SHARED_VISUAL_UPLOAD_BYTES,
  SHARED_VISUAL_MEDIA_DIR,
} from "@/lib/marketing/publishable/sharedVisualAssets/paths";
import {
  persistSharedVisualAssetsManifest,
  readSharedVisualAssetsManifest,
  upsertSharedVisualAsset,
} from "@/lib/marketing/publishable/sharedVisualAssets/persist";
import { isManualAstraHandoffSourceStale } from "@/lib/marketing/publishable/sharedVisualAssets/status";
import type { SharedVisualPlan } from "@/lib/marketing/publishable/sharedVisualPlan/contracts";

export class SharedVisualUploadError extends Error {
  readonly code: string;
  readonly httpStatus: number;
  constructor(code: string, message: string, httpStatus = 400) {
    super(message);
    this.name = "SharedVisualUploadError";
    this.code = code;
    this.httpStatus = httpStatus;
  }
}

function extensionForMime(mime: string): "png" | "jpg" | "webp" {
  if (mime === "image/jpeg") return "jpg";
  if (mime === "image/webp") return "webp";
  return "png";
}

function readPngDimensions(bytes: Buffer): { width?: number; height?: number } {
  // PNG IHDR at offset 16
  if (bytes.length < 24) return {};
  if (bytes[0] !== 0x89 || bytes[1] !== 0x50) return {};
  try {
    const width = bytes.readUInt32BE(16);
    const height = bytes.readUInt32BE(20);
    if (width > 0 && height > 0 && width < 100_000 && height < 100_000) {
      return { width, height };
    }
  } catch {
    /* ignore */
  }
  return {};
}

export function validateSharedVisualUploadBytes(bytes: Buffer): {
  mimeType: "image/png" | "image/jpeg" | "image/webp";
  extension: "png" | "jpg" | "webp";
} {
  if (bytes.length === 0) {
    throw new SharedVisualUploadError("empty_file", "빈 파일은 업로드할 수 없습니다.");
  }
  if (bytes.length > MAX_SHARED_VISUAL_UPLOAD_BYTES) {
    throw new SharedVisualUploadError(
      "file_too_large",
      `파일이 너무 큽니다 (최대 ${Math.floor(MAX_SHARED_VISUAL_UPLOAD_BYTES / (1024 * 1024))}MB).`,
    );
  }
  const mime = detectImageMime(bytes);
  if (!mime) {
    throw new SharedVisualUploadError(
      "invalid_image_type",
      "PNG / JPEG / WEBP 이미지만 업로드할 수 있습니다.",
    );
  }
  return { mimeType: mime, extension: extensionForMime(mime) };
}

export function sharedVisualStoredRelativePath(visualId: string, extension: string): string {
  if (!isStableSocialVisualId(visualId)) {
    throw new SharedVisualUploadError("invalid_visual_id", "visualId 형식이 올바르지 않습니다.");
  }
  if (visualId.includes("/") || visualId.includes("\\") || visualId.includes("..")) {
    throw new SharedVisualUploadError("invalid_visual_id", "visualId에 경로 문자가 포함되어 있습니다.");
  }
  return `${SHARED_VISUAL_MEDIA_DIR}/${visualId}.${extension}`;
}

export function uploadSharedVisualAsset(input: {
  packageRoot: string;
  handoff: ManualAstraHandoff;
  sharedVisualPlan?: SharedVisualPlan | null;
  visualId: string;
  bytes: Buffer;
  /** Client filename — never used as storage identity. */
  clientFilename?: string | null;
  now?: Date;
  allowStaleUpload?: boolean;
}): {
  asset: SharedVisualAsset;
  manifest: ReturnType<typeof upsertSharedVisualAsset>;
} {
  void input.clientFilename; // explicitly ignored for identity
  const visualId = input.visualId.trim();
  if (!isStableSocialVisualId(visualId)) {
    throw new SharedVisualUploadError("unknown_visual_id", "알 수 없는 visualId입니다.");
  }

  const handoffVisual = input.handoff.visuals.find((v) => v.visualId === visualId);
  if (!handoffVisual) {
    throw new SharedVisualUploadError(
      "unknown_visual_id",
      "현재 Astra 요청문에 없는 visualId입니다.",
    );
  }

  const handoffStale = isManualAstraHandoffSourceStale({
    handoff: input.handoff,
    sharedVisualPlan: input.sharedVisualPlan ?? null,
  });
  if (handoffStale && !input.allowStaleUpload) {
    throw new SharedVisualUploadError(
      "stale_handoff",
      "현재 Astra 요청문이 최신 Visual Plan과 일치하지 않습니다. 새 요청문을 생성한 뒤 업로드하세요.",
      409,
    );
  }

  const { mimeType, extension } = validateSharedVisualUploadBytes(input.bytes);
  const storedPath = sharedVisualStoredRelativePath(visualId, extension);
  const storedFilename = `${visualId}.${extension}`;
  const nowIso = (input.now ?? new Date()).toISOString();

  const existingManifest = readSharedVisualAssetsManifest(input.packageRoot);
  const previous = existingManifest?.assets.find((a) => a.visualId === visualId) ?? null;

  // Write binary first — on failure previous mapping stays valid.
  overwritePackageArtifact({
    packageRoot: input.packageRoot,
    planned: {
      relativePath: storedPath,
      content: input.bytes,
      kind: "human_edited",
      origin: "human_edit",
      mediaType: mimeType,
    },
    createdAt: nowIso,
  });

  const dims = mimeType === "image/png" ? readPngDimensions(input.bytes) : {};
  const asset: SharedVisualAsset = {
    visualId,
    expectedFilename: handoffVisual.expectedFilename,
    storedFilename,
    storedPath,
    mimeType,
    byteSize: input.bytes.byteLength,
    ...dims,
    uploadedAt: nowIso,
    status: "uploaded",
  };

  const handoffFp = computeManualAstraHandoffFingerprint(input.handoff);
  const manifest = upsertSharedVisualAsset({
    manifest: existingManifest,
    asset,
    sourceAssetId: input.handoff.sourceAssetId,
    sourceAssetVersion: input.handoff.sourceAssetVersion,
    sourceSharedVisualPlanFingerprint: input.handoff.sourceSharedVisualPlanFingerprint,
    sourceManualAstraHandoffFingerprint: handoffFp,
    now: input.now,
  });

  try {
    persistSharedVisualAssetsManifest({
      packageRoot: input.packageRoot,
      manifest,
      createdAt: nowIso,
    });
  } catch (error) {
    // Manifest failed — leave binary; do not clear previous mapping conceptually
    // (previous mapping still in old manifest file if write failed entirely).
    throw new SharedVisualUploadError(
      "manifest_persist_failed",
      "이미지 저장 후 매핑 기록에 실패했습니다. 다시 시도해 주세요.",
      500,
    );
  }

  // Best-effort cleanup of previous file if path changed (e.g. png → jpg).
  if (previous && previous.storedPath !== storedPath) {
    try {
      const abs = resolvePackageArtifactPath({
        packageRoot: input.packageRoot,
        relativePath: previous.storedPath,
      });
      if (existsSync(abs)) unlinkSync(abs);
    } catch {
      /* orphan cleanup optional */
    }
  }

  return { asset, manifest };
}
