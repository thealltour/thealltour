import { describe, expect, it } from "vitest";

import {
  PHASE4_SPECIALIST_PROFILE_IDS,
  expectedProductionAliasForProfile,
  mapOpenAiCompatToRuntimeRequest,
  resolveGatewayAlias,
  HERMES_INFERENCE_ALIAS_MARKETING_MANAGER,
} from "@/ai-runtime/gateway";
import {
  QUALITY_SENSITIVE_WORKLOADS,
  WORKLOAD_FALLBACK_ORDER,
  WORKLOAD_MODEL_ORDER,
} from "@/ai-runtime/router/policies";
import { buildRoutingCandidates } from "@/ai-runtime/router";
import { createDefaultAiRuntimeRegistry, AI_MODEL_IDS } from "@/ai-runtime/registry";
import { createInMemoryUsageLedger } from "@/ai-runtime/quota";

describe("Phase 4 specialist routing regression", () => {
  const registry = createDefaultAiRuntimeRegistry();
  const ledger = createInMemoryUsageLedger();

  it("specialist production alias uses content_draft route, not manager_decision", () => {
    expect(WORKLOAD_MODEL_ORDER.content_draft).toEqual([
      AI_MODEL_IDS.GEMINI_FLASH_LITE_PRIMARY,
      AI_MODEL_IDS.OPENROUTER_FREE,
      AI_MODEL_IDS.NVIDIA_NEMOTRON_3_ULTRA,
      AI_MODEL_IDS.GEMINI_FLASH_LITE_SECONDARY,
    ]);
    expect(WORKLOAD_FALLBACK_ORDER.content_draft).toEqual([
      "equivalent",
      "cheaper",
      "fail",
    ]);

    for (const profileId of PHASE4_SPECIALIST_PROFILE_IDS) {
      const alias = expectedProductionAliasForProfile(profileId);
      const entry = resolveGatewayAlias(alias);
      expect(entry.workload).toBe("content_draft");
      expect(QUALITY_SENSITIVE_WORKLOADS.has(entry.workload)).toBe(false);

      const { request } = mapOpenAiCompatToRuntimeRequest({
        model: alias,
        messages: [{ role: "user", content: "draft a caption" }],
      });
      expect(request.workload).toBe("content_draft");
      expect(request.priority).toBe("normal");
      expect(request.agentId).toBe(profileId);

      const candidates = buildRoutingCandidates({
        request,
        registry,
        ledger,
      });
      const modelIds = candidates.map((c) => c.model.id);
      // content_draft includes OpenRouter; manager_decision does not
      expect(modelIds).toContain(AI_MODEL_IDS.OPENROUTER_FREE);
      expect(modelIds[0]).toBe(AI_MODEL_IDS.GEMINI_FLASH_LITE_PRIMARY);
    }
  });

  it("Marketing Manager keeps manager_decision quality-sensitive Gemini-only order", () => {
    const entry = resolveGatewayAlias(HERMES_INFERENCE_ALIAS_MARKETING_MANAGER);
    expect(entry.workload).toBe("manager_decision");
    expect(QUALITY_SENSITIVE_WORKLOADS.has("manager_decision")).toBe(true);
    expect(WORKLOAD_MODEL_ORDER.manager_decision).toEqual([
      AI_MODEL_IDS.GEMINI_FLASH_LITE_PRIMARY,
      AI_MODEL_IDS.GEMINI_FLASH_LITE_SECONDARY,
    ]);
    expect(WORKLOAD_FALLBACK_ORDER.manager_decision).toEqual([
      "equivalent",
      "queue",
      "fail",
    ]);

    const { request } = mapOpenAiCompatToRuntimeRequest({
      model: HERMES_INFERENCE_ALIAS_MARKETING_MANAGER,
      messages: [{ role: "user", content: "decide" }],
    });
    const candidates = buildRoutingCandidates({
      request,
      registry,
      ledger,
    });
    const modelIds = candidates.map((c) => c.model.id);
    expect(modelIds).not.toContain(AI_MODEL_IDS.OPENROUTER_FREE);
    expect(modelIds).not.toContain(AI_MODEL_IDS.NVIDIA_NEMOTRON_3_ULTRA);
  });
});
