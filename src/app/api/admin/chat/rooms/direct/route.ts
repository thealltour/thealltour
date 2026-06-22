import { NextResponse } from "next/server";
import { requireAdminSession } from "@/lib/apiAuth";
import { AdminChatError, findOrCreateDirectRoom } from "@/lib/adminChat/rooms";

type DirectBody = {
  targetKey?: string;
};

export async function POST(request: Request) {
  const auth = await requireAdminSession();
  if (!auth.ok) return auth.res;

  const body = (await request.json()) as DirectBody;
  if (!body.targetKey?.trim()) {
    return NextResponse.json({ message: "대화 상대를 선택하세요." }, { status: 400 });
  }

  try {
    const room = await findOrCreateDirectRoom(auth.session, body.targetKey.trim());
    return NextResponse.json({ room });
  } catch (e) {
    if (e instanceof AdminChatError) {
      return NextResponse.json({ message: e.message }, { status: e.status });
    }
    throw e;
  }
}
