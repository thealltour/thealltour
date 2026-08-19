/**
 * Gemini/OpenAI 호출 오류 분류.
 * 쿼터 소진·일시 오류여도 env 키를 지우거나 provider를 끄지 않는다. 다음 요청도 같은 키로 재시도한다.
 */

export function errorText(error: unknown): string {
  if (error instanceof Error) return error.message;
  return String(error ?? "");
}

export function isAiQuotaError(error: unknown): boolean {
  const msg = errorText(error).toLowerCase();
  return (
    msg.includes("exceeded your current quota") ||
    msg.includes("quota exceeded") ||
    msg.includes("free_tier") ||
    msg.includes("generativelanguage.googleapis.com/generate_content_free_tier") ||
    msg.includes("check your plan and billing")
  );
}

export function extractAiRetryAfterSeconds(error: unknown): number | null {
  const msg = errorText(error);
  const match = msg.match(/retry in\s+(\d+(?:\.\d+)?)\s*s/i);
  if (!match) return null;
  const seconds = Number(match[1]);
  if (!Number.isFinite(seconds) || seconds <= 0) return null;
  return Math.ceil(seconds);
}

/** 네트워크 등 짧은 재시도만. 쿼터 소진은 Google이 안내한 대기 시간 전에는 재시도하지 않는다. */
export function isTransientAiError(error: unknown): boolean {
  if (isAiQuotaError(error)) return false;
  const msg = errorText(error).toLowerCase();
  return (
    msg.includes("timeout") ||
    msg.includes("timed out") ||
    msg.includes("network") ||
    msg.includes("fetch failed") ||
    msg.includes("econnreset") ||
    msg.includes("econnrefused") ||
    msg.includes("temporarily") ||
    msg.includes("unavailable") ||
    msg.includes("overloaded") ||
    msg.includes("503") ||
    msg.includes("502")
  );
}

export function formatQuotaExceededMessage(error: unknown): string {
  const wait = extractAiRetryAfterSeconds(error);
  const waitHint = wait != null ? ` 약 ${wait}초 후 다시 시도하세요.` : " 잠시 후 다시 시도하세요.";
  return (
    "Google Gemini 무료 플랜 사용량(쿼터)을 모두 소진했습니다." +
    waitHint +
    " API 키 연결은 그대로 유지됩니다. 해지하거나 우회하지 않습니다."
  );
}
