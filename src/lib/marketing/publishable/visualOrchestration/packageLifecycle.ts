/**
 * Package-bound SVP lifecycle: every caller must pass the on-disk VRA fingerprint, otherwise a plan
 * that recorded sourceInstagramVisualRoleFingerprint is always reported stale.
 */

import type { PublishableContentBundle } from "@/lib/marketing/publishable/contracts";
import {
  applyInstagramCardCopyReview,
  hasActiveInstagramVisualCarryOver,
  hasInstagramCardHumanEdits,
  resolveInstagramCardCopyReviewGate,
} from "@/lib/marketing/publishable/instagramEditorial/cardCopyReview";
import {
  readInstagramCardCopyFromPackage,
  readInstagramCarouselPlanFromPackage,
} from "@/lib/marketing/publishable/instagramEditorial/persist";
import { buildInstagramVisualRoleContentFingerprint } from "@/lib/marketing/publishable/instagramVisualRole/fingerprint";
import {
  resolveInstagramVisualRolePlanLifecycle,
  type InstagramVisualRoleLifecycleStatus,
} from "@/lib/marketing/publishable/instagramVisualRole/lifecycle";
import { readInstagramVisualRolePlanFromPackage } from "@/lib/marketing/publishable/instagramVisualRole/persist";
import type { SharedVisualPlan } from "@/lib/marketing/publishable/sharedVisualPlan/contracts";
import {
  resolveSharedVisualPlanLifecycle,
  type VisualArtifactLifecycleStatus,
} from "@/lib/marketing/publishable/visualOrchestration/lifecycle";

export function readCurrentInstagramVisualRoleFingerprint(packageRoot: string): string | null {
  const plan = readInstagramVisualRolePlanFromPackage(packageRoot);
  return plan ? buildInstagramVisualRoleContentFingerprint(plan) : null;
}

/**
 * VRA vs the current carousel + effective (human-reviewed) card copy. The on-disk VRA fingerprint
 * alone cannot see card copy edits because VRA is only rewritten when SVP is regenerated.
 *
 * An active visual carry-over keeps a VRA planned for the generated copy fresh for the approved
 * edited copy; the SVP regenerate path (ensureInstagramVisualRolePlan) still re-plans from the
 * edited copy.
 */
export function resolveInstagramVisualRoleLifecycleForPackage(
  packageRoot: string,
): InstagramVisualRoleLifecycleStatus {
  const plan = readInstagramVisualRolePlanFromPackage(packageRoot);
  const carousel = readInstagramCarouselPlanFromPackage(packageRoot);
  const gate = resolveInstagramCardCopyReviewGate(packageRoot);
  const status = resolveInstagramVisualRolePlanLifecycle({
    plan,
    carousel,
    cardCopy: gate.base ? applyInstagramCardCopyReview(gate.base, gate.review) : null,
  });
  if (status !== "stale" || !gate.base || !hasActiveInstagramVisualCarryOver(gate)) return status;
  return resolveInstagramVisualRolePlanLifecycle({ plan, carousel, cardCopy: gate.base });
}

/**
 * available: human edits exist and the current VRA was planned for the generated copy, so keeping
 * the existing visuals is a meaningful choice. active: an approval with carry-over is in effect.
 */
export function resolveInstagramVisualCarryOverForPackage(packageRoot: string): {
  available: boolean;
  active: boolean;
} {
  const gate = resolveInstagramCardCopyReviewGate(packageRoot);
  if (!gate.base || gate.state === "base_changed" || !hasInstagramCardHumanEdits(gate.review)) {
    return { available: false, active: false };
  }
  const available = isInstagramVisualRolePlanForGeneratedCardCopy(packageRoot);
  return { available, active: available && hasActiveInstagramVisualCarryOver(gate) };
}

/** VRA on disk was planned for the current carousel + generated (pre-review) card copy. */
export function isInstagramVisualRolePlanForGeneratedCardCopy(packageRoot: string): boolean {
  const base = readInstagramCardCopyFromPackage(packageRoot);
  return (
    Boolean(base) &&
    resolveInstagramVisualRolePlanLifecycle({
      plan: readInstagramVisualRolePlanFromPackage(packageRoot),
      carousel: readInstagramCarouselPlanFromPackage(packageRoot),
      cardCopy: base,
    }) === "fresh"
  );
}

export function resolveSharedVisualPlanLifecycleForPackage(input: {
  packageRoot: string;
  plan: SharedVisualPlan | null | undefined;
  bundle: PublishableContentBundle | null | undefined;
}): VisualArtifactLifecycleStatus {
  const status = resolveSharedVisualPlanLifecycle({
    plan: input.plan,
    bundle: input.bundle,
    currentInstagramVisualRoleFingerprint: readCurrentInstagramVisualRoleFingerprint(input.packageRoot),
  });
  if (
    status === "fresh" &&
    input.plan?.sourceInstagramVisualRoleFingerprint &&
    resolveInstagramVisualRoleLifecycleForPackage(input.packageRoot) === "stale"
  ) {
    return "stale";
  }
  return status;
}
