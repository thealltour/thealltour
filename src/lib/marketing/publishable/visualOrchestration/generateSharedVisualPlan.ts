/**
 * Explicit Shared Visual Plan generation (LLM-primary).
 * Ensures Instagram Visual Role Plan when editorial carousel+copy exist (fail-closed).
 * Does NOT overwrite last good plan on LLM failure.
 */

import type { CanonicalMarketingAsset } from "@/lib/marketing/canonicalAsset/contracts";
import type { PublishableContentBundle } from "@/lib/marketing/publishable/contracts";
import { readEditorialNarrativePlanFromPackage } from "@/lib/marketing/publishable/instagramEditorial/persist";
import { buildInstagramVisualRoleContentFingerprint } from "@/lib/marketing/publishable/instagramVisualRole/fingerprint";
import {
  ensureInstagramVisualRolePlan,
  type VisualRoleArchitectInvoke,
} from "@/lib/marketing/publishable/instagramVisualRole/pipeline";
import { readInstagramVisualRolePlanFromPackage } from "@/lib/marketing/publishable/instagramVisualRole/persist";
import {
  persistSharedVisualPlan,
  readSharedVisualPlan,
  type SharedVisualPlan,
} from "@/lib/marketing/publishable/sharedVisualPlan";
import { extractJsonObject } from "@/lib/marketing/publishable/visualOrchestration/extractJson";
import {
  buildSharedVisualPlannerInput,
  formatSharedVisualPlannerPrompt,
} from "@/lib/marketing/publishable/visualOrchestration/plannerInput";
import {
  materializeSharedVisualPlanFromLlm,
  SharedVisualPlannerValidationError,
} from "@/lib/marketing/publishable/visualOrchestration/materializePlannerOutput";
import { SHARED_VISUAL_PLAN_CONTRACT } from "@/lib/marketing/publishable/sharedVisualPlan/contracts";
import {
  assertFingerprintSourcesInclude,
  getArtifactFailurePolicy,
} from "@/lib/marketing/agentContracts/lifecycleHelpers";

export type SharedVisualPlannerInvoke = (prompt: string) => Promise<string> | string;

export type GenerateSharedVisualPlanResult =
  | {
      ok: true;
      plan: SharedVisualPlan;
      warnings: string[];
      previousPlanPreserved: false;
      visualRolePlanStatus?: "generated" | "reused" | "skipped_legacy";
    }
  | {
      ok: false;
      error: { code: string; message: string };
      previousPlan: SharedVisualPlan | null;
      previousPlanPreserved: true;
    };

export async function generateSharedVisualPlanWithLlm(input: {
  packageRoot: string;
  bundle: PublishableContentBundle;
  approvedCanonicalAsset: CanonicalMarketingAsset;
  invoke: SharedVisualPlannerInvoke;
  /** Optional separate invoke for VRA (defaults to wrapping Shared Visual invoke as oneshot text). */
  invokeVisualRoleArchitect?: VisualRoleArchitectInvoke;
  now?: Date;
  /** When true, skip VRA ensure (tests that only mock SVP). Prefer false in production. */
  skipVisualRoleArchitect?: boolean;
  hermesHome?: string;
}): Promise<GenerateSharedVisualPlanResult> {
  // Phase 3B: failure policy + fingerprint sources from artifact contract (parity preserved).
  assertFingerprintSourcesInclude(SHARED_VISUAL_PLAN_CONTRACT, [
    "sourceVisualPlanFingerprint",
    "sourceInstagramVisualRoleFingerprint",
  ]);
  const svpFailurePolicy = getArtifactFailurePolicy(SHARED_VISUAL_PLAN_CONTRACT);

  const previousPlan = readSharedVisualPlan(input.packageRoot);

  let visualRolePlanStatus: "generated" | "reused" | "skipped_legacy" = "skipped_legacy";
  let visualRolePlan = readInstagramVisualRolePlanFromPackage(input.packageRoot);

  if (!input.skipVisualRoleArchitect) {
    const vraInvoke: VisualRoleArchitectInvoke =
      input.invokeVisualRoleArchitect ??
      (async (prompt) => {
        // Compatibility: run VRA text through same prompt transport; callers should pass hermesProfile-aware invoke.
        return input.invoke(prompt.text);
      });

    const narrative = readEditorialNarrativePlanFromPackage(input.packageRoot);
    const vra = await ensureInstagramVisualRolePlan({
      packageRoot: input.packageRoot,
      approvedCanonicalAsset: input.approvedCanonicalAsset,
      editorialNarrativePlan: narrative,
      invoke: vraInvoke,
      now: input.now,
      hermesHome: input.hermesHome,
    });

    if (!vra.ok && !vra.skippedLegacy) {
      return applySharedVisualGenerateFailPolicy({
        policy: svpFailurePolicy,
        previousPlan,
        error: {
          code: vra.error.code,
          message: `Visual Role Architect failed (fail-closed before SVP): ${vra.error.message}`,
        },
      });
    }

    if (vra.ok) {
      visualRolePlan = vra.plan;
      visualRolePlanStatus = vra.status;
    } else {
      visualRolePlanStatus = "skipped_legacy";
      visualRolePlan = null;
    }
  }

  try {
    const plannerInput = buildSharedVisualPlannerInput({
      approvedAsset: input.approvedCanonicalAsset,
      bundle: input.bundle,
      instagramVisualRolePlan: visualRolePlan,
    });
    const prompt = formatSharedVisualPlannerPrompt(plannerInput);
    const rawText = await input.invoke(prompt);
    const llmRaw = extractJsonObject(rawText);
    const vraFp = visualRolePlan
      ? buildInstagramVisualRoleContentFingerprint(visualRolePlan)
      : null;
    const { plan, warnings } = materializeSharedVisualPlanFromLlm({
      bundle: input.bundle,
      llmRaw,
      now: input.now,
      forbiddenClaimsKo: input.approvedCanonicalAsset.forbiddenClaimsKo ?? null,
      sourceInstagramVisualRoleFingerprint: vraFp,
      instagramVisualRolePlan: visualRolePlan,
    });
    persistSharedVisualPlan({
      packageRoot: input.packageRoot,
      plan,
      createdAt: plan.generatedAt,
    });
    return {
      ok: true,
      plan,
      warnings,
      previousPlanPreserved: false,
      visualRolePlanStatus,
    };
  } catch (error) {
    const code =
      error instanceof SharedVisualPlannerValidationError
        ? error.code
        : error instanceof Error && error.message
          ? error.message.split(":")[0] || "shared_visual_planner_failed"
          : "shared_visual_planner_failed";
    const message = error instanceof Error ? error.message : "shared_visual_planner_failed";
    console.error("[shared-visual-plan] generate failed; previous plan preserved", {
      code,
      message,
    });
    return applySharedVisualGenerateFailPolicy({
      policy: svpFailurePolicy,
      previousPlan,
      error: { code, message },
    });
  }
}

function applySharedVisualGenerateFailPolicy(input: {
  policy: ReturnType<typeof getArtifactFailurePolicy>;
  previousPlan: SharedVisualPlan | null;
  error: { code: string; message: string };
}): GenerateSharedVisualPlanResult {
  switch (input.policy.onGenerateFail) {
    case "preserve_previous":
      return {
        ok: false,
        error: input.error,
        previousPlan: input.previousPlan,
        previousPlanPreserved: true,
      };
    case "fail_closed":
      return {
        ok: false,
        error: input.error,
        previousPlan: null,
        previousPlanPreserved: true,
      };
    case "deterministic_fallback":
      // SVP must not silently fall back — contract drift if this branch is hit.
      throw new Error(
        `Artifact contract drift: shared-visual-plan-v1 onGenerateFail=deterministic_fallback is not supported`,
      );
    default: {
      const _exhaustive: never = input.policy.onGenerateFail;
      throw new Error(`Unsupported SVP onGenerateFail: ${String(_exhaustive)}`);
    }
  }
}
