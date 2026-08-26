/**
 * Known marketing department agents plus open string for future agents.
 * Does not bind an agent to a provider or model.
 */
export type AgentId =
  | "marketing-manager"
  | "content-strategist"
  | "governance-auditor"
  | "performance-analyst"
  | (string & {});

export const RUNTIME_REQUEST_SOURCES = [
  "desktop",
  "group-chat",
  "agent-handoff",
  "cron",
  "department-orchestrator",
  "mcp",
  "system",
] as const;

export type RuntimeRequestSource = (typeof RUNTIME_REQUEST_SOURCES)[number];
