"use client";

import type { PlannerPlan } from "@/lib/planner/planSchemas";
import { formatIsoDateDot } from "@/lib/planner/dates";

type PlannerPlanSummaryProps = {
  plan: PlannerPlan;
  /** Natural-language origin text when present; legacy plans omit. */
  originText?: string | null;
};

function formatTripPeriod(plan: PlannerPlan): string {
  const { tripOverview } = plan;
  const nights = tripOverview.nights;
  const days = tripOverview.days;
  if (tripOverview.startDate == null || tripOverview.endDate == null) {
    return `${days}일 여행 · 날짜 미정`;
  }
  return `${formatIsoDateDot(tripOverview.startDate)} - ${formatIsoDateDot(tripOverview.endDate)} (${nights}박 ${days}일)`;
}

export function PlannerPlanSummary({ plan, originText }: PlannerPlanSummaryProps) {
  const { tripOverview, destination } = plan;
  const origin = originText?.trim() || "";
  const routeLabel = origin
    ? `${origin} → ${destination.name}`
    : destination.name;
  return (
    <header className="space-y-3">
      <div className="space-y-1">
        <p className="type-caption font-semibold tracking-wide text-[var(--text-muted)]">
          {routeLabel}
          {destination.country ? ` · ${destination.country}` : ""}
        </p>
        <h1 className="heading-display type-h1 text-[var(--foreground)]">{plan.title}</h1>
      </div>
      <p className="type-body leading-relaxed text-[var(--text-secondary)]">{plan.summary}</p>
      <dl className="grid grid-cols-1 gap-2 rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-4 sm:grid-cols-2">
        <SummaryItem label="여행 기간" value={formatTripPeriod(plan)} />
        <SummaryItem label="인원" value={tripOverview.travelersSummary} />
        <SummaryItem label="스타일" value={tripOverview.styleSummary} />
      </dl>
    </header>
  );
}

function SummaryItem({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <dt className="type-caption text-[var(--text-muted)]">{label}</dt>
      <dd className="type-small font-medium text-[var(--foreground)]">{value}</dd>
    </div>
  );
}
