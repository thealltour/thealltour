import { NextResponse } from "next/server";

import { requireAdminPermission } from "@/lib/apiAuth";
import { marketingAssetErrorResponse } from "@/lib/marketing/assets/assetApiErrors";
import { buildMarketingAssetPackageZip } from "@/lib/marketing/assets/buildMarketingAssetPackageZip";
import { loadCompletedMarketingCandidateForAssets } from "@/lib/marketing/assets/candidateAssetPackageService";
import { MarketingAssetPathError } from "@/lib/marketing/assets/errors";

export const dynamic = "force-dynamic";

type RouteContext = { params: Promise<{ candidateId: string }> };

/**
 * Download the full HDD marketing asset package as a single ZIP (path-safe).
 * Includes manifest.json and all readable manifest artifacts.
 */
export async function GET(_request: Request, context: RouteContext) {
  const auth = await requireAdminPermission("settings.manage");
  if (!auth.ok) return auth.res;

  const { candidateId } = await context.params;

  try {
    const candidate = await loadCompletedMarketingCandidateForAssets(candidateId);
    if (!candidate) {
      return Response.json(
        { message: "후보를 찾을 수 없습니다.", code: "candidate_not_found" },
        { status: 404 },
      );
    }

    const zip = await buildMarketingAssetPackageZip({
      candidateId: candidate.candidateId,
      businessDateKst: candidate.businessDateKst,
    });

    const safeFileName = zip.zipFileName.replace(/["\r\n]/g, "_");
    return new NextResponse(new Uint8Array(zip.bytes), {
      status: 200,
      headers: {
        "Content-Type": "application/zip",
        "Content-Length": String(zip.byteSize),
        "Content-Disposition": `attachment; filename="${safeFileName}"`,
        "Cache-Control": "no-store",
        "X-Marketing-Asset-Package-Id": zip.packageId ?? "",
        "X-Marketing-Asset-Zip-Entries": String(zip.entryCount),
      },
    });
  } catch (error) {
    if (error instanceof MarketingAssetPathError && /not found/i.test(error.message)) {
      return Response.json({ message: error.message, code: error.code }, { status: 404 });
    }
    return marketingAssetErrorResponse(error);
  }
}
