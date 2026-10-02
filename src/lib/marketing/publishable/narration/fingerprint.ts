import { createHash } from "node:crypto";

/** JSON field insertion order is not identity; sentence/card array order is. */
export function stableFingerprint(value: unknown): string {
  function ordered(input: unknown): unknown {
    if (Array.isArray(input)) return input.map(ordered);
    if (input !== null && typeof input === "object") return Object.fromEntries(
      Object.entries(input).sort(([a], [b]) => a < b ? -1 : a > b ? 1 : 0).map(([key, entry]) => [key, ordered(entry)]),
    );
    return input;
  }
  const normalized: unknown = JSON.parse(JSON.stringify(value));
  return createHash("sha256").update(JSON.stringify(ordered(normalized))).digest("hex");
}
