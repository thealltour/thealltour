"use client";

import { PlannerAffiliateOffersProvider } from "@/components/planner/PlannerAffiliateOffers";
import { PlannerDayNavigation } from "@/components/planner/PlannerDayNavigation";
import { PlannerDaySection } from "@/components/planner/PlannerDaySection";
import {
  PlannerEditPanel,
  type PlannerPlanUpdatedPayload,
} from "@/components/planner/PlannerEditPanel";
import {
  emptyItemEditValues,
  itemToEditValues,
  PlannerDayTitleEditModal,
  PlannerItemDeleteModal,
  PlannerItemEditModal,
  type ItemEditValues,
} from "@/components/planner/PlannerManualEditModals";
import { PlannerPlanSummary } from "@/components/planner/PlannerPlanSummary";
import { PlannerPreparationHub } from "@/components/planner/PlannerPreparationHub";
import { PlannerContinuationBanner } from "@/components/planner/PlannerContinuationBanner";
import { PlannerSavePanel } from "@/components/planner/PlannerSavePanel";
import {
  usePlannerDayScrollSpy,
  usePrefersReducedMotion,
} from "@/components/planner/usePlannerDayScrollSpy";
import { Button } from "@/components/ui/Button";
import { getItemOffersForDay } from "@/lib/affiliate/planner/contextualOffers";
import {
  trackPlannerDayNavigationClick,
  trackPlannerManualEditModeStarted,
  trackPlannerManualItemAdded,
  trackPlannerManualItemDeleted,
  trackPlannerManualItemMoved,
  trackPlannerManualItemUpdated,
  trackPlannerManualDayUpdated,
} from "@/lib/analytics/trackPlannerEvents";
import { postPlannerManualEdit } from "@/lib/planner/manualEdit/client";
import type { PlannerManualCommand } from "@/lib/planner/manualEdit/types";
import type {
  PlannerEnrichmentDto,
  PlannerPlaceEnrichmentItem,
  PlannerRouteEnrichment,
  PlannerWeatherDay,
} from "@/lib/planner/enrichmentTypes";
import type { PlannerPlan, PlannerPlanItem } from "@/lib/planner/planSchemas";
import type { PlannerPace } from "@/types/planner";
import { Pencil } from "lucide-react";
import { useCallback, useMemo, useState } from "react";

type PlannerResultViewProps = {
  plan: PlannerPlan;
  updatedAt: string;
  sessionId: string;
  sourceProductId: string | null;
  isSaved: boolean;
  /** True when session.member_id matches cookie member (claimed or created while logged in). */
  isMemberLinked: boolean;
  enrichment: PlannerEnrichmentDto | null;
  originText?: string | null;
  pace?: PlannerPace | null;
  onSaved: (meta?: { updatedAt?: string }) => void;
  onMemberLinked: (meta: { updatedAt: string }) => void;
  onPlanUpdated: (payload: PlannerPlanUpdatedPayload) => void;
  onReloadLatest: () => void;
  /** Incremented by the loader on every plan update; refreshes affiliate offers. */
  planRevision?: number;
};

type ModalState =
  | { kind: "none" }
  | { kind: "day_title"; dayNumber: number }
  | { kind: "item_edit"; dayNumber: number; itemOrder: number }
  | { kind: "item_add"; dayNumber: number }
  | { kind: "item_delete"; dayNumber: number; itemOrder: number; name: string };

function parseDuration(raw: string): number | null | undefined {
  const t = raw.trim();
  if (!t) return null;
  const n = Number(t);
  if (!Number.isFinite(n) || n <= 0) return undefined;
  return Math.round(n);
}

export function PlannerResultView({
  plan,
  updatedAt,
  sessionId,
  sourceProductId,
  isSaved,
  isMemberLinked,
  enrichment,
  originText,
  pace,
  onSaved,
  onMemberLinked,
  onPlanUpdated,
  onReloadLatest,
  planRevision = 0,
}: PlannerResultViewProps) {
  const dayNumbers = useMemo(() => plan.days.map((d) => d.day), [plan.days]);
  const firstDay = dayNumbers[0] ?? 1;
  const [activeDayState, setActiveDay] = useState(firstDay);
  const activeDay = dayNumbers.includes(activeDayState) ? activeDayState : firstDay;
  const [suppressSpy, setSuppressSpy] = useState(false);
  const reducedMotion = usePrefersReducedMotion();
  const [manualEditMode, setManualEditMode] = useState(false);
  const [modal, setModal] = useState<ModalState>({ kind: "none" });
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [conflict, setConflict] = useState(false);
  const [statusHint, setStatusHint] = useState<string | null>(null);

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

      window.setTimeout(() => setSuppressSpy(false), reducedMotion ? 50 : 700);
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

  function closeModal() {
    if (busy) return;
    setModal({ kind: "none" });
    setError(null);
    setConflict(false);
  }

  function handleConflictReload() {
    setModal({ kind: "none" });
    setError(null);
    setConflict(false);
    onReloadLatest();
  }

  async function runManual(command: PlannerManualCommand, onSuccessTrack: () => void) {
    setBusy(true);
    setError(null);
    setConflict(false);
    try {
      const result = await postPlannerManualEdit({
        sessionId,
        command: { ...command, expectedUpdatedAt: updatedAt },
      });
      if (!result.ok) {
        if (result.code === "PLAN_VERSION_CONFLICT") {
          setConflict(true);
          setError(result.message);
          return;
        }
        setError(result.message);
        return;
      }
      onPlanUpdated({ plan: result.plan, updatedAt: result.updatedAt });
      onSuccessTrack();
      setModal({ kind: "none" });
      setStatusHint("일정이 수정됐어요.");
      window.setTimeout(() => setStatusHint(null), 2500);
    } catch {
      setError("일정을 수정하지 못했습니다. 잠시 후 다시 시도해 주세요.");
    } finally {
      setBusy(false);
    }
  }

  const editingDay =
    modal.kind === "day_title" ||
    modal.kind === "item_edit" ||
    modal.kind === "item_add" ||
    modal.kind === "item_delete"
      ? plan.days.find((d) => d.day === modal.dayNumber)
      : undefined;

  const editingItem: PlannerPlanItem | undefined =
    modal.kind === "item_edit"
      ? editingDay?.items.find((i) => i.order === modal.itemOrder)
      : undefined;

  return (
    <PlannerAffiliateOffersProvider
      sessionId={sessionId}
      sourceProductId={sourceProductId}
      planRevision={planRevision}
    >
      {(affiliateOffers) => (
        <div
          className="mx-auto w-full max-w-2xl space-y-5 px-4 py-6 pb-[calc(6.5rem+env(safe-area-inset-bottom,0px))] sm:space-y-6 sm:px-0 sm:py-10 lg:pb-10"
          data-testid="planner-result-view"
        >
          <PlannerPlanSummary plan={plan} originText={originText} pace={pace} />

          <div
            className="grid grid-cols-2 gap-2 sm:gap-3"
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
              onRequestManualEdit={() => {
                setManualEditMode(true);
                trackPlannerManualEditModeStarted({
                  sessionId,
                  destination: plan.destination.name,
                  sourceProductId,
                });
              }}
              compact
            />
          </div>

          {!isSaved && !isMemberLinked ? (
            <PlannerContinuationBanner
              sessionId={sessionId}
              onClaimed={(meta) => onMemberLinked({ updatedAt: meta.updatedAt })}
            />
          ) : null}

          <div className="flex flex-wrap items-center gap-2" data-testid="planner-manual-edit-entry">
            {manualEditMode ? (
              <>
                <p className="type-caption font-medium text-[var(--primary)]" role="status">
                  직접 수정 중
                </p>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => {
                    setManualEditMode(false);
                    closeModal();
                  }}
                >
                  수정 종료
                </Button>
              </>
            ) : (
              <Button
                type="button"
                variant="outline"
                size="sm"
                className="inline-flex items-center gap-1.5"
                onClick={() => {
                  setManualEditMode(true);
                  trackPlannerManualEditModeStarted({
                    sessionId,
                    destination: plan.destination.name,
                    sourceProductId,
                  });
                }}
              >
                <Pencil className="h-3.5 w-3.5" aria-hidden={true} />
                직접 수정
              </Button>
            )}
            {statusHint ? (
              <p className="type-caption text-[var(--text-secondary)]" role="status">
                {statusHint}
              </p>
            ) : null}
          </div>

          <PlannerPreparationHub
            offers={affiliateOffers}
            sessionId={sessionId}
            sourceProductId={sourceProductId}
            originText={originText}
            destinationName={plan.destination.name}
            startDate={plan.tripOverview.startDate}
            endDate={plan.tripOverview.endDate}
          />

          <div className="space-y-4">
            <div>
              <h2 className="type-body font-semibold text-[var(--foreground)]">일정</h2>
              <p className="mt-0.5 type-caption text-[var(--text-muted)]">
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
                  itemOffers={getItemOffersForDay(affiliateOffers, day.day)}
                  sourceProductId={sourceProductId}
                  manualEditMode={manualEditMode}
                  onEditDayTitle={() => {
                    setError(null);
                    setConflict(false);
                    setModal({ kind: "day_title", dayNumber: day.day });
                  }}
                  onEditItem={(itemOrder) => {
                    setError(null);
                    setConflict(false);
                    setModal({ kind: "item_edit", dayNumber: day.day, itemOrder });
                  }}
                  onAddItem={() => {
                    setError(null);
                    setConflict(false);
                    setModal({ kind: "item_add", dayNumber: day.day });
                  }}
                  onDeleteItem={(itemOrder, name) => {
                    setError(null);
                    setConflict(false);
                    setModal({ kind: "item_delete", dayNumber: day.day, itemOrder, name });
                  }}
                  onMoveItem={(itemOrder, direction) => {
                    const current = day.items.find((i) => i.order === itemOrder);
                    if (!current) return;
                    const toOrder = direction === "up" ? itemOrder - 1 : itemOrder + 1;
                    if (toOrder < 1 || toOrder > day.items.length) return;
                    void runManual(
                      {
                        operation: "move_item",
                        dayNumber: day.day,
                        itemOrder,
                        toOrder,
                        expectedUpdatedAt: updatedAt,
                      },
                      () =>
                        trackPlannerManualItemMoved({
                          sessionId,
                          dayNumber: day.day,
                          itemType: current.type,
                        }),
                    );
                  }}
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

          <PlannerDayTitleEditModal
            open={modal.kind === "day_title"}
            initialTitle={editingDay?.title ?? ""}
            busy={busy}
            error={error}
            conflict={conflict}
            onClose={closeModal}
            onReload={handleConflictReload}
            onSave={(title) => {
              if (modal.kind !== "day_title") return;
              void runManual(
                {
                  operation: "update_day",
                  dayNumber: modal.dayNumber,
                  patch: { title },
                  expectedUpdatedAt: updatedAt,
                },
                () =>
                  trackPlannerManualDayUpdated({
                    sessionId,
                    dayNumber: modal.dayNumber,
                  }),
              );
            }}
          />

          <PlannerItemEditModal
            open={modal.kind === "item_edit" || modal.kind === "item_add"}
            mode={modal.kind === "item_add" ? "add" : "edit"}
            initial={
              modal.kind === "item_edit" && editingItem
                ? itemToEditValues(editingItem)
                : emptyItemEditValues()
            }
            busy={busy}
            error={error}
            conflict={conflict}
            onClose={closeModal}
            onReload={handleConflictReload}
            onSave={(values: ItemEditValues) => {
              const duration = parseDuration(values.estimatedDurationMinutes);
              if (duration === undefined) {
                setError("예상 체류시간은 1~720분 사이 숫자로 입력해 주세요.");
                return;
              }
              if (modal.kind === "item_add") {
                void runManual(
                  {
                    operation: "add_item",
                    dayNumber: modal.dayNumber,
                    item: {
                      name: values.name.trim(),
                      time: values.time.trim() ? values.time.trim() : null,
                      description: values.description.trim() || undefined,
                      type: values.type,
                      area: values.area.trim() ? values.area.trim() : null,
                      estimatedDurationMinutes: duration,
                    },
                    expectedUpdatedAt: updatedAt,
                  },
                  () =>
                    trackPlannerManualItemAdded({
                      sessionId,
                      dayNumber: modal.dayNumber,
                      itemType: values.type,
                    }),
                );
                return;
              }
              if (modal.kind !== "item_edit") return;
              if (!values.description.trim()) {
                setError("설명을 입력해 주세요.");
                return;
              }
              void runManual(
                {
                  operation: "update_item",
                  dayNumber: modal.dayNumber,
                  itemOrder: modal.itemOrder,
                  patch: {
                    time: values.time.trim() ? values.time.trim() : null,
                    name: values.name.trim(),
                    area: values.area.trim() ? values.area.trim() : null,
                    description: values.description.trim(),
                    type: values.type,
                    estimatedDurationMinutes: duration,
                  },
                  expectedUpdatedAt: updatedAt,
                },
                () =>
                  trackPlannerManualItemUpdated({
                    sessionId,
                    dayNumber: modal.dayNumber,
                    itemType: values.type,
                  }),
              );
            }}
          />

          <PlannerItemDeleteModal
            open={modal.kind === "item_delete"}
            itemName={modal.kind === "item_delete" ? modal.name : ""}
            busy={busy}
            error={error}
            conflict={conflict}
            onClose={closeModal}
            onReload={handleConflictReload}
            onConfirm={() => {
              if (modal.kind !== "item_delete") return;
              const day = plan.days.find((d) => d.day === modal.dayNumber);
              const target = day?.items.find((i) => i.order === modal.itemOrder);
              void runManual(
                {
                  operation: "delete_item",
                  dayNumber: modal.dayNumber,
                  itemOrder: modal.itemOrder,
                  expectedUpdatedAt: updatedAt,
                },
                () =>
                  trackPlannerManualItemDeleted({
                    sessionId,
                    dayNumber: modal.dayNumber,
                    itemType: target?.type,
                  }),
              );
            }}
          />
        </div>
      )}
    </PlannerAffiliateOffersProvider>
  );
}
