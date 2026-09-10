import { requireAdminPermission } from "@/lib/apiAuth";
import { marketingAssetErrorResponse } from "@/lib/marketing/assets/assetApiErrors";
import { inspectCandidateAssetPackage } from "@/lib/marketing/assets/candidateAssetPackageService";

export const dynamic = "force-dynamic";

type RouteContext = { params: Promise<{ candidateId: string }> };

/**
 * Inspect HDD marketing asset package for a CompletedMarketingCandidate.
 * Missing package → 200 with status "missing" (not an error).
 */
export async function GET(_request: Request, context: RouteContext) {
  const auth = await requireAdminPermission("settings.manage");
  if (!auth.ok) return auth.res;

  const { candidateId } = await context.params;
  try {
    const result = await inspectCandidateAssetPackage({ candidateId });
    if (!result.ok) {
      return Response.json({ message: "후보를 찾을 수 없습니다.", code: "candidate_not_found" }, { status: 404 });
    }
    const { inspection } = result;
    return Response.json(
      {
        status: inspection.status,
        candidateId: inspection.candidateId,
        businessDateKst: inspection.businessDateKst,
        assetRootConfigured: inspection.assetRootConfigured,
        relativePackagePath: inspection.relativePackagePath,
        packageId: inspection.packageId,
        stage: inspection.stage,
        artifacts: inspection.artifacts,
        updatedAt: inspection.updatedAt,
        createdAt: inspection.createdAt,
        integrityDigest: inspection.integrityDigest,
        // Do not expose absolute packageRoot to the browser.
      },
      { headers: { "Cache-Control": "no-store" } },
    );
  } catch (error) {
    return marketingAssetErrorResponse(error);
  }
}
