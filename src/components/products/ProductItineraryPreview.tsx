"use client";

import { useMemo, useCallback } from "react";
import type { IconName } from "@/icons";
import { Icon } from "@/components/ui/Icon";
import type { TimelineModel } from "@/lib/products/mapProductToTimelineModel";
import { getDayPreviewLabel, getLegacyDayPreviewLabel } from "@/lib/products/itineraryPreviewLabel";

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
  /** PR11: 전체 일정 보기 클릭 시 호출. 일정 탭을 먼저 열기 위해 사용 */
  onViewFullItinerary?: () => void;
  /** PR14: Preview Day 카드 클릭 시 해당 Day(1-based)로 상세 일정 이동 */
  onPreviewDayClick?: (dayNumber: number) => void;
};

/** 레거시 키 (메타 추론). 내부에서 IconName으로 매핑 */
export type PreviewDayIconKey = "flight" | "map" | "camera" | "bed" | "sparkles" | "plane-landing";

const PREVIEW_ICON_NAMES: Record<PreviewDayIconKey, IconName> = {
  flight: "flight",
  map: "region",
  camera: "camera",
  bed: "hotel",
  sparkles: "sparkles",
  "plane-landing": "planeLanding",
};

type PreviewDay = {
  dayLabel: string;
  title: string;
  /** PR14: 상세 일정 Day anchor 이동용 (1-based) */
  dayNumber: number;
  activityTag?: string;
  emphasisText?: string;
  iconName?: IconName;
};

type PreviewMeta = Pick<PreviewDay, "activityTag" | "emphasisText" | "iconName">;

/** PR12: 규칙 기반 보조 메타 추론. title/heading/description 결합 텍스트로 키워드 매칭 */
function getPreviewMetaFromText(text: string): PreviewMeta {
  const t = (text || "").trim();
  if (!t) return {};
  if (/귀국|인천.*도착|복귀|귀국일/.test(t)) {
    return { activityTag: "귀국", emphasisText: "귀국 및 해산", iconName: PREVIEW_ICON_NAMES["plane-landing"] };
  }
  if (/출발|공항|탑승|출국|출발일|인천.*출발/.test(t)) {
    return { activityTag: "이동", emphasisText: "출국 및 이동", iconName: PREVIEW_ICON_NAMES.flight };
  }
  if (/도착|체크인|호텔|첫날/.test(t) && !/관광|체험/.test(t)) {
    return { activityTag: "도착", emphasisText: "도착 후 휴식", iconName: PREVIEW_ICON_NAMES.bed };
  }
  if (/관광|사원|시티투어|시내|핵심관광|투어/.test(t)) {
    return { activityTag: "핵심 관광", emphasisText: "사원·시내 중심 일정", iconName: PREVIEW_ICON_NAMES.camera };
  }
  if (/체험|전통|안마|보호소|클래스/.test(t)) {
    return { activityTag: "체험", emphasisText: "대표 체험 일정", iconName: PREVIEW_ICON_NAMES.sparkles };
  }
  if (/자유|휴양|힐링|휴식|자유일정|프리/.test(t)) {
    return { activityTag: "휴양", emphasisText: "휴식 및 귀국 준비", iconName: PREVIEW_ICON_NAMES.bed };
  }
  if (/이동|경유|차량|버스/.test(t)) {
    return { activityTag: "이동", emphasisText: "이동 일정", iconName: PREVIEW_ICON_NAMES.map };
  }
  return {};
}

function fromTimelineModel(model: TimelineModel | null | undefined, maxDays: number): PreviewDay[] {
  if (!model?.days?.length) return [];
  return model.days.slice(0, maxDays).map((d) => {
    const title = getDayPreviewLabel(d);
    const metaText = [d.title, d.events[0]?.heading, d.events[0]?.description, d.dateText].filter(Boolean).join(" ");
    const meta = getPreviewMetaFromText(metaText);
    return { dayLabel: `Day ${d.day}`, title, dayNumber: d.day, ...meta };
  });
}

function fromScheduleDays(days: ScheduleDayLegacy[] | undefined, maxDays: number): PreviewDay[] {
  if (!days?.length) return [];
  return days.slice(0, maxDays).map((d, i) => {
    const title = getLegacyDayPreviewLabel(d.label, d.content ?? "");
    const metaText = [title, d.label].filter(Boolean).join(" ");
    const meta = getPreviewMetaFromText(metaText);
    return { dayLabel: d.label, title, dayNumber: i + 1, ...meta };
  });
}

function PreviewDayCard({
  day,
  onPreviewDayClick,
}: {
  day: PreviewDay;
  onPreviewDayClick?: (dayNumber: number) => void;
}) {
  const isClickable = Boolean(onPreviewDayClick);
  const content = (
    <>
      <div className="mb-1.5 flex flex-wrap items-center gap-1.5">
        <span className="inline-flex w-fit rounded-full bg-[var(--primary)] px-2.5 py-0.5 text-xs font-bold text-white">
          {day.dayLabel}
        </span>
        {day.activityTag && (
          <span className="inline-flex items-center gap-1 rounded-full bg-gray-100 px-2 py-0.5 text-xs text-gray-600">
            {day.iconName ? (
              <Icon
                name={day.iconName}
                decorative
                size={14}
                className="hidden h-3.5 w-3.5 shrink-0 sm:block"
              />
            ) : null}
            {day.activityTag}
          </span>
        )}
      </div>
      <p
        className="min-h-0 flex-1 text-[15px] font-semibold leading-snug text-[var(--text-primary)] line-clamp-2"
        title={day.title}
      >
        {day.title}
      </p>
      {day.emphasisText && (
        <p className="mt-1 line-clamp-1 text-xs text-[var(--text-muted)]" title={day.emphasisText}>
          {day.emphasisText}
        </p>
      )}
    </>
  );
  const cardClass =
    "flex w-full flex-col rounded-xl border border-[var(--border)] bg-[var(--card)] p-3 text-left shadow-[var(--shadow-soft)] transition md:p-4 " +
    (isClickable
      ? "cursor-pointer hover:border-[var(--primary)]/50 hover:shadow-md focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--primary)]"
      : "");
  if (isClickable) {
    return (
      <button
        type="button"
        onClick={() => onPreviewDayClick?.(day.dayNumber)}
        className={cardClass}
        aria-label={`${day.dayLabel} 일정으로 이동`}
      >
        {content}
      </button>
    );
  }
  return <div className={cardClass}>{content}</div>;
}

export function ProductItineraryPreview({
  timelineModel = null,
  scheduleDays = [],
  maxDays = 4,
  itinerarySectionId = "itinerary-section",
  onViewFullItinerary,
  onPreviewDayClick,
}: ProductItineraryPreviewProps) {
  const previewDays = useMemo(() => {
    const max = Math.min(4, maxDays);
    const fromV2 = fromTimelineModel(timelineModel, max);
    if (fromV2.length > 0) return fromV2;
    return fromScheduleDays(scheduleDays, max);
  }, [timelineModel, scheduleDays, maxDays]);

  const handleViewFullItinerary = useCallback(() => {
    onViewFullItinerary?.();
    requestAnimationFrame(() => {
      setTimeout(() => {
        document.getElementById(itinerarySectionId)?.scrollIntoView({ behavior: "smooth", block: "start" });
      }, 100);
    });
  }, [onViewFullItinerary, itinerarySectionId]);

  if (previewDays.length === 0) return null;

  return (
    <section className="w-full" aria-label="일정 미리보기">
      <div className="rounded-2xl border border-[var(--border)] bg-[var(--card)] p-4 shadow-[var(--shadow-soft)] md:p-5">
        <h2 className="mb-3 text-lg font-bold text-[var(--text-primary)] md:text-xl">일정 미리보기</h2>
        {/* Desktop: grid 카드 (PR14: 카드 클릭 시 해당 Day로 이동) */}
        <div className="hidden grid-cols-2 gap-3 md:grid xl:grid-cols-4">
          {previewDays.map((d, i) => (
            <PreviewDayCard key={`${d.dayLabel}-${i}`} day={d} onPreviewDayClick={onPreviewDayClick} />
          ))}
        </div>
        {/* Mobile: 세로 카드 스택 */}
        <div className="grid grid-cols-1 gap-3 md:hidden">
          {previewDays.map((d, i) => (
            <PreviewDayCard key={`${d.dayLabel}-${i}`} day={d} onPreviewDayClick={onPreviewDayClick} />
          ))}
        </div>
        <button
          type="button"
          onClick={handleViewFullItinerary}
          className="mt-3 inline-flex items-center gap-2 rounded-lg border border-[var(--primary)] bg-transparent px-4 py-2.5 text-sm font-semibold text-[var(--primary)] transition hover:bg-[var(--primary-soft)] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--primary)]"
        >
          전체 일정 보기
          <Icon name="chevronRight" decorative size={16} className="h-4 w-4 shrink-0" />
        </button>
      </div>
    </section>
  );
}
