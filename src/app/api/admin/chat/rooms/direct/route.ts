import { requireAdminSession } from "@/lib/apiAuth";
import { jsonError, jsonOk } from "@/lib/api/response";
import { adminChatErrorResponse } from "@/lib/adminChat/errors";
import { findOrCreateDirectRoom } from "@/lib/adminChat/rooms";

type DirectBody = {
  targetKey?: string;
};

export async function POST(request: Request) {
  const auth = await requireAdminSession();
  if (!auth.ok) return auth.res;

  const body = (await request.json()) as DirectBody;
  if (!body.targetKey?.trim()) {
    return jsonError("대화 상대를 선택하세요.", 400);
  }

  try {
    const room = await findOrCreateDirectRoom(auth.session, body.targetKey.trim());
    return jsonOk({ room });
  } catch (e) {
    const errRes = adminChatErrorResponse(e);
    if (errRes) return errRes;
    throw e;
  }
}
