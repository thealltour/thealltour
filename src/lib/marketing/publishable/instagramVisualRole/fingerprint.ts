import { createHash } from "node:crypto";

import type { InstagramVisualRolePlan } from "@/lib/marketing/publishable/instagramVisualRole/contracts";

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

export function buildInstagramVisualRoleContentFingerprint(
  plan: Pick<
    InstagramVisualRolePlan,
    "assetId" | "assetVersion" | "cards" | "rhythmSummary"
  >,
): string {
  return sha256Hex(
    stableStringify({
      kind: "instagram-visual-role-content-v1",
      assetId: plan.assetId,
      assetVersion: plan.assetVersion,
      rhythmSummary: plan.rhythmSummary,
      cards: plan.cards.map((c) => ({
        cardId: c.cardId,
        visualRole: c.visualRole,
        visualPurpose: c.visualPurpose,
        visualPriority: c.visualPriority,
        visualDensity: c.visualDensity,
        visualModePreference: c.visualModePreference,
        generationPreference: c.generationPreference,
        presentationPreference: c.presentationPreference,
        reusePreference: c.reusePreference,
        concreteVisualIntent: c.concreteVisualIntent,
        evidenceRefs: c.evidenceRefs,
      })),
    }),
  );
}
