/**
 * POST /api/admin/storage/delete
 * Body: { urls: string[] }
 * — Supabase public URL에 해당하는 파일만 삭제 (product-images, guide-pdfs)
 */
import { NextRequest, NextResponse } from "next/server";
import { deleteSupabaseStorageByPublicUrls } from "@/lib/storage/deleteSupabaseStorageByPublicUrls";

export async function POST(request: NextRequest) {
  try {
    const body = (await request.json()) as { urls?: unknown };
    const urls = Array.isArray(body.urls) ? body.urls.filter((u): u is string => typeof u === "string") : [];
    if (urls.length === 0) {
      return NextResponse.json({ error: "urls 배열이 필요합니다." }, { status: 400 });
    }
    if (urls.length > 50) {
      return NextResponse.json({ error: "한 번에 최대 50개 URL만 삭제할 수 있습니다." }, { status: 400 });
    }

    const result = await deleteSupabaseStorageByPublicUrls(urls);
    return NextResponse.json({
      ok: result.errors.length === 0,
      ...result,
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : "삭제 실패";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
