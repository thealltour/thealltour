import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";

import type { MarketingProductionRequest } from "@/lib/marketing/cron/daily/agendaSlate/productionRequestTypes";
import type { CompletedMarketingCandidate } from "@/lib/marketing/cron/daily/types";
import {
  PRODUCTION_OUTCOME_AWAITING_ASSET_APPROVAL,
  PRODUCTION_REQUEST_CANONICAL_ASSET_KEY,
  type CanonicalMarketingAsset,
} from "@/lib/marketing/canonicalAsset/contracts";
import { parseDurableCanonicalMarketingAsset } from "@/lib/marketing/canonicalAsset/parseCanonicalMarketingAsset";
import { CANONICAL_MARKETING_ASSET_RELATIVE_PATH } from "@/lib/marketing/canonicalAsset/paths";

export function readCanonicalAssetFromProductionRequest(
  request: MarketingProductionRequest | null | undefined,
): CanonicalMarketingAsset | null {
  if (!request?.metadata) return null;
  return parseDurableCanonicalMarketingAsset(
    request.metadata[PRODUCTION_REQUEST_CANONICAL_ASSET_KEY],
  );
}

export function readCanonicalAssetFromCandidate(
  candidate: CompletedMarketingCandidate | null | undefined,
): CanonicalMarketingAsset | null {
  if (!candidate) return null;
  return parseDurableCanonicalMarketingAsset(candidate.canonicalMarketingAsset ?? null);
}

export function readCanonicalAssetFromPackage(
  packageRoot: string | null | undefined,
): CanonicalMarketingAsset | null {
  if (!packageRoot) return null;
  const path = join(packageRoot, CANONICAL_MARKETING_ASSET_RELATIVE_PATH);
  if (!existsSync(path)) return null;
  try {
    return parseDurableCanonicalMarketingAsset(JSON.parse(readFileSync(path, "utf8")));
  } catch {
    return null;
  }
}

/** Prefer package → candidate → production request. Legacy: null (do not fabricate).
 * Package is the durable SoT after human save/approve writes to disk.
 */
export function resolveCanonicalMarketingAsset(input: {
  candidate?: CompletedMarketingCandidate | null;
  packageRoot?: string | null;
  productionRequest?: MarketingProductionRequest | null;
}): CanonicalMarketingAsset | null {
  return (
    readCanonicalAssetFromPackage(input.packageRoot) ??
    readCanonicalAssetFromCandidate(input.candidate) ??
    readCanonicalAssetFromProductionRequest(input.productionRequest)
  );
}

export function persistCanonicalAssetToPackage(input: {
  packageRoot: string;
  asset: CanonicalMarketingAsset;
}): void {
  const path = join(input.packageRoot, CANONICAL_MARKETING_ASSET_RELATIVE_PATH);
  mkdirSync(dirname(path), { recursive: true });
  writeFileSync(path, `${JSON.stringify(input.asset, null, 2)}\n`, "utf8");
}

export function attachCanonicalAssetToCandidate(
  candidate: CompletedMarketingCandidate,
  asset: CanonicalMarketingAsset | null,
): CompletedMarketingCandidate {
  return {
    ...candidate,
    canonicalMarketingAsset: asset,
    updatedAt: new Date().toISOString(),
  };
}

export function isAwaitingAssetApproval(
  request: MarketingProductionRequest | null | undefined,
): boolean {
  return request?.metadata?.productionOutcome === PRODUCTION_OUTCOME_AWAITING_ASSET_APPROVAL;
}

export function productionRequestMetadataWithCanonicalAsset(input: {
  metadata: Record<string, unknown> | null | undefined;
  asset: CanonicalMarketingAsset | null;
  awaitingApproval?: boolean;
  clearResume?: boolean;
}): Record<string, unknown> {
  const next: Record<string, unknown> = { ...(input.metadata ?? {}) };
  if (input.asset) {
    next[PRODUCTION_REQUEST_CANONICAL_ASSET_KEY] = input.asset;
  } else {
    delete next[PRODUCTION_REQUEST_CANONICAL_ASSET_KEY];
  }
  if (input.awaitingApproval) {
    next.productionOutcome = PRODUCTION_OUTCOME_AWAITING_ASSET_APPROVAL;
  }
  if (input.clearResume) {
    delete next.resumeChannelGenerationFromApprovedAsset;
  }
  return next;
}
