"use client";

import { useMemo, useState } from "react";
import {
  ChevronDown,
  Plane,
  Hotel,
  MapPin,
  CalendarDays,
  Check,
  UtensilsCrossed,
} from "lucide-react";
import AlertCard from "@/components/ui/AlertCard";

type ProductDetailTabsProps = {
  pointBenefits?: string;
  pointTourism?: string;
  pointGuide?: string;
  meetingInfo?: string;
  travelInsurance?: string;
  includedItems?: string;
  excludedItems?: string;
  detailedSchedule?: string;
  optionalTours?: string;
  minDeparturePeople?: string;
  termsAndNotes?: string;
};

type ScheduleDay = {
  label: string;
  content: string;
};

type MainTab = "schedule" | "included" | "booking" | "refund";

function parseScheduleDays(raw?: string): ScheduleDay[] {
  const source = raw?.trim();
  if (!source) return [];

  const lines = source.split(/\r?\n/);
  const days: ScheduleDay[] = [];
  let currentLabel = "";
  let currentContent: string[] = [];

  for (const line of lines) {
    const match = line.match(/^\[(.+)\]\s*$/);
    if (match) {
      if (currentLabel) {
        days.push({ label: currentLabel, content: currentContent.join("\n").trim() });
      }
      currentLabel = match[1].trim();
      currentContent = [];
      continue;
    }
    currentContent.push(line);
  }

  if (currentLabel) {
    days.push({ label: currentLabel, content: currentContent.join("\n").trim() });
  }

  if (days.length === 0) return [{ label: "일정", content: source }];
  return days.filter((d) => d.content.length > 0);
}

function getScheduleIcon(label: string) {
  const lower = label.toLowerCase().replace(/\s+/g, "");
  if (/출발|항공|비행|공항|day\s*1/.test(lower)) return Plane;
  if (/호텔|숙박|체크인|체크아웃/.test(lower)) return Hotel;
  if (/골프|라운딩|코스/.test(lower)) return MapPin;
  if (/식사|맛집|식당|브런치|디너/.test(lower)) return UtensilsCrossed;
  return CalendarDays;
}

function parseBulletLines(raw?: string) {
  return (raw ?? "")
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter((line) => line.length > 0);
}

export default function ProductDetailTabs({
  includedItems,
  excludedItems,
  detailedSchedule,
  optionalTours,
  minDeparturePeople,
  termsAndNotes,
}: ProductDetailTabsProps) {
  const [activeTab, setActiveTab] = useState<MainTab>("schedule");
  const [openScheduleIndex, setOpenScheduleIndex] = useState<number | null>(0);
  const scheduleDays = useMemo(() => parseScheduleDays(detailedSchedule), [detailedSchedule]);
  const includedLines = useMemo(() => parseBulletLines(includedItems), [includedItems]);
  const excludedLines = useMemo(() => parseBulletLines(excludedItems), [excludedItems]);
  const optionalLines = useMemo(() => parseBulletLines(optionalTours), [optionalTours]);
  const termsLines = useMemo(() => parseBulletLines(termsAndNotes), [termsAndNotes]);

  const mainTabs: { key: MainTab; label: string }[] = [
    { key: "schedule", label: "일정 안내" },
    { key: "included", label: "포함/불포함" },
    { key: "booking", label: "예약 조건" },
    { key: "refund", label: "환불 규정" },
  ];

  const listClass = "space-y-2 text-sm leading-[1.7] text-slate-700";
  const bulletClass = "mt-2 h-1.5 w-1.5 shrink-0 rounded-full bg-[#2563eb]";

  return (
    <section className="space-y-5 rounded-3xl bg-white/95 p-4 shadow-sm ring-1 ring-[#dbeafe] backdrop-blur md:p-6">
      <div className="flex flex-wrap gap-2">
        {mainTabs.map((tab) => (
          <button
            key={tab.key}
            type="button"
            onClick={() => setActiveTab(tab.key)}
            className={`rounded-full border px-4 py-2 text-sm font-semibold transition ${
              activeTab === tab.key
                ? "border-[#60a5fa] bg-[#eff6ff] text-[#1e3a8a] shadow-sm"
                : "border-slate-200 bg-white text-slate-600 hover:bg-slate-50"
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* 일정 안내 - Accordion */}
      {activeTab === "schedule" && (
        <div key="schedule" className="fade-in-up space-y-2">
          {scheduleDays.length > 0 ? (
            scheduleDays.map((day, index) => {
              const Icon = getScheduleIcon(day.label);
              const isOpen = openScheduleIndex === index;
              return (
                <div
                  key={`${day.label}-${index}`}
                  className="overflow-hidden rounded-xl border border-[#dbeafe] bg-[#f8fbff] ring-1 ring-[#dbeafe]"
                >
                  <button
                    type="button"
                    onClick={() => setOpenScheduleIndex(isOpen ? null : index)}
                    className="flex w-full items-center gap-3 px-4 py-3 text-left transition hover:bg-[#eff6ff]"
                  >
                    <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-white text-[#1e3a8a] ring-1 ring-[#dbeafe]">
                      <Icon className="h-4 w-4" />
                    </span>
                    <span className="flex-1 font-semibold text-[#0f172a]">{day.label}</span>
                    <ChevronDown
                      className={`h-5 w-5 shrink-0 text-slate-500 transition ${isOpen ? "rotate-180" : ""}`}
                    />
                  </button>
                  {isOpen && (
                    <div className="border-t border-[#dbeafe] px-4 pb-4 pt-2">
                      <p className="whitespace-pre-line text-sm leading-[1.7] text-slate-700">
                        {day.content}
                      </p>
                    </div>
                  )}
                </div>
              );
            })
          ) : (
            <p className="text-sm text-slate-500">등록된 일정이 없습니다.</p>
          )}
        </div>
      )}

      {/* 포함/불포함 */}
      {activeTab === "included" && (
        <div key="included" className="fade-in-up space-y-6">
          <div>
            <h3 className="mb-3 text-sm font-bold text-[#1e3a8a]">포함 사항</h3>
            {includedLines.length > 0 ? (
              <ul className={listClass}>
                {includedLines.map((line, i) => (
                  <li key={i} className="flex items-start gap-2">
                    <span className={bulletClass} />
                    <span>{line}</span>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="text-sm text-slate-500">등록된 포함 사항이 없습니다.</p>
            )}
          </div>

          <div className="rounded-xl border border-amber-200 bg-amber-50/50 p-4 ring-1 ring-amber-200">
            <h3 className="mb-3 text-sm font-bold text-amber-800">불포함 사항</h3>
            {excludedLines.length > 0 ? (
              <ul className={listClass}>
                {excludedLines.map((line, i) => (
                  <li key={i} className="flex items-start gap-2">
                    <span className="mt-2 h-1.5 w-1.5 shrink-0 rounded-full bg-amber-500" />
                    <span>{line}</span>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="text-sm text-slate-500">등록된 불포함 사항이 없습니다.</p>
            )}
          </div>

          {optionalLines.length > 0 && (
            <div>
              <h3 className="mb-3 text-sm font-bold text-[#1e3a8a]">선택 관광</h3>
              <ul className={listClass}>
                {optionalLines.map((line, i) => (
                  <li key={i} className="flex items-start gap-2">
                    <span className={bulletClass} />
                    <span>{line}</span>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>
      )}

      {/* 예약 조건 - 체크리스트 + 약관 요약 */}
      {activeTab === "booking" && (
        <div key="booking" className="fade-in-up space-y-5">
          <ul className="space-y-3">
            {minDeparturePeople?.trim() && (
              <li className="flex items-start gap-3">
                <Check className="mt-0.5 h-5 w-5 shrink-0 text-emerald-600" />
                <span className="text-sm leading-[1.7] text-slate-700">
                  출발 인원: {minDeparturePeople.trim()}명 이상 확정 시 출발
                </span>
              </li>
            )}
            <li className="flex items-start gap-3">
              <Check className="mt-0.5 h-5 w-5 shrink-0 text-emerald-600" />
              <span className="text-sm leading-[1.7] text-slate-700">
                최종 일정·가격은 상담 후 확정됩니다.
              </span>
            </li>
            <li className="flex items-start gap-3">
              <Check className="mt-0.5 h-5 w-5 shrink-0 text-emerald-600" />
              <span className="text-sm leading-[1.7] text-slate-700">
                문의 주시면 맞춤 견적과 예약 절차를 안내해 드립니다.
              </span>
            </li>
          </ul>
          {termsLines.length > 0 && (
            <AlertCard variant="info" title="예약 시 유의사항">
              <ul className="mt-2 space-y-1">
                {termsLines.map((line, i) => (
                  <li key={i}>{line}</li>
                ))}
              </ul>
            </AlertCard>
          )}
        </div>
      )}

      {/* 환불 규정 */}
      {activeTab === "refund" && (
        <div key="refund" className="fade-in-up">
          {termsLines.length > 0 ? (
            <AlertCard variant="neutral" title="환불 및 취소 규정">
              <ul className="mt-2 space-y-2 leading-[1.7]">
                {termsLines.map((line, i) => (
                  <li key={i}>{line}</li>
                ))}
              </ul>
            </AlertCard>
          ) : (
            <AlertCard variant="info" title="환불 규정">
              <p>
                상품별 상세 환불·취소 규정은 상담 시 안내해 드립니다. 문의해 주시면 기간별 취소 수수료와
                절차를 안내해 드립니다.
              </p>
            </AlertCard>
          )}
        </div>
      )}
    </section>
  );
}
