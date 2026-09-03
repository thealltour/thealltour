import { createHash } from "node:crypto";

export function toUtf8Buffer(content: Buffer | string): Buffer {
  return Buffer.isBuffer(content) ? content : Buffer.from(content, "utf8");
}

export function sha256Buffer(content: Buffer | string): string {
  return createHash("sha256").update(toUtf8Buffer(content)).digest("hex");
}

export function byteSize(content: Buffer | string): number {
  return toUtf8Buffer(content).byteLength;
}

export function stableJsonBytes(value: unknown): Buffer {
  return Buffer.from(`${JSON.stringify(value, null, 2)}\n`, "utf8");
}
