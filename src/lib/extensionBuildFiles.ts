import "server-only";

import fs from "node:fs";
import path from "node:path";
import {
  committedExtensionManifestRelPath,
  committedExtensionZipRelPath,
  type ExtensionBuildManifest,
  type ExtensionSlug,
} from "@/lib/extensionBuilds";

function repoPath(relativePath: string): string {
  return path.join(process.cwd(), relativePath);
}

export function readCommittedExtensionManifest(slug: ExtensionSlug): ExtensionBuildManifest | null {
  const filePath = repoPath(committedExtensionManifestRelPath(slug));
  if (!fs.existsSync(filePath)) return null;
  try {
    const parsed = JSON.parse(fs.readFileSync(filePath, "utf8")) as ExtensionBuildManifest;
    if (!parsed?.version) return null;
    return parsed;
  } catch {
    return null;
  }
}

export function readCommittedExtensionZip(slug: ExtensionSlug): { buffer: Buffer; fileName: string } | null {
  const zipPath = repoPath(committedExtensionZipRelPath(slug));
  if (!fs.existsSync(zipPath)) return null;
  const buffer = fs.readFileSync(zipPath);
  if (buffer.byteLength === 0) return null;
  const manifest = readCommittedExtensionManifest(slug);
  return {
    buffer,
    fileName: manifest?.fileName || `${slug}.zip`,
  };
}
