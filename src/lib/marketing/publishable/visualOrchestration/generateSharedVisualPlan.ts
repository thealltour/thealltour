/**
 * Explicit Shared Visual Plan generation (LLM-primary).
 * Does NOT overwrite last good plan on LLM failure.
 */

import type { CanonicalMarketingAsset } from "@/lib/marketing/canonicalAsset/contracts";
import type { PublishableContentBundle } from "@/lib/marketing/publishable/contracts";
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

export type SharedVisualPlannerInvoke = (prompt: string) => Promise<string> | string;

export type GenerateSharedVisualPlanResult =
  | {
      ok: true;
      plan: SharedVisualPlan;
      warnings: string[];
      previousPlanPreserved: false;
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
  now?: Date;
}): Promise<GenerateSharedVisualPlanResult> {
  const previousPlan = readSharedVisualPlan(input.packageRoot);
  try {
    const plannerInput = buildSharedVisualPlannerInput({
      approvedAsset: input.approvedCanonicalAsset,
      bundle: input.bundle,
    });
    const prompt = formatSharedVisualPlannerPrompt(plannerInput);
    const rawText = await input.invoke(prompt);
    const llmRaw = extractJsonObject(rawText);
    const { plan, warnings } = materializeSharedVisualPlanFromLlm({
      bundle: input.bundle,
      llmRaw,
      now: input.now,
      forbiddenClaimsKo: input.approvedCanonicalAsset.forbiddenClaimsKo ?? null,
    });
    persistSharedVisualPlan({
      packageRoot: input.packageRoot,
      plan,
      createdAt: plan.generatedAt,
    });
    return { ok: true, plan, warnings, previousPlanPreserved: false };
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
    return {
      ok: false,
      error: { code, message },
      previousPlan,
      previousPlanPreserved: true,
    };
  }
}
