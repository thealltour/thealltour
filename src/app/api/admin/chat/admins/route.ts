import { NextResponse } from "next/server";
import { requireAdminSession } from "@/lib/apiAuth";
import { AdminChatError, listChatAdmins } from "@/lib/adminChat/rooms";

export async function GET() {
  const auth = await requireAdminSession();
  if (!auth.ok) return auth.res;

  try {
    const admins = await listChatAdmins();
    return NextResponse.json({ admins });
  } catch (e) {
    if (e instanceof AdminChatError) {
      return NextResponse.json({ message: e.message }, { status: e.status });
    }
    throw e;
  }
}
