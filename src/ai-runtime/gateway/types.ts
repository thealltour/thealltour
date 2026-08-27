/**
 * OpenAI-compatible shapes for Hermes → Runtime inference boundary (SPIKE).
 * Not a full OpenAI SDK surface — only fields Hermes custom chat_completions uses.
 */

export type OpenAiCompatRole = "system" | "user" | "assistant" | "tool" | "function" | "developer";

export type OpenAiCompatMessage = {
  role: OpenAiCompatRole | string;
  content?: string | Array<{ type?: string; text?: string }> | null;
  name?: string;
  tool_call_id?: string;
  tool_calls?: unknown;
};

export type OpenAiCompatChatCompletionRequest = {
  model?: string;
  messages?: OpenAiCompatMessage[];
  temperature?: number;
  max_tokens?: number;
  max_completion_tokens?: number;
  stream?: boolean;
  tools?: unknown[];
  tool_choice?: unknown;
  response_format?: unknown;
  [key: string]: unknown;
};

export type OpenAiCompatChatCompletionChoice = {
  index: number;
  message: {
    role: "assistant";
    content: string | null;
    tool_calls?: Array<{
      id: string;
      type: "function";
      function: { name: string; arguments: string };
    }>;
  };
  finish_reason: "stop" | "length" | "tool_calls" | "content_filter" | "null" | string;
};

export type OpenAiCompatChatCompletionResponse = {
  id: string;
  object: "chat.completion";
  created: number;
  model: string;
  choices: OpenAiCompatChatCompletionChoice[];
  usage: {
    prompt_tokens: number;
    completion_tokens: number;
    total_tokens: number;
  };
};

export type OpenAiCompatErrorBody = {
  error: {
    message: string;
    type: string;
    code: string | null;
    param: string | null;
  };
};

export type GatewayCompatibilityFlags = {
  toolsPresent: boolean;
  streamRequested: boolean;
  responseFormatPresent: boolean;
  unsupportedFields: string[];
};
