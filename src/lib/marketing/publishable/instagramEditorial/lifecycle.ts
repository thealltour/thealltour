/**
 * Lifecycle / stale detection for Instagram Editorial Split artifacts.
 * Reuses fingerprint chaining — no separate stale subsystem.
 */

import type { EditorialNarrativePlan } from "@/lib/marketing/publishable/editorialNarrative/contracts";
import type {
  InstagramCaption,
  InstagramCardCopy,
  InstagramCarouselPlan,
} from "@/lib/marketing/publishable/instagramEditorial/contracts";
import {
  buildEditorialNarrativeContentFingerprint,
  buildInstagramCaptionContentFingerprint,
  buildInstagramCardCopyContentFingerprint,
  buildInstagramCarouselContentFingerprint,
} from "@/lib/marketing/publishable/instagramEditorial/fingerprint";

export type EditorialArtifactLifecycleStatus = "not_generated" | "fresh" | "stale";

export function resolveEditorialNarrativeLifecycle(input: {
  plan: EditorialNarrativePlan | null | undefined;
  expectedCanonicalFingerprint: string;
}): EditorialArtifactLifecycleStatus {
  if (!input.plan) return "not_generated";
  return input.plan.sourceCanonicalFingerprint === input.expectedCanonicalFingerprint
    ? "fresh"
    : "stale";
}

export function resolveInstagramCarouselLifecycle(input: {
  plan: InstagramCarouselPlan | null | undefined;
  narrative: EditorialNarrativePlan | null | undefined;
}): EditorialArtifactLifecycleStatus {
  if (!input.plan) return "not_generated";
  if (!input.narrative) return "stale";
  const narrativeFp = buildEditorialNarrativeContentFingerprint(input.narrative);
  return input.plan.sourceNarrativeFingerprint === narrativeFp ? "fresh" : "stale";
}

export function resolveInstagramCardCopyLifecycle(input: {
  copy: InstagramCardCopy | null | undefined;
  carousel: InstagramCarouselPlan | null | undefined;
}): EditorialArtifactLifecycleStatus {
  if (!input.copy) return "not_generated";
  if (!input.carousel) return "stale";
  const carouselFp = buildInstagramCarouselContentFingerprint(input.carousel);
  return input.copy.sourceCarouselFingerprint === carouselFp ? "fresh" : "stale";
}

export function resolveInstagramCaptionLifecycle(input: {
  caption: InstagramCaption | null | undefined;
  cardCopy: InstagramCardCopy | null | undefined;
}): EditorialArtifactLifecycleStatus {
  if (!input.caption) return "not_generated";
  if (!input.cardCopy) return "stale";
  const copyFp = buildInstagramCardCopyContentFingerprint(input.cardCopy);
  return input.caption.sourceCardCopyFingerprint === copyFp ? "fresh" : "stale";
}

/** Any upstream stale ⇒ Instagram publishable editorial chain needs regeneration. */
export function resolveInstagramEditorialPipelineLifecycle(input: {
  expectedCanonicalFingerprint: string;
  narrative: EditorialNarrativePlan | null | undefined;
  carousel: InstagramCarouselPlan | null | undefined;
  cardCopy: InstagramCardCopy | null | undefined;
  caption: InstagramCaption | null | undefined;
}): {
  narrative: EditorialArtifactLifecycleStatus;
  carousel: EditorialArtifactLifecycleStatus;
  cardCopy: EditorialArtifactLifecycleStatus;
  caption: EditorialArtifactLifecycleStatus;
  pipeline: EditorialArtifactLifecycleStatus;
} {
  const narrative = resolveEditorialNarrativeLifecycle({
    plan: input.narrative,
    expectedCanonicalFingerprint: input.expectedCanonicalFingerprint,
  });
  const carousel =
    narrative !== "fresh"
      ? narrative === "not_generated"
        ? "not_generated"
        : "stale"
      : resolveInstagramCarouselLifecycle({ plan: input.carousel, narrative: input.narrative });
  const cardCopy =
    carousel !== "fresh"
      ? carousel === "not_generated"
        ? "not_generated"
        : "stale"
      : resolveInstagramCardCopyLifecycle({ copy: input.cardCopy, carousel: input.carousel });
  const caption =
    cardCopy !== "fresh"
      ? cardCopy === "not_generated"
        ? "not_generated"
        : "stale"
      : resolveInstagramCaptionLifecycle({ caption: input.caption, cardCopy: input.cardCopy });

  const statuses = [narrative, carousel, cardCopy, caption];
  const pipeline: EditorialArtifactLifecycleStatus = statuses.includes("stale")
    ? "stale"
    : statuses.includes("not_generated")
      ? "not_generated"
      : "fresh";

  return { narrative, carousel, cardCopy, caption, pipeline };
}

export function contentFingerprintsForDownstream(input: {
  narrative: EditorialNarrativePlan;
  carousel: InstagramCarouselPlan;
  cardCopy: InstagramCardCopy;
  caption: InstagramCaption;
}): {
  narrativeContent: string;
  carouselContent: string;
  cardCopyContent: string;
  captionContent: string;
} {
  return {
    narrativeContent: buildEditorialNarrativeContentFingerprint(input.narrative),
    carouselContent: buildInstagramCarouselContentFingerprint(input.carousel),
    cardCopyContent: buildInstagramCardCopyContentFingerprint(input.cardCopy),
    captionContent: buildInstagramCaptionContentFingerprint(input.caption),
  };
}
