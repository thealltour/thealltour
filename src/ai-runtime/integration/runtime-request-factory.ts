import { randomUUID } from "node:crypto";

import type { RuntimeRequest } from "@/ai-runtime/domain/request";
import type {
  RuntimeRequestFactoryInput,
  RuntimeRequestFactoryOptions,
} from "@/ai-runtime/integration/types";

function buildMetadata(input: RuntimeRequestFactoryInput): RuntimeRequest["metadata"] {
  const metadata: NonNullable<RuntimeRequest["metadata"]> = {};

  if (input.correlationId) metadata.correlationId = input.correlationId;
  if (input.parentRequestId) metadata.parentRequestId = input.parentRequestId;
  if (input.conversationId) metadata.conversationId = input.conversationId;
  if (input.roomId) metadata.roomId = input.roomId;
  if (input.handoffId) metadata.handoffId = input.handoffId;
  if (input.cronJobId) metadata.cronJobId = input.cronJobId;
  if (input.departmentId) metadata.departmentId = input.departmentId;

  return Object.keys(metadata).length > 0 ? metadata : undefined;
}

/**
 * Normalizes caller-built Agent messages into a provider-agnostic RuntimeRequest.
 * Does not generate prompts, run retrieval, or bind provider/model.
 */
export function createRuntimeRequest(
  input: RuntimeRequestFactoryInput,
  options: RuntimeRequestFactoryOptions = {},
): RuntimeRequest {
  if (!input.agentId?.trim()) {
    throw new Error("RuntimeRequestFactory requires agentId");
  }
  if (!input.source) {
    throw new Error("RuntimeRequestFactory requires source");
  }
  if (!input.workload) {
    throw new Error("RuntimeRequestFactory requires workload");
  }
  if (!input.priority) {
    throw new Error("RuntimeRequestFactory requires priority");
  }
  if (!Array.isArray(input.messages) || input.messages.length === 0) {
    throw new Error("RuntimeRequestFactory requires at least one message");
  }

  const now = options.now ?? (() => new Date());
  const createRequestId = options.createRequestId ?? (() => randomUUID());

  return {
    id: createRequestId(),
    createdAt: now().toISOString(),
    agentId: input.agentId,
    source: input.source,
    workload: input.workload,
    priority: input.priority,
    messages: input.messages.map((message) => ({
      role: message.role,
      content: message.content,
    })),
    expectedOutputTokens: input.expectedOutputTokens,
    deadlineAt: input.deadlineAt,
    routing: input.routing,
    metadata: buildMetadata(input),
  };
}

/**
 * Cron helper — preserves cronJobId and sets background priority unless caller overrides.
 */
export function createCronRuntimeRequest(
  input: Omit<RuntimeRequestFactoryInput, "source" | "priority"> &
    Partial<Pick<RuntimeRequestFactoryInput, "priority">>,
  options?: RuntimeRequestFactoryOptions,
): RuntimeRequest {
  return createRuntimeRequest(
    {
      ...input,
      source: "cron",
      priority: input.priority ?? "background",
    },
    options,
  );
}

/**
 * Agent handoff helper — preserves handoffId / parentRequestId / correlationId.
 */
export function createHandoffRuntimeRequest(
  input: RuntimeRequestFactoryInput & { source?: "agent-handoff" },
  options?: RuntimeRequestFactoryOptions,
): RuntimeRequest {
  return createRuntimeRequest(
    {
      ...input,
      source: input.source ?? "agent-handoff",
    },
    options,
  );
}

/**
 * Department orchestration helper.
 */
export function createDepartmentRuntimeRequest(
  input: RuntimeRequestFactoryInput & { source?: "department-orchestrator" },
  options?: RuntimeRequestFactoryOptions,
): RuntimeRequest {
  return createRuntimeRequest(
    {
      ...input,
      source: input.source ?? "department-orchestrator",
    },
    options,
  );
}

/**
 * Desktop / Group Chat helper — does not force priority; caller supplies interactive priority.
 */
export function createInteractiveRuntimeRequest(
  input: RuntimeRequestFactoryInput & { source: "desktop" | "group-chat" },
  options?: RuntimeRequestFactoryOptions,
): RuntimeRequest {
  return createRuntimeRequest(input, options);
}
