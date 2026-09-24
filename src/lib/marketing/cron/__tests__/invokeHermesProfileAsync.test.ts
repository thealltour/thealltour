import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { AI_RUNTIME_INFERENCE_GATEWAY_TOKEN_ENV } from "@/ai-runtime/integration/constants";
import {
  buildHermesProfileSpawnEnv,
  hermesGatewayTokenTestHooks,
  resolveInferenceGatewayTokenForHermesChild,
} from "@/lib/marketing/cron/invokeHermesProfileAsync";

const KEY = AI_RUNTIME_INFERENCE_GATEWAY_TOKEN_ENV;

describe("invokeHermesProfileAsync gateway token spawn env", () => {
  const originalToken = process.env[KEY];
  const resolveRuntimeEnv = vi.fn();

  beforeEach(() => {
    resolveRuntimeEnv.mockReset();
    resolveRuntimeEnv.mockReturnValue({});
    hermesGatewayTokenTestHooks.resolveRuntimeEnv = resolveRuntimeEnv;
    delete process.env[KEY];
  });

  afterEach(() => {
    hermesGatewayTokenTestHooks.resolveRuntimeEnv = null;
    if (originalToken === undefined) {
      delete process.env[KEY];
    } else {
      process.env[KEY] = originalToken;
    }
  });

  it("process env token → child receives same", () => {
    process.env[KEY] = "from-process";
    resolveRuntimeEnv.mockReturnValue({ [KEY]: "from-loader" });

    const token = resolveInferenceGatewayTokenForHermesChild({});
    const spawnEnv = buildHermesProfileSpawnEnv({});

    expect(token).toBe("from-process");
    expect(spawnEnv[KEY]).toBe("from-process");
    expect(resolveRuntimeEnv).not.toHaveBeenCalled();
  });

  it("process env absent + runtime env loader token → child receives loader token", () => {
    resolveRuntimeEnv.mockReturnValue({ [KEY]: "from-loader" });

    const token = resolveInferenceGatewayTokenForHermesChild({});
    const spawnEnv = buildHermesProfileSpawnEnv({ HERMES_HOME: "/tmp/hermes-test" });

    expect(token).toBe("from-loader");
    expect(spawnEnv[KEY]).toBe("from-loader");
    expect(spawnEnv.HERMES_HOME).toBe("/tmp/hermes-test");
    expect(resolveRuntimeEnv).toHaveBeenCalledWith({ syncCompatibility: false });
  });

  it("explicit env token wins over process and loader", () => {
    process.env[KEY] = "from-process";
    resolveRuntimeEnv.mockReturnValue({ [KEY]: "from-loader" });

    const token = resolveInferenceGatewayTokenForHermesChild({ [KEY]: "from-explicit" });
    const spawnEnv = buildHermesProfileSpawnEnv({ [KEY]: "from-explicit" });

    expect(token).toBe("from-explicit");
    expect(spawnEnv[KEY]).toBe("from-explicit");
    expect(resolveRuntimeEnv).not.toHaveBeenCalled();
  });

  it("token absent from process + loader empty → spawn key unset", () => {
    resolveRuntimeEnv.mockReturnValue({});

    const token = resolveInferenceGatewayTokenForHermesChild({});
    const spawnEnv = buildHermesProfileSpawnEnv({});

    expect(token).toBeUndefined();
    expect(spawnEnv[KEY]).toBeUndefined();
  });

  it("loader throw → file fallback path does not log secrets", () => {
    resolveRuntimeEnv.mockImplementation(() => {
      throw new Error("server-only");
    });
    hermesGatewayTokenTestHooks.resolveRuntimeEnv = resolveRuntimeEnv;

    const info = vi.spyOn(console, "info").mockImplementation(() => {});
    const log = vi.spyOn(console, "log").mockImplementation(() => {});
    const error = vi.spyOn(console, "error").mockImplementation(() => {});
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});

    // May resolve from real env files on this host; never assert/log the value.
    const token = resolveInferenceGatewayTokenForHermesChild({});
    expect(token === undefined || token.length > 0).toBe(true);

    const leaked = [...info.mock.calls, ...log.mock.calls, ...error.mock.calls, ...warn.mock.calls]
      .map((call) => JSON.stringify(call))
      .join("\n");
    if (token) {
      expect(leaked).not.toContain(token);
    }

    info.mockRestore();
    log.mockRestore();
    error.mockRestore();
    warn.mockRestore();
  });

  it("does not log secret values", () => {
    const info = vi.spyOn(console, "info").mockImplementation(() => {});
    const log = vi.spyOn(console, "log").mockImplementation(() => {});
    const error = vi.spyOn(console, "error").mockImplementation(() => {});
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});

    process.env[KEY] = "super-secret-gateway-token-value";
    buildHermesProfileSpawnEnv({});
    resolveInferenceGatewayTokenForHermesChild({});

    for (const spy of [info, log, error, warn]) {
      for (const call of spy.mock.calls) {
        expect(JSON.stringify(call)).not.toContain("super-secret-gateway-token-value");
      }
    }

    info.mockRestore();
    log.mockRestore();
    error.mockRestore();
    warn.mockRestore();
  });
});
