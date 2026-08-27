import { afterEach, describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

import {
  collectRuntimeEnvDiagnostics,
  ensureRuntimeEnv,
  getRuntimeEnvBag,
  probeRuntimeEnvSources,
  resetRuntimeEnvLoadedForTests,
  isSharedObservabilityEnabledFromEnv,
} from "@/lib/server/loadRuntimeEnv";
import { buildRuntimeStatus } from "@/ai-runtime/observability/runtime-status";
import { isAiRuntimeSharedObservabilityEnabled } from "@/ai-runtime/observability/persistence/factory";
import { AI_PROVIDER_IDS } from "@/ai-runtime/registry";
import { writeFileSync, mkdtempSync, mkdirSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";

describe("ensureRuntimeEnv HERMES_HOME fallback", () => {
  const originalEnv = { ...process.env };

  afterEach(() => {
    resetRuntimeEnvLoadedForTests();
    for (const key of Object.keys(process.env)) {
      if (!(key in originalEnv)) delete process.env[key];
    }
    Object.assign(process.env, originalEnv);
  });

  it("fills missing provider keys from HERMES_HOME/.env without overwriting", () => {
    const root = mkdtempSync(join(tmpdir(), "runtime-env-root-"));
    const hermes = mkdtempSync(join(tmpdir(), "runtime-env-hermes-"));
    writeFileSync(join(root, ".env.local"), "GOOGLE_API_KEY=project-gemini-key\n");
    mkdirSync(hermes, { recursive: true });
    writeFileSync(
      join(hermes, ".env"),
      [
        "GOOGLE_API_KEY=hermes-should-not-win",
        "OPENROUTER_API_KEY=hermes-openrouter-key",
        "NVIDIA_API_KEY=hermes-nvidia-key",
      ].join("\n"),
    );

    delete process.env.GOOGLE_API_KEY;
    delete process.env.OPENROUTER_API_KEY;
    delete process.env.NVIDIA_API_KEY;
    process.env.HERMES_HOME = hermes;

    ensureRuntimeEnv({ root, force: true });

    const bag = getRuntimeEnvBag();
    expect(bag.GOOGLE_API_KEY).toBe("project-gemini-key");
    expect(bag.OPENROUTER_API_KEY).toBe("hermes-openrouter-key");
    expect(bag.NVIDIA_API_KEY).toBe("hermes-nvidia-key");

    const status = buildRuntimeStatus({ env: bag });
    const byId = Object.fromEntries(status.providers.map((p) => [p.id, p]));
    expect(byId[AI_PROVIDER_IDS.GEMINI_MAIN]?.credentialConfigured).toBe(true);
    expect(byId[AI_PROVIDER_IDS.OPENROUTER_MAIN]?.credentialConfigured).toBe(true);
    expect(byId[AI_PROVIDER_IDS.NVIDIA_MAIN]?.credentialConfigured).toBe(true);

    const json = JSON.stringify(status);
    expect(json).not.toContain("hermes-openrouter-key");
    expect(json).not.toContain("project-gemini-key");
    expect(json).not.toContain("hermes-nvidia-key");
  });

  it("re-applies newly added flags after a prior ensure (no early-return stale gate)", () => {
    const root = mkdtempSync(join(tmpdir(), "runtime-env-reapply-"));
    const hermes = mkdtempSync(join(tmpdir(), "runtime-env-hermes-reapply-"));
    writeFileSync(
      join(root, ".env.local"),
      "NEXT_PUBLIC_SUPABASE_URL=https://example.supabase.co\nSUPABASE_SERVICE_ROLE_KEY=dummy-service-role-sentinel\n",
    );
    mkdirSync(hermes, { recursive: true });
    writeFileSync(
      join(hermes, ".env"),
      [
        "GOOGLE_API_KEY=dummy-gemini-sentinel",
        "OPENROUTER_API_KEY=dummy-openrouter-sentinel",
        "NVIDIA_API_KEY=dummy-nvidia-sentinel",
      ].join("\n"),
    );

    for (const k of [
      "GOOGLE_API_KEY",
      "OPENROUTER_API_KEY",
      "NVIDIA_API_KEY",
      "AI_RUNTIME_SHARED_OBSERVABILITY_ENABLED",
    ]) {
      delete process.env[k];
    }
    process.env.HERMES_HOME = hermes;

    ensureRuntimeEnv({ root });
    expect(isSharedObservabilityEnabledFromEnv()).toBe(false);
    expect(isAiRuntimeSharedObservabilityEnabled()).toBe(false);

    resetRuntimeEnvLoadedForTests();
    delete process.env.OPENROUTER_API_KEY;
    delete process.env.NVIDIA_API_KEY;
    delete process.env.GOOGLE_API_KEY;
    writeFileSync(
      join(root, ".env.local"),
      [
        "NEXT_PUBLIC_SUPABASE_URL=https://example.supabase.co",
        "SUPABASE_SERVICE_ROLE_KEY=dummy-service-role-sentinel",
        "AI_RUNTIME_SHARED_OBSERVABILITY_ENABLED=true",
      ].join("\n"),
    );

    ensureRuntimeEnv({ root });
    expect(isSharedObservabilityEnabledFromEnv()).toBe(true);
    expect(isAiRuntimeSharedObservabilityEnabled()).toBe(true);
    const bag = getRuntimeEnvBag();
    expect(bag.OPENROUTER_API_KEY).toBe("dummy-openrouter-sentinel");
    expect(bag.NVIDIA_API_KEY).toBe("dummy-nvidia-sentinel");
    expect(bag.GOOGLE_API_KEY).toBe("dummy-gemini-sentinel");
  });

  it("probeRuntimeEnvSources reports hermes file + credential booleans without secrets", () => {
    const root = mkdtempSync(join(tmpdir(), "runtime-env-probe-"));
    const hermes = mkdtempSync(join(tmpdir(), "runtime-env-hermes-probe-"));
    writeFileSync(
      join(root, ".env.local"),
      "AI_RUNTIME_SHARED_OBSERVABILITY_ENABLED=true\n",
    );
    mkdirSync(hermes, { recursive: true });
    writeFileSync(
      join(hermes, ".env"),
      "OPENROUTER_API_KEY=dummy-or-probe\nNVIDIA_API_KEY=dummy-nv-probe\nGOOGLE_API_KEY=dummy-gm-probe\n",
    );

    for (const k of [
      "GOOGLE_API_KEY",
      "OPENROUTER_API_KEY",
      "NVIDIA_API_KEY",
      "AI_RUNTIME_SHARED_OBSERVABILITY_ENABLED",
    ]) {
      delete process.env[k];
    }
    process.env.HERMES_HOME = hermes;

    const probe = probeRuntimeEnvSources({ root });
    expect(probe.projectEnvLocalFound).toBe(true);
    expect(probe.hermesEnvFound).toBe(true);
    expect(probe.hermesHome).toBe(hermes);
    expect(probe.sharedObservabilityEnabled).toBe(true);
    expect(probe.credentials).toEqual({
      gemini: true,
      openrouter: true,
      nvidia: true,
    });

    const serialized = JSON.stringify(probe);
    expect(serialized).not.toContain("dummy-or-probe");
    expect(serialized).not.toContain("dummy-nv-probe");
    expect(serialized).not.toContain("dummy-gm-probe");
  });

  it("collectRuntimeEnvDiagnostics never includes secret values", () => {
    const root = mkdtempSync(join(tmpdir(), "runtime-env-diag-"));
    const hermes = mkdtempSync(join(tmpdir(), "runtime-env-hermes-diag-"));
    writeFileSync(join(root, ".env.local"), "AI_RUNTIME_SHARED_OBSERVABILITY_ENABLED=true\n");
    mkdirSync(hermes, { recursive: true });
    writeFileSync(
      join(hermes, ".env"),
      "OPENROUTER_API_KEY=super-secret-openrouter\nNVIDIA_API_KEY=super-secret-nvidia\nGOOGLE_API_KEY=super-secret-google\n",
    );
    for (const k of ["GOOGLE_API_KEY", "OPENROUTER_API_KEY", "NVIDIA_API_KEY"]) {
      delete process.env[k];
    }
    process.env.HERMES_HOME = hermes;
    ensureRuntimeEnv({ root });
    const diag = collectRuntimeEnvDiagnostics();
    expect(diag.OPENROUTER_API_KEY_present).toBe(true);
    expect(diag.NVIDIA_API_KEY_present).toBe(true);
    expect(diag.GOOGLE_API_KEY_present).toBe(true);
    expect(diag.sharedObservabilityEnabled).toBe(true);
    expect(diag.hermesEnvFileExists).toBe(true);
    const json = JSON.stringify(diag);
    expect(json).not.toContain("super-secret");
  });

  it("overlay keeps Hermes keys after process.env values are cleared (Next-like)", () => {
    const root = mkdtempSync(join(tmpdir(), "runtime-env-overlay-"));
    const hermes = mkdtempSync(join(tmpdir(), "runtime-env-hermes-overlay-"));
    writeFileSync(join(root, ".env.local"), "AI_RUNTIME_SHARED_OBSERVABILITY_ENABLED=true\n");
    mkdirSync(hermes, { recursive: true });
    writeFileSync(
      join(hermes, ".env"),
      [
        "GOOGLE_API_KEY=dummy-gemini-overlay",
        "OPENROUTER_API_KEY=dummy-openrouter-overlay",
        "NVIDIA_API_KEY=dummy-nvidia-overlay",
      ].join("\n"),
    );

    for (const k of [
      "GOOGLE_API_KEY",
      "OPENROUTER_API_KEY",
      "NVIDIA_API_KEY",
      "AI_RUNTIME_SHARED_OBSERVABILITY_ENABLED",
    ]) {
      delete process.env[k];
    }
    process.env.HERMES_HOME = hermes;

    ensureRuntimeEnv({ root });
    // Simulate Next process.env not retaining dynamic writes
    delete process.env.OPENROUTER_API_KEY;
    delete process.env.NVIDIA_API_KEY;
    delete process.env.GOOGLE_API_KEY;

    const bag = getRuntimeEnvBag();
    expect(bag.OPENROUTER_API_KEY).toBe("dummy-openrouter-overlay");
    expect(bag.NVIDIA_API_KEY).toBe("dummy-nvidia-overlay");
    expect(bag.GOOGLE_API_KEY).toBe("dummy-gemini-overlay");
    expect(process.env.OPENROUTER_API_KEY).toBeUndefined();

    const status = buildRuntimeStatus({ env: bag });
    const byId = Object.fromEntries(status.providers.map((p) => [p.id, p]));
    expect(byId[AI_PROVIDER_IDS.OPENROUTER_MAIN]?.credentialConfigured).toBe(true);
    expect(byId[AI_PROVIDER_IDS.NVIDIA_MAIN]?.credentialConfigured).toBe(true);
    expect(byId[AI_PROVIDER_IDS.GEMINI_MAIN]?.credentialConfigured).toBe(true);
  });
});
