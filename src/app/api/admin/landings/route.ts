import { NextResponse } from "next/server";
import { requireAdminSession } from "@/lib/apiAuth";
import {
  AdminLandingServiceError,
  createAdminLanding,
  listAdminLandings,
  sanitizeLandingInput,
} from "@/lib/adminLandings/service";

type PostBody = {
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

export async function GET() {
  const auth = await requireAdminSession();
  if (!auth.ok) return auth.res;

  try {
    const result = await listAdminLandings();
    return NextResponse.json(result);
  } catch (error) {
    const message = error instanceof Error ? error.message : "랜딩 목록을 불러오지 못했습니다.";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function POST(request: Request) {
  const auth = await requireAdminSession();
  if (!auth.ok) return auth.res;

  let body: PostBody;
  try {
    body = (await request.json()) as PostBody;
  } catch {
    return NextResponse.json({ error: "JSON 본문이 올바르지 않습니다." }, { status: 400 });
  }

  try {
    const payload = sanitizeLandingInput({ ...body, status: "draft" });
    const item = await createAdminLanding(payload);
    return NextResponse.json({ item }, { status: 201 });
  } catch (error) {
    if (error instanceof AdminLandingServiceError) {
      return NextResponse.json({ error: error.message, code: error.code }, { status: error.status });
    }
    const message = error instanceof Error ? error.message : "랜딩 생성 중 오류가 발생했습니다.";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
