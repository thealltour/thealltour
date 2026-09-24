import { afterEach, describe, expect, it, vi } from "vitest";

import { HERMES_INFERENCE_ALIAS_AUTO } from "@/ai-runtime/integration/constants";
import { lookupGatewayAlias } from "@/ai-runtime/gateway/alias-registry";
import {
  MARKETING_HERMES_DIRECT_SPAWN_DEBT,
  collectMarketingHermesAliasPreflightIssues,
  collectMarketingHermesRegistryDrift,
  getMarketingHermesRuntimeContract,
  listMarketingHermesRuntimeContracts,
  listRegisteredMarketingHermesProfileIds,
  resolveHermesProfilesRoot,
} from "@/lib/marketing/hermesRuntime";

describe("Marketing Hermes runtime registry", () => {
  it("A: registers required department + specialist + legacy channel-editor profiles", () => {
    const ids = new Set(listRegisteredMarketingHermesProfileIds());
    for (const id of [
      "content-strategist",
      "marketing-manager",
      "governance-auditor",
      "performance-analyst",
      "editorial-narrative-planner",
      "instagram-carousel-planner",
      "instagram-card-copy-writer",
      "instagram-caption-writer",
      "instagram-visual-role-architect",
      "shared-visual-planner",
      "card-layout-director",
      "astra-handoff-writer",
      "threads-copy-writer",
      "naver-blog-structure-planner",
      "naver-blog-copy-writer",
      "naver-band-copy-writer",
      "channel-editor-instagram",
      "channel-editor-threads",
      "channel-editor-naver-blog",
      "channel-editor-naver-band",
      "channel-editor-kakao",
      "channel-editor-shortform",
    ]) {
      expect(ids.has(id), `missing ${id}`).toBe(true);
    }
  });

  it("B: config drift — modelAlias/provider match committed profile fixtures", () => {
    const drift = collectMarketingHermesRegistryDrift();
    expect(drift).toEqual([]);
  });

  it("B2: live ~/.hermes drift is optional (Pi-only; WSL stubs are skipped)", () => {
    if (process.env.HERMES_RUNTIME_LIVE_PROFILE_DRIFT?.trim() !== "1") {
      return;
    }
    const drift = collectMarketingHermesRegistryDrift(
      listMarketingHermesRuntimeContracts(),
      resolveHermesProfilesRoot(),
    );
    expect(drift).toEqual([]);
  });

  it("documents Layout Director as deterministic production (no LLM wiring)", () => {
    const layout = getMarketingHermesRuntimeContract("card-layout-director");
    expect(layout?.docs?.productionNote).toMatch(/deterministic/i);
  });

  it("specialists keep spike alias theallcloud/auto (no Phase-1 rename)", () => {
    const specialists = listMarketingHermesRuntimeContracts().filter((c) => c.kind === "specialist");
    expect(specialists.length).toBeGreaterThan(0);
    for (const c of specialists) {
      expect(c.runtime.modelAlias).toBe(HERMES_INFERENCE_ALIAS_AUTO);
      expect(c.credentials.inferenceGateway).toBe("launcher_inject");
    }
  });

  it("department bots use profile_env_legacy credential mode", () => {
    for (const id of [
      "content-strategist",
      "marketing-manager",
      "governance-auditor",
      "performance-analyst",
    ]) {
      expect(getMarketingHermesRuntimeContract(id)?.credentials.inferenceGateway).toBe(
        "profile_env_legacy",
      );
    }
  });

  it("F: alias preflight PASS for all registered aliases", () => {
    expect(collectMarketingHermesAliasPreflightIssues()).toEqual([]);
    for (const c of listMarketingHermesRuntimeContracts()) {
      expect(lookupGatewayAlias(c.runtime.modelAlias)).toBeTruthy();
    }
  });

  it("F: unregistered alias fails lookup (thealltour/auto is not registered)", () => {
    expect(lookupGatewayAlias("thealltour/auto")).toBeUndefined();
  });

  it("keeps a direct-spawn debt inventory for remaining non-launcher paths", () => {
    expect(MARKETING_HERMES_DIRECT_SPAWN_DEBT.length).toBeGreaterThan(0);
    expect(MARKETING_HERMES_DIRECT_SPAWN_DEBT.some((d) => d.path.includes("bot"))).toBe(true);
  });
});

describe("Marketing Hermes alias preflight helper", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("reports FAIL when a contract alias is not in the gateway registry", () => {
    const issues = collectMarketingHermesAliasPreflightIssues([
      {
        profileId: "fake-agent",
        kind: "specialist",
        runtime: {
          modelAlias: "thealltour/definitely-not-registered",
          provider: "custom:thealltour-runtime",
          timeoutMs: 1_000,
        },
        credentials: { inferenceGateway: "launcher_inject" },
        failurePolicy: { transportRetries: 1 },
      },
    ]);
    expect(issues).toHaveLength(1);
    expect(issues[0]?.modelAlias).toBe("thealltour/definitely-not-registered");
  });
});
