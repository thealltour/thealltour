import { NextResponse } from "next/server";
import { requireAdminPermission } from "@/lib/apiAuth";
import { buildRuntimeStatusWithShared } from "@/ai-runtime/observability";
import { ensureRuntimeEnv } from "@/lib/server/loadRuntimeEnv";

export async function GET() {
  const auth = await requireAdminPermission("settings.manage");
  if (!auth.ok) return auth.res;

  ensureRuntimeEnv();
  const status = await buildRuntimeStatusWithShared();
  return NextResponse.json(status);
}
