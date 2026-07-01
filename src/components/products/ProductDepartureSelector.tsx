"use client";

import { useMemo, useState } from "react";
import type { ProductDepartureSchedule } from "@/types/product";
import {
  formatDepartureScheduleChipLabel,
  formatDepartureScheduleInquiryValue,
} from "@/lib/products/normalizeDepartureSchedules";

type Props = {
  departures?: string[];
  schedules?: ProductDepartureSchedule[];
  /** 예약 문의 클릭 시 선택된 출발일·가격 전달 */
  onInquiryClick?: (selectedDeparture: string | null, selectedPrice?: number | null) => void;
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

export default function ProductDepartureSelector({
  departures = [],
  schedules,
  onInquiryClick,
}: Props) {
  const options = useMemo(
    () => buildDepartureOptions(schedules, departures),
    [schedules, departures],
  );
  const [selectedKey, setSelectedKey] = useState<string | null>(null);
  const [hint, setHint] = useState("");

  if (!options.length) return null;

  const selectedOption = options.find((option) => option.key === selectedKey) ?? null;

  const handleInquiry = () => {
    if (!selectedOption) {
      setHint("출발일을 먼저 선택해 주세요.");
      return;
    }
    setHint("");
    onInquiryClick?.(selectedOption.inquiryValue, selectedOption.price);
  };

  return (
    <section
      className="rounded-xl border border-slate-200 bg-white p-4 space-y-4"
      aria-label="출발일 선택"
    >
      <h3 className="text-sm font-semibold text-slate-900">출발일 선택</h3>

      <div className="flex flex-wrap gap-2">
        {options.map((option) => {
          const active = selectedKey === option.key;

          return (
            <button
              key={option.key}
              type="button"
              disabled={option.disabled}
              onClick={() => {
                setSelectedKey(option.key);
                setHint("");
              }}
              className={`px-3 py-2 rounded-lg text-sm border transition
                ${option.disabled
                  ? "bg-slate-100 text-slate-400 border-slate-200 cursor-not-allowed"
                  : active
                    ? "bg-slate-900 text-white border-slate-900"
                    : "bg-white text-slate-800 border-slate-200 hover:bg-slate-50"
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

      <button
        type="button"
        onClick={handleInquiry}
        className="w-full rounded-lg bg-slate-900 text-white py-3 text-sm font-medium hover:bg-slate-800 transition"
        aria-label="예약 문의"
      >
        예약 문의
      </button>
      {hint ? <p className="text-xs text-amber-600">{hint}</p> : null}
    </section>
  );
}
