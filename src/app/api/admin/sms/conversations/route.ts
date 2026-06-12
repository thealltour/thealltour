import { NextResponse } from "next/server";
import { requireAdminSession } from "@/lib/apiAuth";
import { listSmsConversations } from "@/lib/sms/smsConversations";

export async function GET(request: Request) {
  const auth = await requireAdminSession();
  if (!auth.ok) return auth.res;

  const url = new URL(request.url);
  const filterRaw = url.searchParams.get("filter")?.trim() ?? "all";
  const filter =
    filterRaw === "unread" || filterRaw === "unmatched" ? filterRaw : ("all" as const);
  const q = url.searchParams.get("q")?.trim() ?? "";
  const pageRaw = Number.parseInt(url.searchParams.get("page") ?? "1", 10);
  const page = Number.isFinite(pageRaw) && pageRaw > 0 ? pageRaw : 1;
  const pageSize = 30;

  const result = await listSmsConversations({ filter, q, page, pageSize });
  return NextResponse.json(result);
}
