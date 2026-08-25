const FORBIDDEN_KEY =
  /^(name|full_?name|display_?name|customer_?name|user_?name|first_?name|last_?name|phone|tel|mobile|email|e-mail|passport|address|street|member_?id|customer_id|ssn|password|secret|token|api_?key|authorization|auth|embedding|embedding_vector|vector|raw_profile)$/i;

const FORBIDDEN_VALUE =
  /\b(passport|주민등록|핸드폰|휴대폰|\d{3}-\d{3,4}-\d{4}|[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,})\b/i;

export function truncateBotText(value: string | null | undefined, maxChars: number): string | null {
  if (value == null) return null;
  const normalized = value.replace(/\s+/g, " ").trim();
  if (!normalized) return null;
  if (normalized.length <= maxChars) return normalized;
  return `${normalized.slice(0, Math.max(0, maxChars - 1))}…`;
}

export function isForbiddenBotKey(key: string): boolean {
  return FORBIDDEN_KEY.test(key);
}

export function stripForbiddenBotData<T>(value: T, maxChars = 2000): T {
  return stripValue(value, maxChars, 0) as T;
}

function stripValue(value: unknown, maxChars: number, depth: number): unknown {
  if (depth > 8) return null;
  if (value == null) return value;
  if (typeof value === "string") {
    const truncated = truncateBotText(value, maxChars) ?? "";
    return FORBIDDEN_VALUE.test(truncated) ? "[redacted]" : truncated;
  }
  if (typeof value === "number" || typeof value === "boolean") return value;
  if (Array.isArray(value)) {
    if (value.every((item) => typeof item === "number") && value.length > 8) {
      return undefined;
    }
    return value
      .map((item) => stripValue(item, maxChars, depth + 1))
      .filter((item) => item !== undefined);
  }
  if (typeof value === "object") {
    const output: Record<string, unknown> = {};
    for (const [key, nested] of Object.entries(value as Record<string, unknown>)) {
      if (isForbiddenBotKey(key)) continue;
      const cleaned = stripValue(nested, maxChars, depth + 1);
      if (cleaned !== undefined) output[key] = cleaned;
    }
    return output;
  }
  return null;
}

export function jsonContainsForbiddenBotLeak(value: unknown): boolean {
  return containsLeak(value, 0);
}

function containsLeak(value: unknown, depth: number): boolean {
  if (depth > 10 || value == null) return false;
  if (Array.isArray(value)) {
    if (value.length > 16 && value.every((item) => typeof item === "number")) return true;
    return value.some((item) => containsLeak(item, depth + 1));
  }
  if (typeof value === "object") {
    for (const [key, nested] of Object.entries(value as Record<string, unknown>)) {
      if (isForbiddenBotKey(key)) return true;
      if (containsLeak(nested, depth + 1)) return true;
    }
  }
  return false;
}
