import { describe, expect, it, vi, beforeEach, afterEach } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import AiRuntimeConsole from "@/components/admin/ai-runtime/AiRuntimeConsole";
import type { RuntimeStatusDto } from "@/ai-runtime/observability/types";

const statusFixture: RuntimeStatusDto = {
  generatedAt: "2026-08-27T09:00:00.000Z",
  summary: {
    enabledProviders: 3,
    disabledProviders: 1,
    registeredModels: 5,
    adaptersReady: 3,
    activeReservations: 0,
  },
  providers: [
    {
      id: "gemini-main",
      displayName: "Gemini",
      kind: "gemini",
      enabled: true,
      adapterReadiness: "ready",
      credentialConfigured: true,
      registeredModelCount: 1,
      models: [],
    },
    {
      id: "openrouter-main",
      displayName: "OpenRouter",
      kind: "openrouter",
      enabled: true,
      adapterReadiness: "ready",
      credentialConfigured: true,
      registeredModelCount: 1,
      models: [],
    },
    {
      id: "nvidia-main",
      displayName: "NVIDIA NIM",
      kind: "nvidia",
      enabled: true,
      adapterReadiness: "ready",
      credentialConfigured: true,
      registeredModelCount: 1,
      models: [],
    },
    {
      id: "groq-main",
      displayName: "Groq",
      kind: "groq",
      enabled: false,
      adapterReadiness: "unavailable",
      credentialConfigured: false,
      disabledReason: "Hermes provider invocation unavailable",
      registeredModelCount: 0,
      models: [],
    },
  ],
  shared: {
    available: true,
    lastHour: { requests: 0, completed: 0, failed: 0, fallbacks: 0, providerCalls: 0 },
    providerUsage: [],
    recentJobs: [],
    recentRoutes: [],
  },
};

describe("AiRuntimeConsole credential badges (PROD-F4)", () => {
  beforeEach(() => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () =>
        new Response(JSON.stringify(statusFixture), {
          status: 200,
          headers: { "Content-Type": "application/json" },
        }),
      ),
    );
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("renders Credential Configured for OpenRouter and NVIDIA NIM", async () => {
    render(<AiRuntimeConsole />);
    await waitFor(() => {
      expect(screen.getAllByText("OpenRouter").length).toBeGreaterThan(0);
    });
    expect(screen.getAllByText("NVIDIA NIM").length).toBeGreaterThan(0);
    expect(screen.getAllByText("Credential Configured").length).toBeGreaterThanOrEqual(3);
    expect(screen.getAllByText("Disabled").length).toBeGreaterThanOrEqual(1);
    expect(screen.queryByText("Shared telemetry unavailable")).toBeNull();
  });
});
