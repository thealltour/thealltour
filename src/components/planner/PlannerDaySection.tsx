"use client";

import { PlannerDayMap, type PlannerMapMarker } from "@/components/planner/PlannerDayMap";
import { getPlannerIconToneClasses } from "@/components/planner/conversation/plannerConversationIcons";
import { ITEM_TYPE_VISUALS } from "@/components/planner/plannerResultVisuals";
import type { PlannerPlanDay, PlannerPlanItem } from "@/lib/planner/planSchemas";
import type {
  PlannerPlaceEnrichmentItem,
  PlannerRouteEnrichment,
  PlannerWeatherDay,
} from "@/lib/planner/enrichmentTypes";
import { formatDistanceMeters } from "@/lib/planner/routePairs";
import { cn } from "@/lib/cn";

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

const ROUTE_MODE_LABEL: Record<PlannerRouteEnrichment["mode"], string> = {
  walk: "도보",
  public_transit: "대중교통",
  drive: "차량",
  other: "이동",
};

function formatDateKo(ymd: string | null | undefined): string | null {
  if (!ymd) return null;
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

function resolveTravelCopy(
  item: PlannerPlanItem,
  route: PlannerRouteEnrichment | undefined,
): string | null {
  if (route?.status === "resolved" && route.durationMinutes != null) {
    const dist = formatDistanceMeters(route.distanceMeters);
    return [
      `${ROUTE_MODE_LABEL[route.mode]} · 약 ${route.durationMinutes}분`,
      dist,
      "(지도 기준)",
    ]
      .filter(Boolean)
      .join(" · ");
  }

  if (!item.travelToNext) return null;

  const mode = item.travelToNext.mode
    ? TRAVEL_MODE_LABEL[item.travelToNext.mode]
    : "이동";
  if (item.travelToNext.estimatedMinutes != null) {
    return `${mode} · 약 ${item.travelToNext.estimatedMinutes}분`;
  }
  return mode;
}

type PlannerDaySectionProps = {
  day: PlannerPlanDay;
  sessionId: string;
  placeByOrder?: Map<number, PlannerPlaceEnrichmentItem>;
  routeByFromOrder?: Map<number, PlannerRouteEnrichment>;
  weatherDay?: PlannerWeatherDay;
};

export function PlannerDaySection({
  day,
  sessionId,
  placeByOrder,
  routeByFromOrder,
  weatherDay,
}: PlannerDaySectionProps) {
  const weatherText = weatherLine(weatherDay);
  const dateText = formatDateKo(day.date);
  const metaBits = [dateText, weatherText].filter(Boolean).join(" · ");

  const markers: PlannerMapMarker[] = day.items
    .map((item) => {
      const place = placeByOrder?.get(item.order)?.place;
      if (place?.status !== "resolved" || !place.location) return null;
      return {
        order: item.order,
        title: place.displayName || item.name,
        address: place.formattedAddress,
        lat: place.location.lat,
        lng: place.location.lng,
      };
    })
    .filter((m): m is PlannerMapMarker => m != null);

  return (
    <section className="space-y-4 rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-4 sm:p-5">
      <header className="space-y-1.5">
        <div className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-0.5">
          <p className="type-caption font-bold tracking-[0.08em] text-[var(--primary)]">
            DAY {day.day}
          </p>
          {metaBits ? (
            <p className="type-caption text-[var(--text-muted)]">{metaBits}</p>
          ) : null}
        </div>
        <h2 className="type-h3 text-[var(--foreground)]">{day.title}</h2>
        <p className="type-small leading-snug text-[var(--text-muted)]">{day.summary}</p>
      </header>

      {markers.length > 0 ? (
        <PlannerDayMap sessionId={sessionId} dayNumber={day.day} markers={markers} />
      ) : null}

      <ol className="space-y-0">
        {day.items.map((item, index) => {
          const enrichment = placeByOrder?.get(item.order)?.place;
          const route = routeByFromOrder?.get(item.order);
          const isLast = index === day.items.length - 1;
          const travelCopy = resolveTravelCopy(item, route);
          const showTravelConnector = Boolean(travelCopy);
          const visual = ITEM_TYPE_VISUALS[item.type];
          const Icon = visual.icon;
          const tone = getPlannerIconToneClasses(visual.tone);
          const hasSecondary =
            Boolean(item.area) ||
            (enrichment?.status === "resolved" && Boolean(enrichment.formattedAddress)) ||
            enrichment?.status === "ambiguous" ||
            (enrichment?.status === "resolved" && Boolean(enrichment.googleMapsUri)) ||
            item.bookingRecommended;

          return (
            <li key={`${day.day}-${item.order}`} className="relative">
              <div className="grid grid-cols-[3.25rem_2rem_minmax(0,1fr)] gap-x-2">
                <div className="pt-1.5 text-right">
                  {item.time ? (
                    <span className="type-caption font-semibold tabular-nums text-[var(--foreground)]">
                      {item.time}
                    </span>
                  ) : null}
                </div>

                <div className="relative flex flex-col items-center" aria-hidden={true}>
                  <span
                    className={cn(
                      "relative z-[1] inline-flex h-7 w-7 shrink-0 items-center justify-center rounded-full",
                      tone.container,
                    )}
                  >
                    <Icon className={cn("h-3.5 w-3.5", tone.icon)} />
                  </span>
                  {!isLast || showTravelConnector ? (
                    <span
                      className="absolute top-7 bottom-0 w-px bg-[var(--border)]"
                      aria-hidden={true}
                    />
                  ) : null}
                </div>

                <div className={cn("min-w-0 pb-4", isLast && !showTravelConnector && "pb-0")}>
                  <div className="flex flex-wrap items-center gap-x-2 gap-y-0.5">
                    <span className="type-caption text-[var(--text-muted)]">
                      {ITEM_TYPE_LABEL[item.type]}
                    </span>
                    {item.bookingRecommended ? (
                      <span className="rounded-md bg-[var(--surface-muted)] px-1.5 py-0.5 type-caption text-[var(--text-subtle)]">
                        예약 권장
                      </span>
                    ) : null}
                  </div>
                  <p className="mt-0.5 type-body break-words font-semibold text-[var(--foreground)]">
                    {item.name}
                  </p>
                  <p className="mt-1 type-small break-words leading-relaxed text-[var(--text-secondary)]">
                    {item.description}
                  </p>
                  {item.estimatedDurationMinutes != null ? (
                    <p className="mt-1.5 type-caption text-[var(--text-muted)]">
                      약 {item.estimatedDurationMinutes}분
                    </p>
                  ) : null}
                </div>
              </div>

              {showTravelConnector ? (
                <div
                  className="grid grid-cols-[3.25rem_2rem_minmax(0,1fr)] gap-x-2"
                  data-testid={`planner-travel-connector-${day.day}-${item.order}`}
                >
                  <div aria-hidden={true} />
                  <div className="relative flex justify-center" aria-hidden={true}>
                    {!isLast ? (
                      <span className="absolute inset-y-0 w-px bg-[var(--border)]" />
                    ) : null}
                    <span className="relative z-[1] type-caption leading-none text-[var(--text-muted)]">
                      ↓
                    </span>
                  </div>
                  <p className={cn("type-caption text-[var(--text-muted)]", !isLast && "pb-3")}>
                    {travelCopy}
                  </p>
                </div>
              ) : null}

              {hasSecondary ? (
                <div className="grid grid-cols-[3.25rem_2rem_minmax(0,1fr)] gap-x-2">
                  <div aria-hidden={true} />
                  <div aria-hidden={true} />
                  <details className={cn("group min-w-0", !isLast && "pb-4")}>
                    <summary
                      className={cn(
                        "cursor-pointer list-none type-caption font-medium text-[var(--primary)]",
                        "underline-offset-2 hover:underline",
                        "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--focus-ring)]",
                        "[&::-webkit-details-marker]:hidden",
                      )}
                    >
                      <span className="group-open:hidden">자세히</span>
                      <span className="hidden group-open:inline">접기</span>
                    </summary>
                    <div className="mt-2 space-y-1">
                      {item.area ? (
                        <p className="type-caption text-[var(--text-muted)]">{item.area}</p>
                      ) : null}
                      {enrichment?.status === "resolved" && enrichment.formattedAddress ? (
                        <p className="type-caption text-[var(--text-muted)]">
                          {enrichment.formattedAddress}
                        </p>
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
                          className="inline-block type-caption font-medium text-[var(--primary)] underline-offset-2 hover:underline"
                        >
                          지도에서 보기
                        </a>
                      ) : null}
                    </div>
                  </details>
                </div>
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
