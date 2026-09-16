import { describe, expect, it } from "vitest";

import { AI_MODEL_IDS } from "@/ai-runtime/registry/models";
import { WORKLOAD_MODEL_ORDER } from "@/ai-runtime/router/policies";
import {
  MARKETING_ROLE_ROUTE_KEYS,
  ROLE_MODEL_ROUTES,
  listRoleRoutingPolicies,
  mapAgentIdToRoleKey,
  resolveModelRoute,
} from "@/ai-runtime/router/role-routes";
import { resolveRequestModelRoute } from "@/ai-runtime/router/scoring";
import type { RuntimeRequest } from "@/ai-runtime/domain/request";

const NOW = "2026-09-16T04:00:00.000Z";

function request(partial: Partial<RuntimeRequest>): RuntimeRequest {
  return {
    id: "req-role-1",
    createdAt: NOW,
    agentId: "marketing-manager",
    source: "cron",
    workload: "manager_decision",
    priority: "background",
    messages: [{ role: "user", content: "x" }],
    ...partial,
  };
}

describe("ORG_ROUTING_ALIGNMENT_V1 role routes", () => {
  it("marketing_manager + manager_decision → role override", () => {
    const resolved = resolveModelRoute({
      role: "marketing_manager",
      workload: "manager_decision",
    });
    expect(resolved.routeSource).toBe("role_override");
    expect(resolved.modelIds).toEqual(ROLE_MODEL_ROUTES.marketing_manager);
    expect(resolved.modelIds).toEqual([
      AI_MODEL_IDS.GEMINI_FLASH_LITE_PRIMARY,
      AI_MODEL_IDS.GEMINI_FLASH_LITE_SECONDARY,
    ]);
  });

  it("story_point_miner + content_draft → story miner role route", () => {
    const resolved = resolveModelRoute({
      role: "story_point_miner",
      workload: "content_draft",
    });
    expect(resolved.routeSource).toBe("role_override");
    expect(resolved.modelIds).toEqual(ROLE_MODEL_ROUTES.story_point_miner);
  });

  it("content_strategist + reasoning → content strategist role route", () => {
    const resolved = resolveModelRoute({
      role: "content_strategist",
      workload: "reasoning",
    });
    expect(resolved.routeSource).toBe("role_override");
    expect(resolved.modelIds).toEqual(ROLE_MODEL_ROUTES.content_strategist);
  });

  it("governance_auditor + governance → governance role route", () => {
    const resolved = resolveModelRoute({
      role: "governance_auditor",
      workload: "governance",
    });
    expect(resolved.routeSource).toBe("role_override");
    expect(resolved.modelIds).toEqual(ROLE_MODEL_ROUTES.governance_auditor);
  });

  it("asset_source_writer + content_draft → asset writer role route", () => {
    const resolved = resolveModelRoute({
      role: "asset_source_writer",
      workload: "content_draft",
    });
    expect(resolved.routeSource).toBe("role_override");
    expect(resolved.modelIds).toEqual(ROLE_MODEL_ROUTES.asset_source_writer);
  });

  it("channel_editor + content_draft → channel editor role route", () => {
    const resolved = resolveModelRoute({
      role: "channel_editor",
      workload: "content_draft",
    });
    expect(resolved.routeSource).toBe("role_override");
    expect(resolved.modelIds).toEqual(ROLE_MODEL_ROUTES.channel_editor);
  });

  it("marketing_agenda_transformer → Gemini→OpenRouter→NVIDIA→Gemini Secondary", () => {
    const resolved = resolveModelRoute({
      role: "marketing_agenda_transformer",
      workload: "reasoning",
    });
    expect(resolved.routeSource).toBe("role_override");
    expect(resolved.modelIds).toEqual(ROLE_MODEL_ROUTES.marketing_agenda_transformer);
    expect(resolved.modelIds[0]).toBe(AI_MODEL_IDS.GEMINI_FLASH_LITE_PRIMARY);
    expect(resolved.modelIds[1]).toBe(AI_MODEL_IDS.OPENROUTER_FREE);
    expect(resolved.modelIds[2]).toBe(AI_MODEL_IDS.NVIDIA_NEMOTRON_3_ULTRA);
    expect(resolved.modelIds[3]).toBe(AI_MODEL_IDS.GEMINI_FLASH_LITE_SECONDARY);
  });

  it("unknown role → current workload default", () => {
    const resolved = resolveModelRoute({
      role: "not_a_real_role",
      workload: "content_draft",
    });
    expect(resolved.routeSource).toBe("workload_default");
    expect(resolved.roleKey).toBeNull();
    expect(resolved.modelIds).toEqual(WORKLOAD_MODEL_ORDER.content_draft);
  });

  it("no role → current workload default", () => {
    const resolved = resolveModelRoute({
      role: null,
      workload: "reasoning",
    });
    expect(resolved.routeSource).toBe("workload_default");
    expect(resolved.modelIds).toEqual(WORKLOAD_MODEL_ORDER.reasoning);
  });

  it("role route failure/fallback does not break provider fallback order semantics", () => {
    const roleResolved = resolveModelRoute({
      role: "story_point_miner",
      workload: "content_draft",
    });
    expect(roleResolved.modelIds.length).toBeGreaterThan(1);
    expect(roleResolved.modelIds.at(-1)).toBe(AI_MODEL_IDS.GEMINI_FLASH_LITE_SECONDARY);

    const workloadFallback = resolveModelRoute({
      role: "",
      workload: "content_draft",
    });
    expect(workloadFallback.modelIds).toEqual(WORKLOAD_MODEL_ORDER.content_draft);
  });

  it("manual Astra roles do NOT appear in automatic provider routes", () => {
    const keys = MARKETING_ROLE_ROUTE_KEYS.join(",");
    expect(keys).not.toMatch(/astra|chatgpt|editorial_director|canonical_asset_editor/i);
    for (const policy of listRoleRoutingPolicies()) {
      expect(policy.roleKey).not.toMatch(/astra|chatgpt/i);
      expect(policy.label).not.toMatch(/Astra|ChatGPT/i);
    }
  });

  it("explicit metadata.roleKey wins over agentId mapping for shared Hermes profile", () => {
    const withRole = resolveRequestModelRoute(
      request({
        agentId: "content-strategist",
        workload: "content_draft",
        metadata: { roleKey: "asset_source_writer" },
      }),
    );
    expect(withRole.routeSource).toBe("role_override");
    expect(withRole.roleKey).toBe("asset_source_writer");
    expect(withRole.modelIds).toEqual(ROLE_MODEL_ROUTES.asset_source_writer);
  });

  it("mapAgentIdToRoleKey maps core agents and performance branches", () => {
    expect(mapAgentIdToRoleKey("marketing-manager", "manager_decision")).toBe("marketing_manager");
    expect(mapAgentIdToRoleKey("marketing-manager", "classification")).toBeNull();
    expect(mapAgentIdToRoleKey("governance-auditor", "governance")).toBe("governance_auditor");
    expect(mapAgentIdToRoleKey("content-strategist", "content_draft")).toBeNull();
    expect(mapAgentIdToRoleKey("performance-analyst", "analysis")).toBe(
      "performance_analysis_basic",
    );
    expect(mapAgentIdToRoleKey("performance-analyst", "reasoning")).toBe(
      "performance_analysis_reasoning",
    );
    expect(mapAgentIdToRoleKey("unknown-bot")).toBeNull();
  });

  it("preserves workload defaults as base policy table", () => {
    expect(WORKLOAD_MODEL_ORDER.classification[0]).toBe(AI_MODEL_IDS.NVIDIA_NEMOTRON_3_ULTRA);
    expect(WORKLOAD_MODEL_ORDER.content_draft[0]).toBe(AI_MODEL_IDS.GEMINI_FLASH_LITE_PRIMARY);
    expect(WORKLOAD_MODEL_ORDER.governance).toEqual([
      AI_MODEL_IDS.GEMINI_FLASH_LITE_PRIMARY,
      AI_MODEL_IDS.GEMINI_FLASH_LITE_SECONDARY,
    ]);
  });
});
