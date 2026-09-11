import { NextResponse } from "next/server";

import { requireAdminPermission } from "@/lib/apiAuth";
import { marketingAssetErrorResponse } from "@/lib/marketing/assets/assetApiErrors";
import { readCandidateAssetPackageFile } from "@/lib/marketing/assets/candidateAssetPackageService";
import { MarketingAssetPathError } from "@/lib/marketing/assets/errors";

export const dynamic = "force-dynamic";

type RouteContext = { params: Promise<{ candidateId: string }> };

function defaultDisposition(mediaType: string): "inline" | "attachment" {
  if (mediaType.startsWith("image/")) return "inline";
  if (mediaType.startsWith("video/")) return "inline";
  if (mediaType.startsWith("text/")) return "inline";
  if (mediaType === "application/json") return "inline";
  return "attachment";
}

/**
 * Stream a single package file (path-safe). Query:
 *   path=copy/post.txt
 *   disposition=inline|attachment (optional)
 */
export async function GET(request: Request, context: RouteContext) {
  const auth = await requireAdminPermission("settings.manage");
  if (!auth.ok) return auth.res;

  const { candidateId } = await context.params;
  const url = new URL(request.url);
  const relativePath = url.searchParams.get("path")?.trim() ?? "";
  if (!relativePath) {
    return Response.json({ message: "path query required", code: "INVALID_PAYLOAD" }, { status: 400 });
  }

  const dispositionParam = url.searchParams.get("disposition")?.trim().toLowerCase();
  const dispositionOverride =
    dispositionParam === "inline" || dispositionParam === "attachment"
      ? dispositionParam
      : null;

  try {
    const result = await readCandidateAssetPackageFile({ candidateId, relativePath });
    if (!result.ok) {
      return Response.json({ message: "후보를 찾을 수 없습니다.", code: "candidate_not_found" }, { status: 404 });
    }
    const { file } = result;
    const disposition = dispositionOverride ?? defaultDisposition(file.mediaType);
    const safeFileName = file.fileName.replace(/["\r\n]/g, "_");
    return new NextResponse(new Uint8Array(file.bytes), {
      status: 200,
      headers: {
        "Content-Type": file.mediaType,
        "Content-Length": String(file.byteSize),
        "Content-Disposition": `${disposition}; filename="${safeFileName}"`,
        "Cache-Control": "no-store",
        "X-Marketing-Asset-Path": file.relativePath,
      },
    });
  } catch (error) {
    if (error instanceof MarketingAssetPathError && /not found/i.test(error.message)) {
      return Response.json({ message: error.message, code: error.code }, { status: 404 });
    }
    return marketingAssetErrorResponse(error);
  }
}
