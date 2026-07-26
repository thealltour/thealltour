import { requireAdminSession } from "@/lib/apiAuth";
import { jsonError, jsonOk } from "@/lib/api/response";
import { deleteNotice, updateNotice, type NoticeWriteInput } from "@/lib/adminNotices/repository";

export async function PATCH(
  request: Request,
  context: { params: Promise<{ id: string }> },
) {
  const auth = await requireAdminSession();
  if (!auth.ok) return auth.res;

  const { id } = await context.params;
  const body = (await request.json()) as NoticeWriteInput;

  const updates: Record<string, unknown> = {};
  if (body.title !== undefined) {
    const title = body.title.trim();
    if (!title) return jsonError("제목을 입력해 주세요.", 400);
    updates.title = title;
  }
  if (body.content !== undefined) {
    const content = body.content.trim();
    if (!content) return jsonError("내용을 입력해 주세요.", 400);
    updates.content = content;
  }
  if (body.is_published !== undefined) updates.is_published = body.is_published;
  if (body.sort_order !== undefined) {
    updates.sort_order = typeof body.sort_order === "number" ? body.sort_order : null;
  }

  if (Object.keys(updates).length === 0) {
    return jsonError("변경할 항목이 없습니다.", 400);
  }

  const updated = await updateNotice(id, updates);
  if (!updated.ok) {
    return jsonError(updated.message, 500);
  }
  return jsonOk({ message: "공지가 수정되었습니다." });
}

export async function DELETE(
  _request: Request,
  context: { params: Promise<{ id: string }> },
) {
  const auth = await requireAdminSession();
  if (!auth.ok) return auth.res;

  const { id } = await context.params;
  const deleted = await deleteNotice(id);
  if (!deleted.ok) {
    return jsonError(deleted.message, 500);
  }
  return jsonOk({ message: "공지가 삭제되었습니다." });
}
