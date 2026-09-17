"use client";

import {
  getPlannerIconToneClasses,
  type PlannerIconVisual,
} from "@/components/planner/conversation/plannerConversationIcons";
import { RESULT_OVERVIEW_VISUALS } from "@/components/planner/plannerResultVisuals";
import { cn } from "@/lib/cn";
import { paceLabel } from "@/lib/planner/conversationCopy";
import { formatIsoDateDot } from "@/lib/planner/dates";
import type { PlannerPlan } from "@/lib/planner/planSchemas";
import { PLANNER_PACES } from "@/lib/planner/schemas";
import type { PlannerPace } from "@/types/planner";

type PlannerPlanSummaryProps = {
  plan: PlannerPlan;
  /** Natural-language origin text when present; legacy plans omit. */
  originText?: string | null;
  /** Structured draft pace from session input when available. */
  pace?: PlannerPace | null;
};

function formatTripPeriod(plan: PlannerPlan): string {
  const { tripOverview } = plan;
  const nights = tripOverview.nights;
  const days = tripOverview.days;
  if (tripOverview.startDate == null || tripOverview.endDate == null) {
    return `${days}일 · 날짜 미정`;
  }
  return `${formatIsoDateDot(tripOverview.startDate)} → ${formatIsoDateDot(tripOverview.endDate)} · ${nights}박 ${days}일`;
}

function formatDestinationValue(
  plan: PlannerPlan,
  originText?: string | null,
): { value: string; secondary?: string } {
  const origin = originText?.trim() || "";
  const dest = plan.destination.name;
  const value = origin ? `${origin} → ${dest}` : dest;
  const country = plan.destination.country?.trim();
  return country ? { value, secondary: country } : { value };
}

function resolvePaceDisplay(
  pace: PlannerPace | null | undefined,
  styleSummary: string,
): string {
  if (pace && (PLANNER_PACES as readonly string[]).includes(pace)) {
    return paceLabel(pace);
  }
  return styleSummary;
}

export function PlannerPlanSummary({ plan, originText, pace }: PlannerPlanSummaryProps) {
  const { tripOverview } = plan;
  const destination = formatDestinationValue(plan, originText);
  const paceValue = resolvePaceDisplay(pace, tripOverview.styleSummary);
  const styleSummary = tripOverview.styleSummary.trim();

  return (
    <header className="space-y-2.5 sm:space-y-3" data-testid="planner-plan-summary">
      <h1 className="heading-display text-[1.5rem] font-bold leading-[1.25] tracking-[-0.02em] text-[var(--foreground)] sm:text-[1.75rem]">
        {plan.title}
      </h1>
      <p className="type-small leading-snug text-[var(--text-secondary)] sm:text-[1rem] sm:leading-relaxed">
        {plan.summary}
      </p>

      <div
        className="rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-3 sm:p-4"
        data-testid="planner-plan-overview-surface"
      >
        <dl
          className="grid grid-cols-2 gap-x-3 gap-y-3 sm:gap-x-4 sm:gap-y-3.5"
          data-testid="planner-plan-overview"
        >
          <SummaryItem
            label="여행지"
            value={destination.value}
            secondary={destination.secondary}
            visual={RESULT_OVERVIEW_VISUALS.destination}
          />
          <SummaryItem
            label="기간"
            value={formatTripPeriod(plan)}
            visual={RESULT_OVERVIEW_VISUALS.duration}
          />
          <SummaryItem
            label="인원"
            value={tripOverview.travelersSummary}
            visual={RESULT_OVERVIEW_VISUALS.travelers}
          />
          <SummaryItem
            label="여행 속도"
            value={paceValue}
            visual={RESULT_OVERVIEW_VISUALS.pace}
          />
        </dl>

        {styleSummary ? (
          <div
            className="mt-3 border-t border-[var(--border)] pt-3"
            data-testid="planner-plan-style"
          >
            <p className="type-caption text-[var(--text-muted)]">여행 스타일</p>
            <p className="mt-0.5 type-small font-medium leading-relaxed break-words text-[var(--foreground)]">
              {styleSummary}
            </p>
          </div>
        ) : null}
      </div>
    </header>
  );
}

function SummaryItem({
  label,
  value,
  secondary,
  visual,
}: {
  label: string;
  value: string;
  secondary?: string;
  visual: PlannerIconVisual;
}) {
  const Icon = visual.icon;
  const tone = getPlannerIconToneClasses(visual.tone);
  return (
    <div className="flex min-w-0 items-start gap-2">
      <span
        className={cn(
          "mt-0.5 inline-flex h-7 w-7 shrink-0 items-center justify-center rounded-lg",
          tone.container,
        )}
        aria-hidden={true}
      >
        <Icon className={cn("h-3.5 w-3.5", tone.icon)} aria-hidden={true} />
      </span>
      <div className="min-w-0">
        <dt className="type-caption text-[var(--text-muted)]">{label}</dt>
        <dd className="type-small break-words font-semibold leading-snug text-[var(--foreground)]">
          {value}
          {secondary ? (
            <span className="mt-0.5 block type-caption font-normal text-[var(--text-muted)]">
              {secondary}
            </span>
          ) : null}
        </dd>
      </div>
    </div>
  );
}
