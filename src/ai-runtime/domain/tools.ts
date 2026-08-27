/**
 * Provider-neutral tool protocol for Hermes ↔ Runtime inference boundary.
 * Runtime transports schemas and tool_calls; Hermes owns tool execution.
 */

export const RUNTIME_TOOL_TYPES = ["function"] as const;
export type RuntimeToolType = (typeof RUNTIME_TOOL_TYPES)[number];

/** JSON Schema object for function parameters (opaque to Runtime). */
export type RuntimeJsonSchema = Record<string, unknown>;

export interface RuntimeToolFunctionDefinition {
  name: string;
  description?: string;
  parameters?: RuntimeJsonSchema;
}

export interface RuntimeToolDefinition {
  type: RuntimeToolType;
  function: RuntimeToolFunctionDefinition;
}

export type RuntimeToolChoiceMode = "auto" | "none" | "required";

export type RuntimeToolChoice =
  | RuntimeToolChoiceMode
  | { type: "function"; function: { name: string } };

export interface RuntimeToolCallFunction {
  name: string;
  /** JSON object serialized as string (OpenAI wire shape). */
  arguments: string;
}

export interface RuntimeToolCall {
  id: string;
  type: RuntimeToolType;
  function: RuntimeToolCallFunction;
  /**
   * Opaque provider-specific fields required for round-trip
   * (e.g. Gemini thoughtSignature). Never log/expose to Admin Console.
   */
  providerData?: Record<string, unknown>;
}
