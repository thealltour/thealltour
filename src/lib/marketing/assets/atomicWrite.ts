import { closeSync, fsyncSync, mkdirSync, openSync, renameSync, unlinkSync, writeSync } from "node:fs";
import { dirname, join } from "node:path";
import { randomBytes } from "node:crypto";

import { toUtf8Buffer } from "@/lib/marketing/assets/hashing";

export function atomicWriteFile(absolutePath: string, content: Buffer | string, mode = 0o644): void {
  const directory = dirname(absolutePath);
  mkdirSync(directory, { recursive: true });
  const tmpPath = join(
    directory,
    `.${process.pid}.${Date.now()}.${randomBytes(4).toString("hex")}.tmp`,
  );
  const buffer = toUtf8Buffer(content);
  const fd = openSync(tmpPath, "w", mode);
  try {
    writeSync(fd, buffer);
    fsyncSync(fd);
  } catch (error) {
    closeSync(fd);
    try {
      unlinkSync(tmpPath);
    } catch {
      // ignore cleanup failure
    }
    throw error;
  }
  closeSync(fd);
  try {
    renameSync(tmpPath, absolutePath);
  } catch (error) {
    try {
      unlinkSync(tmpPath);
    } catch {
      // ignore cleanup failure
    }
    throw error;
  }
}

/** Rename a completed temp file onto a canonical path without reading it into memory. */
export function atomicPublishFile(sourceAbsolutePath: string, destAbsolutePath: string): void {
  mkdirSync(dirname(destAbsolutePath), { recursive: true });
  renameSync(sourceAbsolutePath, destAbsolutePath);
}
