import { afterEach, describe, expect, it, vi } from "vitest";

import { AI_PROVIDER_IDS } from "@/ai-runtime/registry";
import {
  listRegisteredAdapterProviderIds,
  resetProviderAdapterCacheForTests,
} from "@/ai-runtime/adapters";
import {
  buildRuntimeStatus,
  listWorkloadsWithEligibleModels,
} from "@/ai-runtime/observability";
import { createRuntimeScheduler } from "@/ai-runtime/scheduler";

const SECRET_KEYS = [
  "GOOGLE_GENERATIVE_AI_API_KEY",
  "GEMINI_API_KEY",
  "GOOGLE_API_KEY",
  "OPENROUTER_API_KEY",
  "NVIDIA_API_KEY",
  "GROQ_API_KEY",
];

describe("ai-runtime observability", () => {
  afterEach(() => {
    resetProviderAdapterCacheForTests();
  });

  it("builds summary counts from registry", () => {
    const status = buildRuntimeStatus({
      env: {},
      now: () => new Date("2026-08-27T03:00:00.000Z"),
    });

    expect(status.summary).toEqual({
      enabledProviders: 3,
      disabledProviders: 1,
      registeredModels: 4,
      adaptersReady: 3,
      activeReservations: 0,
    });
    expect(status.generatedAt).toBe("2026-08-27T03:00:00.000Z");
  });

  it("marks Groq disabled with registry statusReason and no adapter", () => {
    const status = buildRuntimeStatus({ env: {} });
    const groq = status.providers.find((provider) => provider.id === AI_PROVIDER_IDS.GROQ_MAIN);

    expect(groq).toMatchObject({
      enabled: false,
      adapterReadiness: "unavailable",
      disabledReason: "Hermes provider invocation unavailable",
      registeredModelCount: 0,
    });
  });

  it("derives adapter readiness from resolver registration", () => {
    const adapterIds = listRegisteredAdapterProviderIds();
    expect(adapterIds).toEqual(
      expect.arrayContaining([
        AI_PROVIDER_IDS.GEMINI_MAIN,
        AI_PROVIDER_IDS.OPENROUTER_MAIN,
        AI_PROVIDER_IDS.NVIDIA_MAIN,
      ]),
    );
    expect(adapterIds).not.toContain(AI_PROVIDER_IDS.GROQ_MAIN);

    const status = buildRuntimeStatus({ env: {} });
    const gemini = status.providers.find((provider) => provider.id === AI_PROVIDER_IDS.GEMINI_MAIN);
    const groq = status.providers.find((provider) => provider.id === AI_PROVIDER_IDS.GROQ_MAIN);

    expect(gemini?.adapterReadiness).toBe("ready");
    expect(groq?.adapterReadiness).toBe("unavailable");
  });

  it("exposes credential configured as boolean only", () => {
    const status = buildRuntimeStatus({
      env: {
        GOOGLE_API_KEY: "super-secret-gemini-key",
        OPENROUTER_API_KEY: "super-secret-openrouter-key",
      },
    });

    const gemini = status.providers.find((provider) => provider.id === AI_PROVIDER_IDS.GEMINI_MAIN);
    const openrouter = status.providers.find(
      (provider) => provider.id === AI_PROVIDER_IDS.OPENROUTER_MAIN,
    );
    const nvidia = status.providers.find((provider) => provider.id === AI_PROVIDER_IDS.NVIDIA_MAIN);

    expect(gemini?.credentialConfigured).toBe(true);
    expect(openrouter?.credentialConfigured).toBe(true);
    expect(nvidia?.credentialConfigured).toBe(false);

    const serialized = JSON.stringify(status);
    for (const key of SECRET_KEYS) {
      expect(serialized).not.toContain(key);
    }
    expect(serialized).not.toContain("super-secret");
    expect(serialized).not.toMatch(/api[_-]?key/i);
  });

  it("includes model slugs, workloads, and provider-managed free routing flag", () => {
    const status = buildRuntimeStatus({ env: {} });
    const openrouter = status.providers.find(
      (provider) => provider.id === AI_PROVIDER_IDS.OPENROUTER_MAIN,
    );

    expect(openrouter?.models).toEqual([
      expect.objectContaining({
        id: "openrouter-free",
        modelSlug: "openrouter/free",
        providerManaged: true,
        freeTierEligible: true,
        workloads: expect.arrayContaining(["classification", "reasoning"]),
      }),
    ]);
  });

  it("lists workloads with eligible enabled models", () => {
    const status = buildRuntimeStatus({ env: {} });
    const workloads = listWorkloadsWithEligibleModels(status);

    expect(workloads).toContain("content_draft");
    expect(workloads).toContain("manager_decision");
    expect(workloads.length).toBeGreaterThan(0);
  });

  it("includes routing snapshot and workload policies", () => {
    const status = buildRuntimeStatus({
      env: {},
      now: () => new Date("2026-08-27T03:00:00.000Z"),
    });

    expect(status.routing).toMatchObject({
      lastHourRequests: 0,
      fallbackCount: 0,
      fallbackRate: 0,
      providerSelections: {},
      recent: [],
    });
    expect(status.routingPolicies?.length).toBeGreaterThan(0);
    expect(status.routingPolicies?.find((policy) => policy.workload === "content_draft")?.orderLabels).toEqual([
      "Gemini",
      "OpenRouter",
      "NVIDIA",
      "Gemini Secondary",
    ]);
  });

  it("includes scheduler snapshot when scheduler is provided", () => {
    const route = vi.fn();
    const scheduler = createRuntimeScheduler({
      router: { route },
      context: { credentialResolver: { resolve: async () => "k" } },
      now: () => new Date("2026-08-27T03:00:00.000Z"),
    });

    const status = buildRuntimeStatus({
      env: {},
      now: () => new Date("2026-08-27T03:00:00.000Z"),
      scheduler,
    });

    expect(status.scheduler).toEqual({
      queued: 0,
      runnable: 0,
      deferred: 0,
      running: 0,
      completedLastHour: 0,
      failedLastHour: 0,
      cancelled: 0,
      recent: [],
    });
  });

  it("includes quota snapshot with unknown health when ledger is empty", () => {
    const status = buildRuntimeStatus({
      env: {},
      now: () => new Date("2026-08-27T03:00:00.000Z"),
    });
    const gemini = status.providers.find((provider) => provider.id === AI_PROVIDER_IDS.GEMINI_MAIN);

    expect(gemini?.quota).toMatchObject({
      health: "unknown",
      minuteRequests: 0,
      dayRequests: 0,
      minuteTokensKnown: false,
      dayTokensKnown: false,
    });

    const serialized = JSON.stringify(status);
    expect(serialized).not.toContain('"events"');
    expect(serialized).not.toContain("super-secret");
  });
});
