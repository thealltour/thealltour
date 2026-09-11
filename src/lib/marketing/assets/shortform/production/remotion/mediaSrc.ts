import "server-only";

import { copyFileSync, existsSync, lstatSync, mkdirSync, rmSync } from "node:fs";
import { dirname, extname, isAbsolute, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

import { isPathInside } from "@/lib/marketing/assets/paths";
import { ShortformProductionError } from "@/lib/marketing/assets/shortform/production/errors";
import type { TravelShortInfoV1Props } from "@/lib/marketing/assets/shortform/production/remotion/TravelShortInfoV1";
import { resolveShortformWorkspaceRoot } from "@/lib/marketing/assets/shortform/worker/workspace";

const REMOTE_OR_DATA_PREFIXES = ["http://", "https://", "data:", "blob:"] as const;

export function isRemoteOrDataRemotionMediaSrc(value: string): boolean {
  return REMOTE_OR_DATA_PREFIXES.some((prefix) => value.startsWith(prefix));
}

function absoluteFromMediaSrc(mediaSrc: string): string {
  if (mediaSrc.startsWith("file:")) {
    try {
      return resolve(fileURLToPath(mediaSrc));
    } catch {
      throw new ShortformProductionError("invalid file URL mediaSrc", "REMOTION_MEDIA_SRC_INVALID");
    }
  }
  if (!isAbsolute(mediaSrc)) {
    throw new ShortformProductionError(
      "relative mediaSrc requires Remotion publicDir staging first",
      "REMOTION_MEDIA_SRC_INVALID",
    );
  }
  return resolve(mediaSrc);
}

/**
 * Remotion OffthreadVideo compositor downloads only http(s) URLs.
 * Bare absolute paths become origin-relative HTTP (404).
 * file:// is rejected by the compositor download client.
 *
 * Local workspace media must be staged as REGULAR FILES into bundle publicDir
 * and referenced via staticFile()-compatible relative paths.
 * Symlinks are not used: Remotion webpack/static serving does not reliably
 * materialize symlink targets into the bundle public tree.
 */
export function assertLocalMediaInsideAllowedRoot(input: {
  mediaSrc: string;
  allowedRoot: string;
}): string {
  const absolute = absoluteFromMediaSrc(input.mediaSrc.trim());
  const allowedRoot = resolve(input.allowedRoot);
  if (!isPathInside(allowedRoot, absolute)) {
    throw new ShortformProductionError(
      "local mediaSrc escapes allowed workspace root",
      "REMOTION_MEDIA_SRC_FORBIDDEN",
    );
  }
  if (!existsSync(absolute)) {
    throw new ShortformProductionError("local mediaSrc file missing", "REMOTION_MEDIA_SRC_MISSING");
  }
  return absolute;
}

function safePublicRelativeName(sceneId: string, absolutePath: string): string {
  const ext = extname(absolutePath).toLowerCase() || ".mp4";
  const safeExt = /^\.[a-z0-9]{1,8}$/.test(ext) ? ext : ".mp4";
  const safeScene = sceneId.replace(/[^A-Za-z0-9_-]/g, "_").slice(0, 64) || "scene";
  return `media/${safeScene}${safeExt}`;
}

/** Idempotent: replace any prior symlink/file, then copy bytes as a regular file. */
export function materializeRegularPublicMediaFile(input: {
  absoluteSource: string;
  destination: string;
}): void {
  mkdirSync(dirname(input.destination), { recursive: true });
  try {
    lstatSync(input.destination);
    rmSync(input.destination, { force: true });
  } catch {
    /* destination absent */
  }
  copyFileSync(input.absoluteSource, input.destination);
  const st = lstatSync(input.destination);
  if (st.isSymbolicLink()) {
    throw new ShortformProductionError(
      "staged Remotion media must be a regular file",
      "REMOTION_MEDIA_STAGING_FAILED",
    );
  }
  if (!st.isFile()) {
    throw new ShortformProductionError(
      "staged Remotion media must be a regular file",
      "REMOTION_MEDIA_STAGING_FAILED",
    );
  }
}

/**
 * Stage local scene media into a Remotion publicDir and rewrite props:
 * - remote/data URLs unchanged
 * - local absolute/file paths → public-relative path (for staticFile())
 */
export function stageTravelShortInfoMediaForRemotion(input: {
  props: TravelShortInfoV1Props;
  publicDir: string;
  allowedRoot: string;
}): TravelShortInfoV1Props {
  const publicDir = resolve(input.publicDir);
  mkdirSync(publicDir, { recursive: true });
  const allowedRoot = resolve(input.allowedRoot);

  const scenes = input.props.scenes.map((scene) => {
    const raw = scene.mediaSrc?.trim() ?? "";
    if (!raw) {
      throw new ShortformProductionError("mediaSrc is required", "REMOTION_MEDIA_SRC_INVALID");
    }
    if (isRemoteOrDataRemotionMediaSrc(raw)) {
      return scene;
    }
    const absolute = assertLocalMediaInsideAllowedRoot({ mediaSrc: raw, allowedRoot });
    const relative = safePublicRelativeName(scene.sceneId, absolute);
    const destination = join(publicDir, relative);
    if (!isPathInside(publicDir, destination)) {
      throw new ShortformProductionError(
        "staged media path escapes publicDir",
        "REMOTION_MEDIA_SRC_FORBIDDEN",
      );
    }
    materializeRegularPublicMediaFile({ absoluteSource: absolute, destination });
    return { ...scene, mediaSrc: relative };
  });

  return { ...input.props, scenes };
}

export function resolveAllowedShortformMediaRoot(
  env: NodeJS.ProcessEnv | Record<string, string | undefined> = process.env,
): string {
  return resolveShortformWorkspaceRoot(env.SHORTFORM_WORKER_WORKSPACE_PATH);
}
