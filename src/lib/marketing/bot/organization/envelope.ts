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

export type JsonExtractMode = "whole_json" | "fenced_json" | "balanced_object";

export type JsonExtractFailureClass =
  | "empty_output"
  | "fenced_json"
  | "multiple_json_objects"
  | "truncated_json"
  | "malformed_json"
  | "prose_wrapped_json"
  | "unknown";

export type JsonExtractSuccess = {
  ok: true;
  value: unknown;
  mode: JsonExtractMode;
};

export type JsonExtractFailure = {
  ok: false;
  failureClass: JsonExtractFailureClass;
  message: string;
};

export type JsonExtractResult = JsonExtractSuccess | JsonExtractFailure;

function tryParseObject(text: string): unknown | null {
  try {
    const value = JSON.parse(text) as unknown;
    if (!value || typeof value !== "object" || Array.isArray(value)) return null;
    return value;
  } catch {
    return null;
  }
}

/** Scan one balanced `{...}` starting at `start`, respecting JSON strings. Returns end index or -1 if truncated. */
export function scanBalancedJsonObjectEnd(text: string, start: number): number {
  if (text[start] !== "{") return -1;
  let depth = 0;
  let inString = false;
  let escape = false;
  for (let i = start; i < text.length; i += 1) {
    const ch = text[i]!;
    if (inString) {
      if (escape) {
        escape = false;
        continue;
      }
      if (ch === "\\") {
        escape = true;
        continue;
      }
      if (ch === '"') inString = false;
      continue;
    }
    if (ch === '"') {
      inString = true;
      continue;
    }
    if (ch === "{") depth += 1;
    else if (ch === "}") {
      depth -= 1;
      if (depth === 0) return i;
    }
  }
  return -1;
}

export function findTopLevelJsonObjects(text: string): string[] {
  const objects: string[] = [];
  let i = 0;
  while (i < text.length) {
    if (text[i] !== "{") {
      i += 1;
      continue;
    }
    const end = scanBalancedJsonObjectEnd(text, i);
    if (end < 0) break;
    objects.push(text.slice(i, end + 1));
    i = end + 1;
  }
  return objects;
}

function stripMarkdownFencePayload(text: string): { payload: string; wasFenced: boolean } {
  const trimmed = text.trim();
  const whole = /^```(?:json)?\s*\r?\n?([\s\S]*?)\r?\n?```$/i.exec(trimmed);
  if (whole?.[1] != null) {
    return { payload: whole[1].trim(), wasFenced: true };
  }
  const embedded = /```(?:json)?\s*\r?\n?([\s\S]*?)\r?\n?```/i.exec(trimmed);
  if (embedded?.[1] != null) {
    return { payload: embedded[1].trim(), wasFenced: true };
  }
  return { payload: trimmed, wasFenced: false };
}

function looksTruncatedJson(text: string): boolean {
  const start = text.indexOf("{");
  if (start < 0) return false;
  return scanBalancedJsonObjectEnd(text, start) < 0;
}

/**
 * Deterministic JSON object extraction for LLM outputs.
 * Supports bare JSON, markdown fences, and short prose around exactly one object.
 * Rejects ambiguous multiple top-level objects and truncated/malformed JSON.
 */
export function extractJsonObjectResult(text: string): JsonExtractResult {
  const raw = String(text ?? "");
  if (!raw.trim()) {
    return { ok: false, failureClass: "empty_output", message: "empty_agent_output" };
  }

  const whole = tryParseObject(raw.trim());
  if (whole) {
    return { ok: true, value: whole, mode: "whole_json" };
  }

  const { payload, wasFenced } = stripMarkdownFencePayload(raw);
  if (wasFenced) {
    const fencedWhole = tryParseObject(payload);
    if (fencedWhole) {
      return { ok: true, value: fencedWhole, mode: "fenced_json" };
    }
    const fencedObjects = findTopLevelJsonObjects(payload);
    if (fencedObjects.length > 1) {
      return {
        ok: false,
        failureClass: "multiple_json_objects",
        message: "ambiguous_multiple_json_objects",
      };
    }
    if (fencedObjects.length === 1) {
      const parsed = tryParseObject(fencedObjects[0]!);
      if (parsed) return { ok: true, value: parsed, mode: "fenced_json" };
      return { ok: false, failureClass: "malformed_json", message: "fenced_json_malformed" };
    }
    if (looksTruncatedJson(payload)) {
      return { ok: false, failureClass: "truncated_json", message: "fenced_json_truncated" };
    }
    return { ok: false, failureClass: "fenced_json", message: "fenced_json_unparseable" };
  }

  const objects = findTopLevelJsonObjects(raw);
  if (objects.length > 1) {
    return {
      ok: false,
      failureClass: "multiple_json_objects",
      message: "ambiguous_multiple_json_objects",
    };
  }
  if (objects.length === 1) {
    const parsed = tryParseObject(objects[0]!);
    if (parsed) {
      const mode: JsonExtractMode =
        raw.trim() === objects[0]!.trim() ? "whole_json" : "balanced_object";
      // If there was non-JSON prose around a single object, treat as balanced_object.
      return { ok: true, value: parsed, mode: mode === "whole_json" ? "whole_json" : "balanced_object" };
    }
    return { ok: false, failureClass: "malformed_json", message: "balanced_object_malformed" };
  }

  if (looksTruncatedJson(raw)) {
    return { ok: false, failureClass: "truncated_json", message: "truncated_json" };
  }
  if (raw.includes("{") || raw.includes("}")) {
    // Had braces but could not isolate a valid object — likely prose-wrapped junk.
    return { ok: false, failureClass: "prose_wrapped_json", message: "prose_wrapped_unparseable" };
  }
  return { ok: false, failureClass: "malformed_json", message: "no_json_object" };
}

export function extractJsonObject(text: string): unknown {
  const result = extractJsonObjectResult(text);
  if (!result.ok) {
    throw new MarketingBotValidationError(`No JSON object in agent output:${result.failureClass}`);
  }
  return result.value;
}
