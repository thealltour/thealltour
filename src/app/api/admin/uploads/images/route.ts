import { NextRequest, NextResponse } from "next/server";
import { getStorageProvider } from "@/lib/storage";

const ALLOWED_EXTENSIONS = ["jpg", "jpeg", "png", "webp"];
const ALLOWED_TYPES = ["image/jpeg", "image/png", "image/webp"];
const MAX_SIZE = 10 * 1024 * 1024; // 10MB
const MAX_FILES = 10;

function getExtension(name: string): string {
  const parts = name.split(".");
  return parts.length > 1 ? parts.pop()!.toLowerCase() : "";
}

function isAllowedFile(file: File): { ok: boolean; error?: string } {
  const ext = getExtension(file.name);
  if (!ALLOWED_EXTENSIONS.includes(ext)) {
    return { ok: false, error: "허용 확장자: jpg, jpeg, png, webp" };
  }
  if (!ALLOWED_TYPES.includes(file.type)) {
    return { ok: false, error: "허용 형식: JPEG, PNG, WebP" };
  }
  if (file.size > MAX_SIZE) {
    return { ok: false, error: "파일 용량은 10MB 이하만 업로드할 수 있습니다." };
  }
  return { ok: true };
}

function generatePath(index: number): string {
  const now = new Date();
  const yyyy = now.getFullYear();
  const mm = String(now.getMonth() + 1).padStart(2, "0");
  const timestamp = Date.now();
  const random = Math.random().toString(36).slice(2, 10);
  return `products/${yyyy}/${mm}/${timestamp}-${random}-${index + 1}.webp`;
}

export async function POST(request: NextRequest) {
  try {
    const formData = await request.formData();
    const entries = formData.getAll("files");
    const files = entries.filter((v): v is File => v instanceof File);

    if (files.length === 0) {
      return NextResponse.json({ error: "files 필드가 필요합니다." }, { status: 400 });
    }
    if (files.length > MAX_FILES) {
      return NextResponse.json(
        { error: `한 번에 최대 ${MAX_FILES}장까지 업로드할 수 있습니다.` },
        { status: 400 },
      );
    }

    for (const file of files) {
      const validation = isAllowedFile(file);
      if (!validation.ok) {
        return NextResponse.json({ error: validation.error }, { status: 400 });
      }
    }

    const provider = getStorageProvider();
    const urls: string[] = [];
    for (let i = 0; i < files.length; i += 1) {
      const file = files[i];
      const path = generatePath(i);
      const { url } = await provider.uploadPublicImage({
        file,
        path,
        contentType: file.type,
      });
      urls.push(url);
    }

    return NextResponse.json({ urls });
  } catch (err) {
    const message = err instanceof Error ? err.message : "업로드 실패";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
