/**
 * Optional read-only filesystem capacity probe for SV-1 callers/tests.
 * Does not create directories, delete files, or exec shells.
 */

import { statfs } from "node:fs/promises";

import {
  ShortformStoragePolicyError,
  type FilesystemCapacityStats,
} from "@/lib/marketing/assets/shortform/storagePolicy";

/**
 * Read capacity for an existing path. Path must already exist (fail closed).
 * Uses Node `fs.statfs` (available on this project's Node runtime).
 */
export async function readFilesystemCapacity(path: string): Promise<FilesystemCapacityStats> {
  if (!path || typeof path !== "string" || path.includes("\0")) {
    throw new ShortformStoragePolicyError("path must be a non-empty string without NUL");
  }
  try {
    const stats = await statfs(path);
    const blockSize = Number(stats.bsize);
    const blocks = Number(stats.blocks);
    const bavail = Number(stats.bavail);
    if (!Number.isFinite(blockSize) || blockSize <= 0) {
      throw new ShortformStoragePolicyError("statfs returned invalid bsize");
    }
    if (!Number.isFinite(blocks) || blocks < 0 || !Number.isFinite(bavail) || bavail < 0) {
      throw new ShortformStoragePolicyError("statfs returned invalid block counts");
    }
    const totalBytes = Math.trunc(blockSize * blocks);
    const freeBytes = Math.trunc(blockSize * bavail);
    if (totalBytes <= 0) {
      throw new ShortformStoragePolicyError("computed totalBytes must be > 0");
    }
    if (freeBytes > totalBytes) {
      throw new ShortformStoragePolicyError("computed freeBytes exceed totalBytes");
    }
    return { totalBytes, freeBytes };
  } catch (error) {
    if (error instanceof ShortformStoragePolicyError) throw error;
    const message = error instanceof Error ? error.message : "statfs_failed";
    throw new ShortformStoragePolicyError(`readFilesystemCapacity failed: ${message}`);
  }
}
