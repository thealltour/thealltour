/**
 * Deterministic rebuild helper for SharedVisualPlan + ManualAstraHandoff.
 * NOT called from channel generate/regenerate — operator uses LLM generate routes.
 * Kept for tests / labeled deterministic_fallback only.
 */

import type { CanonicalMarketingAsset } from "@/lib/marketing/canonicalAsset/contracts";
import type { PublishableContentBundle } from "@/lib/marketing/publishable/contracts";
import {
  buildManualAstraHandoff,
  persistManualAstraHandoff,
  type ManualAstraApprovedAssetContext,
} from "@/lib/marketing/publishable/manualAstraHandoff";
import {
  buildSharedVisualPlan,
  persistSharedVisualPlan,
  type SharedVisualPlan,
} from "@/lib/marketing/publishable/sharedVisualPlan";
import type { ManualAstraHandoff } from "@/lib/marketing/publishable/manualAstraHandoff/contracts";

export type DerivedVisualArtifactsRefreshResult = {
  ok: boolean;
  skipped?: boolean;
  skipReason?: string;
  plan: SharedVisualPlan | null;
  handoff: ManualAstraHandoff | null;
  visualRequestCount: number;
  generatedVisualNeededCount: number;
  threadsMediaPlan: "present" | "null" | "absent";
  instagramCardPlan: "present" | "empty" | "absent";
  warnings: string[];
  error?: { code: string; message: string };
};

export function approvedAssetToManualAstraContext(
  asset: CanonicalMarketingAsset | null | undefined,
): ManualAstraApprovedAssetContext | null {
  if (!asset) return null;
  return {
    titleKo: asset.titleKo ?? null,
    supportedClaimBoundaryKo: asset.supportedClaimBoundaryKo ?? null,
    limitationsKo: Array.isArray(asset.limitationsKo) ? asset.limitationsKo : null,
    forbiddenClaimsKo: Array.isArray(asset.forbiddenClaimsKo) ? asset.forbiddenClaimsKo : null,
    storySupportVerdict: asset.storySupportVerdict ?? null,
    editorialArchetype: asset.editorialArchetype ?? null,
  };
}

function describeVisualInputs(bundle: PublishableContentBundle): {
  threadsMediaPlan: "present" | "null" | "absent";
  instagramCardPlan: "present" | "empty" | "absent";
  visualRequestCount: number;
} {
  const threadsPlan = bundle.threads?.mediaPlan;
  let threadsMediaPlan: "present" | "null" | "absent" = "absent";
  if (bundle.threads) {
    if (threadsPlan == null) {
      threadsMediaPlan = "null";
    } else if (threadsPlan.recommended === true && (threadsPlan.visuals?.length ?? 0) > 0) {
      threadsMediaPlan = "present";
    } else {
      // Explicit empty / not recommended — treat as no Threads visual requests.
      threadsMediaPlan = "null";
    }
  }

  let instagramCardPlan: "present" | "empty" | "absent" = "absent";
  if (bundle.instagram) {
    const cards = bundle.instagram.instagramMeta?.cardPlan ?? [];
    const withVisual = cards.filter((c) => c.visual != null);
    instagramCardPlan = withVisual.length > 0 ? "present" : "empty";
  }

  // Approximate request count from builder inputs (before dedupe) for logging.
  let visualRequestCount = 0;
  if (threadsMediaPlan === "present" && threadsPlan) {
    visualRequestCount += threadsPlan.visuals?.length ?? 0;
  }
  if (instagramCardPlan === "present") {
    visualRequestCount += (bundle.instagram?.instagramMeta?.cardPlan ?? []).filter(
      (c) => c.visual != null,
    ).length;
  }

  return { threadsMediaPlan, instagramCardPlan, visualRequestCount };
}

/**
 * Rebuild + overwrite SharedVisualPlan and ManualAstraHandoff from the current bundle.
 * Always persists current artifacts (including empty/zero-item) so stale handoffs are replaced.
 */
export function refreshDerivedVisualArtifacts(input: {
  packageRoot: string;
  publishableBundle: PublishableContentBundle;
  approvedCanonicalAsset?: CanonicalMarketingAsset | null;
  now?: Date;
}): DerivedVisualArtifactsRefreshResult {
  const warnings: string[] = [];
  const inputs = describeVisualInputs(input.publishableBundle);

  console.info(
    "[derived-visual-artifacts] refresh start",
    JSON.stringify({
      candidateId: input.publishableBundle.candidateId,
      threadsMediaPlan: inputs.threadsMediaPlan,
      instagramCardPlan: inputs.instagramCardPlan,
      visualRequestCount: inputs.visualRequestCount,
    }),
  );

  if (inputs.threadsMediaPlan === "null") {
    warnings.push("threads_content_present_but_mediaPlan_null");
    console.info(
      "[derived-visual-artifacts] Threads content generated; mediaPlan null — no Threads visual requests",
    );
  }

  try {
    const plan = buildSharedVisualPlan({
      bundle: input.publishableBundle,
      now: input.now,
    });
    const handoff = buildManualAstraHandoff({
      sharedVisualPlan: plan,
      approvedAssetContext: approvedAssetToManualAstraContext(input.approvedCanonicalAsset),
      now: input.now,
    });

    persistSharedVisualPlan({
      packageRoot: input.packageRoot,
      plan,
      createdAt: plan.generatedAt,
    });
    persistManualAstraHandoff({
      packageRoot: input.packageRoot,
      handoff,
      createdAt: handoff.generatedAt,
    });

    const generatedVisualNeededCount = plan.visuals.filter((v) => v.generatedVisualNeeded).length;

    console.info(
      "[derived-visual-artifacts] refresh ok",
      JSON.stringify({
        candidateId: input.publishableBundle.candidateId,
        planVisuals: plan.visuals.length,
        handoffVisualCount: handoff.visualCount,
        generatedVisualNeededCount,
        planFingerprint: plan.sourceVisualPlanFingerprint,
        threadsMediaPlan: inputs.threadsMediaPlan,
        instagramCardPlan: inputs.instagramCardPlan,
      }),
    );

    return {
      ok: true,
      plan,
      handoff,
      visualRequestCount: inputs.visualRequestCount,
      generatedVisualNeededCount,
      threadsMediaPlan: inputs.threadsMediaPlan,
      instagramCardPlan: inputs.instagramCardPlan,
      warnings,
    };
  } catch (error) {
    const message = error instanceof Error ? error.message : "derived_visual_refresh_failed";
    const code =
      error && typeof error === "object" && "code" in error && typeof (error as { code: unknown }).code === "string"
        ? (error as { code: string }).code
        : "derived_visual_refresh_failed";
    console.error("[derived-visual-artifacts] refresh failed", { code, message });
    return {
      ok: false,
      plan: null,
      handoff: null,
      visualRequestCount: inputs.visualRequestCount,
      generatedVisualNeededCount: 0,
      threadsMediaPlan: inputs.threadsMediaPlan,
      instagramCardPlan: inputs.instagramCardPlan,
      warnings,
      error: { code, message },
    };
  }
}
