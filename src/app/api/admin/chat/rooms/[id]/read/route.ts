import { NextResponse } from "next/server";
import { requireAdminSession } from "@/lib/apiAuth";
import { AdminChatError, markRoomRead } from "@/lib/adminChat/rooms";

type RouteContext = {
  params: Promise<{ id: string }>;
};

export async function PATCH(_request: Request, context: RouteContext) {
  const auth = await requireAdminSession();
  if (!auth.ok) return auth.res;

  const { id } = await context.params;

  try {
    await markRoomRead(auth.session, id);
    return NextResponse.json({ ok: true });
  } catch (e) {
    if (e instanceof AdminChatError) {
      return NextResponse.json({ message: e.message }, { status: e.status });
    }
    throw e;
  }
}
