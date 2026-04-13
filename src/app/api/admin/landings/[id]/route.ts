import { NextResponse } from "next/server";
import { requireAdminSession } from "@/lib/apiAuth";
import {
  AdminLandingServiceError,
  deleteAdminLanding,
  getAdminLandingById,
  sanitizeLandingInput,
  updateAdminLanding,
} from "@/lib/adminLandings/service";

type PatchBody = {
  title?: string;
  slug?: string;
  templateType?: string;
  status?: "draft" | "published" | "archived";
  summary?: string | null;
  seoTitle?: string | null;
  seoDescription?: string | null;
  sourcePath?: string | null;
  quoteCategory?: string | null;
};

export async function GET(_request: Request, context: { params: Promise<{ id: string }> }) {
  const auth = await requireAdminSession();
  if (!auth.ok) return auth.res;

  const { id } = await context.params;
  try {
    const item = await getAdminLandingById(id);
    if (!item) return NextResponse.json({ error: "Landing not found" }, { status: 404 });
    return NextResponse.json({ item });
  } catch (error) {
    const message = error instanceof Error ? error.message : "랜딩 상세를 불러오지 못했습니다.";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function PATCH(request: Request, context: { params: Promise<{ id: string }> }) {
  const auth = await requireAdminSession();
  if (!auth.ok) return auth.res;

  const { id } = await context.params;
  let body: PatchBody;
  try {
    body = (await request.json()) as PatchBody;
  } catch {
    return NextResponse.json({ error: "JSON 본문이 올바르지 않습니다." }, { status: 400 });
  }

  try {
    const payload = sanitizeLandingInput(body);
    const item = await updateAdminLanding(id, payload);
    if (!item) return NextResponse.json({ error: "Landing not found" }, { status: 404 });
    return NextResponse.json({ item });
  } catch (error) {
    if (error instanceof AdminLandingServiceError) {
      return NextResponse.json({ error: error.message, code: error.code }, { status: error.status });
    }
    const message = error instanceof Error ? error.message : "랜딩 수정 중 오류가 발생했습니다.";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function DELETE(_request: Request, context: { params: Promise<{ id: string }> }) {
  const auth = await requireAdminSession();
  if (!auth.ok) return auth.res;

  const { id } = await context.params;
  try {
    await deleteAdminLanding(id);
  } catch (error) {
    if (error instanceof Error && error.message === "NOT_IMPLEMENTED") {
      return NextResponse.json({ error: "랜딩 삭제는 다음 PR에서 지원됩니다." }, { status: 501 });
    }
    const message = error instanceof Error ? error.message : "랜딩 삭제 중 오류가 발생했습니다.";
    return NextResponse.json({ error: message }, { status: 500 });
  }
  return NextResponse.json({ error: "랜딩 삭제는 다음 PR에서 지원됩니다." }, { status: 501 });
}
