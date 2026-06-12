"use client";

import { DatePicker } from "@/components/ui/DatePicker";
import { Label } from "@/components/ui/Label";
import {
  DESIRED_DEPARTURE_FLEXIBLE_LABEL,
  formatDesiredDepartureLabel,
  kstTodayYmd,
  type DesiredDepartureState,
} from "@/lib/inquiry/desiredDeparture";

type DesiredDepartureFieldProps = {
  value: DesiredDepartureState;
  onChange: (next: DesiredDepartureState) => void;
  className?: string;
};

export function DesiredDepartureField({ value, onChange, className }: DesiredDepartureFieldProps) {
  const minDate = kstTodayYmd();
  const previewLabel = value.flexible
    ? DESIRED_DEPARTURE_FLEXIBLE_LABEL
    : formatDesiredDepartureLabel(value);

  return (
    <Label className={`flex flex-col gap-2 ${className ?? ""}`}>
      <span>
        출발 희망일 <span className="text-slate-400 text-sm font-normal">(선택)</span>
      </span>
      <DatePicker
        name="desiredDepartureDate"
        value={value.flexible ? "" : value.date}
        min={minDate}
        disabled={value.flexible}
        onChange={(date) => onChange({ ...value, date, flexible: false })}
        aria-label="출발 희망일 선택"
        placeholder="출발 희망일 선택"
      />
      <label className="flex cursor-pointer items-center gap-2 text-sm text-content-secondary">
        <input
          type="checkbox"
          checked={value.flexible}
          onChange={(e) =>
            onChange({
              date: "",
              flexible: e.target.checked,
            })
          }
          className="h-4 w-4 rounded border-slate-300 text-[var(--primary)] focus:ring-[var(--primary)]"
        />
        출발일 미정 · 유동
      </label>
      {previewLabel ? (
        <p className="text-sm text-content-secondary" aria-live="polite">
          선택: {previewLabel}
        </p>
      ) : null}
    </Label>
  );
}
