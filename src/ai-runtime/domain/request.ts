import type { AgentId, RuntimeRequestSource } from "@/ai-runtime/domain/agent";
import type { WorkloadClass } from "@/ai-runtime/domain/workload";
import type { RuntimePriority } from "@/ai-runtime/domain/priority";
import type {
  RuntimeToolCall,
  RuntimeToolChoice,
  RuntimeToolDefinition,
} from "@/ai-runtime/domain/tools";
import type { RuntimeResponseFormat } from "@/ai-runtime/domain/structured-output";

export const RUNTIME_MESSAGE_ROLES = ["system", "user", "assistant", "tool"] as const;

export type RuntimeMessageRole = (typeof RUNTIME_MESSAGE_ROLES)[number];

export interface RuntimeMessage {
  role: RuntimeMessageRole;
  /** Text content; may be empty when assistant emits toolCalls only. */
  content: string;
  /** Assistant-only: provider-neutral tool invocations for this turn. */
  toolCalls?: RuntimeToolCall[];
  /** Tool-only: correlates to a prior assistant toolCalls[].id. */
  toolCallId?: string;
  /** Optional tool/function name (OpenAI/Hermes often include it). */
  name?: string;
}

/**
 * Soft routing preferences only — never required provider/model binding.
 * Selection belongs to a future Router, not the Agent.
 */
export interface RuntimeRoutingHints {
  preferredProviderIds?: string[];
  preferredModelIds?: string[];
  excludedProviderIds?: string[];
  excludedModelIds?: string[];
  requiresStructuredOutput?: boolean;
  requiresToolCalling?: boolean;
  allowFallback?: boolean;
  allowQueue?: boolean;
}

/**
 * Trace / fan-out metadata for one organizational user request.
 * `correlationId` ties multiple agent invocations and LLM calls together.
 */
export interface RuntimeRequestMetadata {
  conversationId?: string;
  roomId?: string;
  parentRequestId?: string;
  handoffId?: string;
  cronJobId?: string;
  departmentId?: string;
  correlationId?: string;
  /**
   * Spike-only: when true and agentId is runtime-spike, Router fails the first
   * candidate before inference (no credential damage). Never set on production agents.
   */
  spikeForceFallback?: boolean;
}

/**
 * Provider-agnostic runtime request.
 * Do not add required providerId / modelId — Agents must not bind models directly.
 */
export interface RuntimeRequest {
  id: string;
  createdAt: string;
  agentId: AgentId;
  source: RuntimeRequestSource;
  workload: WorkloadClass;
  priority: RuntimePriority;
  messages: RuntimeMessage[];
  /** OpenAI-compatible tool definitions (Hermes MCP/Skills schemas). */
  tools?: RuntimeToolDefinition[];
  toolChoice?: RuntimeToolChoice;
  /** OpenAI-compatible response_format (json_object / json_schema). */
  responseFormat?: RuntimeResponseFormat;
  expectedOutputTokens?: number;
  deadlineAt?: string;
  routing?: RuntimeRoutingHints;
  metadata?: RuntimeRequestMetadata;
}
