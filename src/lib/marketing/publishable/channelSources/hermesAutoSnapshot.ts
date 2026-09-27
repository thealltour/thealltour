/**
 * Hermes Auto snapshots — immutable, content-addressed copies of the publishable slot plus
 * the channel's specialist sidecars, taken before switching away from Hermes.
 */

import { createHash } from "node:crypto";

import {
  HERMES_AUTO_SNAPSHOT_CONTRACT,
  type HermesAutoSnapshot,
} from "@/lib/marketing/publishable/channelSources/contracts";
import {
  readPackageJson,
  writeImmutablePackageJson,
} from "@/lib/marketing/publishable/channelSources/packageIo";
import {
  CHANNEL_SIDECAR_RELATIVE_PATHS,
  HERMES_AUTO_SNAPSHOTS_DIRECTORY,
  hermesAutoSnapshotRelativePath,
} from "@/lib/marketing/publishable/channelSources/paths";
import type { PublishableChannel, PublishableChannelContent } from "@/lib/marketing/publishable/contracts";

export function captureHermesAutoSnapshot(input: {
  packageRoot: string;
  channel: PublishableChannel;
  slot: PublishableChannelContent | null | undefined;
  nowIso: string;
}): { ref: string; snapshot: HermesAutoSnapshot } {
  const slot = input.slot ?? null;
  const sidecars: Record<string, unknown | null> = {};
  for (const relativePath of CHANNEL_SIDECAR_RELATIVE_PATHS[input.channel]) {
    sidecars[relativePath] = readPackageJson(input.packageRoot, relativePath);
  }
  const slotOrigin: HermesAutoSnapshot["slotOrigin"] =
    slot?.provenance.composer === "human" ? "human" : "hermes_auto";
  const snapshotId = createHash("sha256")
    .update(JSON.stringify({ channel: input.channel, slot, sidecars }), "utf8")
    .digest("hex")
    .slice(0, 16);
  const ref = hermesAutoSnapshotRelativePath(input.channel, snapshotId);
  const existing = readPackageJson<HermesAutoSnapshot>(input.packageRoot, ref);
  if (existing?.contract === HERMES_AUTO_SNAPSHOT_CONTRACT) {
    return { ref, snapshot: existing };
  }
  const snapshot: HermesAutoSnapshot = {
    contract: HERMES_AUTO_SNAPSHOT_CONTRACT,
    channel: input.channel,
    snapshotId,
    createdAt: input.nowIso,
    slotOrigin,
    slot,
    sidecars,
  };
  writeImmutablePackageJson(input.packageRoot, ref, snapshot, input.nowIso);
  return { ref, snapshot };
}

export function readHermesAutoSnapshot(
  packageRoot: string,
  ref: string | null | undefined,
): HermesAutoSnapshot | null {
  if (!ref || !ref.startsWith(`${HERMES_AUTO_SNAPSHOTS_DIRECTORY}/`)) return null;
  const value = readPackageJson<HermesAutoSnapshot>(packageRoot, ref);
  return value?.contract === HERMES_AUTO_SNAPSHOT_CONTRACT ? value : null;
}
