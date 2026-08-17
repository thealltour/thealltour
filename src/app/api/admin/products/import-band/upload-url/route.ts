import { NextRequest, NextResponse } from "next/server";
import { requireAdminSessionForPath } from "@/lib/apiAuth";
import { createBandImportStagingUploadTarget } from "@/lib/admin/bandImport/bandImportStaging";
import { getFilenameExt, isBandImportImageExt } from "@/lib/admin/bandImport/bandImportImageConstants";

function isAllowedStagingExt(ext: string): boolean {
  return ext === "zip" || isBandImportImageExt(ext);
}

/**
 * 밴드 상품 등록 사진 업로드용 signed upload URL 발급.
 * 이 요청 본문은 파일명만 담긴 JSON이라 Vercel의 4.5MB 함수 본문 제한과 무관하며,
 * 실제 zip/사진 바이트는 이 응답의 path/token으로 브라우저가 Supabase Storage에 직접 올린다.
 */
export async function POST(request: NextRequest) {
  const auth = await requireAdminSessionForPath("/api/admin/products/import-band/upload-url");
  if (!auth.ok) return auth.res;

  let body: { filename?: string };
  try {
    body = (await request.json()) as { filename?: string };
  } catch {
    return NextResponse.json({ message: "요청 본문이 올바르지 않습니다." }, { status: 400 });
  }

  const filename = body.filename?.trim();
  if (!filename) {
    return NextResponse.json({ message: "filename이 필요합니다." }, { status: 400 });
  }

  const ext = getFilenameExt(filename);
  if (!isAllowedStagingExt(ext)) {
    return NextResponse.json(
      { message: "사진(jpg/jpeg/png/webp) 또는 zip 파일만 업로드할 수 있습니다." },
      { status: 400 },
    );
  }

  try {
    const target = await createBandImportStagingUploadTarget(filename);
    return NextResponse.json(target);
  } catch (error) {
    console.error("[import-band/upload-url] 발급 실패:", error);
    return NextResponse.json({ message: "업로드 URL 발급에 실패했습니다." }, { status: 500 });
  }
}
