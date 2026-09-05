"use client";

import { Badge } from "@/components/ui/Badge";
import { PlannerDayMap, type PlannerMapMarker } from "@/components/planner/PlannerDayMap";
import type { PlannerPlanDay, PlannerPlanItem } from "@/lib/planner/planSchemas";
import type {
  PlannerPlaceEnrichmentItem,
  PlannerRouteEnrichment,
  PlannerWeatherDay,
} from "@/lib/planner/enrichmentTypes";
import { formatDistanceMeters } from "@/lib/planner/routePairs";

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
      <header className="space-y-1">
        <p className="type-caption font-semibold tracking-wide text-[var(--text-muted)]">
          DAY {day.day}
          {formatDateKo(day.date) ? ` · ${formatDateKo(day.date)}` : ""}
          {weatherText ? ` · ${weatherText}` : ""}
        </p>
        <h2 className="type-h3 text-[var(--foreground)]">{day.title}</h2>
        <p className="type-small leading-relaxed text-[var(--text-secondary)]">{day.summary}</p>
      </header>

      {markers.length > 0 ? (
        <PlannerDayMap sessionId={sessionId} dayNumber={day.day} markers={markers} />
      ) : null}

      <ol className="space-y-4">
        {day.items.map((item) => {
          const enrichment = placeByOrder?.get(item.order)?.place;
          const route = routeByFromOrder?.get(item.order);
          const nextItem = day.items.find((x) => x.order === item.order + 1);
          const showTravel = Boolean(item.travelToNext) || Boolean(nextItem);

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
              {showTravel ? (
                <TravelLine item={item} route={route} />
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

function TravelLine({
  item,
  route,
}: {
  item: PlannerPlanItem;
  route: PlannerRouteEnrichment | undefined;
}) {
  if (route?.status === "resolved" && route.durationMinutes != null) {
    const dist = formatDistanceMeters(route.distanceMeters);
    return (
      <p className="type-caption text-[var(--text-muted)]">
        ↓ {ROUTE_MODE_LABEL[route.mode]} 약 {route.durationMinutes}분
        {dist ? ` · ${dist}` : ""}
        <span className="ml-1 text-[var(--text-subtle)]">(지도 기준)</span>
      </p>
    );
  }

  if (!item.travelToNext) return null;

  return (
    <p className="type-caption text-[var(--text-muted)]">
      ↓{" "}
      {item.travelToNext.mode ? TRAVEL_MODE_LABEL[item.travelToNext.mode] : "이동"}
      {item.travelToNext.estimatedMinutes != null
        ? ` 예상 이동 약 ${item.travelToNext.estimatedMinutes}분`
        : ""}
    </p>
  );
}
