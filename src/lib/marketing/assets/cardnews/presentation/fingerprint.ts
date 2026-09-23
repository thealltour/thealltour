import { createHash } from "node:crypto";

import type { CardPresentationPlan } from "@/lib/marketing/assets/cardnews/presentation/contracts";

function sha256Hex(payload: string): string {
  return createHash("sha256").update(payload, "utf8").digest("hex");
}

function stableStringify(value: unknown): string {
  if (value === null || typeof value !== "object") return JSON.stringify(value);
  if (Array.isArray(value)) return `[${value.map((item) => stableStringify(item)).join(",")}]`;
  const entries = Object.entries(value as Record<string, unknown>).sort(([a], [b]) =>
    a.localeCompare(b),
  );
  return `{${entries.map(([k, v]) => `${JSON.stringify(k)}:${stableStringify(v)}`).join(",")}}`;
}

export function buildInstagramPresentationSourceFingerprint(input: {
  cardIds: string[];
  headlines: string[];
  bodies: string[];
  roles: string[];
  visualIds: Array<string | null>;
}): string {
  return sha256Hex(
    stableStringify({
      kind: "instagram-presentation-source-v1",
      cardIds: input.cardIds,
      headlines: input.headlines,
      bodies: input.bodies,
      roles: input.roles,
      visualIds: input.visualIds,
    }),
  );
}

export function buildCardPresentationContentFingerprint(
  plan: Pick<CardPresentationPlan, "assetId" | "assetVersion" | "cards">,
): string {
  return sha256Hex(
    stableStringify({
      kind: "card-presentation-content-v1",
      assetId: plan.assetId,
      assetVersion: plan.assetVersion,
      cards: plan.cards,
    }),
  );
}

export type PresentationLifecycleStatus = "not_generated" | "fresh" | "stale";

export function resolveCardPresentationLifecycle(input: {
  plan: CardPresentationPlan | null | undefined;
  expectedInstagramFingerprint: string;
  expectedVisualPlanFingerprint?: string | null;
}): PresentationLifecycleStatus {
  if (!input.plan) return "not_generated";
  if (input.plan.provenance.sourceInstagramFingerprint !== input.expectedInstagramFingerprint) {
    return "stale";
  }
  const expectedVp = input.expectedVisualPlanFingerprint ?? null;
  const actualVp = input.plan.provenance.sourceVisualPlanFingerprint ?? null;
  if (expectedVp && actualVp && expectedVp !== actualVp) return "stale";
  return "fresh";
}
