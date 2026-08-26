import { RuntimeError } from "@/ai-runtime/domain/error";
import type { ProviderRateLimitMetadata } from "@/ai-runtime/adapters/types";
import { extractRateLimitMetadata, mapHttpStatusToRuntimeError } from "@/ai-runtime/adapters/http";

export function nvidiaErrorFromResponse(
  status: number,
  bodyText: string,
  headers: Headers,
  secrets: string[],
): RuntimeError {
  const rateLimit: ProviderRateLimitMetadata = extractRateLimitMetadata(headers);
  return mapHttpStatusToRuntimeError({ status, bodyText, rateLimit, secrets });
}
