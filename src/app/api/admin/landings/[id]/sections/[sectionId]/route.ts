import { NextResponse } from "next/server";
import { requireAdminSession } from "@/lib/apiAuth";
import { updateLandingSection } from "@/lib/adminLandings/sectionService";

type PatchBody = {
  title?: string;
  description?: string | null;
  body?: string | null;
  isEnabled?: boolean;
  sortOrder?: number;
};

export async function PATCH(
  request: Request,
  context: { params: Promise<{ id: string; sectionId: string }> },
) {
  const auth = await requireAdminSession();
  if (!auth.ok) return auth.res;

  const { id, sectionId } = await context.params;
  let body: PatchBody;
  try {
    body = (await request.json()) as PatchBody;
  } catch {
    return NextResponse.json({ error: "JSON 본문이 올바르지 않습니다." }, { status: 400 });
  }

  const updates: PatchBody = {};
  if (typeof body.title === "string") updates.title = body.title.trim();
  if (body.description === null || typeof body.description === "string") updates.description = body.description;
  if (body.body === null || typeof body.body === "string") updates.body = body.body;
  if (typeof body.isEnabled === "boolean") updates.isEnabled = body.isEnabled;
  if (typeof body.sortOrder === "number" && Number.isFinite(body.sortOrder)) updates.sortOrder = body.sortOrder;
  if (Object.keys(updates).length === 0) {
    return NextResponse.json({ error: "변경할 항목이 없습니다." }, { status: 400 });
  }

  try {
    const item = await updateLandingSection(id, sectionId, updates);
    if (!item) return NextResponse.json({ error: "Section not found" }, { status: 404 });
    return NextResponse.json({ item });
  } catch (error) {
    const message = error instanceof Error ? error.message : "섹션 수정에 실패했습니다.";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
