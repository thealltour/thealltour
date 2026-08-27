import {
  SAFE_OBSERVABILITY_METADATA_KEYS,
  type SafeObservabilityMetadata,
  type SafeObservabilityMetadataKey,
} from "@/ai-runtime/observability/persistence/types";

const ALLOWED = new Set<string>(SAFE_OBSERVABILITY_METADATA_KEYS);

/**
 * Allow-list builder — strips prompts, messages, headers, secrets, and unknown keys.
 */
export function buildSafeMetadata(
  input: Record<string, unknown> | SafeObservabilityMetadata | undefined | null,
): SafeObservabilityMetadata {
  if (!input || typeof input !== "object") return {};

  const out: SafeObservabilityMetadata = {};
  for (const key of Object.keys(input)) {
    if (!ALLOWED.has(key)) continue;
    const value = (input as Record<string, unknown>)[key];
    if (value == null) continue;
    if (typeof value === "string" || typeof value === "number" || typeof value === "boolean") {
      out[key as SafeObservabilityMetadataKey] = value;
    }
  }
  return out;
}
