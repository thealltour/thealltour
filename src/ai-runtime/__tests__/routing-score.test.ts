import { describe, expect, it } from "vitest";

import type { RuntimeRequest } from "@/ai-runtime/domain/request";
import {
  AI_MODEL_IDS,
  AI_PROVIDER_IDS,
  createDefaultAiRuntimeRegistry,
} from "@/ai-runtime/registry";
import { buildRoutingCandidates } from "@/ai-runtime/router/candidate-builder";
import {
  compareCandidates,
  quotaHealthScore,
  scoreCandidate,
  sortCandidates,
} from "@/ai-runtime/router/scoring";
import { createInMemoryUsageLedger } from "@/ai-runtime/quota";

const NOW = "2026-08-27T03:00:00.000Z";

function sampleRequest(overrides: Partial<RuntimeRequest> = {}): RuntimeRequest {
  return {
    id: "req-score-1",
    createdAt: NOW,
    agentId: "marketing-manager",
    source: "desktop",
    workload: "classification",
    priority: "normal",
    messages: [{ role: "user", content: "Classify this." }],
    ...overrides,
  };
}

describe("routing score", () => {
  const registry = createDefaultAiRuntimeRegistry();
  const geminiPrimary = registry.getModelById(AI_MODEL_IDS.GEMINI_FLASH_LITE_PRIMARY)!;
  const geminiSecondary = registry.getModelById(AI_MODEL_IDS.GEMINI_FLASH_LITE_SECONDARY)!;
  const openrouter = registry.getModelById(AI_MODEL_IDS.OPENROUTER_FREE)!;
  const nvidia = registry.getModelById(AI_MODEL_IDS.NVIDIA_LLAMA_3_3_70B)!;

  it("ranks quota health green > yellow > red", () => {
    expect(quotaHealthScore("green")).toBeGreaterThan(quotaHealthScore("yellow"));
    expect(quotaHealthScore("yellow")).toBeGreaterThan(quotaHealthScore("red"));
    expect(quotaHealthScore("unknown")).toBe(0);
  });

  it("ranks Gemini primary above secondary for same workload without explicit preference", () => {
    const request = sampleRequest({ workload: "content_draft" });
    const primaryScore = scoreCandidate({
      model: geminiPrimary,
      workload: request.workload,
      priority: request.priority,
      quotaHealth: "green",
      request,
    });
    const secondaryScore = scoreCandidate({
      model: geminiSecondary,
      workload: request.workload,
      priority: request.priority,
      quotaHealth: "green",
      request,
    });
    expect(primaryScore).toBeGreaterThan(secondaryScore);
  });

  it("boosts secondary Gemini score when explicitly preferred", () => {
    const request = sampleRequest({
      workload: "governance",
      routing: { preferredModelIds: [AI_MODEL_IDS.GEMINI_FLASH_LITE_SECONDARY] },
    });
    const baselineSecondary = scoreCandidate({
      model: geminiSecondary,
      workload: request.workload,
      priority: request.priority,
      quotaHealth: "green",
      request: sampleRequest({ workload: "governance" }),
    });
    const preferredSecondary = scoreCandidate({
      model: geminiSecondary,
      workload: request.workload,
      priority: request.priority,
      quotaHealth: "green",
      request,
    });
    expect(preferredSecondary).toBeGreaterThan(baselineSecondary);
  });

  it("increases free-tier bonus for background priority vs critical", () => {
    const backgroundScore = scoreCandidate({
      model: openrouter,
      workload: "classification",
      priority: "background",
      quotaHealth: "green",
      request: sampleRequest({ priority: "background" }),
    });
    const criticalScore = scoreCandidate({
      model: openrouter,
      workload: "classification",
      priority: "critical",
      quotaHealth: "green",
      request: sampleRequest({ priority: "critical" }),
    });
    expect(backgroundScore).toBeGreaterThan(criticalScore);
  });

  it("applies preferred provider and model bonuses", () => {
    const request = sampleRequest({
      routing: {
        preferredProviderIds: [AI_PROVIDER_IDS.NVIDIA_MAIN],
        preferredModelIds: [AI_MODEL_IDS.NVIDIA_LLAMA_3_3_70B],
      },
    });
    const boosted = scoreCandidate({
      model: nvidia,
      workload: request.workload,
      priority: request.priority,
      quotaHealth: "green",
      request,
    });
    const baseline = scoreCandidate({
      model: nvidia,
      workload: request.workload,
      priority: request.priority,
      quotaHealth: "green",
      request: sampleRequest(),
    });
    expect(boosted).toBeGreaterThan(baseline);
  });

  it("orders candidates deterministically with stable tie-break", () => {
    const ledger = createInMemoryUsageLedger({ now: () => new Date(NOW) });
    const request = sampleRequest({ workload: "classification" });
    const first = buildRoutingCandidates({
      request,
      registry,
      ledger,
      now: () => new Date(NOW),
    });
    const second = buildRoutingCandidates({
      request,
      registry,
      ledger,
      now: () => new Date(NOW),
    });
    expect(first.map((candidate) => candidate.model.id)).toEqual(
      second.map((candidate) => candidate.model.id),
    );
    expect(first.length).toBeGreaterThan(1);
  });

  it("tie-breaks equal scores by policy rank then model id", () => {
    const ledger = createInMemoryUsageLedger({ now: () => new Date(NOW) });
    const candidates = buildRoutingCandidates({
      request: sampleRequest({ workload: "analysis" }),
      registry,
      ledger,
      now: () => new Date(NOW),
    });
    const sorted = sortCandidates(candidates);
    for (let index = 1; index < sorted.length; index += 1) {
      expect(compareCandidates(sorted[index - 1]!, sorted[index]!)).toBeLessThanOrEqual(0);
    }
  });

  it("excludes blocked quota health models from candidates", () => {
    const ledger = createInMemoryUsageLedger({ now: () => new Date(NOW) });
    ledger.record({
      id: "evt-block",
      requestId: "blocked-req",
      providerId: AI_PROVIDER_IDS.GEMINI_MAIN,
      modelId: AI_MODEL_IDS.GEMINI_FLASH_LITE_PRIMARY,
      startedAt: NOW,
      completedAt: NOW,
      result: "rate_limited",
      retryAfterMs: 60_000,
    });

    const candidates = buildRoutingCandidates({
      request: sampleRequest(),
      registry,
      ledger,
      now: () => new Date(NOW),
    });

    expect(candidates.some((candidate) => candidate.model.id === AI_MODEL_IDS.GEMINI_FLASH_LITE_PRIMARY)).toBe(
      false,
    );
  });

  it("respects hard excluded providers in eligibility", () => {
    const ledger = createInMemoryUsageLedger({ now: () => new Date(NOW) });
    const candidates = buildRoutingCandidates({
      request: sampleRequest({
        routing: { excludedProviderIds: [AI_PROVIDER_IDS.NVIDIA_MAIN] },
      }),
      registry,
      ledger,
      now: () => new Date(NOW),
    });
    expect(candidates.every((candidate) => candidate.model.providerId !== AI_PROVIDER_IDS.NVIDIA_MAIN)).toBe(
      true,
    );
  });

  it("does not treat preferred provider as hard filter", () => {
    const ledger = createInMemoryUsageLedger({ now: () => new Date(NOW) });
    const candidates = buildRoutingCandidates({
      request: sampleRequest({
        routing: { preferredProviderIds: [AI_PROVIDER_IDS.GEMINI_MAIN] },
      }),
      registry,
      ledger,
      now: () => new Date(NOW),
    });
    expect(candidates.some((candidate) => candidate.model.providerId !== AI_PROVIDER_IDS.GEMINI_MAIN)).toBe(
      true,
    );
  });

  it("deprioritizes provider-managed free routing on governance workloads", () => {
    const ledger = createInMemoryUsageLedger({ now: () => new Date(NOW) });
    const governanceCandidates = buildRoutingCandidates({
      request: sampleRequest({ workload: "governance", priority: "high" }),
      registry,
      ledger,
      now: () => new Date(NOW),
    });
    expect(governanceCandidates.some((candidate) => candidate.model.id === AI_MODEL_IDS.OPENROUTER_FREE)).toBe(
      false,
    );
  });
});
