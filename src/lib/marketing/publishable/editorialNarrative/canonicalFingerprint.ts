/**
 * Canonical asset fingerprint used as Narrative Plan source identity.
 */

import { createHash } from "node:crypto";

import type { CanonicalMarketingAsset } from "@/lib/marketing/canonicalAsset/contracts";

export function buildCanonicalFingerprintForNarrative(asset: CanonicalMarketingAsset): string {
  return createHash("sha256")
    .update(
      JSON.stringify({
        assetId: asset.assetId,
        assetVersion: asset.version,
        titleKo: asset.titleKo,
        openingHookKo: asset.openingHookKo,
        bodyKo: asset.bodyKo,
        keyTakeawaysKo: asset.keyTakeawaysKo,
        decisionGuidanceKo: asset.decisionGuidanceKo,
        supportedClaimBoundaryKo: asset.supportedClaimBoundaryKo,
        limitationsKo: asset.limitationsKo,
        forbiddenClaimsKo: asset.forbiddenClaimsKo,
        editorialArchetype: asset.editorialArchetype ?? null,
        sourceRevision: asset.sourceRevision,
      }),
      "utf8",
    )
    .digest("hex");
}
