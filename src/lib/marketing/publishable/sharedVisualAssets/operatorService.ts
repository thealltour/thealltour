/**
 * Operator-facing Manual Astra Handoff + Shared Visual upload for marketing-review.
 */

import "server-only";

import { inspectCandidateAssetPackage } from "@/lib/marketing/assets/candidateAssetPackageService";
import { readManualAstraHandoff } from "@/lib/marketing/publishable/manualAstraHandoff";
import { readSharedVisualPlan } from "@/lib/marketing/publishable/sharedVisualPlan";
import {
  computeManualAstraHandoffFingerprint,
  formatUsageLine,
  getSharedVisualUploadStatus,
  isManualAstraHandoffSourceStale,
  isSharedVisualAssetsStale,
  readSharedVisualAssetsManifest,
  SharedVisualUploadError,
  uploadSharedVisualAsset,
  type SharedVisualAsset,
  type SharedVisualAssetsManifest,
  type SharedVisualUploadStatus,
} from "@/lib/marketing/publishable/sharedVisualAssets";
import type { ManualAstraHandoff } from "@/lib/marketing/publishable/manualAstraHandoff/contracts";

export class AstraHandoffOperatorError extends Error {
  readonly code: string;
  readonly httpStatus: number;
  constructor(code: string, message: string, httpStatus = 400) {
    super(message);
    this.name = "AstraHandoffOperatorError";
    this.code = code;
    this.httpStatus = httpStatus;
  }
}

export type AstraHandoffOperatorSlot = {
  visualId: string;
  role: string;
  visualIntent: string;
  visualMode: string | null;
  aspectRatio: string;
  expectedFilename: string;
  usageLabels: string[];
  compositionGuidance: string;
  textSafeArea: string;
  evidenceGuidance: string[];
  uploaded: SharedVisualAsset | null;
};

export type AstraHandoffOperatorView = {
  status: "missing_package" | "missing_handoff" | "ready";
  candidateId: string;
  packagePresent: boolean;
  handoff: ManualAstraHandoff | null;
  handoffFingerprint: string | null;
  handoffStale: boolean;
  assetsManifest: SharedVisualAssetsManifest | null;
  assetsStale: boolean;
  uploadStatus: SharedVisualUploadStatus | null;
  slots: AstraHandoffOperatorSlot[];
  message: string | null;
};

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

export async function getAstraHandoffOperatorView(
  candidateId: string,
): Promise<AstraHandoffOperatorView> {
  const resolved = await resolvePackageRoot(candidateId);
  if (!resolved) {
    return {
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
  }

  const handoff = readManualAstraHandoff(resolved.packageRoot);
  const sharedVisualPlan = readSharedVisualPlan(resolved.packageRoot);
  const assetsManifest = readSharedVisualAssetsManifest(resolved.packageRoot);

  if (!handoff) {
    return {
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
      message: "Manual Astra Handoff가 아직 없습니다.",
    };
  }

  const handoffFingerprint = computeManualAstraHandoffFingerprint(handoff);
  const handoffStale = isManualAstraHandoffSourceStale({
    handoff,
    sharedVisualPlan,
  });
  const assetsStale = assetsManifest
    ? isSharedVisualAssetsStale({
        manifest: assetsManifest,
        handoff,
        sharedVisualPlan,
      })
    : false;
  const uploadStatus = getSharedVisualUploadStatus({
    handoff,
    manifest: assetsManifest,
    sharedVisualPlan,
  });

  const uploadedById = new Map(
    (assetsManifest?.assets ?? []).map((a) => [a.visualId, a] as const),
  );

  const slots: AstraHandoffOperatorSlot[] = handoff.visuals.map((v) => ({
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
    status: "ready",
    candidateId: resolved.candidateId,
    packagePresent: true,
    handoff,
    handoffFingerprint,
    handoffStale,
    assetsManifest,
    assetsStale,
    uploadStatus,
    slots,
    message: null,
  };
}

export async function uploadAstraHandoffSharedVisual(input: {
  candidateId: string;
  visualId: string;
  bytes: Buffer;
  clientFilename?: string | null;
}): Promise<{
  asset: SharedVisualAsset;
  manifest: SharedVisualAssetsManifest;
  uploadStatus: SharedVisualUploadStatus;
  handoffStale: boolean;
}> {
  const resolved = await resolvePackageRoot(input.candidateId);
  if (!resolved) {
    throw new AstraHandoffOperatorError(
      "package_missing",
      "HDD 마케팅 패키지가 없습니다.",
      404,
    );
  }

  const handoff = readManualAstraHandoff(resolved.packageRoot);
  if (!handoff) {
    throw new AstraHandoffOperatorError(
      "handoff_missing",
      "Manual Astra Handoff가 없습니다.",
      404,
    );
  }

  const sharedVisualPlan = readSharedVisualPlan(resolved.packageRoot);
  const { asset, manifest } = uploadSharedVisualAsset({
    packageRoot: resolved.packageRoot,
    handoff,
    sharedVisualPlan,
    visualId: input.visualId,
    bytes: input.bytes,
    clientFilename: input.clientFilename,
  });

  const uploadStatus = getSharedVisualUploadStatus({
    handoff,
    manifest,
    sharedVisualPlan,
  });
  const handoffStale = isManualAstraHandoffSourceStale({
    handoff,
    sharedVisualPlan,
  });

  return { asset, manifest, uploadStatus, handoffStale };
}

export function astraHandoffOperatorErrorResponse(error: unknown): Response {
  if (error instanceof SharedVisualUploadError || error instanceof AstraHandoffOperatorError) {
    return Response.json(
      { message: error.message, code: error.code },
      { status: error.httpStatus, headers: { "Cache-Control": "no-store" } },
    );
  }
  console.error("[astra-handoff-operator]", error);
  return Response.json(
    { message: "요청 처리에 실패했습니다.", code: "internal_error" },
    { status: 500, headers: { "Cache-Control": "no-store" } },
  );
}
