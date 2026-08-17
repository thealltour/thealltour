"use client";

import { useMemo } from "react";
import { Minus, Plus } from "lucide-react";
import { OptionGroup } from "@/components/products/OptionGroup";
import { ProductDepartureCalendarPanel } from "@/components/products/ProductDepartureCalendarPanel";
import {
  MAX_TRAVELER_COUNT,
  MIN_TRAVELER_COUNT,
} from "@/components/products/ProductQuoteContext";
import { sortOptionGroups } from "@/lib/pricing/calcQuote";
import {
  hasAnyOptionSelection,
  optionsSelectionHasMultiGroup,
} from "@/lib/pricing/selectedOptions";
import {
  formatDepartureScheduleChipLabel,
  formatDepartureScheduleInquiryValue,
} from "@/lib/products/normalizeDepartureSchedules";
import { collectProductDepartureDates } from "@/lib/products/productDepartureDates";
import type { SelectedDeparture } from "@/lib/products/buildProductInquiryPrefill";
import type { ProductDepartureSchedule, ProductOptions, Product, SelectedOptions } from "@/types/product";
import { cn } from "@/lib/cn";

export type ProductBookingSelectionPanelVariant = "page" | "rail" | "sheet";

export type ProductBookingSelectionPanelProps = {
  product?: Product | null;
  departureUi?: "chips" | "calendar";
  departures?: string[];
  schedules?: ProductDepartureSchedule[];
  options?: ProductOptions | null;
  selectedDepartureKey: string | null;
  selectedOptions: SelectedOptions;
  travelerCount: number;
  onTravelerCountChange: (count: number) => void;
  onDepartureChange: (departure: SelectedDeparture | null, key: string | null) => void;
  onOptionSingleChange: (groupKey: string, itemValue: string) => void;
  onOptionMultiToggle: (groupKey: string, itemValue: string) => void;
  onConsultClick?: () => void;
  paxDiscountPreview?: { label: string; amount: number } | null;
  variant?: ProductBookingSelectionPanelVariant;
};

type DepartureOption = {
  key: string;
  label: string;
  inquiryValue: string;
  price?: number | null;
  disabled?: boolean;
};

function panelSectionIds(variant: ProductBookingSelectionPanelVariant) {
  if (variant === "sheet") {
    return {
      panel: "product-booking-sheet",
      departure: "product-sheet-departure-section",
      traveler: "product-sheet-traveler-section",
      options: "product-sheet-options-section",
    };
  }
  return {
    panel: "product-booking-panel",
    departure: "product-departure-section",
    traveler: "product-traveler-section",
    options: "product-options-section",
  };
}

function buildDepartureOptions(
  schedules: ProductDepartureSchedule[] | undefined,
  departures: string[],
): DepartureOption[] {
  if (schedules?.length) {
    return schedules.map((schedule, index) => ({
      key: `schedule-${index}-${schedule.departureDate}`,
      label: formatDepartureScheduleChipLabel(schedule),
      inquiryValue: formatDepartureScheduleInquiryValue(schedule),
      price: schedule.price ?? null,
      disabled: schedule.status === "SOLD_OUT",
    }));
  }

  return departures.map((date, index) => ({
    key: `departure-${index}-${date}`,
    label: date,
    inquiryValue: date,
    price: null,
  }));
}

function selectionAreaClass(hasSelection: boolean, compact: boolean): string {
  const pad = compact ? "p-2.5" : "p-3";
  return hasSelection
    ? `rounded-xl border border-solid border-[var(--border)] bg-white ${pad}`
    : `rounded-xl border-2 border-dashed border-slate-300 bg-slate-50/60 ${pad}`;
}

function shouldHideGroupTitle(
  groupTitle: string,
  sectionTitle: string,
  isSingleMultiGroup: boolean,
): boolean {
  if (!isSingleMultiGroup) return false;
  const normalizedGroup = groupTitle.replace(/\s+/g, "");
  const normalizedSection = sectionTitle.replace(/\s+/g, "");
  return normalizedGroup.includes("추가옵션") || normalizedGroup === normalizedSection;
}

/**
 * 출발일 선택 + 옵션 선택 통합 패널
 */
export function ProductBookingSelectionPanel({
  product,
  departureUi = "chips",
  departures = [],
  schedules,
  options,
  selectedDepartureKey,
  selectedOptions,
  travelerCount,
  onTravelerCountChange,
  onDepartureChange,
  onOptionSingleChange,
  onOptionMultiToggle,
  onConsultClick,
  paxDiscountPreview = null,
  variant = "page",
}: ProductBookingSelectionPanelProps) {
  const compact = variant !== "page";
  const ids = panelSectionIds(variant);
  const departureOptions = useMemo(
    () => buildDepartureOptions(schedules, departures),
    [schedules, departures],
  );

  const hasDepartures = departureOptions.length > 0;
  const calendarDepartureCount = useMemo(
    () => (product && departureUi === "calendar" ? collectProductDepartureDates(product).length : 0),
    [product, departureUi],
  );
  const showCalendarDeparture =
    departureUi === "calendar" && Boolean(product) && (calendarDepartureCount > 0 || !hasDepartures);
  const sortedOptionGroups = options?.groups?.length ? sortOptionGroups(options) : [];
  const hasOptions = sortedOptionGroups.length > 0;
  const hasMultiOptions = optionsSelectionHasMultiGroup(sortedOptionGroups);
  const requiredSet = new Set(options?.requiredGroups ?? []);
  const hasDepartureSelection = Boolean(selectedDepartureKey);
  const hasOptionSelection = hasAnyOptionSelection(selectedOptions);
  const isSingleMultiGroup =
    sortedOptionGroups.length === 1 && sortedOptionGroups[0]?.type === "multi";
  const optionsSectionTitle = "추가 옵션·할증 선택";

  if (!hasDepartures && !hasOptions && !showCalendarDeparture) return null;

  const showDepartureSection = hasDepartures || showCalendarDeparture;
  const canDecrease = travelerCount > MIN_TRAVELER_COUNT;
  const canIncrease = travelerCount < MAX_TRAVELER_COUNT;
  const stepperSize = compact ? "h-9 w-9" : "h-11 w-11";

  const travelerSection = (
    <div id={ids.traveler} className="space-y-2 scroll-mt-24">
      <div>
        <h3 className={cn("font-bold text-[#0f172a]", compact ? "text-sm" : "text-base")}>인원</h3>
        {compact ? null : (
          <p className="mt-0.5 text-xs text-slate-500">여행에 참여하는 총 인원을 선택해 주세요.</p>
        )}
      </div>
      <div className={selectionAreaClass(true, compact)}>
        <div className="flex items-center justify-between gap-4 px-1 py-1">
          <span className="text-sm font-medium text-slate-700">총 인원</span>
          <div className="inline-flex items-center gap-3" role="group" aria-label="인원 선택">
            <button
              type="button"
              onClick={() => onTravelerCountChange(travelerCount - 1)}
              disabled={!canDecrease}
              className={cn(
                "inline-flex items-center justify-center rounded-full border-2 transition",
                stepperSize,
                canDecrease
                  ? "border-slate-300 bg-white text-slate-800 hover:border-slate-400 hover:bg-slate-50"
                  : "cursor-not-allowed border-slate-200 bg-slate-100 text-slate-300",
              )}
              aria-label="인원 줄이기"
            >
              <Minus className="h-4 w-4" aria-hidden />
            </button>
            <span
              className={cn(
                "min-w-[3rem] text-center font-bold tabular-nums text-[#0f172a]",
                compact ? "text-base" : "text-lg min-w-[3.5rem]",
              )}
              aria-live="polite"
            >
              {travelerCount}명
            </span>
            <button
              type="button"
              onClick={() => onTravelerCountChange(travelerCount + 1)}
              disabled={!canIncrease}
              className={cn(
                "inline-flex items-center justify-center rounded-full border-2 transition",
                stepperSize,
                canIncrease
                  ? "border-[var(--accent)] bg-[var(--accent-soft)] text-[#0f172a] hover:opacity-90"
                  : "cursor-not-allowed border-slate-200 bg-slate-100 text-slate-300",
              )}
              aria-label="인원 늘리기"
            >
              <Plus className="h-4 w-4" aria-hidden />
            </button>
          </div>
        </div>
        {paxDiscountPreview && paxDiscountPreview.amount > 0 ? (
          <div className="mt-3 rounded-xl border border-[var(--success)]/25 bg-[var(--success-bg)] px-3 py-2.5">
            <div className="flex items-center justify-between gap-2 text-sm font-bold text-[var(--success)]">
              <span>{paxDiscountPreview.label}</span>
              <span className="shrink-0 text-[var(--success)]">
                -{paxDiscountPreview.amount.toLocaleString("ko-KR")}원
              </span>
            </div>
            <p className="mt-1 text-[11px] font-medium text-[var(--success)]">
              동반자 가입 불필요 · 대표 1명 예약 시 전체 인원 자동 할인 적용
            </p>
          </div>
        ) : null}
      </div>
    </div>
  );

  return (
    <section
      id={ids.panel}
      className={cn(
        compact
          ? "@container space-y-0 bg-transparent p-0 shadow-none"
          : "rounded-2xl border-2 border-[var(--primary-soft)] bg-white p-5 shadow-[var(--shadow-soft-strong)] md:p-6",
      )}
      aria-label="출발일 및 옵션 선택"
    >
      {showDepartureSection ? (
        <div id={ids.departure} className="space-y-2 scroll-mt-24">
          <h3 className={cn("font-bold text-[#0f172a]", compact ? "text-sm" : "text-base")}>
            출발일 선택
          </h3>
          {!hasDepartureSelection ? (
            <p className="text-xs font-medium text-[var(--warning)]">
              원하시는 출발일을 1개 선택해 주세요.
            </p>
          ) : null}
          {departureUi === "calendar" && product ? (
            <ProductDepartureCalendarPanel
              product={product}
              schedules={schedules}
              departures={departures}
              selectedDepartureKey={selectedDepartureKey}
              onDepartureChange={onDepartureChange}
              onConsultClick={onConsultClick}
              compact={compact}
            />
          ) : (
            <div className={selectionAreaClass(hasDepartureSelection, compact)}>
              <div className="flex flex-wrap gap-2" role="radiogroup" aria-label="출발일">
                {departureOptions.map((option) => {
                  const active = selectedDepartureKey === option.key;
                  return (
                    <button
                      key={option.key}
                      type="button"
                      disabled={option.disabled}
                      onClick={() => {
                        if (option.disabled || active) return;
                        onDepartureChange(
                          {
                            label: option.label,
                            inquiryValue: option.inquiryValue,
                            price: option.price,
                          },
                          option.key,
                        );
                      }}
                      className={`flex min-h-[40px] items-center gap-3 rounded-xl border-2 px-3 py-2 text-sm font-medium transition
                      ${option.disabled
                        ? "cursor-not-allowed border-slate-200 bg-slate-100 text-slate-400"
                        : active
                          ? "border-[var(--accent)] bg-[var(--accent-soft)] text-[#0f172a] ring-1 ring-[var(--accent)]"
                          : "border-slate-300 bg-slate-50/40 text-slate-800 hover:border-slate-400 hover:bg-slate-50"
                      }`}
                      aria-pressed={active}
                      aria-label={`출발일 ${option.label}${active ? " 선택됨" : ""}${option.disabled ? " 마감" : ""}`}
                    >
                      <span
                        className={`flex h-4 w-4 shrink-0 items-center justify-center rounded-full border-2 ${
                          active
                            ? "border-[var(--accent)] bg-[var(--accent)]"
                            : "border-slate-300 bg-white"
                        }`}
                        aria-hidden
                      >
                        {active ? <span className="h-1.5 w-1.5 rounded-full bg-white" /> : null}
                      </span>
                      <span>
                        {option.label}
                        {option.disabled ? " (마감)" : null}
                      </span>
                    </button>
                  );
                })}
              </div>
            </div>
          )}
        </div>
      ) : null}

      {(showDepartureSection || hasOptions) ? (
        <hr className={cn("border-[var(--divider)]", compact ? "my-3" : "my-5")} />
      ) : null}

      {travelerSection}

      {hasOptions ? (
        <>
          <hr className={cn("border-[var(--divider)]", compact ? "my-3" : "my-5")} />
          <div id={ids.options} className="space-y-3 scroll-mt-24">
            <div>
              <h3 className={cn("font-bold text-[#0f172a]", compact ? "text-sm" : "text-base")}>
                {optionsSectionTitle}
              </h3>
              <p className="mt-0.5 text-xs text-slate-500">
                {!hasOptionSelection
                  ? hasMultiOptions
                    ? "필요한 항목을 선택해 주세요. (여러 개 선택 가능)"
                    : "필요한 옵션을 선택해 주세요."
                  : hasMultiOptions
                    ? "여러 항목을 동시에 선택할 수 있습니다."
                    : "필요한 옵션을 선택해 주세요."}
              </p>
            </div>
            <div className={selectionAreaClass(hasOptionSelection, compact)}>
              <div
                className={
                  compact
                    ? "flex flex-col space-y-4"
                    : "flex flex-col space-y-5 md:grid md:grid-cols-2 md:gap-6 md:space-y-0"
                }
              >
                {sortedOptionGroups.map((group) => (
                  <OptionGroup
                    key={group.key}
                    group={group}
                    selected={selectedOptions}
                    isRequired={requiredSet.has(group.key)}
                    hideTitle={shouldHideGroupTitle(group.title, optionsSectionTitle, isSingleMultiGroup)}
                    onSingleChange={(itemValue) => onOptionSingleChange(group.key, itemValue)}
                    onMultiToggle={(itemValue) => onOptionMultiToggle(group.key, itemValue)}
                  />
                ))}
              </div>
            </div>
          </div>
        </>
      ) : null}
    </section>
  );
}
