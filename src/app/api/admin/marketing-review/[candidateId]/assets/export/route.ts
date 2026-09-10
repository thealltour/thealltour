import { requireAdminPermission } from "@/lib/apiAuth";
import { marketingAssetErrorResponse } from "@/lib/marketing/assets/assetApiErrors";
import { exportCandidateAssetPackage } from "@/lib/marketing/assets/candidateAssetPackageService";

export const dynamic = "force-dynamic";

type RouteContext = { params: Promise<{ candidateId: string }> };

/**
 * Export CompletedMarketingCandidate package under MARKETING_ASSET_ROOT.
 * Idempotent: identical repeat returns reused=true without rewriting digest-equal content.
 * Does not mutate Human Review / SNS / publication state.
 */
export async function POST(request: Request, context: RouteContext) {
  const auth = await requireAdminPermission("settings.manage");
  if (!auth.ok) return auth.res;

  const { candidateId } = await context.params;
  let dryRun = false;
  try {
    const body = (await request.json()) as { dryRun?: unknown };
    dryRun = Boolean(body?.dryRun);
  } catch {
    dryRun = false;
  }

  try {
    const result = await exportCandidateAssetPackage({ candidateId, dryRun });
    if (!result.ok) {
      return Response.json({ message: "후보를 찾을 수 없습니다.", code: "candidate_not_found" }, { status: 404 });
    }
    const exportResult = result.result;
    return Response.json(
      {
        dryRun: exportResult.dryRun,
        wrote: exportResult.wrote,
        reused: exportResult.reused,
        candidateId: exportResult.candidateId,
        businessDateKst: exportResult.businessDateKst,
        packageId: exportResult.packageId,
        relativePackagePath: exportResult.relativePackagePath,
        plannedRelativePaths: exportResult.plannedRelativePaths,
        artifactCount: exportResult.artifacts.length,
        artifacts: exportResult.artifacts,
        stage: exportResult.manifest.stage,
        integrityDigest: exportResult.manifest.integrity.digest,
        updatedAt: exportResult.manifest.updatedAt,
      },
      { headers: { "Cache-Control": "no-store" } },
    );
  } catch (error) {
    return marketingAssetErrorResponse(error);
  }
}
