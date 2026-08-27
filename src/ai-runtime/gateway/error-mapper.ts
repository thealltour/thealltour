import { RuntimeError, type RuntimeErrorCode } from "@/ai-runtime/domain/error";
import type { OpenAiCompatErrorBody } from "@/ai-runtime/gateway/types";

export type MappedHttpError = {
  status: number;
  body: OpenAiCompatErrorBody;
  /** Hint for Hermes: whether a client-side retry is appropriate. */
  retryable: boolean;
};

function openAiError(
  message: string,
  type: string,
  code: string | null,
): OpenAiCompatErrorBody {
  return { error: { message, type, code, param: null } };
}

export function mapRuntimeErrorCodeToHttp(code: RuntimeErrorCode, message: string, retryable: boolean): MappedHttpError {
  switch (code) {
    case "AUTH_ERROR":
      return {
        status: 401,
        body: openAiError(message || "authentication failed", "invalid_request_error", "invalid_api_key"),
        retryable: false,
      };
    case "RATE_LIMIT":
      return {
        status: 429,
        body: openAiError(message || "rate limit exceeded", "rate_limit_error", "rate_limit_exceeded"),
        retryable: true,
      };
    case "QUOTA_EXHAUSTED":
      return {
        status: 429,
        body: openAiError(message || "quota exhausted", "insufficient_quota", "insufficient_quota"),
        retryable: false,
      };
    case "TIMEOUT":
      return {
        status: 504,
        body: openAiError(message || "upstream timeout", "timeout", "timeout"),
        retryable: true,
      };
    case "MODEL_UNAVAILABLE":
      return {
        status: 503,
        body: openAiError(message || "model unavailable", "server_error", "model_unavailable"),
        retryable: true,
      };
    case "CONTEXT_TOO_LARGE":
      return {
        status: 400,
        body: openAiError(message || "context too large", "invalid_request_error", "context_length_exceeded"),
        retryable: false,
      };
    case "INVALID_REQUEST":
      return {
        status: 400,
        body: openAiError(message || "invalid request", "invalid_request_error", "invalid_request"),
        retryable: false,
      };
    case "PROVIDER_ERROR":
      return {
        status: 502,
        body: openAiError(message || "provider error", "server_error", "provider_error"),
        retryable: true,
      };
    case "RUNTIME_ERROR":
    default:
      return {
        status: 500,
        body: openAiError(message || "runtime error", "server_error", "runtime_error"),
        retryable,
      };
  }
}

export function mapUnknownToHttp(error: unknown): MappedHttpError {
  if (error instanceof RuntimeError) {
    return mapRuntimeErrorCodeToHttp(error.code, error.message, error.retryable);
  }
  if (error instanceof Error) {
    const msg = error.message;
    if (/messages must contain/i.test(msg)) {
      return mapRuntimeErrorCodeToHttp("INVALID_REQUEST", msg, false);
    }
    return mapRuntimeErrorCodeToHttp("RUNTIME_ERROR", msg, false);
  }
  return mapRuntimeErrorCodeToHttp("RUNTIME_ERROR", "unknown error", false);
}
