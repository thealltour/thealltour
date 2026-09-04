import {
  marketingAssetManifestSchema,
  mediaBriefSchema,
  type MarketingAssetManifest,
  type MediaBrief,
} from "@/lib/marketing/assets/contracts";
import { MarketingAssetContractError } from "@/lib/marketing/assets/errors";

export function parseMediaBrief(value: unknown): MediaBrief {
  const result = mediaBriefSchema.safeParse(value);
  if (!result.success) {
    const first = result.error.issues[0];
    throw new MarketingAssetContractError(
      `media-brief-v1 invalid at ${first?.path.join(".") || "root"}: ${first?.message ?? "schema validation failed"}`,
    );
  }
  return result.data;
}

export function parseMarketingAssetManifest(value: unknown): MarketingAssetManifest {
  const result = marketingAssetManifestSchema.safeParse(value);
  if (!result.success) {
    const first = result.error.issues[0];
    throw new MarketingAssetContractError(
      `marketing-asset-manifest-v1 invalid at ${first?.path.join(".") || "root"}: ${first?.message ?? "schema validation failed"}`,
    );
  }
  return result.data;
}
