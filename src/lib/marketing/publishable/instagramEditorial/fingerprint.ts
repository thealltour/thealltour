import { createHash } from "node:crypto";

import type { EditorialNarrativePlan } from "@/lib/marketing/publishable/editorialNarrative/contracts";
import type {
  InstagramCaption,
  InstagramCardCopy,
  InstagramCarouselPlan,
} from "@/lib/marketing/publishable/instagramEditorial/contracts";

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

/** Inputs that make Narrative Plan stale when Canonical changes. */
export function buildEditorialNarrativeSourceFingerprint(input: {
  assetId: string;
  assetVersion: number;
  canonicalFingerprint: string;
  editorialArchetype?: string | null;
  storyLockFingerprint?: string | null;
}): string {
  return sha256Hex(
    stableStringify({
      kind: "editorial-narrative-source-v1",
      assetId: input.assetId,
      assetVersion: input.assetVersion,
      canonicalFingerprint: input.canonicalFingerprint,
      editorialArchetype: input.editorialArchetype ?? null,
      storyLockFingerprint: input.storyLockFingerprint ?? null,
    }),
  );
}

export function buildEditorialNarrativeContentFingerprint(
  plan: Pick<
    EditorialNarrativePlan,
    "assetId" | "assetVersion" | "narrativePromise" | "audienceTakeaway" | "beats"
  >,
): string {
  return sha256Hex(
    stableStringify({
      kind: "editorial-narrative-content-v1",
      assetId: plan.assetId,
      assetVersion: plan.assetVersion,
      narrativePromise: plan.narrativePromise,
      audienceTakeaway: plan.audienceTakeaway,
      beats: plan.beats.map((b) => ({
        beatId: b.beatId,
        purpose: b.purpose,
        message: b.message,
        evidenceRefs: b.evidenceRefs ?? [],
      })),
    }),
  );
}

export function buildInstagramCarouselContentFingerprint(
  plan: Pick<InstagramCarouselPlan, "assetId" | "assetVersion" | "cards">,
): string {
  return sha256Hex(
    stableStringify({
      kind: "instagram-carousel-content-v1",
      assetId: plan.assetId,
      assetVersion: plan.assetVersion,
      cards: plan.cards.map((c) => ({
        cardId: c.cardId,
        role: c.role,
        beatIds: c.beatIds,
        communicationGoal: c.communicationGoal,
        visualPriority: c.visualPriority,
      })),
    }),
  );
}

export function buildInstagramCardCopyContentFingerprint(
  copy: Pick<InstagramCardCopy, "assetId" | "assetVersion" | "cards">,
): string {
  return sha256Hex(
    stableStringify({
      kind: "instagram-card-copy-content-v1",
      assetId: copy.assetId,
      assetVersion: copy.assetVersion,
      cards: copy.cards.map((c) => ({
        cardId: c.cardId,
        kicker: c.kicker ?? null,
        headline: c.headline,
        body: c.body ?? null,
        microcopy: c.microcopy ?? null,
        evidenceRefs: c.evidenceRefs ?? [],
      })),
    }),
  );
}

export function buildInstagramCaptionContentFingerprint(
  caption: Pick<
    InstagramCaption,
    "assetId" | "assetVersion" | "opening" | "body" | "cta" | "hashtags" | "altText"
  >,
): string {
  return sha256Hex(
    stableStringify({
      kind: "instagram-caption-content-v1",
      assetId: caption.assetId,
      assetVersion: caption.assetVersion,
      opening: caption.opening,
      body: caption.body,
      cta: caption.cta ?? null,
      hashtags: caption.hashtags,
      altText: caption.altText,
    }),
  );
}
