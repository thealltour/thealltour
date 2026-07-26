import { requireAdminSession } from "@/lib/apiAuth";
import { jsonOk } from "@/lib/api/response";
import { adminChatErrorResponse } from "@/lib/adminChat/errors";
import { sendRoomTyping } from "@/lib/adminChat/rooms";

type RouteContext = { params: Promise<{ id: string }> };

type TypingBody = { typing?: boolean };

export async function POST(request: Request, context: RouteContext) {
  const auth = await requireAdminSession();
  if (!auth.ok) return auth.res;

  const { id } = await context.params;
  let body: TypingBody = {};
  try {
    body = (await request.json()) as TypingBody;
  } catch {
    body = {};
  }

  try {
    await sendRoomTyping(auth.session, id, body.typing !== false);
    return jsonOk({ ok: true });
  } catch (e) {
    const errRes = adminChatErrorResponse(e);
    if (errRes) return errRes;
    throw e;
  }
}
