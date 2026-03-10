"use client";

import { useMemo } from "react";
import type { TimelineModel } from "@/lib/products/mapProductToTimelineModel";

export type ScheduleDayLegacy = { label: string; content: string };

export type ProductItineraryPreviewProps = {
  /** 시각화 타임라인 모델 (우선 사용). days[].title 또는 events[0].heading 사용 */
  timelineModel?: TimelineModel | null;
  /** 레거시 텍스트 일정 (timelineModel 없을 때). label + content 첫 줄 */
  scheduleDays?: ScheduleDayLegacy[];
  /** preview 표시 일수 (기본 4) */
  maxDays?: number;
  /** 일정 섹션으로 스크롤할 때 사용할 id (클릭 시 스크롤) */
  itinerarySectionId?: string;
};

type PreviewDay = { dayLabel: string; title: string };

function fromTimelineModel(model: TimelineModel | null | undefined, maxDays: number): PreviewDay[] {
  if (!model?.days?.length) return [];
  return model.days.slice(0, maxDays).map((d) => {
    const title =
      d.title?.trim() ||
      d.events[0]?.heading?.trim() ||
      d.events[0]?.description?.trim() ||
      "일정";
    return { dayLabel: `Day ${d.day}`, title };
  });
}

function fromScheduleDays(days: ScheduleDayLegacy[] | undefined, maxDays: number): PreviewDay[] {
  if (!days?.length) return [];
  return days.slice(0, maxDays).map((d) => {
    const firstLine = d.content?.split(/\r?\n/)[0]?.trim() || d.label;
    return { dayLabel: d.label, title: firstLine };
  });
}

export function ProductItineraryPreview({
  timelineModel = null,
  scheduleDays = [],
  maxDays = 4,
  itinerarySectionId = "itinerary-section",
}: ProductItineraryPreviewProps) {
  const previewDays = useMemo(() => {
    const max = Math.min(4, maxDays);
    const fromV2 = fromTimelineModel(timelineModel, max);
    if (fromV2.length > 0) return fromV2;
    return fromScheduleDays(scheduleDays, max);
  }, [timelineModel, scheduleDays, maxDays]);

  if (previewDays.length === 0) return null;

  const scrollToItinerary = () => {
    document.getElementById(itinerarySectionId)?.scrollIntoView({ behavior: "smooth", block: "start" });
  };

  return (
    <section className="w-full" aria-label="일정 미리보기">
      <div className="rounded-2xl border border-[var(--border)] bg-[var(--card)] p-4 shadow-[var(--shadow-soft)] md:p-5">
        <h2 className="mb-4 text-lg font-bold text-[var(--text-primary)] md:text-xl">일정 미리보기</h2>
        {/* Desktop: horizontal step list */}
        <div className="hidden md:block">
          <ol className="flex flex-wrap gap-2">
            {previewDays.map((d, i) => (
              <li key={`${d.dayLabel}-${i}`} className="flex min-w-0 flex-1 basis-[calc(25%-0.5rem)] items-start gap-2">
                <span className="shrink-0 rounded-full bg-[var(--primary)] px-2 py-0.5 text-xs font-bold text-white">
                  {d.dayLabel}
                </span>
                <span className="min-w-0 truncate text-sm font-medium text-[var(--text-primary)]" title={d.title}>
                  {d.title}
                </span>
              </li>
            ))}
          </ol>
        </div>
        {/* Mobile: vertical timeline */}
        <ul className="space-y-3 md:hidden">
          {previewDays.map((d, i) => (
            <li key={`${d.dayLabel}-${i}`} className="flex items-start gap-3">
              <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-[var(--primary)] text-xs font-bold text-white">
                {i + 1}
              </span>
              <div className="min-w-0 flex-1 pt-0.5">
                <span className="text-xs font-semibold text-[var(--text-muted)]">{d.dayLabel}</span>
                <p className="text-sm font-medium text-[var(--text-primary)]">{d.title}</p>
              </div>
            </li>
          ))}
        </ul>
        <button
          type="button"
          onClick={scrollToItinerary}
          className="mt-4 text-sm font-semibold text-[var(--primary)] underline underline-offset-2 hover:no-underline"
        >
          전체 일정 보기
        </button>
      </div>
    </section>
  );
}
