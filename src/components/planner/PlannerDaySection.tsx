"use client";

import { Badge } from "@/components/ui/Badge";
import type { PlannerPlanDay, PlannerPlanItem } from "@/lib/planner/planSchemas";

const ITEM_TYPE_LABEL: Record<PlannerPlanItem["type"], string> = {
  attraction: "관광",
  food: "식사",
  cafe: "카페",
  shopping: "쇼핑",
  activity: "액티비티",
  rest: "휴식",
  transport: "이동",
  other: "기타",
};

const TRAVEL_MODE_LABEL: Record<
  NonNullable<NonNullable<PlannerPlanItem["travelToNext"]>["mode"]>,
  string
> = {
  walk: "도보",
  public_transit: "대중교통",
  taxi: "택시",
  car: "차량",
  other: "이동",
};

function formatDateKo(ymd: string): string {
  const [y, m, d] = ymd.split("-");
  if (!y || !m || !d) return ymd;
  return `${y}.${m}.${d}`;
}

type PlannerDaySectionProps = {
  day: PlannerPlanDay;
};

export function PlannerDaySection({ day }: PlannerDaySectionProps) {
  return (
    <section className="space-y-4 rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-4 sm:p-5">
      <header className="space-y-1">
        <p className="type-caption font-semibold tracking-wide text-[var(--text-muted)]">
          DAY {day.day} · {formatDateKo(day.date)}
        </p>
        <h2 className="type-h3 text-[var(--foreground)]">{day.title}</h2>
        <p className="type-small leading-relaxed text-[var(--text-secondary)]">{day.summary}</p>
      </header>

      <ol className="space-y-4">
        {day.items.map((item) => (
          <li key={`${day.day}-${item.order}`} className="space-y-2">
            <div className="flex flex-wrap items-center gap-2">
              {item.time ? (
                <span className="type-caption font-semibold tabular-nums text-[var(--primary)]">
                  {item.time}
                </span>
              ) : null}
              <Badge variant="neutral">{ITEM_TYPE_LABEL[item.type]}</Badge>
              {item.bookingRecommended ? <Badge variant="primary">예약 권장</Badge> : null}
            </div>
            <div>
              <p className="type-body font-semibold text-[var(--foreground)]">{item.name}</p>
              {item.area ? (
                <p className="type-caption text-[var(--text-muted)]">{item.area}</p>
              ) : null}
              <p className="mt-1 type-small leading-relaxed text-[var(--text-secondary)]">
                {item.description}
              </p>
              {item.estimatedDurationMinutes != null ? (
                <p className="mt-1 type-caption text-[var(--text-muted)]">
                  약 {item.estimatedDurationMinutes}분
                </p>
              ) : null}
            </div>
            {item.travelToNext ? (
              <p className="type-caption text-[var(--text-muted)]">
                ↓{" "}
                {item.travelToNext.mode
                  ? TRAVEL_MODE_LABEL[item.travelToNext.mode]
                  : "이동"}
                {item.travelToNext.estimatedMinutes != null
                  ? ` 약 ${item.travelToNext.estimatedMinutes}분`
                  : ""}
              </p>
            ) : null}
          </li>
        ))}
      </ol>

      {day.tips.length > 0 ? (
        <ul className="space-y-1 rounded-xl bg-[var(--surface-muted)] px-3 py-2.5">
          {day.tips.map((tip) => (
            <li key={tip} className="type-caption text-[var(--text-secondary)]">
              · {tip}
            </li>
          ))}
        </ul>
      ) : null}
    </section>
  );
}
