import { createHash } from "node:crypto";

/**
 * Deterministic display/idempotency-facing ID from a full logical key.
 * Prefer hash-of-full-key over truncating the raw key (which collapses
 * date-suffixed keys like `daily-marketing-plan:2026-09-0x`).
 */
export function buildStablePrefixedId(prefix: string, logicalKey: string): string {
  const hash = createHash("sha256").update(logicalKey).digest("hex").slice(0, 24);
  return `${prefix}_${hash}`;
}
