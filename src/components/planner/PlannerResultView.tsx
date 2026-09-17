"use client";

import {
  PlannerAffiliateDaySlot,
  PlannerAffiliateOffersProvider,
} from "@/components/planner/PlannerAffiliateOffers";
import { PlannerBookingSurface } from "@/components/planner/PlannerBookingSurface";
import { PlannerDayNavigation } from "@/components/planner/PlannerDayNavigation";
import { PlannerDaySection } from "@/components/planner/PlannerDaySection";
import { PlannerEditPanel } from "@/components/planner/PlannerEditPanel";
import { PlannerPlanSummary } from "@/components/planner/PlannerPlanSummary";
import { PlannerSavePanel } from "@/components/planner/PlannerSavePanel";
import {
  usePlannerDayScrollSpy,
  usePrefersReducedMotion,
} from "@/components/planner/usePlannerDayScrollSpy";
import { trackPlannerDayNavigationClick } from "@/lib/analytics/trackPlannerEvents";
import type {
  PlannerEnrichmentDto,
  PlannerPlaceEnrichmentItem,
  PlannerRouteEnrichment,
  PlannerWeatherDay,
} from "@/lib/planner/enrichmentTypes";
import type { PlannerPlan } from "@/lib/planner/planSchemas";
import { useCallback, useMemo, useState } from "react";

type PlannerResultViewProps = {
  plan: PlannerPlan;
  sessionId: string;
  sourceProductId: string | null;
  isSaved: boolean;
  enrichment: PlannerEnrichmentDto | null;
  originText?: string | null;
  onSaved: () => void;
  onPlanUpdated: (plan: PlannerPlan) => void;
};

export function PlannerResultView({
  plan,
  sessionId,
  sourceProductId,
  isSaved,
  enrichment,
  originText,
  onSaved,
  onPlanUpdated,
}: PlannerResultViewProps) {
  const dayNumbers = useMemo(() => plan.days.map((d) => d.day), [plan.days]);
  const firstDay = dayNumbers[0] ?? 1;
  const [activeDayState, setActiveDay] = useState(firstDay);
  const activeDay = dayNumbers.includes(activeDayState) ? activeDayState : firstDay;
  const [suppressSpy, setSuppressSpy] = useState(false);
  const reducedMotion = usePrefersReducedMotion();

  const handleSpyActiveDay = useCallback((dayNumber: number) => {
    setActiveDay(dayNumber);
  }, []);

  usePlannerDayScrollSpy({
    dayNumbers,
    suppressUpdates: suppressSpy,
    onActiveDayChange: handleSpyActiveDay,
  });

  const handleDaySelect = useCallback(
    (dayNumber: number) => {
      const dayIndex = dayNumbers.indexOf(dayNumber);
      setActiveDay(dayNumber);
      setSuppressSpy(true);
      trackPlannerDayNavigationClick({
        sessionId,
        dayNumber,
        dayIndex: dayIndex >= 0 ? dayIndex : 0,
      });

      const el = document.getElementById(`planner-day-${dayNumber}`);
      el?.scrollIntoView({
        behavior: reducedMotion ? "auto" : "smooth",
        block: "start",
      });

      window.setTimeout(
        () => setSuppressSpy(false),
        reducedMotion ? 50 : 700,
      );
    },
    [dayNumbers, reducedMotion, sessionId],
  );

  const placesByDay = useMemo(() => {
    const map = new Map<number, Map<number, PlannerPlaceEnrichmentItem>>();
    if (!enrichment) return map;
    for (const item of enrichment.places) {
      let dayMap = map.get(item.dayNumber);
      if (!dayMap) {
        dayMap = new Map();
        map.set(item.dayNumber, dayMap);
      }
      dayMap.set(item.itemOrder, item);
    }
    return map;
  }, [enrichment]);

  const routesByDay = useMemo(() => {
    const map = new Map<number, Map<number, PlannerRouteEnrichment>>();
    if (!enrichment?.routes) return map;
    for (const route of enrichment.routes) {
      let dayMap = map.get(route.day);
      if (!dayMap) {
        dayMap = new Map();
        map.set(route.day, dayMap);
      }
      dayMap.set(route.fromOrder, route);
    }
    return map;
  }, [enrichment]);

  const weatherByDate = useMemo(() => {
    const map = new Map<string, PlannerWeatherDay>();
    if (!enrichment || enrichment.weather.availability !== "forecast") return map;
    for (const d of enrichment.weather.days) map.set(d.date, d);
    return map;
  }, [enrichment]);

  const noticeLines = useMemo(() => {
    const lines: string[] = [];
    lines.push(
      "AI가 입력하신 여행 조건을 바탕으로 만든 초안입니다. 운영시간·휴무·현지 사정은 여행 전 다시 확인해 주세요.",
    );
    if (enrichment?.partialFailure) {
      lines.push("일부 장소 정보를 확인하지 못했습니다.");
    }
    const weatherAvailability = enrichment?.weather.availability;
    if (weatherAvailability === "date_not_set") {
      lines.push("여행 날짜를 정하면 최신 날씨를 확인할 수 있어요.");
    } else if (
      weatherAvailability === "too_early" ||
      (Boolean(enrichment?.message?.includes("날씨")) && weatherAvailability !== "forecast")
    ) {
      lines.push("여행일이 가까워지면 최신 날씨를 확인할 수 있어요.");
    } else if (weatherAvailability === "forecast") {
      lines.push("날씨는 변동될 수 있습니다.");
    }
    return lines;
  }, [enrichment]);

  return (
    <PlannerAffiliateOffersProvider sessionId={sessionId} sourceProductId={sourceProductId}>
      {(affiliateOffers) => (
        <div
          className="mx-auto w-full max-w-2xl space-y-6 px-4 py-6 sm:space-y-8 sm:px-0 sm:py-12"
          data-testid="planner-result-view"
        >
          <PlannerPlanSummary plan={plan} originText={originText} />

          <div
            className="grid grid-cols-1 gap-2 sm:grid-cols-2 sm:gap-3"
            data-testid="planner-result-actions"
          >
            <PlannerSavePanel
              sessionId={sessionId}
              destination={plan.destination.name}
              sourceProductId={sourceProductId}
              isSaved={isSaved}
              onSaved={onSaved}
              compact
            />
            <PlannerEditPanel
              sessionId={sessionId}
              destination={plan.destination.name}
              sourceProductId={sourceProductId}
              status={isSaved ? "saved" : "generated"}
              onPlanUpdated={onPlanUpdated}
              compact
            />
          </div>

          <PlannerBookingSurface
            offers={affiliateOffers}
            sessionId={sessionId}
            sourceProductId={sourceProductId}
            originText={originText}
            destinationName={plan.destination.name}
            startDate={plan.tripOverview.startDate}
            endDate={plan.tripOverview.endDate}
          />

          <div className="space-y-5">
            <div>
              <h2 className="type-h3 text-[var(--foreground)]">일자별 일정</h2>
              <p className="mt-1 type-caption text-[var(--text-muted)]">
                이동시간은 교통상황에 따라 달라질 수 있습니다.
              </p>
            </div>

            <PlannerDayNavigation
              days={plan.days}
              activeDay={activeDay}
              onDaySelect={handleDaySelect}
              reducedMotion={reducedMotion}
            />

            {plan.days.map((day) => (
              <section
                key={`${day.day}-${day.date ?? "flex"}-${day.title}`}
                id={`planner-day-${day.day}`}
                data-planner-day={day.day}
                data-testid={`planner-day-section-${day.day}`}
                className="scroll-mt-[calc(var(--planner-result-day-nav-top)+var(--planner-day-nav-height))] space-y-3 lg:scroll-mt-[calc(108px+var(--planner-day-nav-height))]"
              >
                <PlannerDaySection
                  day={day}
                  sessionId={sessionId}
                  placeByOrder={placesByDay.get(day.day)}
                  routeByFromOrder={routesByDay.get(day.day)}
                  weatherDay={day.date ? weatherByDate.get(day.date) : undefined}
                />
                <PlannerAffiliateDaySlot
                  offers={affiliateOffers}
                  dayNumber={day.day}
                  sessionId={sessionId}
                  sourceProductId={sourceProductId}
                />
              </section>
            ))}
          </div>

          <section
            className="space-y-4 rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-4 sm:p-5"
            data-testid="planner-result-preparation"
          >
            <div>
              <h2 className="type-h3 text-[var(--foreground)]">여행 전에 참고하세요</h2>
              <ul className="mt-2 space-y-1.5">
                {plan.preparation.travelTips.map((tip) => (
                  <li key={tip} className="type-small text-[var(--text-secondary)]">
                    · {tip}
                  </li>
                ))}
              </ul>
            </div>
            <div>
              <h2 className="type-h3 text-[var(--foreground)]">챙기면 좋은 것</h2>
              <ul className="mt-2 space-y-1.5">
                {plan.preparation.packingHints.map((hint) => (
                  <li key={hint} className="type-small text-[var(--text-secondary)]">
                    · {hint}
                  </li>
                ))}
              </ul>
            </div>
          </section>

          {noticeLines.length > 0 ? (
            <section
              className="space-y-2 border-t border-[var(--border)] pt-4"
              data-testid="planner-result-notices"
              aria-label="알아두세요"
            >
              <h2 className="type-caption font-semibold text-[var(--text-muted)]">알아두세요</h2>
              <ul className="space-y-1.5">
                {noticeLines.map((line) => (
                  <li key={line} className="type-caption leading-relaxed text-[var(--text-muted)]">
                    · {line}
                  </li>
                ))}
              </ul>
            </section>
          ) : null}
        </div>
      )}
    </PlannerAffiliateOffersProvider>
  );
}
