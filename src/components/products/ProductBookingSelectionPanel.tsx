"use client";

import { useMemo } from "react";
import { OptionGroup } from "@/components/products/OptionGroup";
import { sortOptionGroups } from "@/lib/pricing/calcQuote";
import {
  formatDepartureScheduleChipLabel,
  formatDepartureScheduleInquiryValue,
} from "@/lib/products/normalizeDepartureSchedules";
import type { SelectedDeparture } from "@/lib/products/buildProductInquiryPrefill";
import type { ProductDepartureSchedule, ProductOptions, SelectedOptions } from "@/types/product";

export type ProductBookingSelectionPanelProps = {
  departures?: string[];
  schedules?: ProductDepartureSchedule[];
  options?: ProductOptions | null;
  selectedDepartureKey: string | null;
  selectedOptions: SelectedOptions;
  onDepartureChange: (departure: SelectedDeparture | null, key: string | null) => void;
  onOptionChange: (groupKey: string, itemValue: string) => void;
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

/**
 * 출발일 선택 + 옵션 선택 통합 패널 (상품 상세 본문)
 */
export function ProductBookingSelectionPanel({
  departures = [],
  schedules,
  options,
  selectedDepartureKey,
  selectedOptions,
  onDepartureChange,
  onOptionChange,
}: ProductBookingSelectionPanelProps) {
  const departureOptions = useMemo(
    () => buildDepartureOptions(schedules, departures),
    [schedules, departures],
  );

  const hasDepartures = departureOptions.length > 0;
  const sortedOptionGroups = options?.groups?.length ? sortOptionGroups(options) : [];
  const hasOptions = sortedOptionGroups.length > 0;
  const requiredSet = new Set(options?.requiredGroups ?? []);

  if (!hasDepartures && !hasOptions) return null;

  return (
    <section
      id="product-booking-panel"
      className="rounded-2xl border border-[var(--border)] bg-white p-5 shadow-sm md:p-6"
      aria-label="출발일 및 옵션 선택"
    >
      {hasDepartures ? (
        <div className="space-y-3">
          <h3 className="text-base font-bold text-[#0f172a]">출발일 선택</h3>
          <div className="flex flex-wrap gap-2" role="group" aria-label="출발일">
            {departureOptions.map((option) => {
              const active = selectedDepartureKey === option.key;
              return (
                <button
                  key={option.key}
                  type="button"
                  disabled={option.disabled}
                  onClick={() => {
                    if (option.disabled) return;
                    onDepartureChange(
                      {
                        label: option.label,
                        inquiryValue: option.inquiryValue,
                        price: option.price,
                      },
                      option.key,
                    );
                  }}
                  className={`rounded-xl border-2 px-3.5 py-2.5 text-sm font-medium transition
                    ${option.disabled
                      ? "cursor-not-allowed border-slate-200 bg-slate-100 text-slate-400"
                      : active
                        ? "border-[var(--accent)] bg-[var(--accent-soft)] text-[#0f172a] ring-1 ring-[var(--accent)]"
                        : "border-slate-200 bg-white text-slate-800 hover:border-slate-300 hover:bg-slate-50"
                    }`}
                  aria-pressed={active}
                  aria-label={`출발일 ${option.label}${active ? " 선택됨" : ""}${option.disabled ? " 마감" : ""}`}
                >
                  {option.label}
                  {option.disabled ? " (마감)" : null}
                </button>
              );
            })}
          </div>
        </div>
      ) : null}

      {hasDepartures && hasOptions ? (
        <hr className="my-5 border-[var(--divider)]" />
      ) : null}

      {hasOptions ? (
        <div className="space-y-4">
          <div>
            <h3 className="text-base font-bold text-[#0f172a]">추가 옵션·할증 선택</h3>
            <p className="mt-0.5 text-xs text-slate-500">필요한 옵션을 선택해 주세요.</p>
          </div>
          <div className="flex flex-col space-y-5 md:grid md:grid-cols-2 md:gap-6 md:space-y-0">
            {sortedOptionGroups.map((group) => (
              <OptionGroup
                key={group.key}
                group={group}
                value={selectedOptions[group.key] ?? ""}
                isRequired={requiredSet.has(group.key)}
                onChange={(itemValue) => onOptionChange(group.key, itemValue)}
              />
            ))}
          </div>
        </div>
      ) : null}
    </section>
  );
}
