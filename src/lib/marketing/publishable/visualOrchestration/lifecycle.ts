/**
 * Visual orchestration lifecycle: not_generated | fresh | stale.
 * Status is computed — artifacts are never auto-deleted on channel change.
 */

import type { PublishableContentBundle } from "@/lib/marketing/publishable/contracts";
import type { ManualAstraHandoff } from "@/lib/marketing/publishable/manualAstraHandoff/contracts";
import type { SharedVisualPlan } from "@/lib/marketing/publishable/sharedVisualPlan/contracts";
import { computePlanSourceFingerprintFromBundle } from "@/lib/marketing/publishable/sharedVisualPlan/fingerprint";
import {
  buildSourceChannelSnapshot,
  sourceChannelSnapshotsEqual,
} from "@/lib/marketing/publishable/sharedVisualPlan/sourceChannelSnapshot";
import { isManualAstraHandoffSourceStale } from "@/lib/marketing/publishable/sharedVisualAssets/status";

export type VisualArtifactLifecycleStatus = "not_generated" | "fresh" | "stale";

export function resolveSharedVisualPlanLifecycle(input: {
  plan: SharedVisualPlan | null | undefined;
  bundle: PublishableContentBundle | null | undefined;
}): VisualArtifactLifecycleStatus {
  if (!input.plan) return "not_generated";
  if (!input.bundle) return "stale";
  if (input.plan.sourceChannelSnapshot) {
    const current = buildSourceChannelSnapshot(input.bundle);
    return sourceChannelSnapshotsEqual(input.plan.sourceChannelSnapshot, current)
      ? "fresh"
      : "stale";
  }
  const currentFp = computePlanSourceFingerprintFromBundle(input.bundle);
  return input.plan.sourceVisualPlanFingerprint === currentFp ? "fresh" : "stale";
}

export function resolveManualAstraHandoffLifecycle(input: {
  handoff: ManualAstraHandoff | null | undefined;
  plan: SharedVisualPlan | null | undefined;
  planLifecycle: VisualArtifactLifecycleStatus;
}): VisualArtifactLifecycleStatus {
  if (!input.handoff) return "not_generated";
  if (!input.plan || input.planLifecycle === "not_generated") return "stale";
  if (input.planLifecycle === "stale") return "stale";
  if (
    isManualAstraHandoffSourceStale({
      handoff: input.handoff,
      sharedVisualPlan: input.plan,
    })
  ) {
    return "stale";
  }
  return "fresh";
}

export function lifecycleLabelKo(status: VisualArtifactLifecycleStatus): string {
  switch (status) {
    case "not_generated":
      return "아직 생성되지 않음";
    case "fresh":
      return "최신";
    case "stale":
      return "오래됨(stale)";
  }
}
