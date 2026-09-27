/**
 * Production-backed fixture eligibility — approved Canonical required.
 * Draft packages must not be registered or verified as production fixtures.
 */

import { promises as fs } from "node:fs";
import path from "node:path";

import { CANONICAL_MARKETING_ASSET_RELATIVE_PATH } from "@/lib/marketing/canonicalAsset/paths";
import { isApprovedCanonicalAsset } from "@/lib/marketing/canonicalAsset/validateCanonicalMarketingAsset";
import type { CanonicalMarketingAsset } from "@/lib/marketing/canonicalAsset/contracts";
import type { ProductionBackedFixture } from "@/lib/marketing/publishable/crossFixtureRegression/types";

export type EligibilityResult = {
  ok: boolean;
  blockers: string[];
  canonical: CanonicalMarketingAsset | null;
};

export async function loadPackageCanonical(
  packageRoot: string,
): Promise<CanonicalMarketingAsset | null> {
  const filePath = path.join(packageRoot, CANONICAL_MARKETING_ASSET_RELATIVE_PATH);
  try {
    const raw = await fs.readFile(filePath, "utf8");
    return JSON.parse(raw) as CanonicalMarketingAsset;
  } catch {
    return null;
  }
}

/**
 * Rejects draft / missing / assetId mismatch for production-backed fixtures.
 */
export async function assertProductionFixtureEligible(
  fixture: ProductionBackedFixture,
  options?: { canonicalOverride?: CanonicalMarketingAsset | null },
): Promise<EligibilityResult> {
  const blockers: string[] = [];

  if (fixture.backing !== "production_backed") {
    blockers.push(`fixture ${fixture.fixtureId} is not production_backed`);
    return { ok: false, blockers, canonical: null };
  }

  if (!fixture.role) {
    blockers.push("fixture role metadata is required");
  }
  if (!fixture.packageRoot || !fixture.assetId) {
    blockers.push("packageRoot and assetId are required");
  }
  if (!fixture.expectedBehaviors || Object.keys(fixture.expectedBehaviors).length === 0) {
    blockers.push("expectedBehaviors must be defined");
  }

  const canonical =
    options?.canonicalOverride !== undefined
      ? options.canonicalOverride
      : await loadPackageCanonical(fixture.packageRoot);

  if (!canonical) {
    blockers.push("Canonical package file missing or unreadable");
    return { ok: false, blockers, canonical: null };
  }

  if (canonical.assetId !== fixture.assetId) {
    blockers.push(
      `assetId mismatch: fixture=${fixture.assetId} package=${canonical.assetId}`,
    );
  }

  if (canonical.status !== "approved") {
    blockers.push(
      `Canonical status is "${canonical.status}" — draft Canonicals are rejected for production-backed fixtures`,
    );
  }

  if (!isApprovedCanonicalAsset(canonical)) {
    blockers.push(
      "Canonical is not approved (status/approvedVersion/version gate failed)",
    );
  }

  return { ok: blockers.length === 0, blockers, canonical };
}

/** Used by tests: refuse to register a draft as production-backed. */
export function rejectDraftForProductionFixture(status: string): boolean {
  return status !== "approved";
}
