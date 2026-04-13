import { NextResponse } from "next/server";
import { requireAdminSession } from "@/lib/apiAuth";
import { listLandingSections } from "@/lib/adminLandings/sectionService";

export async function GET(_request: Request, context: { params: Promise<{ id: string }> }) {
  const auth = await requireAdminSession();
  if (!auth.ok) return auth.res;

  const { id } = await context.params;
  try {
    const items = await listLandingSections(id);
    return NextResponse.json({ items });
  } catch (error) {
    const message = error instanceof Error ? error.message : "섹션 목록을 불러오지 못했습니다.";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
