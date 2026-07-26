import { requireAdminSession } from "@/lib/apiAuth";
import { jsonOk } from "@/lib/api/response";
import { adminChatErrorResponse } from "@/lib/adminChat/errors";
import { listMyChatRooms } from "@/lib/adminChat/rooms";

export async function GET() {
  const auth = await requireAdminSession();
  if (!auth.ok) return auth.res;

  try {
    const rooms = await listMyChatRooms(auth.session);
    return jsonOk({ rooms });
  } catch (e) {
    const errRes = adminChatErrorResponse(e);
    if (errRes) return errRes;
    throw e;
  }
}

type CreateGroupBody = {
  name?: string;
  memberKeys?: string[];
};

export async function POST(request: Request) {
  const auth = await requireAdminSession();
  if (!auth.ok) return auth.res;

  const body = (await request.json()) as CreateGroupBody;

  try {
    const { createGroupRoom } = await import("@/lib/adminChat/rooms");
    const room = await createGroupRoom(auth.session, body.name ?? "", body.memberKeys ?? []);
    return jsonOk({ room });
  } catch (e) {
    const errRes = adminChatErrorResponse(e);
    if (errRes) return errRes;
    throw e;
  }
}
