import { NextResponse } from "next/server";
import { requireAdminPermission } from "@/lib/apiAuth";
import { buildRuntimeStatusWithShared } from "@/ai-runtime/observability";
import {
  ensureRuntimeEnv,
  getRuntimeEnvBag,
  logRuntimeEnvDiagnostics,
} from "@/lib/server/loadRuntimeEnv";

export async function GET() {
  // Fill overlay before auth so diagnostics / credential reads see Hermes keys.
  ensureRuntimeEnv();
  logRuntimeEnvDiagnostics();

  const auth = await requireAdminPermission("settings.manage");
  if (!auth.ok) return auth.res;

  const status = await buildRuntimeStatusWithShared({ env: getRuntimeEnvBag() });
  // Never attach diagnostics to the response body.
  return NextResponse.json(status);
}
