"use client";

import { useState } from "react";

type Props = {
  departures?: string[];
  /** 예약 문의 클릭 시 선택된 출발일 전달 */
  onInquiryClick?: (selectedDeparture: string | null) => void;
};

export default function ProductDepartureSelector({ departures = [], onInquiryClick }: Props) {
  const [selected, setSelected] = useState<string | null>(null);
  const [hint, setHint] = useState("");

  if (!departures.length) return null;

  const handleInquiry = () => {
    if (!selected) {
      setHint("출발일을 먼저 선택해 주세요.");
      return;
    }
    setHint("");
    onInquiryClick?.(selected);
  };

  return (
    <section
      className="rounded-xl border border-slate-200 bg-white p-4 space-y-4"
      aria-label="출발일 선택"
    >
      <h3 className="text-sm font-semibold text-slate-900">
        출발일 선택
      </h3>

      <div className="flex flex-wrap gap-2">
        {departures.map((date) => {
          const active = selected === date;

          return (
            <button
              key={date}
              type="button"
              onClick={() => {
                setSelected(date);
                setHint("");
              }}
              className={`px-3 py-2 rounded-lg text-sm border transition
                ${active
                  ? "bg-slate-900 text-white border-slate-900"
                  : "bg-white text-slate-800 border-slate-200 hover:bg-slate-50"
                }`}
              aria-pressed={active}
              aria-label={`출발일 ${date}${active ? " 선택됨" : ""}`}
            >
              {date}
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
