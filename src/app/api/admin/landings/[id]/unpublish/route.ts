import { NextResponse } from "next/server";
import { requireAdminSession } from "@/lib/apiAuth";
import { AdminLandingServiceError, unpublishLanding } from "@/lib/adminLandings/service";

export async function POST(_request: Request, context: { params: Promise<{ id: string }> }) {
  const auth = await requireAdminSession();
  if (!auth.ok) return auth.res;

  const { id } = await context.params;
  try {
    const item = await unpublishLanding(id);
    if (!item) {
      return NextResponse.json({ error: "Landing not found" }, { status: 404 });
    }
    return NextResponse.json({ item });
  } catch (error) {
    if (error instanceof AdminLandingServiceError) {
      return NextResponse.json({ error: error.message, code: error.code }, { status: error.status });
    }
    const message = error instanceof Error ? error.message : "Unpublish 처리 중 오류가 발생했습니다.";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
