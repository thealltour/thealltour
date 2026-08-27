import { NextResponse } from "next/server";
import { requireAdminPermission } from "@/lib/apiAuth";
import { buildRuntimeStatus } from "@/ai-runtime/observability";

export async function GET() {
  const auth = await requireAdminPermission("settings.manage");
  if (!auth.ok) return auth.res;

  const status = buildRuntimeStatus();
  return NextResponse.json(status);
}
