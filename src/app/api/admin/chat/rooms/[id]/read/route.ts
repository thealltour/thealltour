import { requireAdminSession } from "@/lib/apiAuth";
import { jsonOk } from "@/lib/api/response";
import { adminChatErrorResponse } from "@/lib/adminChat/errors";
import { markRoomRead } from "@/lib/adminChat/rooms";

type RouteContext = {
  params: Promise<{ id: string }>;
};

export async function PATCH(_request: Request, context: RouteContext) {
  const auth = await requireAdminSession();
  if (!auth.ok) return auth.res;

  const { id } = await context.params;

  try {
    await markRoomRead(auth.session, id);
    return jsonOk({ ok: true });
  } catch (e) {
    const errRes = adminChatErrorResponse(e);
    if (errRes) return errRes;
    throw e;
  }
}
