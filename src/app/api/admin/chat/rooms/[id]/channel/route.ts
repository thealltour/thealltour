import { requireAdminSession } from "@/lib/apiAuth";
import { jsonOk } from "@/lib/api/response";
import { adminChatErrorResponse } from "@/lib/adminChat/errors";
import { getRoomChannelName } from "@/lib/adminChat/rooms";

type RouteContext = {
  params: Promise<{ id: string }>;
};

export async function GET(_request: Request, context: RouteContext) {
  const auth = await requireAdminSession();
  if (!auth.ok) return auth.res;

  const { id } = await context.params;

  try {
    const channelName = await getRoomChannelName(auth.session, id);
    return jsonOk({ channelName });
  } catch (e) {
    const errRes = adminChatErrorResponse(e);
    if (errRes) return errRes;
    throw e;
  }
}
