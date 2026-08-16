"use client";

import {
  CALLBACK_TIME_OPTIONS,
  GOLF_ACCOMMODATION_OPTIONS,
  GOLF_BUDGET_OPTIONS,
  GOLF_GROUP_SIZE_OPTIONS,
  GOLF_ROUNDS_OPTIONS,
  type GolfBriefSnapshot,
} from "@/lib/inquiry/golfBriefFields";

type GolfBriefFieldsProps = {
  value: GolfBriefSnapshot;
  onChange: (next: GolfBriefSnapshot) => void;
};

export function GolfBriefFields({ value, onChange }: GolfBriefFieldsProps) {
  return (
    <div className="md:col-span-2 space-y-3 rounded-xl border border-[var(--success)]/25 bg-[var(--success-bg)] p-4">
      <p className="text-sm font-semibold text-[var(--success)]">골프투어 맞춤 정보 (선택)</p>
      <div className="grid gap-3 sm:grid-cols-2">
        <label className="flex flex-col gap-1 text-xs font-medium text-slate-700">
          인원
          <select
            value={value.group_size ?? ""}
            onChange={(e) => onChange({ ...value, group_size: e.target.value || undefined })}
            className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm"
          >
            <option value="">선택</option>
            {GOLF_GROUP_SIZE_OPTIONS.map((opt) => (
              <option key={opt} value={opt}>
                {opt}
              </option>
            ))}
          </select>
        </label>
        <label className="flex flex-col gap-1 text-xs font-medium text-slate-700">
          라운드 수
          <select
            value={value.rounds ?? ""}
            onChange={(e) => onChange({ ...value, rounds: e.target.value || undefined })}
            className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm"
          >
            <option value="">선택</option>
            {GOLF_ROUNDS_OPTIONS.map((opt) => (
              <option key={opt} value={opt}>
                {opt}
              </option>
            ))}
          </select>
        </label>
        <label className="flex flex-col gap-1 text-xs font-medium text-slate-700 sm:col-span-2">
          희망 지역
          <input
            type="text"
            value={value.target_region ?? ""}
            onChange={(e) => onChange({ ...value, target_region: e.target.value })}
            placeholder="예: 일본 오키나와, 태국 방콕"
            className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm"
          />
        </label>
        <label className="flex flex-col gap-1 text-xs font-medium text-slate-700">
          숙소 등급
          <select
            value={value.accommodation ?? ""}
            onChange={(e) => onChange({ ...value, accommodation: e.target.value || undefined })}
            className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm"
          >
            <option value="">선택</option>
            {GOLF_ACCOMMODATION_OPTIONS.map((opt) => (
              <option key={opt} value={opt}>
                {opt}
              </option>
            ))}
          </select>
        </label>
        <label className="flex flex-col gap-1 text-xs font-medium text-slate-700">
          예산대
          <select
            value={value.budget ?? ""}
            onChange={(e) => onChange({ ...value, budget: e.target.value || undefined })}
            className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm"
          >
            <option value="">선택</option>
            {GOLF_BUDGET_OPTIONS.map((opt) => (
              <option key={opt} value={opt}>
                {opt}
              </option>
            ))}
          </select>
        </label>
        <label className="flex flex-col gap-1 text-xs font-medium text-slate-700 sm:col-span-2">
          연락 희망 시간
          <select
            value={value.callback_time ?? ""}
            onChange={(e) => onChange({ ...value, callback_time: e.target.value || undefined })}
            className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm"
          >
            <option value="">선택</option>
            {CALLBACK_TIME_OPTIONS.map((opt) => (
              <option key={opt} value={opt}>
                {opt}
              </option>
            ))}
          </select>
        </label>
      </div>
    </div>
  );
}
