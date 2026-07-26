import { requireAdminSession } from "@/lib/apiAuth";
import { jsonError, jsonOk } from "@/lib/api/response";
import { insertNotice, listNotices, type NoticeWriteInput } from "@/lib/adminNotices/repository";

export async function GET() {
  const auth = await requireAdminSession();
  if (!auth.ok) return auth.res;

  const result = await listNotices();
  if (result.errorMessage) {
    return jsonError(result.errorMessage, 500);
  }
  return jsonOk(result.data ?? []);
}

export async function POST(request: Request) {
  const auth = await requireAdminSession();
  if (!auth.ok) return auth.res;

  const body = (await request.json()) as NoticeWriteInput;
  const title = body.title?.trim() ?? "";
  const content = body.content?.trim() ?? "";
  if (!title || !content) {
    return jsonError("제목과 내용은 필수입니다.", 400);
  }

  const inserted = await insertNotice({
    title,
    content,
    is_published: body.is_published ?? true,
    sort_order: typeof body.sort_order === "number" ? body.sort_order : null,
  });

  if (!inserted.ok) {
    return jsonError(inserted.message, 500);
  }
  return jsonOk({ message: "공지가 등록되었습니다." }, { status: 201 });
}
