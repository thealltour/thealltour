"use client";

import { useMemo } from "react";
import { OptionGroup } from "@/components/products/OptionGroup";
import { ProductDepartureCalendarPanel } from "@/components/products/ProductDepartureCalendarPanel";
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

export type ProductBookingSelectionPanelProps = {
  product?: Product | null;
  departureUi?: "chips" | "calendar";
  departures?: string[];
  schedules?: ProductDepartureSchedule[];
  options?: ProductOptions | null;
  selectedDepartureKey: string | null;
  selectedOptions: SelectedOptions;
  onDepartureChange: (departure: SelectedDeparture | null, key: string | null) => void;
  onOptionSingleChange: (groupKey: string, itemValue: string) => void;
  onOptionMultiToggle: (groupKey: string, itemValue: string) => void;
  onConsultClick?: () => void;
};

type DepartureOption = {
  key: string;
  label: string;
  inquiryValue: string;
  price?: number | null;
  disabled?: boolean;
};

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

function selectionAreaClass(hasSelection: boolean): string {
  return hasSelection
    ? "rounded-xl border border-solid border-[var(--border)] bg-white p-3"
    : "rounded-xl border-2 border-dashed border-slate-300 bg-slate-50/60 p-3";
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
 * 출발일 선택 + 옵션 선택 통합 패널 (상품 상세 본문)
 */
export function ProductBookingSelectionPanel({
  product,
  departureUi = "chips",
  departures = [],
  schedules,
  options,
  selectedDepartureKey,
  selectedOptions,
  onDepartureChange,
  onOptionSingleChange,
  onOptionMultiToggle,
  onConsultClick,
}: ProductBookingSelectionPanelProps) {
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

  return (
    <section
      id="product-booking-panel"
      className="rounded-2xl border border-[var(--border)] bg-white p-5 shadow-sm md:p-6"
      aria-label="출발일 및 옵션 선택"
    >
      {showDepartureSection ? (
        <div className="space-y-3">
          <h3 className="text-base font-bold text-[#0f172a]">출발일 선택</h3>
          {!hasDepartureSelection ? (
            <p className="text-xs font-medium text-amber-700">
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
            />
          ) : (
            <div className={selectionAreaClass(hasDepartureSelection)}>
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
                      className={`flex min-h-[48px] items-center gap-3 rounded-xl border-2 px-3.5 py-2.5 text-sm font-medium transition
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

      {showDepartureSection && hasOptions ? (
        <hr className="my-5 border-[var(--divider)]" />
      ) : null}

      {hasOptions ? (
        <div className="space-y-4">
          <div>
            <h3 className="text-base font-bold text-[#0f172a]">{optionsSectionTitle}</h3>
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
          <div className={selectionAreaClass(hasOptionSelection)}>
            <div className="flex flex-col space-y-5 md:grid md:grid-cols-2 md:gap-6 md:space-y-0">
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
      ) : null}
    </section>
  );
}
