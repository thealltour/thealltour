import { createEmptyPlannerDraftInput } from "@/lib/planner/constants";
import {
  computeDurationDays,
  isIsoDateYmd,
  PLANNER_DURATION_DAYS_MAX,
  PLANNER_DURATION_DAYS_MIN,
} from "@/lib/planner/dates";
import {
  PLANNER_BUDGET_STYLES,
  PLANNER_COMPANION_TYPES,
  PLANNER_INTERESTS,
  PLANNER_PACES,
} from "@/lib/planner/schemas";
import type { PlannerBudgetStyle, PlannerDraftInput } from "@/types/planner";

function asInterest(value: unknown): PlannerDraftInput["interests"][number] | null {
  return typeof value === "string" && (PLANNER_INTERESTS as readonly string[]).includes(value)
    ? (value as PlannerDraftInput["interests"][number])
    : null;
}

function asCompanion(value: unknown): PlannerDraftInput["companionType"] | null {
  return typeof value === "string" && (PLANNER_COMPANION_TYPES as readonly string[]).includes(value)
    ? (value as PlannerDraftInput["companionType"])
    : null;
}

function asPace(value: unknown): PlannerDraftInput["pace"] | null {
  return typeof value === "string" && (PLANNER_PACES as readonly string[]).includes(value)
    ? (value as PlannerDraftInput["pace"])
    : null;
}

function asBudgetStyle(value: unknown): PlannerBudgetStyle | null {
  return typeof value === "string" && (PLANNER_BUDGET_STYLES as readonly string[]).includes(value)
    ? (value as PlannerBudgetStyle)
    : null;
}

function clampDurationDays(value: number): number {
  return Math.min(
    PLANNER_DURATION_DAYS_MAX,
    Math.max(PLANNER_DURATION_DAYS_MIN, Math.trunc(value)),
  );
}

/** Normalize PR-1 string destination and partial / legacy drafts into PlannerDraftInput. */
export function normalizePlannerDraftInput(raw: unknown): PlannerDraftInput {
  const base = createEmptyPlannerDraftInput();
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return base;
  const o = raw as Record<string, unknown>;

  if (typeof o.destination === "string" && o.destination.trim()) {
    base.destination = { text: o.destination.trim() };
  } else if (o.destination && typeof o.destination === "object" && !Array.isArray(o.destination)) {
    const text = (o.destination as { text?: unknown }).text;
    if (typeof text === "string") base.destination = { text: text.trim() };
  }

  if (o.dates && typeof o.dates === "object" && !Array.isArray(o.dates)) {
    const d = o.dates as {
      mode?: unknown;
      startDate?: unknown;
      endDate?: unknown;
      durationDays?: unknown;
    };
    const startRaw = typeof d.startDate === "string" ? d.startDate.trim() : "";
    const endRaw = typeof d.endDate === "string" ? d.endDate.trim() : "";
    const startDate = isIsoDateYmd(startRaw) ? startRaw : null;
    const endDate = isIsoDateYmd(endRaw) ? endRaw : null;
    const mode = d.mode === "flexible" || d.mode === "fixed" ? d.mode : "fixed";

    if (mode === "flexible") {
      const duration =
        typeof d.durationDays === "number" && Number.isFinite(d.durationDays)
          ? clampDurationDays(d.durationDays)
          : 3;
      base.dates = {
        mode: "flexible",
        startDate: null,
        endDate: null,
        durationDays: duration,
      };
    } else {
      const computed = computeDurationDays(startDate, endDate);
      const duration =
        computed != null
          ? clampDurationDays(computed)
          : typeof d.durationDays === "number" && Number.isFinite(d.durationDays)
            ? clampDurationDays(d.durationDays)
            : 3;
      base.dates = {
        mode: "fixed",
        startDate,
        endDate,
        durationDays: duration,
      };
    }
  }

  if (o.travelers && typeof o.travelers === "object" && !Array.isArray(o.travelers)) {
    const t = o.travelers as { adults?: unknown; children?: unknown };
    const adults = typeof t.adults === "number" && Number.isFinite(t.adults) ? Math.trunc(t.adults) : 2;
    const children =
      typeof t.children === "number" && Number.isFinite(t.children) ? Math.trunc(t.children) : 0;
    base.travelers = {
      adults: Math.min(20, Math.max(1, adults)),
      children: Math.min(20, Math.max(0, children)),
    };
  }

  const companion = asCompanion(o.companionType);
  if (companion) base.companionType = companion;

  if (Array.isArray(o.interests)) {
    const next: PlannerDraftInput["interests"] = [];
    for (const item of o.interests) {
      const interest = asInterest(item);
      if (interest && !next.includes(interest)) next.push(interest);
    }
    base.interests = next;
  }

  if (typeof o.themeRequest === "string") {
    base.themeRequest = o.themeRequest.trim().slice(0, 1000);
  } else if (typeof o.preferencesNote === "string") {
    base.themeRequest = o.preferencesNote.trim().slice(0, 1000);
  }

  const pace = asPace(o.pace);
  if (pace) base.pace = pace;

  if (o.budget && typeof o.budget === "object" && !Array.isArray(o.budget)) {
    const b = o.budget as {
      amount?: unknown;
      scope?: unknown;
      currency?: unknown;
      style?: unknown;
    };
    const amount =
      b.amount === null
        ? null
        : typeof b.amount === "number" && Number.isFinite(b.amount) && b.amount >= 0
          ? b.amount
          : null;
    const scope = b.scope === "total" || b.scope === "per_person" ? b.scope : "per_person";
    base.budget = {
      style: asBudgetStyle(b.style),
      amount,
      scope,
      currency: "KRW",
    };
  }

  if (typeof o.additionalRequest === "string") {
    base.additionalRequest = o.additionalRequest.trim().slice(0, 1000);
  }

  return base;
}
