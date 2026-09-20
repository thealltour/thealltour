import { createHash } from "node:crypto";

import type { ThreadsCopyArtifact } from "@/lib/marketing/publishable/threadsCopy/contracts";

function sha256Hex(payload: string): string {
  return createHash("sha256").update(payload, "utf8").digest("hex");
}

function stableStringify(value: unknown): string {
  if (value === null || typeof value !== "object") {
    return JSON.stringify(value);
  }
  if (Array.isArray(value)) {
    return `[${value.map((item) => stableStringify(item)).join(",")}]`;
  }
  const entries = Object.entries(value as Record<string, unknown>).sort(([a], [b]) =>
    a.localeCompare(b),
  );
  return `{${entries.map(([k, v]) => `${JSON.stringify(k)}:${stableStringify(v)}`).join(",")}}`;
}

/** Content fingerprint — Narrative change or copy rewrite invalidates publishable Threads. */
export function buildThreadsCopyContentFingerprint(
  copy: Pick<
    ThreadsCopyArtifact,
    "assetId" | "assetVersion" | "body" | "selectedNarrativeBeats" | "endingIntent"
  >,
): string {
  return sha256Hex(
    stableStringify({
      kind: "threads-copy-content-v1",
      assetId: copy.assetId,
      assetVersion: copy.assetVersion,
      body: copy.body,
      selectedNarrativeBeats: copy.selectedNarrativeBeats,
      endingIntent: copy.endingIntent,
    }),
  );
}
