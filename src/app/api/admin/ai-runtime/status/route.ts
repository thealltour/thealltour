import { writeFileSync } from "node:fs";
import { NextResponse } from "next/server";
import { requireAdminPermission } from "@/lib/apiAuth";
import {
  buildRuntimeStatusWithShared,
  evaluateCredentialConfigured,
} from "@/ai-runtime/observability";
import type { RuntimeStatusDto } from "@/ai-runtime/observability/types";
import {
  RUNTIME_ENV_STORE_INSTANCE_ID,
  logRuntimeEnvDiagnostics,
  resolveRuntimeEnv,
  snapshotCredentialPresence,
} from "@/lib/server/loadRuntimeEnv";

export const dynamic = "force-dynamic";
export const revalidate = 0;
export const runtime = "nodejs";

function allowDiag(): boolean {
  return (
    process.env.NODE_ENV !== "production" ||
    process.env.AI_RUNTIME_ENV_DIAGNOSTIC === "1"
  );
}

function logStatusCredentialDto(status: RuntimeStatusDto): void {
  if (!allowDiag()) return;

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

function logF4RequestDiag(payload: unknown): void {
  if (!allowDiag()) return;
  console.info("[ai-runtime-f4-request]", JSON.stringify(payload));
  try {
    writeFileSync(
      "/tmp/ai-runtime-f4-request-diag.json",
      `${JSON.stringify(payload, null, 2)}\n`,
      { encoding: "utf8", mode: 0o600 },
    );
  } catch {
    // ignore
  }
}

export async function GET() {
  // Phase 0 same-request snapshot BEFORE request-scoped resolve
  const before = snapshotCredentialPresence();

  // Request-scoped SoT — does not depend on instrumentation overlay singleton
  const env = resolveRuntimeEnv({ syncCompatibility: true });

  const after = snapshotCredentialPresence(env);
  logRuntimeEnvDiagnostics("[ai-runtime-env]", env);

  const evaluator = {
    openrouter: evaluateCredentialConfigured("ai-provider/openrouter/main", env),
    nvidia: evaluateCredentialConfigured("ai-provider/nvidia/main", env),
    gemini: evaluateCredentialConfigured("ai-provider/gemini/main", env),
  };

  const auth = await requireAdminPermission("settings.manage");

  const buildAndRespond = async () => {
    const status = await buildRuntimeStatusWithShared({ env });
    logStatusCredentialDto(status);
    logF4RequestDiag({
      runtimeEnvStoreInstanceId: RUNTIME_ENV_STORE_INSTANCE_ID,
      before,
      after,
      evaluator,
      dto: Object.fromEntries(
        status.providers.map((p) => [
          p.id,
          { credentialConfigured: p.credentialConfigured, enabled: p.enabled },
        ]),
      ),
      sharedAvailable: status.shared?.available ?? null,
    });
    return status;
  };

  if (!auth.ok) {
    if (process.env.NODE_ENV !== "production") {
      try {
        await buildAndRespond();
      } catch {
        // ignore diag failures
      }
    }
    return auth.res;
  }

  const status = await buildAndRespond();
  return NextResponse.json(status, {
    headers: {
      "Cache-Control": "no-store, max-age=0",
    },
  });
}
