/**
 * Instagram Visual Role Plan lifecycle helpers.
 */

import type { InstagramCardCopy, InstagramCarouselPlan } from "@/lib/marketing/publishable/instagramEditorial/contracts";
import {
  buildInstagramCardCopyContentFingerprint,
  buildInstagramCarouselContentFingerprint,
} from "@/lib/marketing/publishable/instagramEditorial/fingerprint";
import type { InstagramVisualRolePlan } from "@/lib/marketing/publishable/instagramVisualRole/contracts";

export type InstagramVisualRoleLifecycleStatus = "not_generated" | "fresh" | "stale";

export function resolveInstagramVisualRolePlanLifecycle(input: {
  plan: InstagramVisualRolePlan | null | undefined;
  carousel: InstagramCarouselPlan | null | undefined;
  cardCopy: InstagramCardCopy | null | undefined;
}): InstagramVisualRoleLifecycleStatus {
  if (!input.plan) return "not_generated";
  if (!input.carousel || !input.cardCopy) return "stale";
  const carouselFp = buildInstagramCarouselContentFingerprint(input.carousel);
  const cardCopyFp = buildInstagramCardCopyContentFingerprint(input.cardCopy);
  if (input.plan.sourceCarouselFingerprint !== carouselFp) return "stale";
  if (input.plan.sourceCardCopyFingerprint !== cardCopyFp) return "stale";
  return "fresh";
}
