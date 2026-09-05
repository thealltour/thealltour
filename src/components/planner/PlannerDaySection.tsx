"use client";

import { Badge } from "@/components/ui/Badge";
import type { PlannerPlanDay, PlannerPlanItem } from "@/lib/planner/planSchemas";
import type { PlannerPlaceEnrichmentItem, PlannerWeatherDay } from "@/lib/planner/enrichmentTypes";

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

function weatherLine(day: PlannerWeatherDay | undefined): string | null {
  if (!day) return null;
  const temp =
    day.minC != null && day.maxC != null
      ? `${Math.round(day.minC)}~${Math.round(day.maxC)}°C`
      : day.maxC != null
        ? `${Math.round(day.maxC)}°C`
        : null;
  return [day.condition, temp].filter(Boolean).join(" · ") || null;
}

type PlannerDaySectionProps = {
  day: PlannerPlanDay;
  placeByOrder?: Map<number, PlannerPlaceEnrichmentItem>;
  weatherDay?: PlannerWeatherDay;
};

export function PlannerDaySection({ day, placeByOrder, weatherDay }: PlannerDaySectionProps) {
  const weatherText = weatherLine(weatherDay);

  return (
    <section className="space-y-4 rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-4 sm:p-5">
      <header className="space-y-1">
        <p className="type-caption font-semibold tracking-wide text-[var(--text-muted)]">
          DAY {day.day} · {formatDateKo(day.date)}
          {weatherText ? ` · ${weatherText}` : ""}
        </p>
        <h2 className="type-h3 text-[var(--foreground)]">{day.title}</h2>
        <p className="type-small leading-relaxed text-[var(--text-secondary)]">{day.summary}</p>
      </header>

      <ol className="space-y-4">
        {day.items.map((item) => {
          const enrichment = placeByOrder?.get(item.order)?.place;
          return (
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
                {enrichment?.status === "resolved" && enrichment.formattedAddress ? (
                  <p className="type-caption text-[var(--text-muted)]">{enrichment.formattedAddress}</p>
                ) : null}
                {enrichment?.status === "ambiguous" ? (
                  <p className="type-caption text-[var(--text-muted)]">
                    장소 정보를 정확히 확인하지 못했습니다.
                  </p>
                ) : null}
                {enrichment?.status === "resolved" && enrichment.googleMapsUri ? (
                  <a
                    href={enrichment.googleMapsUri}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="mt-1 inline-block type-caption font-medium text-[var(--primary)] underline-offset-2 hover:underline"
                  >
                    지도에서 보기
                  </a>
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
          );
        })}
      </ol>

      {day.tips.length > 0 ? (
        <ul className="space-y-1 border-t border-[var(--divider)] pt-3">
          {day.tips.map((tip) => (
            <li key={tip} className="type-caption text-[var(--text-muted)]">
              · {tip}
            </li>
          ))}
        </ul>
      ) : null}
    </section>
  );
}
