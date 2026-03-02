"use client";

import type { ItineraryV2, ItineraryV2Day, ItineraryV2Event } from "@/types/product";
import { ImageUploadField } from "@/components/admin/ImageUploadField";
import { InteractiveTimelineV2 } from "@/components/products/InteractiveTimelineV2";
import { itineraryV2ToTimelineModel } from "@/lib/products/mapProductToTimelineModel";
import { parseLegacyItineraryText } from "@/lib/products/parseLegacyItineraryText";
import { normalizeProductImageUrl } from "@/lib/media/normalizeProductImageUrl";

const TIMEOFDAY_OPTIONS = [
  { value: "", label: "미지정" },
  { value: "오전", label: "오전" },
  { value: "오후", label: "오후" },
  { value: "저녁", label: "저녁" },
  { value: "종일", label: "종일" },
] as const;

const ICON_KEY_OPTIONS = [
  { value: "", label: "없음" },
  { value: "car", label: "이동" },
  { value: "utensils", label: "식사" },
  { value: "golf", label: "골프" },
  { value: "hotel", label: "숙소" },
  { value: "map", label: "관광" },
  { value: "sun", label: "자유" },
] as const;

const DEFAULT_EVENTS_TEMPLATE: ItineraryV2Event[] = [
  { heading: "이동", description: "", timeOfDay: "오전", iconKey: "car" },
  { heading: "식사", description: "", timeOfDay: "오후", iconKey: "utensils" },
];

function createEmptyDay(dayNumber: number): ItineraryV2Day {
  return {
    day: dayNumber,
    dateText: "",
    title: "",
    coverImageUrl: "",
    events: [{ heading: "", description: "" }, { heading: "", description: "" }],
  };
}

export type ScheduleVisualEditorV2Props = {
  form: {
    itinerary_v2_json: ItineraryV2;
    legacy_itinerary_text: string;
    images_json?: string[];
    image_url?: string;
  };
  /** ProductFormState와 같은 상위 타입 setState도 허용 */
  setForm: React.Dispatch<React.SetStateAction<any>>;
  previewProductImageUrl: string;
  activeDayIndex: number;
  setActiveDayIndex: (index: number) => void;
};

export function ScheduleVisualEditorV2({
  form,
  setForm,
  previewProductImageUrl,
  activeDayIndex,
  setActiveDayIndex,
}: ScheduleVisualEditorV2Props) {
  const v2 = form.itinerary_v2_json;
  const days = v2.days ?? [];
  const productImageCandidates = Array.from(
    new Set(
      [
        ...(Array.isArray(form.images_json) ? form.images_json : []),
        form.image_url ?? "",
      ]
        .map((u) => u?.trim())
        .filter((u): u is string => Boolean(u)),
    ),
  );

  const updateV2 = (updater: (prev: ItineraryV2) => ItineraryV2) => {
    setForm((prev: any) => ({
      ...prev,
      itinerary_v2_json: updater(prev.itinerary_v2_json),
    }));
  };

  const applyLegacyDraft = () => {
    const text = form.legacy_itinerary_text?.trim() ?? "";
    const draft = parseLegacyItineraryText(text);
    setForm((prev: any) => ({
      ...prev,
      itinerary_v2_json: draft,
    }));
  };

  const addDay = () => {
    updateV2((prev) => ({
      days: [...prev.days, createEmptyDay(prev.days.length + 1)],
    }));
  };

  const removeDay = (dayIndex: number) => {
    updateV2((prev) => ({
      days: prev.days
        .filter((_, i) => i !== dayIndex)
        .map((d, i) => ({ ...d, day: i + 1 })),
    }));
    setActiveDayIndex(Math.max(0, Math.min(activeDayIndex, days.length - 2)));
  };

  const moveDay = (dayIndex: number, direction: "up" | "down") => {
    if (direction === "up" && dayIndex <= 0) return;
    if (direction === "down" && dayIndex >= days.length - 1) return;
    const next = [...days];
    const swap = direction === "up" ? dayIndex - 1 : dayIndex + 1;
    [next[dayIndex], next[swap]] = [next[swap], next[dayIndex]];
    updateV2(() => ({
      days: next.map((d, i) => ({ ...d, day: i + 1 })),
    }));
    if (activeDayIndex === dayIndex) setActiveDayIndex(swap);
    else if (activeDayIndex === swap) setActiveDayIndex(dayIndex);
  };

  const updateDay = (dayIndex: number, patch: Partial<ItineraryV2Day>) => {
    updateV2((prev) => ({
      days: prev.days.map((d, i) => (i === dayIndex ? { ...d, ...patch } : d)),
    }));
  };

  const addEvent = (dayIndex: number) => {
    updateV2((prev) => ({
      days: prev.days.map((d, i) =>
        i === dayIndex ? { ...d, events: [...d.events, { heading: "", description: "" }] } : d,
      ),
    }));
  };

  const removeEvent = (dayIndex: number, eventIndex: number) => {
    updateV2((prev) => ({
      days: prev.days.map((d, i) =>
        i === dayIndex
          ? { ...d, events: d.events.filter((_, ei) => ei !== eventIndex) }
          : d,
      ),
    }));
  };

  const moveEvent = (dayIndex: number, eventIndex: number, direction: "up" | "down") => {
    const day = days[dayIndex];
    if (!day || day.events.length < 2) return;
    if (direction === "up" && eventIndex <= 0) return;
    if (direction === "down" && eventIndex >= day.events.length - 1) return;
    const nextEvents = [...day.events];
    const swap = direction === "up" ? eventIndex - 1 : eventIndex + 1;
    [nextEvents[eventIndex], nextEvents[swap]] = [nextEvents[swap], nextEvents[eventIndex]];
    updateDay(dayIndex, { events: nextEvents });
  };

  const updateEvent = (
    dayIndex: number,
    eventIndex: number,
    patch: Partial<ItineraryV2Event>,
  ) => {
    updateV2((prev) => ({
      days: prev.days.map((d, i) =>
        i === dayIndex
          ? {
              ...d,
              events: d.events.map((e, ei) =>
                ei === eventIndex ? { ...e, ...patch } : e,
              ),
            }
          : d,
      ),
    }));
  };

  const createSkeleton = (dayCount: number) => {
    const newDays = Array.from({ length: dayCount }, (_, i) =>
      createEmptyDay(i + 1),
    ).map((d) => ({
      ...d,
      events: [...DEFAULT_EVENTS_TEMPLATE],
    }));
    updateV2(() => ({ days: newDays }));
  };

  const timelineModel = itineraryV2ToTimelineModel(v2);
  const fallbackUrl = previewProductImageUrl?.trim()
    ? normalizeProductImageUrl(previewProductImageUrl) || previewProductImageUrl
    : null;

  return (
    <div className="grid gap-6 lg:grid-cols-[1fr_380px]">
      <div className="space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <p className="text-xs text-slate-600">
            Day와 이벤트를 입력하면 상세 페이지에서 타임라인으로 표시됩니다.
          </p>
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              onClick={() => createSkeleton(3)}
              className="rounded-lg border border-blue-200 bg-white px-3 py-1.5 text-xs font-semibold text-blue-700 hover:bg-blue-50"
            >
              기본 골격 생성 (3일)
            </button>
            <button
              type="button"
              onClick={addDay}
              className="rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-xs font-semibold text-slate-700 hover:bg-slate-50"
            >
              + Day 추가
            </button>
          </div>
        </div>

        <div className="rounded-lg border border-amber-200 bg-amber-50/50 p-3">
          <p className="mb-2 text-xs font-semibold text-amber-800">레거시 텍스트로 초안 만들기</p>
          <p className="mb-2 text-[11px] text-amber-700">
            기존 일정 텍스트를 붙여넣고 버튼을 누르면 Day/이벤트 초안이 생성됩니다. &quot;1일차&quot;, &quot;Day 1&quot;, &quot;[2일차]&quot; 등으로 구분된 텍스트를 지원합니다.
          </p>
          <textarea
            value={form.legacy_itinerary_text ?? ""}
            onChange={(e) =>
              setForm((prev: any) => ({
                ...prev,
                legacy_itinerary_text: e.target.value,
              }))
            }
            placeholder={"예시:\n[1일차]\n집결/인천국제공항 제1터미널 집결/오후/19:40\n출발/티웨이항공(TW) 인천(ICN) 출발 (약 10시간 35분 소요)/오후/21:40\n식사/석식: 기내식\n숙박/기내박\n\n\n[2일차]\n미팅/시드니(SYD) 공항 도착 및 가이드 미팅/오전/10:15 \n관광/시드니 동부 해안 관광/오후\n본다이 비치/시드니 최고의 서핑 명소 및 해변 관람"}
            rows={4}
            className="mb-2 w-full rounded border border-amber-300 bg-white px-2.5 py-2 text-xs outline-none focus:border-amber-500 focus:ring-2 focus:ring-amber-200"
          />
          <button
            type="button"
            onClick={applyLegacyDraft}
            className="rounded-lg border border-amber-400 bg-amber-100 px-3 py-1.5 text-xs font-semibold text-amber-800 hover:bg-amber-200"
          >
            레거시 텍스트로 초안 만들기
          </button>
        </div>

        {days.length === 0 ? (
          <button
            type="button"
            onClick={() => createSkeleton(3)}
            className="w-full rounded-lg border border-dashed border-slate-300 bg-white px-3 py-8 text-sm font-semibold text-slate-600 hover:bg-slate-50"
          >
            기본 골격 생성으로 시작하거나 Day 추가
          </button>
        ) : (
          <div className="space-y-4">
            {days.map((dayEntry, dayIndex) => (
              <article
                key={`v2-day-${dayEntry.day}-${dayIndex}`}
                className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm"
                onFocus={() => setActiveDayIndex(dayIndex)}
              >
                <div className="mb-3 flex flex-wrap items-center gap-2">
                  <span className="rounded bg-[#eff6ff] px-2.5 py-1 text-xs font-bold text-[#1d4ed8]">
                    Day {dayEntry.day}
                  </span>
                  <input
                    value={dayEntry.dateText ?? ""}
                    onChange={(e) =>
                      updateDay(dayIndex, {
                        dateText: e.target.value.trim() || undefined,
                      })
                    }
                    placeholder="날짜 (예: 2026.03.22 (일))"
                    className="max-w-[180px] rounded border border-slate-300 px-2 py-1.5 text-xs outline-none focus:border-[#2563eb]"
                  />
                  <input
                    value={dayEntry.title ?? ""}
                    onChange={(e) =>
                      updateDay(dayIndex, {
                        title: e.target.value.trim() || undefined,
                      })
                    }
                    placeholder="제목 (선택)"
                    className="min-w-[140px] flex-1 rounded border border-slate-300 px-2 py-1.5 text-xs outline-none focus:border-[#2563eb]"
                  />
                  <div className="ml-auto flex gap-1">
                    <button
                      type="button"
                      disabled={dayIndex === 0}
                      onClick={() => moveDay(dayIndex, "up")}
                      className="rounded border border-slate-300 px-2 py-1 text-[11px] text-slate-600 disabled:opacity-40"
                    >
                      위로
                    </button>
                    <button
                      type="button"
                      disabled={dayIndex >= days.length - 1}
                      onClick={() => moveDay(dayIndex, "down")}
                      className="rounded border border-slate-300 px-2 py-1 text-[11px] text-slate-600 disabled:opacity-40"
                    >
                      아래로
                    </button>
                    <button
                      type="button"
                      onClick={() => removeDay(dayIndex)}
                      className="rounded border border-rose-200 px-2 py-1 text-[11px] text-rose-600 hover:bg-rose-50"
                    >
                      Day 삭제
                    </button>
                  </div>
                </div>

                <div className="mb-3">
                  <p className="mb-1 text-[11px] font-semibold text-slate-500">
                    Day 커버 이미지 (선택, 카드 800px)
                  </p>
                  <div className="grid gap-3 md:grid-cols-2">
                    <div className="rounded-lg border border-slate-200 bg-slate-50/40 p-2">
                      <p className="mb-2 text-[11px] font-semibold text-slate-600">
                        파일 업로드 / 드래그앤드롭
                      </p>
                      <ImageUploadField
                        value={dayEntry.coverImageUrl ?? ""}
                        onChange={(v) =>
                          updateDay(dayIndex, {
                            coverImageUrl: v?.trim() || undefined,
                          })
                        }
                        onUploaded={(v) =>
                          updateDay(dayIndex, {
                            coverImageUrl: v?.trim() || undefined,
                          })
                        }
                        uploadedUrlKey="card"
                        optional
                        placeholder="URL 또는 업로드"
                      />
                    </div>
                    <div className="rounded-lg border border-slate-200 bg-slate-50/40 p-2">
                      <div className="mb-2 flex items-center justify-between">
                        <p className="text-[11px] font-semibold text-slate-600">
                          상품 이미지에서 선택
                        </p>
                        {dayEntry.coverImageUrl ? (
                          <button
                            type="button"
                            onClick={() => updateDay(dayIndex, { coverImageUrl: undefined })}
                            className="rounded border border-slate-300 bg-white px-2 py-0.5 text-[10px] text-slate-600 hover:bg-slate-50"
                          >
                            선택 해제
                          </button>
                        ) : null}
                      </div>
                      {productImageCandidates.length === 0 ? (
                        <p className="rounded border border-dashed border-slate-300 bg-white px-2 py-6 text-center text-[11px] text-slate-500">
                          먼저 상품 이미지(여러 장)를 업로드해 주세요.
                        </p>
                      ) : (
                        <div className="grid max-h-[240px] grid-cols-3 gap-2 overflow-y-auto pr-1">
                          {productImageCandidates.map((url, imageIndex) => {
                            const selected = (dayEntry.coverImageUrl ?? "").trim() === url;
                            return (
                              <button
                                key={`${url}-${imageIndex}`}
                                type="button"
                                onClick={() => updateDay(dayIndex, { coverImageUrl: url })}
                                className={`group relative aspect-[4/3] overflow-hidden rounded-md border transition ${
                                  selected
                                    ? "border-[#1E3A8A] ring-2 ring-[#bfdbfe]"
                                    : "border-slate-200 hover:border-slate-400"
                                }`}
                                title={`이미지 ${imageIndex + 1} 선택`}
                              >
                                <img
                                  src={normalizeProductImageUrl(url)}
                                  alt={`상품 이미지 ${imageIndex + 1}`}
                                  className="h-full w-full object-cover"
                                />
                              </button>
                            );
                          })}
                        </div>
                      )}
                    </div>
                  </div>
                </div>

                <div className="space-y-2">
                  <p className="text-[11px] font-semibold text-slate-600">이벤트</p>
                  {(dayEntry.events ?? []).map((ev, evIndex) => (
                    <div
                      key={`ev-${dayIndex}-${evIndex}`}
                      className="flex flex-wrap items-start gap-2 rounded-lg border border-slate-100 bg-slate-50/50 p-2"
                    >
                      <input
                        value={ev.heading}
                        onChange={(e) =>
                          updateEvent(dayIndex, evIndex, {
                            heading: e.target.value,
                          })
                        }
                        placeholder="제목 (필수)"
                        className="min-w-[90px] rounded border border-slate-300 bg-white px-2 py-1 text-xs outline-none focus:border-[#2563eb]"
                      />
                      <input
                        value={ev.description ?? ""}
                        onChange={(e) =>
                          updateEvent(dayIndex, evIndex, {
                            description: e.target.value.trim() || undefined,
                          })
                        }
                        placeholder="설명"
                        className="min-w-0 flex-1 rounded border border-slate-300 bg-white px-2 py-1 text-xs outline-none focus:border-[#2563eb]"
                      />
                      <select
                        value={ev.timeOfDay ?? ""}
                        onChange={(e) =>
                          updateEvent(dayIndex, evIndex, {
                            timeOfDay: (e.target.value as ItineraryV2Event["timeOfDay"]) || undefined,
                          })
                        }
                        className="rounded border border-slate-300 bg-white px-2 py-1 text-[11px]"
                      >
                        {TIMEOFDAY_OPTIONS.map((o) => (
                          <option key={o.value || "x"} value={o.value}>
                            {o.label}
                          </option>
                        ))}
                      </select>
                      <input
                        type="text"
                        value={ev.timeText ?? ""}
                        onChange={(e) =>
                          updateEvent(dayIndex, evIndex, {
                            timeText: e.target.value.trim() || undefined,
                          })
                        }
                        placeholder="시각 (09:00)"
                        className="w-[72px] rounded border border-slate-300 bg-white px-2 py-1 text-[11px] outline-none focus:border-[#2563eb]"
                      />
                      <select
                        value={ev.iconKey ?? ""}
                        onChange={(e) =>
                          updateEvent(dayIndex, evIndex, {
                            iconKey: e.target.value.trim() || undefined,
                          })
                        }
                        className="rounded border border-slate-300 bg-white px-2 py-1 text-[11px]"
                      >
                        {ICON_KEY_OPTIONS.map((o) => (
                          <option key={o.value || "x"} value={o.value}>
                            {o.label}
                          </option>
                        ))}
                      </select>
                      <div className="flex gap-0.5">
                        <button
                          type="button"
                          disabled={evIndex === 0}
                          onClick={() => moveEvent(dayIndex, evIndex, "up")}
                          className="rounded border border-slate-300 px-1.5 py-0.5 text-[10px] disabled:opacity-40"
                        >
                          ▲
                        </button>
                        <button
                          type="button"
                          disabled={evIndex >= (dayEntry.events?.length ?? 0) - 1}
                          onClick={() => moveEvent(dayIndex, evIndex, "down")}
                          className="rounded border border-slate-300 px-1.5 py-0.5 text-[10px] disabled:opacity-40"
                        >
                          ▼
                        </button>
                      </div>
                      <button
                        type="button"
                        onClick={() => removeEvent(dayIndex, evIndex)}
                        className="rounded border border-slate-300 px-2 py-1 text-[11px] text-slate-600 hover:bg-slate-100"
                      >
                        삭제
                      </button>
                    </div>
                  ))}
                  <button
                    type="button"
                    onClick={() => addEvent(dayIndex)}
                    className="rounded border border-dashed border-slate-300 bg-white px-2 py-1.5 text-[11px] font-semibold text-slate-600 hover:bg-slate-50"
                  >
                    + 이벤트 추가
                  </button>
                </div>
              </article>
            ))}
            <button
              type="button"
              onClick={addDay}
              className="w-full rounded-lg border border-dashed border-slate-300 bg-white py-3 text-sm font-semibold text-slate-600 hover:bg-slate-50"
            >
              + Day 추가
            </button>
          </div>
        )}
      </div>

      <div className="lg:sticky lg:top-4 lg:self-start">
        <p className="mb-2 text-xs font-semibold text-slate-600">실시간 타임라인 미리보기</p>
        <div className="rounded-xl border border-slate-200 bg-white p-3 shadow-sm">
          {timelineModel.days.length > 0 ? (
            <InteractiveTimelineV2
              model={timelineModel}
              fallbackImageUrl={fallbackUrl}
              onDayChange={setActiveDayIndex}
            />
          ) : (
            <div className="flex flex-col items-center justify-center rounded-lg bg-slate-50 py-12 text-center text-sm text-slate-500">
              Day를 추가하면 여기에 미리보기가 표시됩니다.
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
