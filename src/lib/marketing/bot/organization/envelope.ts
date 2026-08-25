import { jsonContainsForbiddenBotLeak, stripForbiddenBotData } from "@/lib/marketing/bot/sanitize";
import { MarketingBotValidationError } from "@/lib/marketing/bot/errors";

export const HERMES_MARKETING_PROFILE_IDS = [
  "marketing-manager",
  "content-strategist",
  "governance-auditor",
  "performance-analyst",
] as const;

export type HermesMarketingProfileId = (typeof HERMES_MARKETING_PROFILE_IDS)[number];

export const HANDOFF_TASK_TYPES = [
  "performance_brief",
  "content_draft",
  "governance_review",
  "human_approval",
] as const;

export type HandoffTaskType = (typeof HANDOFF_TASK_TYPES)[number];

export type HandoffActor = HermesMarketingProfileId | "human_owner";

/** MCP does not receive this. Prompt/profile ACL only until server identity exists. */
export const AGENT_IDENTITY_ENFORCEMENT = "prompt_profile_acl_only" as const;

export const MAX_AUTO_REVISION_ROUNDS = 1;

export type HandoffEnvelope<T> = {
  sourceAgent: HandoffActor;
  targetAgent: HandoffActor;
  taskType: HandoffTaskType;
  productId: string | null;
  channel: string | null;
  goal: string | null;
  contextMemoryRefs: string[];
  payload: T;
};

export function createHandoffEnvelope<T>(input: HandoffEnvelope<T>): HandoffEnvelope<T> {
  if (jsonContainsForbiddenBotLeak(input)) {
    throw new MarketingBotValidationError("Handoff envelope cannot include PII or embedding vectors");
  }
  return stripForbiddenBotData(input);
}

export function serializeHandoffEnvelope<T>(envelope: HandoffEnvelope<T>): string {
  return JSON.stringify(createHandoffEnvelope(envelope));
}

export function parseHandoffEnvelope<T>(raw: string): HandoffEnvelope<T> {
  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    throw new MarketingBotValidationError("Handoff envelope must be JSON");
  }
  if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
    throw new MarketingBotValidationError("Handoff envelope must be an object");
  }
  const value = parsed as HandoffEnvelope<T>;
  if (!value.sourceAgent || !value.targetAgent || !value.taskType) {
    throw new MarketingBotValidationError("Handoff envelope requires sourceAgent, targetAgent, and taskType");
  }
  return createHandoffEnvelope(value);
}

export function extractJsonObject(text: string): unknown {
  const start = text.indexOf("{");
  const end = text.lastIndexOf("}");
  if (start < 0 || end <= start) {
    throw new MarketingBotValidationError("No JSON object in agent output");
  }
  return JSON.parse(text.slice(start, end + 1));
}
