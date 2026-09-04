import { isAbsolute, resolve } from "node:path";

import { MarketingAssetConfigError } from "@/lib/marketing/assets/errors";

export const MARKETING_ASSET_ROOT_ENV = "MARKETING_ASSET_ROOT" as const;

export type MarketingAssetEnv = NodeJS.ProcessEnv | Record<string, string | undefined>;

export function resolveMarketingAssetRoot(options: {
  explicitRoot?: string | null;
  env?: MarketingAssetEnv;
} = {}): string {
  const raw = options.explicitRoot?.trim() || options.env?.[MARKETING_ASSET_ROOT_ENV]?.trim() || "";
  if (!raw) {
    throw new MarketingAssetConfigError(
      "MARKETING_ASSET_ROOT is required for marketing asset export. Set an absolute filesystem path (production: /mnt/HDD2TB/marketing-assets) or pass --root.",
    );
  }
  if (raw.includes("\0")) {
    throw new MarketingAssetConfigError("MARKETING_ASSET_ROOT must not contain a NUL byte");
  }
  if (!isAbsolute(raw)) {
    throw new MarketingAssetConfigError(
      `MARKETING_ASSET_ROOT must be an absolute filesystem path, received: ${raw}`,
    );
  }
  return resolve(raw);
}
