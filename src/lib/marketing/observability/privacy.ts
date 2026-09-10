import type { MarketingSpanAttributes } from "@/lib/marketing/observability/types";
import { sanitizeProductionWorkerError } from "@/lib/marketing/cron/daily/agendaSlate/productionRequestTypes";

/**
 * Privacy policy for OBS-1 traces (contract-level).
 *
 * Never store by default:
 * - secrets / API tokens / Authorization headers
 * - raw env dumps
 * - raw PII (customer names, phones, emails, passport numbers)
 * - private chain-of-thought
 * - unrestricted full prompt or full model response
 *
 * Prefer instead:
 * - prompt template name/version
 * - assignment / result summaries (bounded)
 * - evidence IDs
 * - structured validation results
 * - sanitized error class/message
 *
 * Aligns with AI Runtime SAFE_OBSERVABILITY_METADATA_KEYS policy
 * (`src/ai-runtime/observability/persistence/types.ts`).
 */

export const MARKETING_TRACE_PRIVACY_POLICY = "marketing-trace-privacy-v1" as const;

export const FORBIDDEN_ATTRIBUTE_KEY_PATTERNS: RegExp[] = [
  /password/i,
  /secret/i,
  /api[_-]?key/i,
  /authorization/i,
  /bearer/i,
  /cookie/i,
  /private[_-]?key/i,
  /\btoken\b/i,
  /prompt[_-]?text/i,
  /full[_-]?prompt/i,
  /model[_-]?response/i,
  /raw[_-]?response/i,
  /chain[_-]?of[_-]?thought/i,
  /thinking[_-]?trace/i,
  /\benv\b/i,
  /credential/i,
];

export const MAX_ATTRIBUTE_STRING_LENGTH = 400;
export const MAX_ERROR_MESSAGE_LENGTH = 400;
export const MAX_SUMMARY_LENGTH = 240;
/** Soft upper bound for persisted attributes JSON (bytes of UTF-8). */
export const MAX_ATTRIBUTES_JSON_BYTES = 16_384;

export function isForbiddenAttributeKey(key: string): boolean {
  return FORBIDDEN_ATTRIBUTE_KEY_PATTERNS.some((re) => re.test(key));
}

export function sanitizeAttributeString(value: string, limit = MAX_ATTRIBUTE_STRING_LENGTH): string {
  return sanitizeProductionWorkerError(value, limit);
}

export function sanitizeSpanErrorMessage(message: string): string {
  return sanitizeProductionWorkerError(message, MAX_ERROR_MESSAGE_LENGTH);
}

export function truncateSummary(text: string, limit = MAX_SUMMARY_LENGTH): string {
  const cleaned = sanitizeAttributeString(text, limit + 80);
  if (cleaned.length <= limit) return cleaned;
  return `${cleaned.slice(0, Math.max(0, limit - 1))}…`;
}

/**
 * Drop forbidden keys and sanitize string values.
 * Returns `{ attributes, rejectedKeys }`.
 */
export function sanitizeSpanAttributes(
  attributes: MarketingSpanAttributes,
): { attributes: MarketingSpanAttributes; rejectedKeys: string[] } {
  const rejectedKeys: string[] = [];
  const out: MarketingSpanAttributes = {};

  for (const [key, value] of Object.entries(attributes)) {
    if (isForbiddenAttributeKey(key)) {
      rejectedKeys.push(key);
      continue;
    }
    if (typeof value === "string") {
      out[key] = sanitizeAttributeString(value);
    } else if (Array.isArray(value)) {
      out[key] = value.map((item) =>
        typeof item === "string" ? sanitizeAttributeString(item, 120) : String(item),
      );
    } else {
      out[key] = value;
    }
  }

  return { attributes: out, rejectedKeys };
}

/**
 * Persistence-boundary sanitizer: forbid keys, sanitize strings, enforce JSON size.
 * On overflow, drop largest string/array values until under budget (never throws).
 */
export function sanitizeAttributesForPersistence(
  attributes: MarketingSpanAttributes,
  maxBytes = MAX_ATTRIBUTES_JSON_BYTES,
): { attributes: MarketingSpanAttributes; rejectedKeys: string[]; truncated: boolean } {
  const { attributes: cleaned, rejectedKeys } = sanitizeSpanAttributes(attributes);
  let truncated = false;
  let current = { ...cleaned };

  const sizeOf = (attrs: MarketingSpanAttributes) =>
    Buffer.byteLength(JSON.stringify(attrs), "utf8");

  while (sizeOf(current) > maxBytes) {
    truncated = true;
    const entries = Object.entries(current).sort(
      (a, b) => JSON.stringify(b[1]).length - JSON.stringify(a[1]).length,
    );
    const drop = entries[0];
    if (!drop) break;
    delete current[drop[0]];
    rejectedKeys.push(drop[0]);
  }

  if (truncated) {
    current = {
      ...current,
      "marketing.privacy.attributes_truncated": true,
    };
    if (sizeOf(current) > maxBytes) {
      // Last resort: empty object + diagnostic flag only
      current = { "marketing.privacy.attributes_truncated": true };
    }
  }

  return { attributes: current, rejectedKeys, truncated };
}
