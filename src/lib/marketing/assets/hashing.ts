import { createHash } from "node:crypto";
import { closeSync, openSync, readSync } from "node:fs";

export function toUtf8Buffer(content: Buffer | string): Buffer {
  return Buffer.isBuffer(content) ? content : Buffer.from(content, "utf8");
}

export function sha256Buffer(content: Buffer | string): string {
  return createHash("sha256").update(toUtf8Buffer(content)).digest("hex");
}

/** Streaming SHA-256 so large preview/source media is not loaded into memory. */
export function sha256FileSync(absolutePath: string): string {
  const hash = createHash("sha256");
  const fd = openSync(absolutePath, "r");
  try {
    const buffer = Buffer.alloc(64 * 1024);
    for (;;) {
      const bytesRead = readSync(fd, buffer, 0, buffer.length, null);
      if (bytesRead === 0) break;
      hash.update(buffer.subarray(0, bytesRead));
    }
  } finally {
    closeSync(fd);
  }
  return hash.digest("hex");
}

export function byteSize(content: Buffer | string): number {
  return toUtf8Buffer(content).byteLength;
}

export function stableJsonBytes(value: unknown): Buffer {
  return Buffer.from(`${JSON.stringify(value, null, 2)}\n`, "utf8");
}
