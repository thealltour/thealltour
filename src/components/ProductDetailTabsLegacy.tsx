"use client";

import { useMemo, useState } from "react";

export type ProductDetailTabsLegacyProps = {
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

type ScheduleTab = { label: string; content: string };
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
  if (tabs.length === 0) return [{ label: "일정", content: source }];
  return tabs.filter((item) => item.content.length > 0);
}

function parseBulletLines(raw?: string) {
  return (raw ?? "")
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter((line) => line.length > 0);
}

function normalizeOXValue(value?: string) {
  const normalized = (value ?? "").trim().toLowerCase();
  if (!normalized) return "";
  if (["o", "y", "yes", "예", "가능", "제공", "포함", "있음", "있다"].includes(normalized)) return "O";
  if (["x", "n", "no", "아니오", "불가", "미제공", "불포함", "없음", "없다"].includes(normalized)) return "X";
  if (normalized.includes("없") || normalized.includes("불가") || normalized.includes("미")) return "X";
  return "O";
}

export default function ProductDetailTabsLegacy({
  pointBenefits = "",
  pointTourism = "",
  pointGuide = "",
  meetingInfo = "",
  travelInsurance = "",
  includedItems = "",
  excludedItems = "",
  detailedSchedule = "",
  optionalTours = "",
  minDeparturePeople = "",
  termsAndNotes = "",
}: ProductDetailTabsLegacyProps) {
  const [activeMainTab, setActiveMainTab] = useState<MainTab>("points");
  const scheduleTabs = useMemo(() => parseScheduleTabs(detailedSchedule), [detailedSchedule]);
  const [activeScheduleIndex, setActiveScheduleIndex] = useState(0);
  const optionalLines = useMemo(() => parseBulletLines(optionalTours), [optionalTours]);
  const termsLines = useMemo(() => parseBulletLines(termsAndNotes), [termsAndNotes]);

  const pointRows = [
    { label: "혜택", value: pointBenefits, badge: "혜택", type: "text" as const },
    { label: "관광", value: pointTourism, type: "ox" as const },
    { label: "인솔자", value: pointGuide, type: "ox" as const },
    { label: "미팅정보", value: meetingInfo, type: "ox" as const },
    { label: "여행자보험", value: travelInsurance, type: "ox" as const },
  ].filter((item) => (item.type === "text" ? Boolean(item.value?.trim()) : true));

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

      {activeMainTab === "points" && (
        <div className="fade-in-up space-y-5">
          <div className="flex flex-col space-y-3 md:space-y-0 md:grid md:grid-cols-2 md:gap-3 lg:grid-cols-3">
            {pointRows.length > 0 ? (
              pointRows.map((item) => {
                const oxValue = item.type === "ox" ? normalizeOXValue(item.value) : "";
                const isProvided = oxValue === "O";
                const isNotProvided = oxValue === "X";
                return (
                  <article key={item.label} className="rounded-2xl bg-[#f8fbff] p-4 ring-1 ring-[#dbeafe]">
                    {item.type === "text" ? (
                      <>
                        <div className="mb-3 inline-flex items-center rounded-full bg-white px-2.5 py-1 text-xs font-bold text-[#1e3a8a] ring-1 ring-[#dbeafe]">
                          {item.badge}
                        </div>
                        <h3 className="mb-2 text-sm font-bold text-[#1e3a8a]">{item.label}</h3>
                        <p className="whitespace-pre-line text-sm leading-6 text-slate-700">{item.value?.trim()}</p>
                      </>
                    ) : (
                      <div className="flex items-center justify-between gap-3">
                        <h3 className="text-[15px] font-bold text-[#1e3a8a]">{item.label}</h3>
                        <span
                          className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-semibold ${
                            isProvided ? "bg-emerald-100 text-emerald-700" : isNotProvided ? "bg-rose-100 text-rose-700" : "bg-slate-100 text-slate-500"
                          }`}
                        >
                          <span className="font-black">{isProvided ? "O" : isNotProvided ? "X" : "-"}</span>
                          <span>{isProvided ? "제공" : isNotProvided ? "미제공" : "미설정"}</span>
                        </span>
                      </div>
                    )}
                  </article>
                );
              })
            ) : (
              <p className="text-sm text-slate-500">등록된 핵심 포인트가 없습니다.</p>
            )}
          </div>
          {minDeparturePeople?.trim() ? (
            <article className="rounded-2xl bg-[#f8fbff] p-4 ring-1 ring-[#dbeafe]">
              <h3 className="mb-2 text-sm font-bold text-[#1e3a8a]">출발인원</h3>
              <p className="text-sm leading-6 text-slate-700">{minDeparturePeople.trim()}명 이상 출발 확정</p>
            </article>
          ) : null}
          <div className="flex flex-col space-y-3 md:space-y-0 md:grid md:grid-cols-2 md:gap-3">
            <article className="rounded-2xl bg-[#f8fbff] p-4 ring-1 ring-[#dbeafe]">
              <h3 className="mb-2 text-sm font-bold text-[#1e3a8a]">포함사항</h3>
              <p className="whitespace-pre-line text-sm leading-6 text-slate-700">
                {includedItems?.trim() || "등록된 포함사항이 없습니다."}
              </p>
            </article>
            <article className="rounded-2xl bg-[#fff7ed] p-4 ring-1 ring-[#fed7aa]">
              <h3 className="mb-2 text-sm font-bold text-[#1e3a8a]">불포함사항</h3>
              <p className="whitespace-pre-line text-sm leading-6 text-slate-700">
                {excludedItems?.trim() || "등록된 불포함사항이 없습니다."}
              </p>
            </article>
          </div>
        </div>
      )}

      {activeMainTab === "schedule" && (
        <div className="fade-in-up space-y-4">
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
              <article className="fade-in-up rounded-2xl bg-[#f8fbff] p-5 ring-1 ring-[#dbeafe]">
                <div className="mb-3 inline-flex items-center rounded-full bg-white px-3 py-1 text-xs font-bold text-[#1e3a8a] ring-1 ring-[#dbeafe]">
                  {scheduleTabs[activeScheduleIndex]?.label}
                </div>
                <p className="whitespace-pre-line text-sm leading-7 text-slate-700">
                  {scheduleTabs[activeScheduleIndex]?.content}
                </p>
              </article>
            </>
          ) : (
            <p className="text-sm text-slate-500">등록된 상세일정이 없습니다.</p>
          )}
        </div>
      )}

      {activeMainTab === "optional" && (
        <div className="fade-in-up rounded-2xl bg-[#f8fbff] p-4 ring-1 ring-[#dbeafe]">
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
      )}

      {activeMainTab === "terms" && (
        <div className="fade-in-up rounded-2xl bg-[#f8fbff] p-4 ring-1 ring-[#dbeafe]">
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
      )}
    </section>
  );
}
