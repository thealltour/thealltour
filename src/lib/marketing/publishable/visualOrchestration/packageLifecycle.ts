/**
 * Package-bound SVP lifecycle: every caller must pass the on-disk VRA fingerprint, otherwise a plan
 * that recorded sourceInstagramVisualRoleFingerprint is always reported stale.
 */

import type { PublishableContentBundle } from "@/lib/marketing/publishable/contracts";
import { resolveEffectiveInstagramCardCopy } from "@/lib/marketing/publishable/instagramEditorial/cardCopyReview";
import { readInstagramCarouselPlanFromPackage } from "@/lib/marketing/publishable/instagramEditorial/persist";
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
 */
export function resolveInstagramVisualRoleLifecycleForPackage(
  packageRoot: string,
): InstagramVisualRoleLifecycleStatus {
  return resolveInstagramVisualRolePlanLifecycle({
    plan: readInstagramVisualRolePlanFromPackage(packageRoot),
    carousel: readInstagramCarouselPlanFromPackage(packageRoot),
    cardCopy: resolveEffectiveInstagramCardCopy(packageRoot),
  });
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
