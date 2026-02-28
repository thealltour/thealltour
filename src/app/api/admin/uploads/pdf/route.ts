/**
 * POST /api/admin/uploads/pdf
 *
 * multipart/form-data PDF 업로드
 * - field name: "file"
 * - 허용: application/pdf
 * - 최대 10MB
 * - admin 인증: middleware에서 ADMIN_AUTH_COOKIE 검사 (미인증 시 401)
 *
 * 응답: { pdfUrl: string }
 * TODO: PDF 1페이지 → WebP 썸네일 생성 시 thumbnailUrl 추가
 */
import { NextRequest, NextResponse } from "next/server";
import { getStorageProvider } from "@/lib/storage";

const BUCKET = "guide-pdfs";
const MAX_SIZE = 10 * 1024 * 1024; // 10MB

function generatePath(): string {
  const now = new Date();
  const yyyy = now.getFullYear();
  const mm = String(now.getMonth() + 1).padStart(2, "0");
  const timestamp = Date.now();
  const random = Math.random().toString(36).slice(2, 10);
  return `products/${yyyy}/${mm}/${timestamp}-${random}.pdf`;
}

export async function POST(request: NextRequest) {
  try {
    const formData = await request.formData();
    const file = formData.get("file");

    if (!file || !(file instanceof File)) {
      return NextResponse.json({ error: "file 필드가 필요합니다." }, { status: 400 });
    }

    if (file.type !== "application/pdf") {
      return NextResponse.json({ error: "PDF 형식만 업로드할 수 있습니다." }, { status: 400 });
    }
    if (file.size > MAX_SIZE) {
      return NextResponse.json(
        { error: "파일 용량은 10MB 이하만 업로드할 수 있습니다." },
        { status: 400 }
      );
    }

    const path = generatePath();
    const provider = getStorageProvider();
    const { url } = await provider.uploadPublicImage({
      file,
      path,
      contentType: "application/pdf",
      bucket: BUCKET,
    });

    return NextResponse.json({ pdfUrl: url });
  } catch (err) {
    const message = err instanceof Error ? err.message : "업로드 실패";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
