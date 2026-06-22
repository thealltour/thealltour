import { NextResponse } from "next/server";
import { requireAdminSession } from "@/lib/apiAuth";
import { AdminChatError, inviteToGroupRoom, listRoomMembers } from "@/lib/adminChat/rooms";

type RouteContext = {
  params: Promise<{ id: string }>;
};

export async function GET(_request: Request, context: RouteContext) {
  const auth = await requireAdminSession();
  if (!auth.ok) return auth.res;

  const { id } = await context.params;

  try {
    const members = await listRoomMembers(id, auth.session);
    return NextResponse.json({ members });
  } catch (e) {
    if (e instanceof AdminChatError) {
      return NextResponse.json({ message: e.message }, { status: e.status });
    }
    throw e;
  }
}

type PostBody = {
  memberKeys?: string[];
};

export async function POST(request: Request, context: RouteContext) {
  const auth = await requireAdminSession();
  if (!auth.ok) return auth.res;

  const { id } = await context.params;
  const body = (await request.json()) as PostBody;

  try {
    const result = await inviteToGroupRoom(auth.session, id, body.memberKeys ?? []);
    return NextResponse.json(result);
  } catch (e) {
    if (e instanceof AdminChatError) {
      return NextResponse.json({ message: e.message }, { status: e.status });
    }
    throw e;
  }
}
