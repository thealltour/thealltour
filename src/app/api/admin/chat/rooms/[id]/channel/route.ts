import { NextResponse } from "next/server";
import { requireAdminSession } from "@/lib/apiAuth";
import { AdminChatError, getRoomChannelName } from "@/lib/adminChat/rooms";

type RouteContext = {
  params: Promise<{ id: string }>;
};

export async function GET(_request: Request, context: RouteContext) {
  const auth = await requireAdminSession();
  if (!auth.ok) return auth.res;

  const { id } = await context.params;

  try {
    const channelName = await getRoomChannelName(auth.session, id);
    return NextResponse.json({ channelName });
  } catch (e) {
    if (e instanceof AdminChatError) {
      return NextResponse.json({ message: e.message }, { status: e.status });
    }
    throw e;
  }
}
