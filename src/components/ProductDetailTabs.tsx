"use client";

import { useMemo, useState } from "react";

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
  termsAndNotes?: string;
};

type ScheduleTab = {
  label: string;
  content: string;
};

type MainTab = "points" | "schedule" | "optional" | "terms";

function parseScheduleTabs(raw?: string): ScheduleTab[] {
  const source = raw?.trim();
  if (!source) return [];

  const lines = source.split(/\r?\n/);
  const tabs: ScheduleTab[] = [];
  let currentLabel = "";
  let currentContent: string[] = [];

  for (const line of lines) {
    const match = line.match(/^\[(.+)\]\s*$/);
    if (match) {
      if (currentLabel) {
        tabs.push({ label: currentLabel, content: currentContent.join("\n").trim() });
      }
      currentLabel = match[1].trim();
      currentContent = [];
      continue;
    }
    currentContent.push(line);
  }

  if (currentLabel) {
    tabs.push({ label: currentLabel, content: currentContent.join("\n").trim() });
  }

  if (tabs.length === 0) {
    return [{ label: "일정", content: source }];
  }

  return tabs.filter((item) => item.content.length > 0);
}

function parseBulletLines(raw?: string) {
  return (raw ?? "")
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter((line) => line.length > 0);
}

export default function ProductDetailTabs({
  pointBenefits,
  pointTourism,
  pointGuide,
  meetingInfo,
  travelInsurance,
  includedItems,
  excludedItems,
  detailedSchedule,
  optionalTours,
  termsAndNotes,
}: ProductDetailTabsProps) {
  const [activeMainTab, setActiveMainTab] = useState<MainTab>("points");
  const scheduleTabs = useMemo(() => parseScheduleTabs(detailedSchedule), [detailedSchedule]);
  const [activeScheduleIndex, setActiveScheduleIndex] = useState(0);
  const optionalLines = useMemo(() => parseBulletLines(optionalTours), [optionalTours]);
  const termsLines = useMemo(() => parseBulletLines(termsAndNotes), [termsAndNotes]);

  const pointRows = [
    { label: "혜택", value: pointBenefits, icon: "혜택" },
    { label: "관광", value: pointTourism, icon: "관광" },
    { label: "인솔자", value: pointGuide, icon: "인솔" },
    { label: "미팅정보", value: meetingInfo, icon: "미팅" },
    { label: "여행자보험", value: travelInsurance, icon: "보험" },
  ].filter((item) => Boolean(item.value && item.value.trim()));

  const mainTabs: { key: MainTab; label: string }[] = [
    { key: "points", label: "상품 핵심 포인트" },
    { key: "schedule", label: "상세일정" },
    { key: "optional", label: "선택관광" },
    { key: "terms", label: "약관 및 참조사항" },
  ];

  return (
    <section className="space-y-5 rounded-3xl bg-white/95 p-4 shadow-sm ring-1 ring-[#dbeafe] backdrop-blur md:p-6">
      <div className="flex flex-wrap gap-2">
        {mainTabs.map((tab) => (
          <button
            key={tab.key}
            type="button"
            onClick={() => setActiveMainTab(tab.key)}
            className={`rounded-full border px-4 py-2 text-sm font-semibold transition ${
              activeMainTab === tab.key
                ? "border-[#60a5fa] bg-[#eff6ff] text-[#1e3a8a] shadow-sm"
                : "border-slate-200 bg-white text-slate-600 hover:bg-slate-50"
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {activeMainTab === "points" ? (
        <div key="points" className="fade-in-up space-y-5">
          <div className="grid gap-3 md:grid-cols-2 lg:grid-cols-3">
            {pointRows.length > 0 ? (
              pointRows.map((item) => (
                <article key={item.label} className="rounded-2xl bg-[#f8fbff] p-4 ring-1 ring-[#dbeafe]">
                  <div className="mb-3 inline-flex items-center rounded-full bg-white px-2.5 py-1 text-xs font-bold text-[#1e3a8a] ring-1 ring-[#dbeafe]">
                    {item.icon}
                  </div>
                  <h3 className="mb-2 text-sm font-bold text-[#1e3a8a]">{item.label}</h3>
                  <p className="whitespace-pre-line text-sm leading-6 text-slate-700">{item.value?.trim()}</p>
                </article>
              ))
            ) : (
              <p className="text-sm text-slate-500">등록된 핵심 포인트가 없습니다.</p>
            )}
          </div>

          <div className="grid gap-3 md:grid-cols-2">
            <article className="rounded-2xl bg-[#f8fbff] p-4 ring-1 ring-[#dbeafe]">
              <h3 className="mb-2 text-sm font-bold text-[#1e3a8a]">포함사항</h3>
              <p className="whitespace-pre-line text-sm leading-6 text-slate-700">
                {includedItems?.trim() ? includedItems : "등록된 포함사항이 없습니다."}
              </p>
            </article>
            <article className="rounded-2xl bg-[#fff7ed] p-4 ring-1 ring-[#fed7aa]">
              <h3 className="mb-2 text-sm font-bold text-[#1e3a8a]">불포함사항</h3>
              <p className="whitespace-pre-line text-sm leading-6 text-slate-700">
                {excludedItems?.trim() ? excludedItems : "등록된 불포함사항이 없습니다."}
              </p>
            </article>
          </div>
        </div>
      ) : null}

      {activeMainTab === "schedule" ? (
        <div key="schedule" className="fade-in-up space-y-4">
          {scheduleTabs.length > 0 ? (
            <>
              <div className="flex flex-wrap gap-2">
                {scheduleTabs.map((tab, index) => (
                  <button
                    key={tab.label}
                    type="button"
                    onClick={() => setActiveScheduleIndex(index)}
                    className={`rounded-full px-3 py-1.5 text-xs font-semibold transition ${
                      index === activeScheduleIndex
                        ? "bg-[#1d4ed8] text-white"
                        : "border border-slate-300 bg-white text-slate-600 hover:bg-slate-50"
                    }`}
                  >
                    {tab.label}
                  </button>
                ))}
              </div>
              <article
                key={scheduleTabs[activeScheduleIndex]?.label ?? "schedule-content"}
                className="fade-in-up rounded-2xl bg-[#f8fbff] p-5 ring-1 ring-[#dbeafe]"
              >
                <div className="mb-3 inline-flex items-center rounded-full bg-white px-3 py-1 text-xs font-bold text-[#1e3a8a] ring-1 ring-[#dbeafe]">
                  {scheduleTabs[activeScheduleIndex]?.label}
                </div>
                <p className="whitespace-pre-line text-sm leading-7 text-slate-700">{scheduleTabs[activeScheduleIndex]?.content}</p>
              </article>
            </>
          ) : (
            <p className="text-sm text-slate-500">등록된 상세일정이 없습니다.</p>
          )}
        </div>
      ) : null}

      {activeMainTab === "optional" ? (
        <div key="optional" className="fade-in-up rounded-2xl bg-[#f8fbff] p-4 ring-1 ring-[#dbeafe]">
          {optionalLines.length > 0 ? (
            <ul className="space-y-2">
              {optionalLines.map((line, index) => (
                <li key={`${line}-${index}`} className="flex items-start gap-2 text-sm leading-6 text-slate-700">
                  <span className="mt-2 h-1.5 w-1.5 shrink-0 rounded-full bg-[#2563eb]" />
                  <span>{line}</span>
                </li>
              ))}
            </ul>
          ) : (
            <p className="text-sm text-slate-500">등록된 선택관광 정보가 없습니다.</p>
          )}
        </div>
      ) : null}

      {activeMainTab === "terms" ? (
        <div key="terms" className="fade-in-up rounded-2xl bg-[#f8fbff] p-4 ring-1 ring-[#dbeafe]">
          {termsLines.length > 0 ? (
            <ul className="space-y-2">
              {termsLines.map((line, index) => (
                <li key={`${line}-${index}`} className="flex items-start gap-2 text-sm leading-6 text-slate-700">
                  <span className="mt-2 h-1.5 w-1.5 shrink-0 rounded-full bg-slate-400" />
                  <span>{line}</span>
                </li>
              ))}
            </ul>
          ) : (
            <p className="text-sm text-slate-500">등록된 약관 및 참조사항이 없습니다.</p>
          )}
        </div>
      ) : null}
    </section>
  );
}
