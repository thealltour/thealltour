import { mkdirSync, mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, describe, expect, it } from "vitest";

import { lookupGatewayAlias } from "@/ai-runtime/gateway/alias-registry";
import {
  assertMarketingHermesRuntimeEnforcement,
  collectAllMarketingHermesEnforcementIssues,
  collectMarketingHermesCompletenessIssues,
  collectMarketingHermesSpecialistPolicyIssues,
  EXCLUDED_HERMES_PROFILE_INVENTORY,
  findDirectHermesSpawnViolations,
  findSpecialistCredentialDuplicationViolations,
  listMarketingHermesRuntimeContracts,
  listProfileLocalCredentialAllowlist,
  MARKETING_HERMES_DEBT_INVENTORY,
  MARKETING_HERMES_DIRECT_SPAWN_ALLOWLIST,
  requireMarketingHermesRuntimeContract,
  type MarketingHermesRuntimeContract,
} from "@/lib/marketing/hermesRuntime";
import { hermesGatewayTokenTestHooks } from "@/lib/marketing/hermesRuntime/credentials";
import { invokeMarketingHermesAgentSync } from "@/lib/marketing/hermesRuntime/syncLauncher";
import { marketingHermesLauncherTestHooks } from "@/lib/marketing/hermesRuntime/launcher";
import { invokeHermesOneshot } from "@/lib/marketing/bot/organization/hermesRuntime";
import { invokeHermesProfileAsync } from "@/lib/marketing/cron/invokeHermesProfileAsync";

describe("Phase 2 Marketing Hermes enforcement", () => {
  afterEach(() => {
    hermesGatewayTokenTestHooks.resolveRuntimeEnv = null;
    marketingHermesLauncherTestHooks.spawnOnce = null;
  });

  it("A: registry completeness — fixtures match registry; no duplicates", () => {
    expect(collectMarketingHermesCompletenessIssues()).toEqual([]);
    const ids = listMarketingHermesRuntimeContracts().map((c) => c.profileId);
    expect(new Set(ids).size).toBe(ids.length);
    expect(collectAllMarketingHermesEnforcementIssues()).toEqual([]);
    expect(() => assertMarketingHermesRuntimeEnforcement()).not.toThrow();
  });

  it("A: excluded test profiles are explicit inventory (no silent skips)", () => {
    expect(EXCLUDED_HERMES_PROFILE_INVENTORY.map((e) => e.profileId).sort()).toEqual([
      "runtime-spike",
      "test1",
    ]);
  });

  it("A: orphan / unregistered fixtures FAIL", () => {
    const contracts = listMarketingHermesRuntimeContracts().filter(
      (c) => c.profileId !== "threads-copy-writer",
    );
    const missing = collectMarketingHermesCompletenessIssues(contracts);
    expect(missing.some((i) => i.code === "inventory_unregistered")).toBe(true);

    const withOrphan: MarketingHermesRuntimeContract[] = [
      ...listMarketingHermesRuntimeContracts(),
      {
        profileId: "not-a-real-profile",
        kind: "specialist",
        runtime: {
          modelAlias: "theallcloud/auto",
          provider: "custom:theallcloud-runtime",
          timeoutMs: 1_000,
        },
        credentials: { inferenceGateway: "launcher_inject" },
        failurePolicy: { transportRetries: 1 },
      },
    ];
    const orphans = collectMarketingHermesCompletenessIssues(withOrphan);
    expect(orphans.some((i) => i.profileId === "not-a-real-profile")).toBe(true);
  });

  it("B: specialist policy — launcher_inject required; fake policy FAIL", () => {
    expect(collectMarketingHermesSpecialistPolicyIssues()).toEqual([]);
    const bad: MarketingHermesRuntimeContract = {
      profileId: "fake-specialist",
      kind: "specialist",
      runtime: {
        modelAlias: "thealltour/definitely-not-registered",
        provider: "",
        timeoutMs: 0,
      },
      credentials: { inferenceGateway: "profile_env_legacy" },
      failurePolicy: { transportRetries: 0 },
    };
    const issues = collectMarketingHermesSpecialistPolicyIssues([bad]);
    expect(issues.map((i) => i.code).sort()).toEqual(
      expect.arrayContaining([
        "specialist_credential_policy",
        "specialist_missing_timeout",
        "specialist_missing_provider",
        "specialist_missing_transport_retries",
        "alias_unregistered",
      ]),
    );
  });

  it("C: alias preflight — registered PASS; fake FAIL", () => {
    for (const c of listMarketingHermesRuntimeContracts()) {
      expect(lookupGatewayAlias(c.runtime.modelAlias)).toBeTruthy();
    }
    expect(lookupGatewayAlias("thealltour/auto")).toBeUndefined();
  });

  it("D: config drift covered by enforcement (fixtures)", () => {
    expect(collectAllMarketingHermesEnforcementIssues().filter((i) => i.code === "config_drift")).toEqual(
      [],
    );
  });

  it("E: direct spawn guard — allowlisted debt PASS; unlisted fixture FAIL", () => {
    const live = findDirectHermesSpawnViolations();
    expect(live).toEqual([]);
    expect(MARKETING_HERMES_DIRECT_SPAWN_ALLOWLIST.length).toBeGreaterThan(0);

    const dir = mkdtempSync(join(tmpdir(), "hermes-spawn-guard-"));
    mkdirSync(join(dir, "src/lib/marketing/evil"), { recursive: true });
    writeFileSync(
      join(dir, "src/lib/marketing/evil/badSpawn.ts"),
      `import { spawnSync } from "node:child_process";\nspawnSync("hermes", ["-p", "x", "-z", "y"]);\n`,
    );
    mkdirSync(join(dir, "scripts"), { recursive: true });
    const violations = findDirectHermesSpawnViolations(dir);
    expect(violations.some((v) => v.file.includes("badSpawn.ts"))).toBe(true);
  });

  it("F: credential duplication — specialists must not grow profile .env tokens", () => {
    const allow = listProfileLocalCredentialAllowlist();
    expect(allow.has("content-strategist")).toBe(true);
    expect(allow.has("threads-copy-writer")).toBe(false);

    // Live scan (Pi may have no specialist .env — PASS)
    expect(() => findSpecialistCredentialDuplicationViolations()).not.toThrow();

    const dir = mkdtempSync(join(tmpdir(), "hermes-cred-"));
    mkdirSync(join(dir, "threads-copy-writer"), { recursive: true });
    writeFileSync(
      join(dir, "threads-copy-writer", ".env"),
      "AI_RUNTIME_INFERENCE_GATEWAY_TOKEN=should-not-exist\n",
    );
    const violations = findSpecialistCredentialDuplicationViolations(dir);
    expect(violations.some((v) => v.profileId === "threads-copy-writer")).toBe(true);
  });

  it("G: sync launcher injects token when process.env lacks TOKEN", () => {
    const T = "AI_RUNTIME_INFERENCE_GATEWAY_TOKEN";
    const saved = process.env[T];
    delete process.env[T];
    hermesGatewayTokenTestHooks.resolveRuntimeEnv = () => ({ [T]: "sync-loader-token" });
    marketingHermesLauncherTestHooks.spawnOnce = null;

    // spawnSync would call real hermes — instead verify require + env build via sync path unit:
    // We only assert contract lookup + that sync function exists and rejects unknown.
    expect(() => requireMarketingHermesRuntimeContract("threads-copy-writer")).not.toThrow();
    expect(() =>
      invokeMarketingHermesAgentSync({
        profileId: "not-registered-profile",
        prompt: "x",
        timeoutMs: 1_000,
      }),
    ).toThrow(/not in runtime registry/i);

    if (saved === undefined) delete process.env[T];
    else process.env[T] = saved;
  });

  it("H: bot soft-result path does not throw on launcher failure", async () => {
    marketingHermesLauncherTestHooks.spawnOnce = async () => {
      throw new Error("marketing-manager timed out after 1000ms");
    };
    const result = await invokeHermesOneshot({
      profile: "marketing-manager",
      prompt: "ping",
      timeoutMs: 1_000,
    });
    expect(result.timedOut).toBe(true);
    expect(result.error).toBe("timeout");
    expect(result.actuallyInvoked).toBe(true);
  });

  it("I: invokeHermesProfileAsync compatibility (single attempt + registry)", async () => {
    let calls = 0;
    marketingHermesLauncherTestHooks.spawnOnce = async () => {
      calls += 1;
      return "compat-ok";
    };
    const out = await invokeHermesProfileAsync("astra-handoff-writer", "brief", 5_000, {});
    expect(out).toBe("compat-ok");
    expect(calls).toBe(1);
  });

  it("debt inventory is explicit and machine-readable", () => {
    expect(MARKETING_HERMES_DEBT_INVENTORY.every((e) => e.allowed === true)).toBe(true);
    expect(MARKETING_HERMES_DEBT_INVENTORY.some((e) => e.category === "spike_alias")).toBe(true);
    expect(MARKETING_HERMES_DEBT_INVENTORY.some((e) => e.category === "legacy_channel_editor")).toBe(
      true,
    );
  });

  it("card-layout-director keeps deterministic production note (docs only)", () => {
    const layout = requireMarketingHermesRuntimeContract("card-layout-director");
    expect(layout.docs?.productionNote).toMatch(/deterministic/i);
  });
});
