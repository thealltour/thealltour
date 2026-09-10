import { randomBytes } from "node:crypto";

function bytesToHex(buf: Uint8Array, byteLength: number): string {
  if (buf.length < byteLength) {
    throw new Error(`id requires ${byteLength} bytes`);
  }
  return Buffer.from(buf).subarray(0, byteLength).toString("hex");
}

function isAllZeroHex(hex: string): boolean {
  return hex.length > 0 && /^0+$/.test(hex);
}

/**
 * OTel-compatible 16-byte trace id as 32 lowercase hex chars.
 * All-zero ids are invalid per OTel and are never returned.
 */
export function createMarketingTraceId(bytes?: Uint8Array): string {
  if (bytes) {
    const hex = bytesToHex(bytes, 16);
    if (isAllZeroHex(hex)) {
      throw new Error("traceId must not be all-zero");
    }
    return hex;
  }
  for (let i = 0; i < 8; i += 1) {
    const hex = bytesToHex(randomBytes(16), 16);
    if (!isAllZeroHex(hex)) return hex;
  }
  throw new Error("failed to allocate non-zero traceId");
}

/**
 * OTel-compatible 8-byte span id as 16 lowercase hex chars.
 * All-zero ids are invalid per OTel and are never returned.
 * Do not use UUID strings as span ids.
 */
export function createMarketingSpanId(bytes?: Uint8Array): string {
  if (bytes) {
    const hex = bytesToHex(bytes, 8);
    if (isAllZeroHex(hex)) {
      throw new Error("spanId must not be all-zero");
    }
    return hex;
  }
  for (let i = 0; i < 8; i += 1) {
    const hex = bytesToHex(randomBytes(8), 8);
    if (!isAllZeroHex(hex)) return hex;
  }
  throw new Error("failed to allocate non-zero spanId");
}

export function isValidTraceId(id: string): boolean {
  return /^[0-9a-f]{32}$/.test(id) && !/^0{32}$/.test(id);
}

export function isValidSpanId(id: string): boolean {
  return /^[0-9a-f]{16}$/.test(id) && !/^0{16}$/.test(id);
}
