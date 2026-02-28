/**
 * POST /api/admin/uploads/guide
 *
 * multipart/form-data 가이드 업로드 (PDF + 썸네일)
 * - field "pdf": application/pdf
 * - field "thumb": image/webp
 * - 최대 10MB each
 * - admin 인증: middleware에서 ADMIN_AUTH_COOKIE 검사 (미인증 시 401)
 *
 * 응답: { pdfUrl: string, thumbnailUrl: string }
 */
import { NextRequest, NextResponse } from "next/server";
import { getStorageProvider } from "@/lib/storage";

const BUCKET = "guide-pdfs";
const MAX_SIZE = 10 * 1024 * 1024; // 10MB

function generatePath(ext: "pdf" | "webp"): string {
  const now = new Date();
  const yyyy = now.getFullYear();
  const mm = String(now.getMonth() + 1).padStart(2, "0");
  const timestamp = Date.now();
  const random = Math.random().toString(36).slice(2, 10);
  return `guides/${yyyy}/${mm}/${timestamp}-${random}.${ext}`;
}

export async function POST(request: NextRequest) {
  try {
    const formData = await request.formData();
    const pdfFile = formData.get("pdf") as File | null;
    const thumbFile = formData.get("thumb") as File | null;

    if (!pdfFile && !thumbFile) {
      return NextResponse.json(
        { error: "pdf 또는 thumb 필드 중 하나 이상이 필요합니다." },
        { status: 400 }
      );
    }

    const provider = getStorageProvider();
    let pdfUrl: string | null = null;
    let thumbnailUrl: string | null = null;

    if (pdfFile && pdfFile instanceof File) {
      if (pdfFile.type !== "application/pdf") {
        return NextResponse.json({ error: "pdf 필드는 PDF 형식이어야 합니다." }, { status: 400 });
      }
      if (pdfFile.size > MAX_SIZE) {
        return NextResponse.json(
          { error: "PDF 파일 용량은 10MB 이하만 업로드할 수 있습니다." },
          { status: 400 }
        );
      }
      const path = generatePath("pdf");
      const { url } = await provider.uploadPublicImage({
        file: pdfFile,
        path,
        contentType: "application/pdf",
        bucket: BUCKET,
      });
      pdfUrl = url;
    }

    if (thumbFile && thumbFile instanceof File) {
      if (thumbFile.type !== "image/webp") {
        return NextResponse.json({ error: "thumb 필드는 image/webp 형식이어야 합니다." }, { status: 400 });
      }
      if (thumbFile.size > MAX_SIZE) {
        return NextResponse.json(
          { error: "썸네일 파일 용량은 10MB 이하만 업로드할 수 있습니다." },
          { status: 400 }
        );
      }
      const path = generatePath("webp");
      const { url } = await provider.uploadPublicImage({
        file: thumbFile,
        path,
        contentType: "image/webp",
        bucket: BUCKET,
      });
      thumbnailUrl = url;
    }

    return NextResponse.json({
      pdfUrl: pdfUrl ?? "",
      thumbnailUrl: thumbnailUrl ?? "",
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : "업로드 실패";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
