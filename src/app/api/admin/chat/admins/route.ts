import { requireAdminSession } from "@/lib/apiAuth";
import { jsonOk } from "@/lib/api/response";
import { adminChatErrorResponse } from "@/lib/adminChat/errors";
import { listChatAdmins } from "@/lib/adminChat/rooms";

export async function GET() {
  const auth = await requireAdminSession();
  if (!auth.ok) return auth.res;

  try {
    const admins = await listChatAdmins();
    return jsonOk({ admins });
  } catch (e) {
    const errRes = adminChatErrorResponse(e);
    if (errRes) return errRes;
    throw e;
  }
}
