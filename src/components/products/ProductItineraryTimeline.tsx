"use client";

import type { ProductItineraryDay } from "@/types/product";

type Props = {
  itinerary?: ProductItineraryDay[] | null;
};

export default function ProductItineraryTimeline({ itinerary = [] }: Props) {
  const list = Array.isArray(itinerary) ? itinerary : [];
  if (!list.length) return null;

  return (
    <section className="space-y-4" aria-labelledby="itinerary-timeline-heading">
      <div className="space-y-1">
        <h2 id="itinerary-timeline-heading" className="text-lg font-semibold text-slate-900">
          상세 일정
        </h2>
        <p className="text-sm text-slate-500">
          일차별 여행 일정을 확인해보세요.
        </p>
      </div>

      <div className="rounded-2xl border border-slate-200 bg-white p-4 md:p-5">
        <div className="relative space-y-6">
          {/* 세로 연결선: 첫 번째 dot ~ 마지막 dot */}
          <div
            className="absolute left-[5px] top-3 bottom-3 w-px bg-slate-200"
            aria-hidden
          />

          {list.map((item, index) => (
            <div
              key={`${item.day}-${index}`}
              className="relative flex gap-4"
              data-day={item.day}
            >
              <div className="relative z-10 flex shrink-0 flex-col items-center" aria-hidden>
                <div className="mt-1 h-3 w-3 rounded-full bg-slate-900" />
              </div>

              <div className="min-w-0 flex-1 pb-1">
                  <div className="mb-2 flex flex-wrap items-center gap-2">
                    <span className="inline-flex shrink-0 rounded-full bg-slate-100 px-2.5 py-1 text-xs font-semibold text-slate-700">
                      DAY {item.day}
                    </span>
                    {item.title?.trim() && (
                      <h3 className="text-base font-semibold text-slate-900">
                        {item.title}
                      </h3>
                    )}
                  </div>

                  {item.subtitle?.trim() && (
                    <p className="mb-2 text-sm font-medium text-slate-700">
                      {item.subtitle}
                    </p>
                  )}

                  {item.description?.trim() && (
                    <p className="whitespace-pre-line text-sm leading-6 text-slate-600">
                      {item.description}
                    </p>
                  )}

                  {(item.meals?.length || item.hotel?.trim()) && (
                    <div className="mt-3 space-y-2 rounded-xl bg-slate-50 p-3">
                      {item.meals?.length ? (
                        <div className="flex flex-wrap gap-2 text-xs text-slate-600">
                          <span className="font-medium text-slate-700">식사</span>
                          {item.meals.map((meal) => (
                            <span
                              key={meal}
                              className="rounded-full border border-slate-200 bg-white px-2 py-1"
                            >
                              {meal}
                            </span>
                          ))}
                        </div>
                      ) : null}

                      {item.hotel?.trim() ? (
                        <div className="text-xs text-slate-600">
                          <span className="font-medium text-slate-700">숙소</span>
                          <span className="ml-2">{item.hotel}</span>
                        </div>
                      ) : null}
                    </div>
                  )}
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
