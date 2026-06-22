import { NextResponse } from "next/server";
import { requireAdminSession } from "@/lib/apiAuth";
import { AdminChatError, listMyChatRooms } from "@/lib/adminChat/rooms";

export async function GET() {
  const auth = await requireAdminSession();
  if (!auth.ok) return auth.res;

  try {
    const rooms = await listMyChatRooms(auth.session);
    return NextResponse.json({ rooms });
  } catch (e) {
    if (e instanceof AdminChatError) {
      return NextResponse.json({ message: e.message }, { status: e.status });
    }
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
    return NextResponse.json({ room });
  } catch (e) {
    if (e instanceof AdminChatError) {
      return NextResponse.json({ message: e.message }, { status: e.status });
    }
    throw e;
  }
}
