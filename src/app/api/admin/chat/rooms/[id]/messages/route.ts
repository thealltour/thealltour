import { requireAdminSession } from "@/lib/apiAuth";
import { jsonOk } from "@/lib/api/response";
import { adminChatErrorResponse } from "@/lib/adminChat/errors";
import { listRoomMessages, sendRoomMessage } from "@/lib/adminChat/rooms";

type RouteContext = {
  params: Promise<{ id: string }>;
};

export async function GET(request: Request, context: RouteContext) {
  const auth = await requireAdminSession();
  if (!auth.ok) return auth.res;

  const { id } = await context.params;
  const url = new URL(request.url);
  const before = url.searchParams.get("before") ?? undefined;
  const limitRaw = url.searchParams.get("limit");
  const limit = limitRaw ? Number(limitRaw) : undefined;

  try {
    const result = await listRoomMessages(auth.session, id, { before, limit });
    return jsonOk(result);
  } catch (e) {
    const errRes = adminChatErrorResponse(e);
    if (errRes) return errRes;
    throw e;
  }
}

type PostBody = {
  body?: string;
  attachmentUrls?: string[];
};

export async function POST(request: Request, context: RouteContext) {
  const auth = await requireAdminSession();
  if (!auth.ok) return auth.res;

  const { id } = await context.params;
  const body = (await request.json()) as PostBody;

  try {
    const message = await sendRoomMessage(auth.session, id, {
      body: body.body ?? "",
      attachmentUrls: body.attachmentUrls,
    });
    return jsonOk({ message });
  } catch (e) {
    const errRes = adminChatErrorResponse(e);
    if (errRes) return errRes;
    throw e;
  }
}
