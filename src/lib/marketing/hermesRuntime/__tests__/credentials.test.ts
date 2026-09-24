import { afterEach, describe, expect, it, vi } from "vitest";

import { AI_RUNTIME_INFERENCE_GATEWAY_TOKEN_ENV } from "@/ai-runtime/integration/constants";
import {
  buildHermesProfileSpawnEnv,
  hermesGatewayTokenTestHooks,
  resolveInferenceGatewayTokenForHermesChild,
} from "@/lib/marketing/hermesRuntime/credentials";

const TOKEN = AI_RUNTIME_INFERENCE_GATEWAY_TOKEN_ENV;

describe("Marketing Hermes gateway credentials", () => {
  const originalToken = process.env[TOKEN];

  afterEach(() => {
    hermesGatewayTokenTestHooks.resolveRuntimeEnv = null;
    if (originalToken === undefined) delete process.env[TOKEN];
    else process.env[TOKEN] = originalToken;
    vi.restoreAllMocks();
  });

  it("C1: explicit env argument nonempty wins over process.env and resolveRuntimeEnv", () => {
    process.env[TOKEN] = "from-process";
    hermesGatewayTokenTestHooks.resolveRuntimeEnv = () => ({ [TOKEN]: "from-resolve" });
    expect(
      resolveInferenceGatewayTokenForHermesChild({ [TOKEN]: "from-explicit" }),
    ).toBe("from-explicit");
  });

  it("C2: process.env fallback when explicit env omits token", () => {
    process.env[TOKEN] = "from-process";
    hermesGatewayTokenTestHooks.resolveRuntimeEnv = () => ({ [TOKEN]: "from-resolve" });
    expect(resolveInferenceGatewayTokenForHermesChild({})).toBe("from-process");
  });

  it("C3: resolveRuntimeEnv fallback when process.env has no token", () => {
    delete process.env[TOKEN];
    hermesGatewayTokenTestHooks.resolveRuntimeEnv = () => ({ [TOKEN]: "from-resolve" });
    expect(resolveInferenceGatewayTokenForHermesChild({})).toBe("from-resolve");
  });

  it("C4: absent token returns undefined (no throw)", () => {
    delete process.env[TOKEN];
    hermesGatewayTokenTestHooks.resolveRuntimeEnv = () => ({});
    expect(resolveInferenceGatewayTokenForHermesChild({})).toBeUndefined();
  });

  it("C5: whitespace-only explicit env does not win", () => {
    process.env[TOKEN] = "from-process";
    hermesGatewayTokenTestHooks.resolveRuntimeEnv = () => ({ [TOKEN]: "from-resolve" });
    expect(resolveInferenceGatewayTokenForHermesChild({ [TOKEN]: "   " })).toBe("from-process");
  });

  it("injects resolved token into spawn env without logging the value", () => {
    const logSpy = vi.spyOn(console, "log").mockImplementation(() => {});
    const errSpy = vi.spyOn(console, "error").mockImplementation(() => {});
    delete process.env[TOKEN];
    hermesGatewayTokenTestHooks.resolveRuntimeEnv = () => ({ [TOKEN]: "secret-token-value" });
    const spawnEnv = buildHermesProfileSpawnEnv({});
    expect(spawnEnv[TOKEN]).toBe("secret-token-value");
    expect(spawnEnv.HERMES_HOME).toBeTruthy();
    const joined = [...logSpy.mock.calls, ...errSpy.mock.calls].flat().join(" ");
    expect(joined).not.toContain("secret-token-value");
  });

  it("documents that named hermes -p does not inherit parent ~/.hermes/.env", () => {
    // Contract comment coverage: without launcher inject, child would miss token.
    delete process.env[TOKEN];
    hermesGatewayTokenTestHooks.resolveRuntimeEnv = () => ({ [TOKEN]: "parent-hermes-env-token" });
    const env = buildHermesProfileSpawnEnv({});
    expect(env[TOKEN]).toBe("parent-hermes-env-token");
  });
});
