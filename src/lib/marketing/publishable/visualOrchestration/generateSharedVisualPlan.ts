/**
 * Explicit Shared Visual Plan generation (LLM-primary).
 * Ensures Instagram Visual Role Plan when editorial carousel+copy exist (fail-closed).
 * Does NOT overwrite last good plan on LLM failure.
 *
 * Decision-trace contract failures (visual_mode_override_missing, etc.) get
 * exactly one materialize-in-loop repair attempt — validation is not relaxed.
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
  isSvpDecisionTraceRepairableError,
  materializeSharedVisualPlanFromLlm,
  SharedVisualPlannerValidationError,
  type SharedVisualPlannerValidationDetails,
} from "@/lib/marketing/publishable/visualOrchestration/materializePlannerOutput";
import { SHARED_VISUAL_PLAN_CONTRACT } from "@/lib/marketing/publishable/sharedVisualPlan/contracts";
import {
  assertFingerprintSourcesInclude,
  getArtifactFailurePolicy,
  getArtifactRepairAttemptBudget,
  requireMaterializeInRepairLoop,
  requireOnGenerateFail,
} from "@/lib/marketing/agentContracts/lifecycleHelpers";

export type SharedVisualPlannerInvoke = (prompt: string) => Promise<string> | string;

export type GenerateSharedVisualPlanResult =
  | {
      ok: true;
      plan: SharedVisualPlan;
      warnings: string[];
      previousPlanPreserved: false;
      visualRolePlanStatus?: "generated" | "reused" | "skipped_legacy";
      /** Hermes invoke count (1 = first-pass success; 2 = repaired). */
      invokeCount?: number;
    }
  | {
      ok: false;
      error: { code: string; message: string };
      previousPlan: SharedVisualPlan | null;
      previousPlanPreserved: true;
      invokeCount?: number;
    };

/** Repair hint for decision-trace omissions — bounded diagnostics only. */
export function formatSharedVisualDecisionTraceRepairHint(error: Error): string {
  const code =
    error instanceof SharedVisualPlannerValidationError
      ? error.code
      : "shared_visual_planner_failed";
  const details: SharedVisualPlannerValidationDetails =
    error instanceof SharedVisualPlannerValidationError ? (error.details ?? {}) : {};
  const cardId = details.cardId ?? "(unknown)";
  const field = details.field ?? "visualModePreference";
  const requested = details.requested ?? "(unknown)";
  const final = details.final ?? "(unknown)";

  return [
    "Previous output violated the VRA-aware orchestration contract.",
    `errorCode: ${code}`,
    `cardId: ${cardId}`,
    `field: ${field}`,
    `requested: ${requested}`,
    `final: ${final}`,
    `You may keep final=${final} if that remains your orchestration decision,`,
    "but you MUST include a decisionTrace.overrides entry explaining why.",
    "Required override shape:",
    `{"cardId":"${cardId}","field":"${field}","requested":"${requested}","final":"${final}","reason":"at least 8 chars explaining the override"}`,
    "Do not change unrelated master grouping/usages unless necessary.",
    "Return the full valid SVP JSON only.",
  ].join("\n");
}

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
  requireOnGenerateFail(SHARED_VISUAL_PLAN_CONTRACT, "preserve_previous");
  requireMaterializeInRepairLoop(SHARED_VISUAL_PLAN_CONTRACT, true);
  const svpFailurePolicy = getArtifactFailurePolicy(SHARED_VISUAL_PLAN_CONTRACT);
  const maxAttempts = getArtifactRepairAttemptBudget(SHARED_VISUAL_PLAN_CONTRACT);

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

  const plannerInput = buildSharedVisualPlannerInput({
    approvedAsset: input.approvedCanonicalAsset,
    bundle: input.bundle,
    instagramVisualRolePlan: visualRolePlan,
  });
  const vraFp = visualRolePlan
    ? buildInstagramVisualRoleContentFingerprint(visualRolePlan)
    : null;

  let lastError: Error | null = null;
  let invokeCount = 0;

  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    try {
      const basePrompt = formatSharedVisualPlannerPrompt(plannerInput, {
        repair:
          attempt > 1 && lastError
            ? formatSharedVisualDecisionTraceRepairHint(lastError)
            : null,
      });
      const rawText = await input.invoke(basePrompt);
      invokeCount += 1;
      const llmRaw = extractJsonObject(rawText);
      // materializeInRepairLoop=true — validate inside the attempt loop
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
        invokeCount,
      };
    } catch (error) {
      lastError = error instanceof Error ? error : new Error(String(error));
      const repairable = isSvpDecisionTraceRepairableError(lastError);
      const details =
        lastError instanceof SharedVisualPlannerValidationError
          ? lastError.details
          : undefined;
      console.error("[shared-visual-plan] attempt failed", {
        attempt,
        maxAttempts,
        code:
          lastError instanceof SharedVisualPlannerValidationError
            ? lastError.code
            : "shared_visual_planner_failed",
        cardId: details?.cardId,
        field: details?.field,
        requested: details?.requested,
        final: details?.final,
        repairable,
      });
      if (!repairable || attempt >= maxAttempts) {
        break;
      }
      // Decision-trace omission → one repair attempt; do not broaden to other errors.
    }
  }

  const code =
    lastError instanceof SharedVisualPlannerValidationError
      ? lastError.code
      : lastError instanceof Error && lastError.message
        ? lastError.message.split(":")[0] || "shared_visual_planner_failed"
        : "shared_visual_planner_failed";
  const message = lastError instanceof Error ? lastError.message : "shared_visual_planner_failed";
  console.error("[shared-visual-plan] generate failed; previous plan preserved", {
    code,
    message,
    invokeCount,
  });
  return {
    ...applySharedVisualGenerateFailPolicy({
      policy: svpFailurePolicy,
      previousPlan,
      error: { code, message },
    }),
    invokeCount,
  };
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
