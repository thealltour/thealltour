/**
 * Package-bound SVP lifecycle: every caller must pass the on-disk VRA fingerprint, otherwise a plan
 * that recorded sourceInstagramVisualRoleFingerprint is always reported stale.
 */

import type { PublishableContentBundle } from "@/lib/marketing/publishable/contracts";
import { buildInstagramVisualRoleContentFingerprint } from "@/lib/marketing/publishable/instagramVisualRole/fingerprint";
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

export function resolveSharedVisualPlanLifecycleForPackage(input: {
  packageRoot: string;
  plan: SharedVisualPlan | null | undefined;
  bundle: PublishableContentBundle | null | undefined;
}): VisualArtifactLifecycleStatus {
  return resolveSharedVisualPlanLifecycle({
    plan: input.plan,
    bundle: input.bundle,
    currentInstagramVisualRoleFingerprint: readCurrentInstagramVisualRoleFingerprint(input.packageRoot),
  });
}
