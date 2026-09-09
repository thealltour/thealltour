/**
 * Research-domain canonical datetime: UTC ISO-8601 with `Z`.
 * External contracts (e.g. Meta TrendSignal) may use offset forms (+09:00);
 * convert at the Research persistence boundary only.
 */

export class ResearchDatetimeError extends Error {
  readonly code = "invalid_research_datetime" as const;
  constructor(message: string) {
    super(message);
    this.name = "ResearchDatetimeError";
  }
}

/**
 * Parse any valid Date-parseable ISO string (offset or Z) → `…Z`.
 * Rejects empty / non-finite values.
 */
export function toResearchUtcDatetime(value: string): string {
  const trimmed = value.trim();
  if (!trimmed) {
    throw new ResearchDatetimeError("datetime is empty");
  }
  const ms = Date.parse(trimmed);
  if (!Number.isFinite(ms)) {
    throw new ResearchDatetimeError(`datetime is not parseable: ${trimmed.slice(0, 48)}`);
  }
  return new Date(ms).toISOString();
}

export function toResearchUtcDatetimeOrNull(
  value: string | null | undefined,
): string | null {
  if (value == null) return null;
  const trimmed = value.trim();
  if (!trimmed) return null;
  return toResearchUtcDatetime(trimmed);
}
