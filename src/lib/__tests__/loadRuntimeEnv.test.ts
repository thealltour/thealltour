import { afterEach, describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

import {
  ensureRuntimeEnv,
  resetRuntimeEnvLoadedForTests,
} from "@/lib/server/loadRuntimeEnv";
import { buildRuntimeStatus } from "@/ai-runtime/observability/runtime-status";
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

    expect(process.env.GOOGLE_API_KEY).toBe("project-gemini-key");
    expect(process.env.OPENROUTER_API_KEY).toBe("hermes-openrouter-key");
    expect(process.env.NVIDIA_API_KEY).toBe("hermes-nvidia-key");

    const status = buildRuntimeStatus({ env: process.env });
    const byId = Object.fromEntries(status.providers.map((p) => [p.id, p]));
    expect(byId[AI_PROVIDER_IDS.GEMINI_MAIN]?.credentialConfigured).toBe(true);
    expect(byId[AI_PROVIDER_IDS.OPENROUTER_MAIN]?.credentialConfigured).toBe(true);
    expect(byId[AI_PROVIDER_IDS.NVIDIA_MAIN]?.credentialConfigured).toBe(true);

    const json = JSON.stringify(status);
    expect(json).not.toContain("hermes-openrouter-key");
    expect(json).not.toContain("project-gemini-key");
    expect(json).not.toContain("hermes-nvidia-key");
  });
});
