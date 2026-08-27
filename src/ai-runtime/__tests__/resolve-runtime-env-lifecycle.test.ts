import { afterEach, describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

/**
 * Production-like lifecycle: no instrumentation preload, no overlay reliance.
 * process.env has no OR/NV keys — only Hermes file via resolveRuntimeEnv.
 */
import {
  resolveRuntimeEnv,
  resetRuntimeEnvLoadedForTests,
} from "@/lib/server/loadRuntimeEnv";
import { resetRuntimeEnvOverlayForTests } from "@/lib/runtimeEnvStore";
import { buildRuntimeStatusWithShared } from "@/ai-runtime/observability/runtime-status";
import { createMemoryRuntimeObservabilityRepository } from "@/ai-runtime/observability/persistence";
import { AI_PROVIDER_IDS } from "@/ai-runtime/registry";
import { writeFileSync, mkdtempSync, mkdirSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";

describe("resolveRuntimeEnv production lifecycle (PROD-F4)", () => {
  const originalEnv = { ...process.env };

  afterEach(() => {
    resetRuntimeEnvLoadedForTests();
    resetRuntimeEnvOverlayForTests();
    for (const key of Object.keys(process.env)) {
      if (!(key in originalEnv)) delete process.env[key];
    }
    Object.assign(process.env, originalEnv);
  });

  it("status DTO is true for OR/NVIDIA without instrumentation overlay preload", async () => {
    const root = mkdtempSync(join(tmpdir(), "f4-lifecycle-root-"));
    const hermes = mkdtempSync(join(tmpdir(), "f4-lifecycle-hermes-"));
    writeFileSync(
      join(root, ".env.local"),
      "AI_RUNTIME_SHARED_OBSERVABILITY_ENABLED=true\n",
    );
    mkdirSync(hermes, { recursive: true });
    writeFileSync(
      join(hermes, ".env"),
      [
        "GOOGLE_API_KEY=dummy-gemini-f4-lifecycle",
        "OPENROUTER_API_KEY=dummy-openrouter-f4-lifecycle",
        "NVIDIA_API_KEY=dummy-nvidia-f4-lifecycle",
      ].join("\n"),
    );

    // Fresh process.env: no provider keys, no HERMES_HOME (use explicit hermesHome)
    for (const k of [
      "GOOGLE_API_KEY",
      "GEMINI_API_KEY",
      "GOOGLE_GENERATIVE_AI_API_KEY",
      "OPENROUTER_API_KEY",
      "NVIDIA_API_KEY",
      "HERMES_HOME",
      "GROQ_API_KEY",
      "HERMES_CUSTOM_GROQ_CUSTOM_API_KEY",
      "AI_RUNTIME_SHARED_OBSERVABILITY_ENABLED",
    ]) {
      delete process.env[k];
    }
    resetRuntimeEnvOverlayForTests();

    // Request-scoped resolve (syncCompatibility false = do not depend on overlay)
    const env = resolveRuntimeEnv({
      root,
      hermesHome: hermes,
      syncCompatibility: false,
    });

    expect(process.env.OPENROUTER_API_KEY).toBeUndefined();
    expect(env.OPENROUTER_API_KEY).toBe("dummy-openrouter-f4-lifecycle");
    expect(env.NVIDIA_API_KEY).toBe("dummy-nvidia-f4-lifecycle");
    expect(env.GOOGLE_API_KEY).toBe("dummy-gemini-f4-lifecycle");
    expect(env.AI_RUNTIME_SHARED_OBSERVABILITY_ENABLED).toBe("true");

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
    expect(json).not.toContain("dummy-openrouter-f4-lifecycle");
    expect(json).not.toContain("dummy-nvidia-f4-lifecycle");
    expect(json).not.toContain("dummy-gemini-f4-lifecycle");
  });

  it("resolveRuntimeEnv falls back to homedir Hermes when HERMES_HOME unset", () => {
    const root = mkdtempSync(join(tmpdir(), "f4-home-root-"));
    writeFileSync(join(root, ".env.local"), "AI_RUNTIME_SHARED_OBSERVABILITY_ENABLED=true\n");

    for (const k of ["OPENROUTER_API_KEY", "NVIDIA_API_KEY", "GOOGLE_API_KEY", "HERMES_HOME"]) {
      delete process.env[k];
    }
    resetRuntimeEnvOverlayForTests();

    // Point resolver at temp hermes via explicit option (simulates homedir resolve)
    const hermes = mkdtempSync(join(tmpdir(), "f4-home-hermes-"));
    mkdirSync(hermes, { recursive: true });
    writeFileSync(join(hermes, ".env"), "OPENROUTER_API_KEY=dummy-or-home\nNVIDIA_API_KEY=dummy-nv-home\n");

    const env = resolveRuntimeEnv({
      root,
      hermesHome: hermes,
      syncCompatibility: false,
    });
    expect(env.OPENROUTER_API_KEY).toBe("dummy-or-home");
    expect(env.NVIDIA_API_KEY).toBe("dummy-nv-home");
  });
});
