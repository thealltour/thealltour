import type { AgendaFreshnessClass } from "@/lib/marketing/agendaQualityV2/contracts";

/** Default TTL hours by freshness class — Phase 1 foundation only. */
export const AGENDA_FRESHNESS_TTL_HOURS_DEFAULTS: Record<AgendaFreshnessClass, number> = {
  breaking: 48,
  timely: 5 * 24,
  seasonal: 21 * 24,
  evergreen: 60 * 24,
};

export type AgendaFreshnessTtlConfig = Partial<Record<AgendaFreshnessClass, number>>;

export function resolveAgendaFreshnessTtlHours(
  freshnessClass: AgendaFreshnessClass,
  overrides?: AgendaFreshnessTtlConfig,
): number {
  const fromOverride = overrides?.[freshnessClass];
  if (typeof fromOverride === "number" && Number.isFinite(fromOverride) && fromOverride > 0) {
    return fromOverride;
  }
  return AGENDA_FRESHNESS_TTL_HOURS_DEFAULTS[freshnessClass];
}

export function computeAgendaExpiresAt(params: {
  freshnessClass: AgendaFreshnessClass;
  fromIso?: string | Date;
  ttlOverrides?: AgendaFreshnessTtlConfig;
}): string {
  const from =
    params.fromIso instanceof Date
      ? params.fromIso
      : params.fromIso
        ? new Date(params.fromIso)
        : new Date();
  const baseMs = Number.isFinite(from.getTime()) ? from.getTime() : Date.now();
  const hours = resolveAgendaFreshnessTtlHours(params.freshnessClass, params.ttlOverrides);
  return new Date(baseMs + hours * 60 * 60 * 1000).toISOString();
}

export function parseAgendaFreshnessClass(value: unknown): AgendaFreshnessClass | null {
  if (typeof value !== "string") return null;
  const normalized = value.trim().toLowerCase();
  if (
    normalized === "breaking" ||
    normalized === "timely" ||
    normalized === "seasonal" ||
    normalized === "evergreen"
  ) {
    return normalized;
  }
  return null;
}
