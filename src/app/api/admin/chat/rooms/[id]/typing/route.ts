import { NextResponse } from "next/server";
import { requireAdminSession } from "@/lib/apiAuth";
import { AdminChatError, sendRoomTyping } from "@/lib/adminChat/rooms";

type RouteContext = { params: Promise<{ id: string }> };

type TypingBody = { typing?: boolean };

export async function POST(request: Request, context: RouteContext) {
  const auth = await requireAdminSession();
  if (!auth.ok) return auth.res;

  const { id } = await context.params;
  let body: TypingBody = {};
  try {
    body = (await request.json()) as TypingBody;
  } catch {
    body = {};
  }

  try {
    await sendRoomTyping(auth.session, id, body.typing !== false);
    return NextResponse.json({ ok: true });
  } catch (e) {
    if (e instanceof AdminChatError) {
      return NextResponse.json({ message: e.message }, { status: e.status });
    }
    throw e;
  }
}
