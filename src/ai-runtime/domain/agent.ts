/**
 * Known marketing department + specialist agents, plus open string for future agents.
 * Does not bind an agent to a provider or model.
 */
export type AgentId =
  | "marketing-manager"
  | "content-strategist"
  | "governance-auditor"
  | "performance-analyst"
  | "editorial-narrative-planner"
  | "instagram-carousel-planner"
  | "instagram-card-copy-writer"
  | "instagram-caption-writer"
  | "instagram-visual-role-architect"
  | "shared-visual-planner"
  | "card-layout-director"
  | "astra-handoff-writer"
  | "threads-copy-writer"
  | "naver-blog-structure-planner"
  | "naver-blog-copy-writer"
  | "naver-band-copy-writer"
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
