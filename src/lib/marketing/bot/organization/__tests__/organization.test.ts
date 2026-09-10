import { describe, expect, it } from "vitest";
import { existsSync } from "node:fs";
import path from "node:path";

import { MARKETING_BOT_TOOL_NAMES } from "@/lib/marketing/bot/types";
import { MARKETING_BOT_CONTRACT_FILES, MARKETING_BOT_ROLES } from "@/lib/marketing/bot/contracts";
import {
  DEPARTMENT_POLICY_PATH,
  MARKETING_AGENT_HANDOFF_TARGETS,
  MARKETING_AGENT_ROLES,
} from "@/lib/marketing/bot/organization/types";
import { MARKETING_AGENT_ROLE_CONFIGS } from "@/lib/marketing/bot/organization/roles";
import { MARKETING_SKILL_MATRIX, allowedToolsForRole, desktopExposedToolsForRole } from "@/lib/marketing/bot/organization/skillMatrix";
import { DEPARTMENT_FORBIDDEN_ACTIONS } from "@/lib/marketing/bot/organization/policies";

describe("marketing department organization", () => {
  it("keeps unique role ids", () => {
    expect(new Set(MARKETING_AGENT_ROLES).size).toBe(MARKETING_AGENT_ROLES.length);
    expect(MARKETING_AGENT_ROLES).toEqual([
      "marketing_manager",
      "content_strategist",
      "governance_auditor",
      "performance_analyst",
    ]);
  });

  it("covers every MCP tool in the matrix and forbids publish tools", () => {
    for (const role of MARKETING_AGENT_ROLES) {
      expect(Object.keys(MARKETING_SKILL_MATRIX[role]).sort()).toEqual([...MARKETING_BOT_TOOL_NAMES].sort());
    }
    expect(MARKETING_BOT_TOOL_NAMES.some((tool) => /publish|send|post|delete|archive/i.test(tool))).toBe(false);
  });

  it("denies Content Strategist approval and publish paths", () => {
    const content = MARKETING_AGENT_ROLE_CONFIGS.content_strategist;
    expect(content.toolPermissions.prepare_marketing_task).toBe("deny");
    expect(content.toolPermissions.review_generated_content).toBe("deny");
    expect(content.forbiddenActions).toEqual(expect.arrayContaining(["auto_approve", "publish", "override_governance"]));
    expect(content.autoPublishAllowed).toBe(false);
  });

  it("keeps Governance Auditor from publishing", () => {
    const auditor = MARKETING_AGENT_ROLE_CONFIGS.governance_auditor;
    expect(auditor.allowedTools).not.toContain("prepare_marketing_task");
    expect(auditor.forbiddenActions).toEqual(expect.arrayContaining(["publish", "auto_approve"]));
    expect(auditor.autoPublishAllowed).toBe(false);
  });

  it("gives Marketing Manager valid handoff targets", () => {
    const manager = MARKETING_AGENT_ROLE_CONFIGS.marketing_manager;
    for (const target of manager.handoffTargets) {
      expect(MARKETING_AGENT_HANDOFF_TARGETS).toContain(target);
    }
    expect(manager.handoffTargets).toEqual(
      expect.arrayContaining(["content_strategist", "governance_auditor", "performance_analyst", "human_owner"]),
    );
    expect(allowedToolsForRole("marketing_manager")).toContain("prepare_marketing_task");
    expect(allowedToolsForRole("marketing_manager")).toContain("run_department_orchestration");
    expect(allowedToolsForRole("performance_analyst")).not.toContain("run_department_orchestration");
    expect(allowedToolsForRole("performance_analyst")).toContain("get_performance_evidence");
    expect(allowedToolsForRole("content_strategist")).not.toContain("get_performance_evidence");
  });

  it("exposes Desktop MCP include as allow ∪ optional (never deny)", () => {
    expect(desktopExposedToolsForRole("content_strategist")).toEqual(
      expect.arrayContaining([
        "get_content_assignment",
        "get_assignment_research_evidence",
        "get_governance_review",
        "get_assignment_governance_status",
      ]),
    );
    expect(desktopExposedToolsForRole("content_strategist")).not.toContain("prepare_marketing_task");
    expect(desktopExposedToolsForRole("content_strategist")).not.toContain("create_content_assignment");
    expect(desktopExposedToolsForRole("marketing_manager")).toEqual(
      expect.arrayContaining(["get_research_context", "create_content_assignment", "run_department_orchestration"]),
    );
    expect(desktopExposedToolsForRole("governance_auditor")).toEqual(
      expect.arrayContaining(["get_governance_review", "get_assignment_governance_status"]),
    );
    expect(desktopExposedToolsForRole("performance_analyst")).toContain("get_research_context");
    expect(desktopExposedToolsForRole("performance_analyst")).not.toContain("evaluate_governance");

    for (const role of MARKETING_AGENT_ROLES) {
      for (const tool of desktopExposedToolsForRole(role)) {
        expect(MARKETING_SKILL_MATRIX[role][tool]).not.toBe("deny");
      }
      for (const tool of MARKETING_BOT_TOOL_NAMES) {
        if (MARKETING_SKILL_MATRIX[role][tool] === "deny") {
          expect(desktopExposedToolsForRole(role)).not.toContain(tool);
        }
      }
    }
  });

  it("keeps Core 4 only — no PREPARE specialist roles in registry", () => {
    expect(MARKETING_AGENT_ROLES).toHaveLength(4);
    expect(MARKETING_AGENT_ROLES).not.toContain("channel_producer");
    expect(MARKETING_AGENT_ROLES).not.toContain("creative_director");
  });

  it("attaches department policy and disables auto-publish on every role", () => {
    for (const role of MARKETING_AGENT_ROLES) {
      const config = MARKETING_AGENT_ROLE_CONFIGS[role];
      expect(config.departmentPolicy).toBe(DEPARTMENT_POLICY_PATH);
      expect(config.autoPublishAllowed).toBe(false);
      expect(config.forbiddenActions).toEqual(expect.arrayContaining([...DEPARTMENT_FORBIDDEN_ACTIONS]));
    }
  });

  it("keeps STEP 2-3 contract aliases", () => {
    expect(MARKETING_BOT_ROLES).toEqual(["marketing_manager", "content", "governance"]);
    expect(MARKETING_BOT_CONTRACT_FILES.content).toContain("content-bot.md");
    expect(MARKETING_BOT_CONTRACT_FILES.content_strategist).toContain("content-strategist.md");
  });

  it("points at existing contract and prompt files", () => {
    const root = process.cwd();
    for (const role of MARKETING_AGENT_ROLES) {
      const config = MARKETING_AGENT_ROLE_CONFIGS[role];
      expect(existsSync(path.join(root, config.contractFile))).toBe(true);
      expect(existsSync(path.join(root, config.promptFile))).toBe(true);
      expect(existsSync(path.join(root, config.departmentPolicy))).toBe(true);
    }
  });
});
