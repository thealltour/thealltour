import { createHash } from "node:crypto";

import type { CanonicalMarketingAsset } from "@/lib/marketing/canonicalAsset/contracts";
import { EXTERNAL_EDITORIAL_MODEL_PROFILE } from "@/lib/marketing/publishable/channelSources/contracts";
import type { EditorialNarrativePlan } from "@/lib/marketing/publishable/editorialNarrative/contracts";
import { materializeEditorialNarrativePlan } from "@/lib/marketing/publishable/instagramEditorial/materialize";

function stableStringify(value: unknown): string {
  if (value === null || typeof value !== "object") return JSON.stringify(value ?? null);
  if (Array.isArray(value)) return `[${value.map((item) => stableStringify(item)).join(",")}]`;
  const entries = Object.entries(value as Record<string, unknown>)
    .filter(([, v]) => v !== undefined)
    .sort(([a], [b]) => a.localeCompare(b));
  return `{${entries.map(([k, v]) => `${JSON.stringify(k)}:${stableStringify(v)}`).join(",")}}`;
}

/**
 * Source narrative fingerprint for external sidecars. Namespaced so it can never equal a
 * Hermes narrative content fingerprint (Hermes reuse checks must not adopt external sidecars).
 */
export function buildExternalNarrativeFingerprint(input: {
  candidateId: string;
  assetId: string;
  canonicalVersion: number;
  sourceRevision: string;
  narrative: unknown;
}): string {
  return createHash("sha256")
    .update(
      stableStringify({
        kind: "external-editorial-narrative-v1",
        candidateId: input.candidateId,
        assetId: input.assetId,
        canonicalVersion: input.canonicalVersion,
        sourceRevision: input.sourceRevision,
        narrative: input.narrative ?? null,
      }),
      "utf8",
    )
    .digest("hex");
}

/** In-memory narrative plan (never persisted to editorial-narrative-plan.json). */
export function materializeExternalNarrativePlan(input: {
  narrative: unknown;
  asset: Pick<CanonicalMarketingAsset, "assetId" | "version">;
  externalNarrativeFingerprint: string;
  generatedAt: string;
}): EditorialNarrativePlan {
  const archetype =
    input.narrative && typeof input.narrative === "object"
      ? (input.narrative as Record<string, unknown>).editorialArchetype
      : null;
  return materializeEditorialNarrativePlan({
    assetId: input.asset.assetId,
    assetVersion: input.asset.version,
    sourceCanonicalFingerprint: `external_editorial:${input.externalNarrativeFingerprint}`,
    modelProfile: EXTERNAL_EDITORIAL_MODEL_PROFILE,
    generatedAt: input.generatedAt,
    editorialArchetype: typeof archetype === "string" && archetype.trim() ? archetype.trim() : null,
    llm: input.narrative,
  });
}
