import { afterEach, describe, expect, it, vi } from "vitest";

import { AI_RUNTIME_INFERENCE_GATEWAY_TOKEN_ENV } from "@/ai-runtime/integration/constants";
import {
  buildHermesProfileArgv,
  hermesGatewayTokenTestHooks,
  invokeMarketingHermesAgent,
  requireMarketingHermesRuntimeContract,
} from "@/lib/marketing/hermesRuntime";
import { invokeHermesProfileAsync } from "@/lib/marketing/cron/invokeHermesProfileAsync";

const TOKEN = AI_RUNTIME_INFERENCE_GATEWAY_TOKEN_ENV;

describe("invokeMarketingHermesAgent launcher", () => {
  const originalToken = process.env[TOKEN];
  const originalBin = process.env.HERMES_BIN;

  afterEach(async () => {
    hermesGatewayTokenTestHooks.resolveRuntimeEnv = null;
    const { marketingHermesLauncherTestHooks } = await import(
      "@/lib/marketing/hermesRuntime/launcher"
    );
    marketingHermesLauncherTestHooks.spawnOnce = null;
    if (originalToken === undefined) delete process.env[TOKEN];
    else process.env[TOKEN] = originalToken;
    if (originalBin === undefined) delete process.env.HERMES_BIN;
    else process.env.HERMES_BIN = originalBin;
    vi.restoreAllMocks();
  });

  it("D: builds -p <profile> argv", () => {
    expect(buildHermesProfileArgv("content-strategist", "hello")).toEqual([
      "-p",
      "content-strategist",
      "--yolo",
      "--ignore-rules",
      "-z",
      "hello",
    ]);
  });

  it("D: applies contract timeout when caller omits timeoutMs", async () => {
    const contract = requireMarketingHermesRuntimeContract("content-strategist");
    let seenTimeout = 0;
    await invokeMarketingHermesAgent({
      profileId: "content-strategist",
      prompt: "ping",
      spawnOnce: async (input) => {
        seenTimeout = input.timeoutMs;
        return "ok";
      },
    });
    expect(seenTimeout).toBe(contract.runtime.timeoutMs);
  });

  it("D: caller timeoutMs overrides contract default", async () => {
    let seenTimeout = 0;
    await invokeMarketingHermesAgent({
      profileId: "instagram-visual-role-architect",
      prompt: "ping",
      timeoutMs: 12_345,
      spawnOnce: async (input) => {
        seenTimeout = input.timeoutMs;
        expect(input.profileId).toBe("instagram-visual-role-architect");
        return "ok";
      },
    });
    expect(seenTimeout).toBe(12_345);
  });

  it("D: injects gateway token into child env even when process.env lacks TOKEN", async () => {
    delete process.env[TOKEN];
    hermesGatewayTokenTestHooks.resolveRuntimeEnv = () => ({ [TOKEN]: "injected-from-loader" });
    let childToken: string | undefined;
    await invokeMarketingHermesAgent({
      profileId: "shared-visual-planner",
      prompt: "ping",
      timeoutMs: 1_000,
      spawnOnce: async (input) => {
        childToken = input.env[TOKEN];
        expect(input.env.HERMES_HOME).toBeTruthy();
        return "ok";
      },
    });
    expect(childToken).toBe("injected-from-loader");
  });

  it("E: transport retry preserves attempt count (no double retry)", async () => {
    const contract = requireMarketingHermesRuntimeContract("content-strategist");
    let calls = 0;
    const retries: number[] = [];
    await expect(
      invokeMarketingHermesAgent({
        profileId: "content-strategist",
        prompt: "ping",
        timeoutMs: 1_000,
        withTransportRetry: true,
        sleep: async () => {},
        onTransportRetry: (a) => retries.push(a.attempt),
        spawnOnce: async () => {
          calls += 1;
          throw new Error("content-strategist timed out after 1000ms");
        },
      }),
    ).rejects.toThrow(/timed out/);
    expect(calls).toBe(contract.failurePolicy.transportRetries);
    expect(retries).toEqual(
      Array.from({ length: contract.failurePolicy.transportRetries - 1 }, (_, i) => i + 1),
    );
  });

  it("E: withTransportRetry false does a single attempt (API path)", async () => {
    let calls = 0;
    await expect(
      invokeMarketingHermesAgent({
        profileId: "content-strategist",
        prompt: "ping",
        timeoutMs: 1_000,
        withTransportRetry: false,
        spawnOnce: async () => {
          calls += 1;
          throw new Error("content-strategist timed out after 1000ms");
        },
      }),
    ).rejects.toThrow(/timed out/);
    expect(calls).toBe(1);
  });

  it("E: cron-style path injects token without process.env TOKEN", async () => {
    delete process.env[TOKEN];
    hermesGatewayTokenTestHooks.resolveRuntimeEnv = () => ({ [TOKEN]: "cron-loader-token" });
    let childToken: string | undefined;
    let calls = 0;
    const out = await invokeMarketingHermesAgent({
      profileId: "marketing-manager",
      prompt: "agenda",
      timeoutMs: 1_000,
      withTransportRetry: true,
      sleep: async () => {},
      spawnOnce: async (input) => {
        calls += 1;
        childToken = input.env[TOKEN];
        if (calls === 1) throw new Error("marketing-manager exited 1: 503 service unavailable");
        return "recovered";
      },
    });
    expect(out).toBe("recovered");
    expect(calls).toBe(2);
    expect(childToken).toBe("cron-loader-token");
  });

  it("G: invokeHermesProfileAsync stays single-attempt and token-aware", async () => {
    delete process.env[TOKEN];
    hermesGatewayTokenTestHooks.resolveRuntimeEnv = () => ({ [TOKEN]: "api-compat-token" });
    const { marketingHermesLauncherTestHooks } = await import(
      "@/lib/marketing/hermesRuntime/launcher"
    );
    let calls = 0;
    let childToken: string | undefined;
    let seenProfile = "";
    let seenTimeout = 0;
    marketingHermesLauncherTestHooks.spawnOnce = async (input) => {
      calls += 1;
      seenProfile = input.profileId;
      seenTimeout = input.timeoutMs;
      childToken = input.env[TOKEN];
      return "compat-ok";
    };
    try {
      const out = await invokeHermesProfileAsync("astra-handoff-writer", "brief", 5_000, {});
      expect(out).toBe("compat-ok");
      expect(calls).toBe(1);
      expect(seenProfile).toBe("astra-handoff-writer");
      expect(seenTimeout).toBe(5_000);
      expect(childToken).toBe("api-compat-token");
    } finally {
      marketingHermesLauncherTestHooks.spawnOnce = null;
    }
  });

  it("rejects unknown registry profile when using unified launcher", async () => {
    await expect(
      invokeMarketingHermesAgent({
        profileId: "not-a-real-marketing-profile",
        prompt: "x",
        spawnOnce: async () => "nope",
      }),
    ).rejects.toThrow(/not in runtime registry/i);
  });
});
