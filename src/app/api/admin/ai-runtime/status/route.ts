import { NextResponse } from "next/server";
import { requireAdminPermission } from "@/lib/apiAuth";
import { buildRuntimeStatusWithShared } from "@/ai-runtime/observability";

export async function GET() {
  const auth = await requireAdminPermission("settings.manage");
  if (!auth.ok) return auth.res;

  const status = await buildRuntimeStatusWithShared();
  return NextResponse.json(status);
}
