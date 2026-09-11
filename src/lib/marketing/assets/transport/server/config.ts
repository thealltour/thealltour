import {
  MARKETING_ASSET_TRANSFER_BIND_HOST_ENV,
  MARKETING_ASSET_TRANSFER_LIMITS,
  MARKETING_ASSET_TRANSFER_PORT_ENV,
} from "@/lib/marketing/assets/transport/contracts";

export type MarketingAssetTransferListenConfig = {
  host: string;
  port: number;
};

/**
 * Fail-safe defaults: loopback only. Explicit env required for Tailscale bind.
 * Never hardcode Tailscale IPs.
 */
export function resolveMarketingAssetTransferListenConfig(
  env: NodeJS.ProcessEnv | Record<string, string | undefined> = process.env,
): MarketingAssetTransferListenConfig {
  const host =
    env[MARKETING_ASSET_TRANSFER_BIND_HOST_ENV]?.trim() ||
    MARKETING_ASSET_TRANSFER_LIMITS.defaultBindHost;
  if (host === "0.0.0.0" || host === "::") {
    // Allow only when explicitly configured (deployment step); still warn via reason in docs.
    // Code permits explicit public bind but defaults never do.
  }
  const portRaw = Number(
    env[MARKETING_ASSET_TRANSFER_PORT_ENV] ?? MARKETING_ASSET_TRANSFER_LIMITS.defaultPort,
  );
  if (!Number.isInteger(portRaw) || portRaw < 1 || portRaw > 65535) {
    throw new Error(`invalid ${MARKETING_ASSET_TRANSFER_PORT_ENV}`);
  }
  return { host, port: portRaw };
}
