import { existsSync, readFileSync } from "node:fs";
import { isAbsolute, resolve } from "node:path";

import { CardNewsVisualError, MarketingAssetPathError } from "@/lib/marketing/assets/errors";
import { isPathInside } from "@/lib/marketing/assets/paths";

const BLOCKED_PREFIX = /^(https?:|file:|data:|ftp:)/i;

export function assertLocalVisualPath(input: {
  rawPath: string;
  allowedRoots: string[];
}): string {
  const raw = input.rawPath.trim();
  if (!raw) {
    throw new CardNewsVisualError("Visual path is empty");
  }
  if (BLOCKED_PREFIX.test(raw)) {
    throw new CardNewsVisualError("External or remote visual URLs are not allowed");
  }
  if (raw.includes("\0") || raw.includes("..") || raw.includes("\\") || /^[A-Za-z]:/.test(raw)) {
    throw new MarketingAssetPathError("visual path must not contain path traversal");
  }
  const absolute = isAbsolute(raw) ? resolve(raw) : resolve(input.allowedRoots[0] ?? process.cwd(), raw);
  const allowed = input.allowedRoots.some((root) => isPathInside(root, absolute));
  if (!allowed) {
    throw new MarketingAssetPathError("visual path must remain under an allowed local root");
  }
  if (!existsSync(absolute)) {
    throw new CardNewsVisualError(`Visual file not found: ${absolute}`);
  }
  return absolute;
}

export function readLocalVisualPng(absolutePath: string): Buffer {
  const bytes = readFileSync(absolutePath);
  if (bytes.length >= 8 && bytes.subarray(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]))) {
    return bytes;
  }
  throw new CardNewsVisualError("Only local PNG visuals are supported in CardNews v0");
}
