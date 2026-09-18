/**
 * Operator services: Shared Visual Plan + Astra Handoff explicit generation.
 */

import "server-only";

import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";

import { inspectCandidateAssetPackage } from "@/lib/marketing/assets/candidateAssetPackageService";
import { readCanonicalAssetFromPackage } from "@/lib/marketing/canonicalAsset/persistence";
import { isApprovedCanonicalAsset } from "@/lib/marketing/canonicalAsset/validateCanonicalMarketingAsset";
import {
  PUBLISHABLE_CONTENT_BUNDLE_CONTRACT,
  type PublishableContentBundle,
} from "@/lib/marketing/publishable/contracts";
import { PUBLISHABLE_CONTENT_RELATIVE_PATH } from "@/lib/marketing/publishable/paths";
import { approvedAssetToManualAstraContext } from "@/lib/marketing/publishable/refreshDerivedVisualArtifacts";
import { readManualAstraHandoff } from "@/lib/marketing/publishable/manualAstraHandoff";
import { readSharedVisualPlan } from "@/lib/marketing/publishable/sharedVisualPlan";
import {
  computeManualAstraHandoffFingerprint,
  getSharedVisualUploadStatus,
  isManualAstraHandoffSourceStale,
  isSharedVisualAssetsStale,
  readSharedVisualAssetsManifest,
} from "@/lib/marketing/publishable/sharedVisualAssets";
import { formatUsageLine } from "@/lib/marketing/publishable/manualAstraHandoff/formatCopyText";
import {
  lifecycleLabelKo,
  resolveManualAstraHandoffLifecycle,
  resolveSharedVisualPlanLifecycle,
  type VisualArtifactLifecycleStatus,
} from "@/lib/marketing/publishable/visualOrchestration/lifecycle";
import { generateSharedVisualPlanWithLlm } from "@/lib/marketing/publishable/visualOrchestration/generateSharedVisualPlan";
import { generateManualAstraHandoffWithLlm } from "@/lib/marketing/publishable/visualOrchestration/generateManualAstraHandoff";
import type { AstraHandoffOperatorSlot, AstraHandoffOperatorView } from "@/lib/marketing/publishable/sharedVisualAssets/operatorService";
import {
  AstraHandoffOperatorError,
  astraHandoffOperatorErrorResponse,
} from "@/lib/marketing/publishable/sharedVisualAssets/operatorService";

export { AstraHandoffOperatorError, astraHandoffOperatorErrorResponse };

function readPublishableBundle(packageRoot: string): PublishableContentBundle | null {
  const path = join(packageRoot, PUBLISHABLE_CONTENT_RELATIVE_PATH);
  if (!existsSync(path)) return null;
  try {
    const raw = JSON.parse(readFileSync(path, "utf8")) as PublishableContentBundle;
    if (raw?.contract !== PUBLISHABLE_CONTENT_BUNDLE_CONTRACT) return null;
    return raw;
  } catch {
    return null;
  }
}

async function resolvePackageRoot(candidateId: string): Promise<{
  packageRoot: string;
  candidateId: string;
} | null> {
  const inspected = await inspectCandidateAssetPackage({ candidateId });
  if (!inspected.ok) {
    throw new AstraHandoffOperatorError("candidate_not_found", "후보를 찾을 수 없습니다.", 404);
  }
  if (inspected.inspection.status !== "present" || !inspected.inspection.packageRoot) {
    return null;
  }
  return {
    packageRoot: inspected.inspection.packageRoot,
    candidateId: inspected.candidate.candidateId,
  };
}

export type VisualOrchestrationOperatorView = {
  candidateId: string;
  packagePresent: boolean;
  message: string | null;
  plan: {
    status: VisualArtifactLifecycleStatus;
    statusLabel: string;
    present: boolean;
    strategySummary: string | null;
    planningMode: string | null;
    visualCount: number;
    generatedVisualNeededCount: number;
    fingerprint: string | null;
    visuals: Array<{
      visualId: string;
      role: string;
      visualMode: string | null;
      generatedVisualNeeded: boolean;
      visualIntent: string;
      usageLabels: string[];
    }>;
  };
  handoff: AstraHandoffOperatorView;
  canGenerateHandoff: boolean;
  handoffBlockReason: string | null;
};

export async function getVisualOrchestrationOperatorView(
  candidateId: string,
): Promise<VisualOrchestrationOperatorView> {
  const resolved = await resolvePackageRoot(candidateId);
  if (!resolved) {
    const emptyHandoff: AstraHandoffOperatorView = {
      status: "missing_package",
      candidateId,
      packagePresent: false,
      handoff: null,
      handoffFingerprint: null,
      handoffStale: false,
      assetsManifest: null,
      assetsStale: false,
      uploadStatus: null,
      slots: [],
      message: "HDD 마케팅 패키지가 없습니다. 먼저 산출물을 내보내 주세요.",
    };
    return {
      candidateId,
      packagePresent: false,
      message: emptyHandoff.message,
      plan: {
        status: "not_generated",
        statusLabel: lifecycleLabelKo("not_generated"),
        present: false,
        strategySummary: null,
        planningMode: null,
        visualCount: 0,
        generatedVisualNeededCount: 0,
        fingerprint: null,
        visuals: [],
      },
      handoff: emptyHandoff,
      canGenerateHandoff: false,
      handoffBlockReason: "패키지가 없습니다.",
    };
  }

  const bundle = readPublishableBundle(resolved.packageRoot);
  const plan = readSharedVisualPlan(resolved.packageRoot);
  const planLifecycle = resolveSharedVisualPlanLifecycle({ plan, bundle });
  const handoffRaw = readManualAstraHandoff(resolved.packageRoot);
  const handoffLifecycle = resolveManualAstraHandoffLifecycle({
    handoff: handoffRaw,
    plan,
    planLifecycle,
  });
  const assetsManifest = readSharedVisualAssetsManifest(resolved.packageRoot);

  const handoffView: AstraHandoffOperatorView = !handoffRaw
    ? {
        status: "missing_handoff",
        candidateId: resolved.candidateId,
        packagePresent: true,
        handoff: null,
        handoffFingerprint: null,
        handoffStale: false,
        assetsManifest,
        assetsStale: false,
        uploadStatus: null,
        slots: [],
        message:
          planLifecycle === "not_generated"
            ? "먼저 Shared Visual Plan을 생성하세요."
            : "Astra Handoff가 아직 없습니다. 명시적으로 생성하세요.",
      }
    : (() => {
        const handoffFingerprint = computeManualAstraHandoffFingerprint(handoffRaw);
        const handoffStale = handoffLifecycle === "stale";
        const assetsStale = assetsManifest
          ? isSharedVisualAssetsStale({
              manifest: assetsManifest,
              handoff: handoffRaw,
              sharedVisualPlan: plan,
            })
          : false;
        const uploadStatus = getSharedVisualUploadStatus({
          handoff: handoffRaw,
          manifest: assetsManifest,
          sharedVisualPlan: plan,
        });
        const uploadedById = new Map(
          (assetsManifest?.assets ?? []).map((a) => [a.visualId, a] as const),
        );
        const slots: AstraHandoffOperatorSlot[] = handoffRaw.visuals.map((v) => ({
          visualId: v.visualId,
          role: v.role,
          visualIntent: v.visualIntent,
          visualMode: v.visualMode ?? null,
          aspectRatio: v.aspectRatio,
          expectedFilename: v.expectedFilename,
          usageLabels: v.usages.map((u) => formatUsageLine(u)),
          compositionGuidance: v.compositionGuidance,
          textSafeArea: v.textSafeArea,
          evidenceGuidance: v.evidenceGuidance,
          uploaded: uploadedById.get(v.visualId) ?? null,
        }));
        return {
          status: "ready" as const,
          candidateId: resolved.candidateId,
          packagePresent: true,
          handoff: handoffRaw,
          handoffFingerprint,
          handoffStale,
          assetsManifest,
          assetsStale,
          uploadStatus,
          slots,
          message: null,
        };
      })();

  const canGenerateHandoff = planLifecycle === "fresh";
  const handoffBlockReason =
    planLifecycle === "not_generated"
      ? "Shared Visual Plan이 없습니다."
      : planLifecycle === "stale"
        ? "Shared Visual Plan이 오래되었습니다. Plan을 먼저 재생성하세요."
        : null;

  return {
    candidateId: resolved.candidateId,
    packagePresent: true,
    message: null,
    plan: {
      status: planLifecycle,
      statusLabel: lifecycleLabelKo(planLifecycle),
      present: Boolean(plan),
      strategySummary: plan?.strategySummary ?? null,
      planningMode: plan?.planningMode ?? null,
      visualCount: plan?.visuals.length ?? 0,
      generatedVisualNeededCount:
        plan?.visuals.filter((v) => v.generatedVisualNeeded).length ?? 0,
      fingerprint: plan?.sourceVisualPlanFingerprint ?? null,
      visuals: (plan?.visuals ?? []).map((v) => ({
        visualId: v.visualId,
        role: v.role,
        visualMode: v.visualMode ?? null,
        generatedVisualNeeded: v.generatedVisualNeeded,
        visualIntent: v.visualIntent,
        usageLabels: v.usages.map((u) => formatUsageLine(u)),
      })),
    },
    handoff: {
      ...handoffView,
      // Surface handoff lifecycle via handoffStale + optional message
      handoffStale:
        handoffView.status === "ready" ? handoffLifecycle === "stale" : handoffView.handoffStale,
    },
    canGenerateHandoff,
    handoffBlockReason,
  };
}

/** Prefer getVisualOrchestrationOperatorView for Marketing Review UI. */
export async function getAstraHandoffOperatorView(
  candidateId: string,
): Promise<AstraHandoffOperatorView> {
  const view = await getVisualOrchestrationOperatorView(candidateId);
  return view.handoff;
}

export async function generateSharedVisualPlanForCandidate(input: {
  candidateId: string;
  invoke: (prompt: string) => Promise<string> | string;
}): Promise<{
  ok: boolean;
  planStatus: VisualArtifactLifecycleStatus;
  visualCount: number;
  warnings?: string[];
  error?: { code: string; message: string };
  previousPlanPreserved?: boolean;
}> {
  const resolved = await resolvePackageRoot(input.candidateId);
  if (!resolved) {
    throw new AstraHandoffOperatorError("package_missing", "HDD 마케팅 패키지가 없습니다.", 404);
  }
  const bundle = readPublishableBundle(resolved.packageRoot);
  if (!bundle) {
    throw new AstraHandoffOperatorError(
      "publishable_missing",
      "publishable-content.json이 없습니다. 채널을 먼저 생성하세요.",
      409,
    );
  }
  const asset = readCanonicalAssetFromPackage(resolved.packageRoot);
  if (!asset || !isApprovedCanonicalAsset(asset)) {
    throw new AstraHandoffOperatorError(
      "canonical_asset_unapproved",
      "승인된 Canonical Asset이 필요합니다.",
      409,
    );
  }

  const result = await generateSharedVisualPlanWithLlm({
    packageRoot: resolved.packageRoot,
    bundle,
    approvedCanonicalAsset: asset,
    invoke: input.invoke,
  });

  if (!result.ok) {
    return {
      ok: false,
      planStatus: resolveSharedVisualPlanLifecycle({
        plan: result.previousPlan,
        bundle,
      }),
      visualCount: result.previousPlan?.visuals.length ?? 0,
      error: result.error,
      previousPlanPreserved: true,
    };
  }

  return {
    ok: true,
    planStatus: "fresh",
    visualCount: result.plan.visuals.length,
    warnings: result.warnings,
    previousPlanPreserved: false,
  };
}

export async function generateAstraHandoffForCandidate(input: {
  candidateId: string;
  invoke: (prompt: string) => Promise<string> | string;
}): Promise<{
  ok: boolean;
  handoffStatus: VisualArtifactLifecycleStatus;
  visualCount: number;
  error?: { code: string; message: string };
  previousHandoffPreserved?: boolean;
}> {
  const resolved = await resolvePackageRoot(input.candidateId);
  if (!resolved) {
    throw new AstraHandoffOperatorError("package_missing", "HDD 마케팅 패키지가 없습니다.", 404);
  }
  const bundle = readPublishableBundle(resolved.packageRoot);
  const plan = readSharedVisualPlan(resolved.packageRoot);
  if (!plan) {
    throw new AstraHandoffOperatorError(
      "shared_visual_plan_missing",
      "Shared Visual Plan이 없습니다. 먼저 Plan을 생성하세요.",
      409,
    );
  }
  const planLifecycle = resolveSharedVisualPlanLifecycle({ plan, bundle });
  const asset = readCanonicalAssetFromPackage(resolved.packageRoot);
  const approved = asset && isApprovedCanonicalAsset(asset) ? asset : null;

  const result = await generateManualAstraHandoffWithLlm({
    packageRoot: resolved.packageRoot,
    plan,
    planFresh: planLifecycle === "fresh",
    approvedAssetContext: approvedAssetToManualAstraContext(approved),
    invoke: input.invoke,
  });

  if (!result.ok) {
    const status = result.previousHandoff
      ? resolveManualAstraHandoffLifecycle({
          handoff: result.previousHandoff,
          plan,
          planLifecycle,
        })
      : "not_generated";
    return {
      ok: false,
      handoffStatus: status,
      visualCount: result.previousHandoff?.visualCount ?? 0,
      error: result.error,
      previousHandoffPreserved: true,
    };
  }

  return {
    ok: true,
    handoffStatus: "fresh",
    visualCount: result.handoff.visualCount,
    previousHandoffPreserved: false,
  };
}

// re-export upload helper dependency check used by upload route
export { isManualAstraHandoffSourceStale };
