import { afterEach, describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

import {
  ensureRuntimeEnv,
  resetRuntimeEnvLoadedForTests,
} from "@/lib/server/loadRuntimeEnv";
import { buildRuntimeStatusWithShared } from "@/ai-runtime/observability/runtime-status";
import {
  createMemoryRuntimeObservabilityRepository,
  type RuntimeObservabilityEvent,
} from "@/ai-runtime/observability/persistence";
import { AI_PROVIDER_IDS } from "@/ai-runtime/registry";
import { writeFileSync, mkdtempSync, mkdirSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";

describe("admin runtime status env path (PROD-F1)", () => {
  const originalEnv = { ...process.env };

  afterEach(() => {
    resetRuntimeEnvLoadedForTests();
    for (const key of Object.keys(process.env)) {
      if (!(key in originalEnv)) delete process.env[key];
    }
    Object.assign(process.env, originalEnv);
  });

  it("status path sees Hermes credentials + shared flag after ensureRuntimeEnv", async () => {
    const root = mkdtempSync(join(tmpdir(), "admin-status-root-"));
    const hermes = mkdtempSync(join(tmpdir(), "admin-status-hermes-"));
    writeFileSync(
      join(root, ".env.local"),
      "AI_RUNTIME_SHARED_OBSERVABILITY_ENABLED=true\n",
    );
    mkdirSync(hermes, { recursive: true });
    writeFileSync(
      join(hermes, ".env"),
      [
        "GOOGLE_API_KEY=dummy-gemini-admin-status",
        "OPENROUTER_API_KEY=dummy-openrouter-admin-status",
        "NVIDIA_API_KEY=dummy-nvidia-admin-status",
      ].join("\n"),
    );

    for (const k of [
      "GOOGLE_API_KEY",
      "OPENROUTER_API_KEY",
      "NVIDIA_API_KEY",
      "AI_RUNTIME_SHARED_OBSERVABILITY_ENABLED",
      "GROQ_API_KEY",
      "HERMES_CUSTOM_GROQ_CUSTOM_API_KEY",
    ]) {
      delete process.env[k];
    }
    process.env.HERMES_HOME = hermes;

    // Same order as GET /api/admin/ai-runtime/status
    ensureRuntimeEnv({ root });

    const now = new Date("2026-08-27T08:00:00.000Z");
    const events: RuntimeObservabilityEvent[] = [
      {
        eventType: "job_completed",
        occurredAt: "2026-08-27T07:30:00.000Z",
        agentId: "content-strategist",
        workload: "content_draft",
        status: "completed",
        providerId: AI_PROVIDER_IDS.GEMINI_MAIN,
        modelId: "gemini-flash-lite-primary",
        correlationId: "c1",
        metadata: { cronJobId: "marketing-daily" },
      },
    ];
    const repository = createMemoryRuntimeObservabilityRepository(events);

    const status = await buildRuntimeStatusWithShared({
      env: process.env,
      now: () => now,
      repository,
    });

    const byId = Object.fromEntries(status.providers.map((p) => [p.id, p]));
    expect(byId[AI_PROVIDER_IDS.GEMINI_MAIN]?.credentialConfigured).toBe(true);
    expect(byId[AI_PROVIDER_IDS.OPENROUTER_MAIN]?.credentialConfigured).toBe(true);
    expect(byId[AI_PROVIDER_IDS.NVIDIA_MAIN]?.credentialConfigured).toBe(true);
    expect(byId[AI_PROVIDER_IDS.GROQ_MAIN]?.enabled).toBe(false);

    expect(status.shared?.available).toBe(true);
    expect(status.shared?.recentJobs?.length).toBeGreaterThan(0);

    const json = JSON.stringify(status);
    expect(json).not.toContain("dummy-gemini-admin-status");
    expect(json).not.toContain("dummy-openrouter-admin-status");
    expect(json).not.toContain("dummy-nvidia-admin-status");
  });
});
