import "server-only";

import { isAbsolute, resolve } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

import { isPathInside } from "@/lib/marketing/assets/paths";
import { ShortformProductionError } from "@/lib/marketing/assets/shortform/production/errors";

const REMOTE_OR_DATA_PREFIXES = ["http://", "https://", "data:", "blob:"] as const;

function hasAllowedRemoteOrDataPrefix(value: string): boolean {
  return REMOTE_OR_DATA_PREFIXES.some((prefix) => value.startsWith(prefix));
}

function fileUrlToAbsolutePath(fileUrl: string): string {
  try {
    return resolve(fileURLToPath(fileUrl));
  } catch {
    throw new ShortformProductionError("invalid file URL mediaSrc", "REMOTION_MEDIA_SRC_INVALID");
  }
}

/**
 * Convert a materialized local filesystem path into a Remotion-consumable media src.
 *
 * Remotion's getAbsoluteSrc() treats bare absolute paths as origin-relative HTTP paths
 * (e.g. http://localhost:3002/home/...), which 404. Local assets must use file:// URLs.
 *
 * Security: only paths inside allowedRoot may become file:// references.
 * Remote http(s)/data/blob URLs pass through unchanged.
 */
export function toRemotionConsumableMediaSrc(input: {
  mediaSrc: string;
  allowedRoot: string;
}): string {
  const raw = input.mediaSrc?.trim() ?? "";
  if (!raw) {
    throw new ShortformProductionError("mediaSrc is required", "REMOTION_MEDIA_SRC_INVALID");
  }
  const allowedRoot = resolve(input.allowedRoot);
  if (!allowedRoot) {
    throw new ShortformProductionError("allowedRoot is required", "REMOTION_MEDIA_SRC_INVALID");
  }

  if (hasAllowedRemoteOrDataPrefix(raw)) {
    return raw;
  }

  if (raw.startsWith("file:")) {
    const absolute = fileUrlToAbsolutePath(raw);
    if (!isPathInside(allowedRoot, absolute)) {
      throw new ShortformProductionError(
        "local mediaSrc escapes allowed workspace root",
        "REMOTION_MEDIA_SRC_FORBIDDEN",
      );
    }
    return pathToFileURL(absolute).href;
  }

  if (!isAbsolute(raw)) {
    throw new ShortformProductionError(
      "relative mediaSrc is not supported for Remotion render",
      "REMOTION_MEDIA_SRC_INVALID",
    );
  }

  const absolute = resolve(raw);
  if (!isPathInside(allowedRoot, absolute)) {
    throw new ShortformProductionError(
      "local mediaSrc escapes allowed workspace root",
      "REMOTION_MEDIA_SRC_FORBIDDEN",
    );
  }
  return pathToFileURL(absolute).href;
}
