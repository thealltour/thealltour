import { afterEach, describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

import {
  buildRuntimeStatusWithShared,
  evaluateCredentialConfigured,
} from "@/ai-runtime/observability/runtime-status";
import {
  createMemoryRuntimeObservabilityRepository,
} from "@/ai-runtime/observability/persistence";
import { AI_PROVIDER_IDS } from "@/ai-runtime/registry";
import {
  ensureRuntimeEnv,
  getRuntimeEnvBag,
  resetRuntimeEnvLoadedForTests,
} from "@/lib/server/loadRuntimeEnv";
import { writeFileSync, mkdtempSync, mkdirSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";

describe("Runtime Status credential DTO data-flow (PROD-F3)", () => {
  const originalEnv = { ...process.env };

  afterEach(() => {
    resetRuntimeEnvLoadedForTests();
    for (const key of Object.keys(process.env)) {
      if (!(key in originalEnv)) delete process.env[key];
    }
    Object.assign(process.env, originalEnv);
  });

  it("buildRuntimeStatusWithShared maps dummy env bag to credentialConfigured booleans", async () => {
    const env = {
      GOOGLE_API_KEY: "dummy-gemini",
      OPENROUTER_API_KEY: "dummy-openrouter",
      NVIDIA_API_KEY: "dummy-nvidia",
    };

    expect(
      evaluateCredentialConfigured("ai-provider/openrouter/main", env),
    ).toBe(true);
    expect(evaluateCredentialConfigured("ai-provider/nvidia/main", env)).toBe(true);
    expect(evaluateCredentialConfigured("ai-provider/gemini/main", env)).toBe(true);

    const status = await buildRuntimeStatusWithShared({
      env,
      repository: createMemoryRuntimeObservabilityRepository([]),
    });

    const byId = Object.fromEntries(status.providers.map((p) => [p.id, p]));
    expect(byId[AI_PROVIDER_IDS.GEMINI_MAIN]?.credentialConfigured).toBe(true);
    expect(byId[AI_PROVIDER_IDS.OPENROUTER_MAIN]?.credentialConfigured).toBe(true);
    expect(byId[AI_PROVIDER_IDS.NVIDIA_MAIN]?.credentialConfigured).toBe(true);
    expect(byId[AI_PROVIDER_IDS.GROQ_MAIN]?.enabled).toBe(false);
    expect(status.shared?.available).toBe(true);

    const json = JSON.stringify(status);
    expect(json).not.toContain("dummy-gemini");
    expect(json).not.toContain("dummy-openrouter");
    expect(json).not.toContain("dummy-nvidia");
  });

  it("forwards env through withShared even when shared repo is injected", async () => {
    const status = await buildRuntimeStatusWithShared({
      env: {
        OPENROUTER_API_KEY: "dummy-openrouter-only",
      },
      repository: createMemoryRuntimeObservabilityRepository([]),
    });
    const byId = Object.fromEntries(status.providers.map((p) => [p.id, p]));
    expect(byId[AI_PROVIDER_IDS.OPENROUTER_MAIN]?.credentialConfigured).toBe(true);
    expect(byId[AI_PROVIDER_IDS.NVIDIA_MAIN]?.credentialConfigured).toBe(false);
    expect(byId[AI_PROVIDER_IDS.GEMINI_MAIN]?.credentialConfigured).toBe(false);
  });

  it("admin route dependency path: ensureRuntimeEnv → getRuntimeEnvBag → status DTO", async () => {
    const root = mkdtempSync(join(tmpdir(), "f3-status-root-"));
    const hermes = mkdtempSync(join(tmpdir(), "f3-status-hermes-"));
    writeFileSync(
      join(root, ".env.local"),
      "AI_RUNTIME_SHARED_OBSERVABILITY_ENABLED=true\n",
    );
    mkdirSync(hermes, { recursive: true });
    writeFileSync(
      join(hermes, ".env"),
      [
        "GOOGLE_API_KEY=dummy-gemini-f3",
        "OPENROUTER_API_KEY=dummy-openrouter-f3",
        "NVIDIA_API_KEY=dummy-nvidia-f3",
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

    ensureRuntimeEnv({ root });
    const env = getRuntimeEnvBag();
    // Simulate Next wiping process.env after bag capture
    delete process.env.OPENROUTER_API_KEY;
    delete process.env.NVIDIA_API_KEY;
    delete process.env.GOOGLE_API_KEY;

    const status = await buildRuntimeStatusWithShared({
      env,
      repository: createMemoryRuntimeObservabilityRepository([]),
    });
    const byId = Object.fromEntries(status.providers.map((p) => [p.id, p]));
    expect(byId[AI_PROVIDER_IDS.GEMINI_MAIN]?.credentialConfigured).toBe(true);
    expect(byId[AI_PROVIDER_IDS.OPENROUTER_MAIN]?.credentialConfigured).toBe(true);
    expect(byId[AI_PROVIDER_IDS.NVIDIA_MAIN]?.credentialConfigured).toBe(true);
    expect(status.shared?.available).toBe(true);

    const json = JSON.stringify(status);
    expect(json).not.toContain("dummy-openrouter-f3");
  });
});
