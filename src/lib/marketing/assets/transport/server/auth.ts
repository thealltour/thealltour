import { createHash, timingSafeEqual } from "node:crypto";

import {
  MARKETING_ASSET_TRANSFER_TOKEN_ENV,
} from "@/lib/marketing/assets/transport/contracts";
import { MarketingAssetTransportError } from "@/lib/marketing/assets/transport/errors";

export function readMarketingAssetTransferToken(
  env: NodeJS.ProcessEnv | Record<string, string | undefined> = process.env,
): string {
  return env[MARKETING_ASSET_TRANSFER_TOKEN_ENV]?.trim() ?? "";
}

export function assertMarketingAssetTransferAuth(
  authorization: string | null | undefined,
  env: NodeJS.ProcessEnv | Record<string, string | undefined> = process.env,
): void {
  const token = readMarketingAssetTransferToken(env);
  if (!token) {
    throw new MarketingAssetTransportError(
      `${MARKETING_ASSET_TRANSFER_TOKEN_ENV} is not configured`,
      "TRANSFER_TOKEN_NOT_CONFIGURED",
      503,
    );
  }
  const header = authorization?.trim() ?? "";
  const expected = `Bearer ${token}`;
  const a = Buffer.from(header);
  const b = Buffer.from(expected);
  if (a.length !== b.length || !timingSafeEqual(a, b)) {
    throw new MarketingAssetTransportError("unauthorized", "TRANSFER_UNAUTHORIZED", 401);
  }
}

export function sha256Buffer(buf: Buffer): string {
  return createHash("sha256").update(buf).digest("hex");
}
