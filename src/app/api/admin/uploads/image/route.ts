/**
 * POST /api/admin/uploads/image
 *
 * multipart/form-data 이미지 업로드 (2종)
 * - field "hero": 히어로용 이미지 (max 1920px, 클라이언트 변환)
 * - field "card": 카드용 이미지 (max 800px, 클라이언트 변환)
 * - 허용: jpg, jpeg, png, webp / 최대 10MB
 * - admin 인증: middleware에서 ADMIN_AUTH_COOKIE 검사 (미인증 시 401)
 *
 * 응답: { heroUrl: string, cardUrl: string }
 * - hero만 오면: cardUrl = heroUrl
 * - card만 오면: heroUrl = cardUrl
 * - 둘 다 오면: 각각 업로드 후 URL 반환
 *
 * 기존 호환: field "file" → hero로 처리
 *
 * curl 예시:
 *   curl -X POST .../api/admin/uploads/image \
 *     -H "Cookie: theall_admin_auth=<JWT>" \
 *     -F "hero=@hero.webp" -F "card=@card.webp"
 */
import { NextRequest, NextResponse } from "next/server";
import { getStorageProvider } from "@/lib/storage";

const ALLOWED_EXTENSIONS = ["jpg", "jpeg", "png", "webp"];
const ALLOWED_TYPES = ["image/jpeg", "image/png", "image/webp"];
const MAX_SIZE = 10 * 1024 * 1024; // 10MB

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

function generatePath(suffix: "hero" | "card"): string {
  const now = new Date();
  const yyyy = now.getFullYear();
  const mm = String(now.getMonth() + 1).padStart(2, "0");
  const timestamp = Date.now();
  const random = Math.random().toString(36).slice(2, 10);
  const base = `products/${yyyy}/${mm}/${timestamp}-${random}`;
  return suffix === "hero" ? `${base}.webp` : `${base}-card.webp`;
}

export async function POST(request: NextRequest) {
  try {
    const formData = await request.formData();
    const heroFile = (formData.get("hero") ?? formData.get("file")) as File | null;
    const cardFile = formData.get("card") as File | null;

    if (!heroFile && !cardFile) {
      return NextResponse.json(
        { error: "hero 또는 card 필드 중 하나 이상이 필요합니다." },
        { status: 400 }
      );
    }

    const provider = getStorageProvider();
    let heroUrl: string | null = null;
    let cardUrl: string | null = null;

    if (heroFile && heroFile instanceof File) {
      const validation = isAllowedFile(heroFile);
      if (!validation.ok) {
        return NextResponse.json({ error: validation.error }, { status: 400 });
      }
      const path = generatePath("hero");
      const { url } = await provider.uploadPublicImage({
        file: heroFile,
        path,
        contentType: heroFile.type,
      });
      heroUrl = url;
    }

    if (cardFile && cardFile instanceof File) {
      const validation = isAllowedFile(cardFile);
      if (!validation.ok) {
        return NextResponse.json({ error: validation.error }, { status: 400 });
      }
      const path = generatePath("card");
      const { url } = await provider.uploadPublicImage({
        file: cardFile,
        path,
        contentType: cardFile.type,
      });
      cardUrl = url;
    }

    const hero = heroUrl ?? cardUrl!;
    const card = cardUrl ?? heroUrl!;
    return NextResponse.json({
      heroUrl: hero,
      cardUrl: card,
      url: hero, // 기존 클라이언트 호환 (heroUrl과 동일)
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : "업로드 실패";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
