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
    const existing = await getAdminLandingById(id);
    if (!existing) return NextResponse.json({ error: "Landing not found" }, { status: 404 });

    const payload = sanitizeLandingInput(body);
    if (payload.status === "published" && existing.status !== "published") {
      return NextResponse.json(
        {
          error: "공개하려면 Publish API(POST .../publish)를 사용하세요.",
          code: "USE_PUBLISH_ENDPOINT",
        },
        { status: 400 },
      );
    }
    if (payload.status === "draft" && existing.status === "published") {
      return NextResponse.json(
        {
          error: "비공개하려면 Unpublish API(POST .../unpublish)를 사용하세요.",
          code: "USE_UNPUBLISH_ENDPOINT",
        },
        { status: 400 },
      );
    }

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
    const deleted = await deleteAdminLanding(id);
    if (!deleted) {
      return NextResponse.json({ error: "Landing not found" }, { status: 404 });
    }
    return new NextResponse(null, { status: 204 });
  } catch (error) {
    const message = error instanceof Error ? error.message : "랜딩 삭제 중 오류가 발생했습니다.";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
