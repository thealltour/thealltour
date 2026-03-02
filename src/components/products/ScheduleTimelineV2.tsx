"use client";

import { useState } from "react";
import Image from "next/image";
import { Calendar, ImageIcon } from "lucide-react";
import type { TimelineViewModel, TimelineDayModel } from "@/lib/products/mapProductToTimelineModel";
import { normalizeProductImageUrl } from "@/lib/media/normalizeProductImageUrl";

export type ScheduleTimelineV2Props = {
  /** 텍스트 일정에서 파생한 타임라인 모델. null이면 렌더하지 않음 */
  model: TimelineViewModel | null;
  /** Day별 이미지 없을 때 사용할 URL (product.image_url 등) */
  fallbackImageUrl?: string | null;
};

function DayImage({
  day,
  fallbackImageUrl,
}: {
  day: TimelineDayModel;
  fallbackImageUrl: string | null;
}) {
  const raw = day.imageUrl?.trim() || fallbackImageUrl?.trim() || "";
  const src = raw ? normalizeProductImageUrl(raw) : "";

  if (src) {
    return (
      <div className="relative aspect-[16/10] w-full overflow-hidden rounded-xl bg-slate-200 shadow-md">
        <Image
          src={src}
          alt={`Day ${day.day}`}
          fill
          sizes="(max-width: 768px) 100vw, 60vw"
          className="object-cover"
        />
      </div>
    );
  }

  return (
    <div
      className="flex aspect-[16/10] w-full flex-col items-center justify-center gap-2 rounded-xl bg-slate-100 text-slate-500"
      aria-hidden
    >
      <ImageIcon className="h-10 w-10 opacity-50" />
      <span className="text-center text-xs font-medium">Day {day.day} 대표 이미지</span>
    </div>
  );
}

/**
 * 상세 인터랙티브 타임라인
 * - Day 탭 선택 시 해당 일차 이미지 + 요약 + 불릿 노출
 * - 이미지 없으면 fallbackImageUrl, 그것도 없으면 placeholder
 */
export function ScheduleTimelineV2({
  model,
  fallbackImageUrl = null,
}: ScheduleTimelineV2Props) {
  const [activeIndex, setActiveIndex] = useState(0);

  if (!model?.days?.length) return null;

  const days = model.days;
  const activeDay = days[activeIndex] ?? days[0];
  const fallback = fallbackImageUrl?.trim() ?? "";

  return (
    <section
      className="w-full overflow-hidden rounded-2xl border border-slate-200/80 bg-white shadow-md"
      aria-label="상세 일정 타임라인"
    >
      <div className="p-4 sm:p-6">
        <div className="mb-4 flex items-center gap-2">
          <Calendar className="h-5 w-5 text-slate-600" />
          <h3 className="text-lg font-bold tracking-tight text-slate-900">상세 일정</h3>
        </div>

        {/* Day 탭 */}
        <div className="mb-4 flex flex-wrap gap-2">
          {days.map((d, i) => (
            <button
              key={`day-${d.day}-${i}`}
              type="button"
              onClick={() => setActiveIndex(i)}
              className={`rounded-lg px-3 py-2 text-sm font-semibold transition ${
                activeIndex === i
                  ? "bg-[#1E3A8A] text-white shadow-sm"
                  : "bg-slate-100 text-slate-700 hover:bg-slate-200"
              }`}
            >
              Day {d.day}
            </button>
          ))}
        </div>

        {/* 선택된 Day: 이미지 + 요약 + 불릿 */}
        <div className="space-y-4">
          <DayImage day={activeDay} fallbackImageUrl={fallback} />

          {activeDay.headline && (
            <p className="text-base font-semibold text-slate-800">{activeDay.headline}</p>
          )}

          {activeDay.bullets.length > 0 ? (
            <ul className="space-y-1.5 text-sm leading-relaxed text-slate-700">
              {activeDay.bullets.map((b, bi) => (
                <li key={bi} className="flex items-start gap-2">
                  <span className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-[#2563eb]" />
                  <span>{b}</span>
                </li>
              ))}
            </ul>
          ) : (
            <p className="text-sm text-slate-500">해당 일차 상세 내용을 입력해 주세요.</p>
          )}
        </div>
      </div>
    </section>
  );
}
