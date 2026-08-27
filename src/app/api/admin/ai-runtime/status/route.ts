import { writeFileSync } from "node:fs";
import { NextResponse } from "next/server";
import { requireAdminPermission } from "@/lib/apiAuth";
import { buildRuntimeStatusWithShared } from "@/ai-runtime/observability";
import type { RuntimeStatusDto } from "@/ai-runtime/observability/types";
import {
  ensureRuntimeEnv,
  getRuntimeEnvBag,
  logRuntimeEnvDiagnostics,
} from "@/lib/server/loadRuntimeEnv";

export const dynamic = "force-dynamic";
export const revalidate = 0;
export const runtime = "nodejs";

function logStatusCredentialDto(status: RuntimeStatusDto): void {
  const allow =
    process.env.NODE_ENV !== "production" ||
    process.env.AI_RUNTIME_ENV_DIAGNOSTIC === "1";
  if (!allow) return;

  const credentials = Object.fromEntries(
    status.providers.map((provider) => [
      provider.id,
      {
        credentialConfigured: provider.credentialConfigured,
        enabled: provider.enabled,
      },
    ]),
  );
  const payload = {
    generatedAt: status.generatedAt,
    credentials,
    sharedAvailable: status.shared?.available ?? null,
  };
  console.info("[ai-runtime-status-dto]", JSON.stringify(payload));
  try {
    writeFileSync(
      "/tmp/ai-runtime-status-creds.json",
      `${JSON.stringify(payload, null, 2)}\n`,
      { encoding: "utf8", mode: 0o600 },
    );
  } catch {
    // ignore
  }
}

export async function GET() {
  ensureRuntimeEnv();
  logRuntimeEnvDiagnostics();

  // Capture env bag once after ensure — same object used for DTO build.
  const env = getRuntimeEnvBag();

  const auth = await requireAdminPermission("settings.manage");
  if (!auth.ok) {
    // Dev-only: still build DTO for safe credential boolean diagnostics (no secrets).
    if (process.env.NODE_ENV !== "production") {
      try {
        const status = await buildRuntimeStatusWithShared({ env });
        logStatusCredentialDto(status);
      } catch {
        // ignore diag failures
      }
    }
    return auth.res;
  }

  const status = await buildRuntimeStatusWithShared({ env });
  logStatusCredentialDto(status);

  // Never attach diagnostics/secrets to the response body.
  return NextResponse.json(status, {
    headers: {
      "Cache-Control": "no-store, max-age=0",
    },
  });
}
