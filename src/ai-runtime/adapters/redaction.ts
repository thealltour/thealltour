import { RuntimeError } from "@/ai-runtime/domain/error";

const SECRET_PATTERNS = [
  /sk-[a-zA-Z0-9_-]{8,}/g,
  /nvapi-[a-zA-Z0-9_-]{8,}/g,
  /AIza[0-9A-Za-z_-]{10,}/g,
  /Bearer\s+[^\s]+/gi,
];

/** Strip common secret shapes from strings before logging or error messages. */
export function redactSecrets(text: string, extraSecrets: string[] = []): string {
  let out = text;
  for (const secret of extraSecrets) {
    if (secret && secret.length >= 8) {
      out = out.split(secret).join("[REDACTED]");
    }
  }
  for (const pattern of SECRET_PATTERNS) {
    out = out.replace(pattern, "[REDACTED]");
  }
  return out;
}

export function safeErrorMessage(text: string, extraSecrets: string[] = [], maxLen = 400): string {
  const redacted = redactSecrets(text, extraSecrets).replace(/\s+/g, " ").trim();
  return redacted.length > maxLen ? `${redacted.slice(0, maxLen)}…` : redacted;
}

export function assertNoSecretInMessage(message: string, secrets: string[]): void {
  for (const secret of secrets) {
    if (secret && secret.length >= 8 && message.includes(secret)) {
      throw new RuntimeError("RUNTIME_ERROR", "Internal error: secret leaked into error message", false);
    }
  }
}
