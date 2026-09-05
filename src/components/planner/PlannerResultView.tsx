"use client";

import AlertCard from "@/components/ui/AlertCard";
import { PlannerDaySection } from "@/components/planner/PlannerDaySection";
import { PlannerEditPanel } from "@/components/planner/PlannerEditPanel";
import { PlannerPlanSummary } from "@/components/planner/PlannerPlanSummary";
import { PlannerSavePanel } from "@/components/planner/PlannerSavePanel";
import type {
  PlannerEnrichmentDto,
  PlannerPlaceEnrichmentItem,
  PlannerRouteEnrichment,
  PlannerWeatherDay,
} from "@/lib/planner/enrichmentTypes";
import type { PlannerPlan } from "@/lib/planner/planSchemas";
import { useMemo } from "react";

type PlannerResultViewProps = {
  plan: PlannerPlan;
  sessionId: string;
  sourceProductId: string | null;
  isSaved: boolean;
  enrichment: PlannerEnrichmentDto | null;
  onSaved: () => void;
  onPlanUpdated: (plan: PlannerPlan) => void;
};

export function PlannerResultView({
  plan,
  sessionId,
  sourceProductId,
  isSaved,
  enrichment,
  onSaved,
  onPlanUpdated,
}: PlannerResultViewProps) {
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

  return (
    <div className="mx-auto w-full max-w-2xl space-y-8 px-4 py-8 sm:px-0 sm:py-12">
      <PlannerPlanSummary plan={plan} />

      <div className="space-y-3">
        <PlannerSavePanel
          sessionId={sessionId}
          destination={plan.destination.name}
          sourceProductId={sourceProductId}
          isSaved={isSaved}
          onSaved={onSaved}
        />
        <PlannerEditPanel
          sessionId={sessionId}
          destination={plan.destination.name}
          sourceProductId={sourceProductId}
          status={isSaved ? "saved" : "generated"}
          onPlanUpdated={onPlanUpdated}
        />
      </div>

      {enrichment?.weather.availability === "too_early" ||
      enrichment?.message?.includes("날씨") ? (
        <p className="type-caption text-[var(--text-muted)]">
          여행일이 가까워지면 최신 날씨를 확인할 수 있어요.
        </p>
      ) : null}

      {enrichment?.weather.availability === "forecast" ? (
        <p className="type-caption text-[var(--text-muted)]">날씨는 변동될 수 있습니다.</p>
      ) : null}

      {enrichment?.partialFailure ? (
        <p className="type-caption text-[var(--text-muted)]">
          일부 장소 정보를 확인하지 못했습니다.
        </p>
      ) : null}

      <AlertCard variant="neutral" title="AI 초안 안내">
        <p className="type-small text-[var(--text-secondary)]">
          AI가 입력하신 여행 조건을 바탕으로 만든 초안입니다. 운영시간·휴무·현지 사정은 여행
          전 다시 확인해 주세요.
        </p>
      </AlertCard>

      <div className="space-y-5">
        <h2 className="type-h3 text-[var(--foreground)]">일자별 일정</h2>
        <p className="type-caption text-[var(--text-muted)]">
          이동시간은 교통상황에 따라 달라질 수 있습니다.
        </p>
        {plan.days.map((day) => (
          <PlannerDaySection
            key={`${day.day}-${day.date}-${day.title}`}
            day={day}
            sessionId={sessionId}
            placeByOrder={placesByDay.get(day.day)}
            routeByFromOrder={routesByDay.get(day.day)}
            weatherDay={weatherByDate.get(day.date)}
          />
        ))}
      </div>

      <section className="space-y-4 rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-4 sm:p-5">
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
    </div>
  );
}
