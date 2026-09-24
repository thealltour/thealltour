/**
 * Parse decisionTrace from LLM / disk Shared Visual Plan payloads.
 */

import {
  SHARED_VISUAL_OVERRIDE_FIELDS,
  type SharedVisualDecisionOverride,
  type SharedVisualDecisionTrace,
  type SharedVisualOverrideField,
} from "@/lib/marketing/publishable/sharedVisualPlan/contracts";

function asString(value: unknown): string {
  return typeof value === "string" ? value.trim() : "";
}

export function parseSharedVisualDecisionTrace(
  raw: unknown,
): SharedVisualDecisionTrace | null {
  if (!raw || typeof raw !== "object") return null;
  const row = raw as Record<string, unknown>;
  const overridesRaw = Array.isArray(row.overrides) ? row.overrides : null;
  if (!overridesRaw) return { overrides: [] };
  const overrides: SharedVisualDecisionOverride[] = [];
  for (const item of overridesRaw) {
    if (!item || typeof item !== "object") continue;
    const o = item as Record<string, unknown>;
    const fieldRaw = asString(o.field);
    if (!(SHARED_VISUAL_OVERRIDE_FIELDS as readonly string[]).includes(fieldRaw)) continue;
    const reason = asString(o.reason);
    const requested = asString(o.requested);
    const final = asString(o.final);
    if (!reason || !requested || !final) continue;
    const cardId = asString(o.cardId);
    overrides.push({
      ...(cardId ? { cardId } : {}),
      field: fieldRaw as SharedVisualOverrideField,
      requested,
      final,
      reason,
    });
  }
  return { overrides };
}

export function hasOverrideFor(input: {
  trace: SharedVisualDecisionTrace | null | undefined;
  cardId?: string;
  field: SharedVisualOverrideField;
}): boolean {
  const list = input.trace?.overrides ?? [];
  return list.some((o) => {
    if (o.field !== input.field) return false;
    if (input.cardId && o.cardId && o.cardId !== input.cardId) return false;
    if (input.cardId && !o.cardId) return false;
    return o.reason.trim().length >= 8;
  });
}
