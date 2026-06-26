import { NextResponse } from "next/server";
import { requireAdminSession } from "@/lib/apiAuth";
import {
  AdminChatError,
  getRoomChannelName,
  inviteToGroupRoom,
  listRoomMembers,
  listRoomMessages,
  markRoomRead,
  sendRoomMessage,
} from "@/lib/adminChat/rooms";

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
    return NextResponse.json(result);
  } catch (e) {
    if (e instanceof AdminChatError) {
      return NextResponse.json({ message: e.message }, { status: e.status });
    }
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
    return NextResponse.json({ message });
  } catch (e) {
    if (e instanceof AdminChatError) {
      return NextResponse.json({ message: e.message }, { status: e.status });
    }
    throw e;
  }
}
