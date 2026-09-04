import { existsSync, lstatSync, readdirSync } from "node:fs";
import { basename, resolve } from "node:path";

import { VideoClipError } from "@/lib/marketing/assets/errors";
import { assertPathInside, resolvePackageArtifactPath } from "@/lib/marketing/assets/paths";
import {
  AI_VIDEO_INCOMING_DIRECTORY,
  AI_VIDEO_INCOMING_EXTENSIONS,
} from "@/lib/marketing/assets/video/intake/contracts";

const SHOT_STEM_FILE = /^(shot-[0-9]{4})\.([A-Za-z0-9]+)$/;

export type IncomingDropFile = {
  fileName: string;
  relativePath: string;
  absolutePath: string;
  shotId: string | null;
  reason: "mapped" | "unrelated" | "unsupported_extension" | "symlink" | "not_regular_file" | "unsafe_name";
};

export function incomingClipRelativePath(fileName: string): string {
  return `${AI_VIDEO_INCOMING_DIRECTORY}/${fileName}`;
}

export function parseIncomingShotFileName(fileName: string): { shotId: string; extension: string } | null {
  const match = SHOT_STEM_FILE.exec(fileName);
  if (!match) return null;
  return { shotId: match[1], extension: match[2] };
}

export function assertSafeIncomingFileName(fileName: string): void {
  if (!fileName || fileName !== basename(fileName) || fileName.includes("\0") || fileName === "." || fileName === "..") {
    throw new VideoClipError("incoming_rejected", "Incoming clip file name must be a single safe path segment");
  }
  if (fileName.includes("/") || fileName.includes("\\") || fileName.includes("..")) {
    throw new VideoClipError("incoming_rejected", "Incoming clip file name must not contain path traversal");
  }
}

export function resolveIncomingDirectory(packageRoot: string): string {
  const incomingRoot = resolve(packageRoot, ...AI_VIDEO_INCOMING_DIRECTORY.split("/"));
  return assertPathInside(packageRoot, incomingRoot, "incoming directory");
}

export function resolveIncomingClipAbsolutePath(input: { packageRoot: string; fileName: string }): string {
  assertSafeIncomingFileName(input.fileName);
  const absolutePath = resolvePackageArtifactPath({
    packageRoot: input.packageRoot,
    relativePath: incomingClipRelativePath(input.fileName),
  });
  assertPathInside(resolveIncomingDirectory(input.packageRoot), absolutePath, "incoming clip path");
  return absolutePath;
}

export function listIncomingDropFiles(packageRoot: string): IncomingDropFile[] {
  const incomingAbsolute = resolveIncomingDirectory(packageRoot);
  if (!existsSync(incomingAbsolute)) {
    return [];
  }

  const entries = readdirSync(incomingAbsolute, { withFileTypes: true });
  const files: IncomingDropFile[] = [];
  for (const entry of entries) {
    const fileName = entry.name;
    try {
      assertSafeIncomingFileName(fileName);
    } catch {
      files.push({
        fileName,
        relativePath: incomingClipRelativePath(fileName),
        absolutePath: resolve(incomingAbsolute, fileName),
        shotId: null,
        reason: "unsafe_name",
      });
      continue;
    }

    const relativePath = incomingClipRelativePath(fileName);
    const absolutePath = resolveIncomingClipAbsolutePath({ packageRoot, fileName });
    const stats = lstatSync(absolutePath);
    if (stats.isSymbolicLink() || entry.isSymbolicLink()) {
      files.push({
        fileName,
        relativePath,
        absolutePath,
        shotId: parseIncomingShotFileName(fileName)?.shotId ?? null,
        reason: "symlink",
      });
      continue;
    }
    if (!stats.isFile()) {
      files.push({
        fileName,
        relativePath,
        absolutePath,
        shotId: parseIncomingShotFileName(fileName)?.shotId ?? null,
        reason: "not_regular_file",
      });
      continue;
    }

    const parsedName = parseIncomingShotFileName(fileName);
    if (parsedName && (AI_VIDEO_INCOMING_EXTENSIONS as readonly string[]).includes(parsedName.extension)) {
      files.push({
        fileName,
        relativePath,
        absolutePath,
        shotId: parsedName.shotId,
        reason: "mapped",
      });
      continue;
    }
    if (parsedName) {
      files.push({
        fileName,
        relativePath,
        absolutePath,
        shotId: parsedName.shotId,
        reason: "unsupported_extension",
      });
      continue;
    }
    files.push({
      fileName,
      relativePath,
      absolutePath,
      shotId: null,
      reason: "unrelated",
    });
  }
  return files.sort((left, right) => left.fileName.localeCompare(right.fileName));
}
