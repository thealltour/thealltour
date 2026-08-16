"use client";

import Image from "next/image";
import type { FlyerEditableFields, FlyerSectionToggles } from "@/lib/flyers/flyer.types";
import type { FlyerOutfitDraftState } from "@/lib/flyers/weather/flyerOutfit.types";
import type { FlyerWeatherDay } from "@/lib/flyers/weather/flyerWeather.types";
import {
  formatFlyerWeatherDateLabel,
  weatherConditionEmoji,
  weatherLeadEmojiForDays,
  weatherPrepChipLabels,
} from "@/lib/flyers/weather/flyerWeatherVisual";
import { flyerExportImageCrossOrigin } from "@/lib/flyers/exportImageUrl";
import type { FlyerSpacingClasses } from "./flyerSpacing";

type BlockCtx = {
  sections: FlyerSectionToggles;
  f: FlyerEditableFields;
  sp: FlyerSpacingClasses;
  typo: "normal" | "compact";
  exportMode?: boolean;
};

const typoTitle = (t: "normal" | "compact") =>
  t === "compact" ? "flyer-title flyer-title--compact" : "flyer-title";
const typoSub = (t: "normal" | "compact") =>
  t === "compact" ? "flyer-subtitle flyer-subtitle--compact" : "flyer-subtitle";
const typoBody = (t: "normal" | "compact") =>
  t === "compact" ? "flyer-body flyer-body--compact" : "flyer-body";
const typoList = (t: "normal" | "compact") =>
  t === "compact" ? "flyer-list flyer-list--compact" : "flyer-list";
/** 포함/불포함 — 롱폼에서 13px·lh 1.6 보수 스케일 (`.flyer-included-excluded-list`) */
const typoListC = (t: "normal" | "compact") =>
  `${typoList(t)} flyer-included-excluded-list`;
const typoSec = (t: "normal" | "compact") =>
  t === "compact" ? "flyer-section-title flyer-section-title--compact" : "flyer-section-title";

function GalleryPlaceholderIcon({ className }: { className?: string }) {
  return (
    <svg
      className={className}
      xmlns="http://www.w3.org/2000/svg"
      width="32"
      height="32"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.5"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
    >
      <rect x="3" y="5" width="18" height="14" rx="2" />
      <circle cx="8.5" cy="10.5" r="1.5" />
      <path d="M21 15l-5-5L5 21" />
    </svg>
  );
}

function FlyerWeatherBlock({
  f,
  typo,
  sp,
  weatherDays,
  outfit,
}: {
  f: FlyerEditableFields;
  typo: "normal" | "compact";
  sp: FlyerSpacingClasses;
  weatherDays: FlyerWeatherDay[];
  outfit?: FlyerOutfitDraftState;
}) {
  const title = f.weatherTitle?.trim() || "현지 예상 날씨";
  const summary = (f.weatherSummary || "").trim();
  const lead = weatherLeadEmojiForDays(weatherDays);
  const chips = weatherPrepChipLabels(outfit);
  const summaryLine =
    summary ||
    (weatherDays.length > 0
      ? `기간 중 ${weatherDays.length}일 예보를 확인해 주세요.`
      : "날씨 요약을 입력하거나 「날씨 불러오기」로 자동 채울 수 있습니다.");

  return (
    <section
      className={`flyer-card flyer-weather-card rounded-xl border border-slate-200/90 bg-gradient-to-b from-white to-slate-50/90 shadow-sm ${sp.cardPad}`}
    >
      <div className="flex items-start gap-3 sm:gap-3.5">
        <span
          className="select-none pt-0.5 text-[1.35rem] leading-none sm:text-[1.65rem]"
          aria-hidden
        >
          {lead}
        </span>
        <div className="min-w-0 flex-1">
          <p className={`${typoSec(typo)} text-slate-900`}>{title}</p>
          <p
            className={`mt-2.5 text-pretty leading-[1.7] ${
              summary
                ? "text-[14px] font-semibold text-slate-900 sm:text-[15px]"
                : `${typoBody(typo)} font-medium text-slate-600`
            }`}
          >
            {summaryLine}
          </p>
        </div>
      </div>

      {chips.length > 0 ? (
        <div className="mt-3.5 flex flex-wrap gap-2">
          {chips.map((label) => (
            <span
              key={label}
              className="inline-flex max-w-full items-center rounded-full border border-slate-200/90 bg-white/90 px-3 py-1.5 text-[12px] font-medium leading-snug text-slate-700 shadow-sm"
            >
              <span className="truncate">{label}</span>
            </span>
          ))}
        </div>
      ) : null}

      {weatherDays.length > 0 ? (
        <div
          className={`${chips.length ? "mt-4" : "mt-3.5"} space-y-3 border-t border-slate-200/70 pt-4`}
        >
          {weatherDays.slice(0, 5).map((d) => (
            <div
              key={d.date}
              className="flex items-center justify-between gap-3 rounded-lg border border-slate-100/90 bg-white px-4 py-5 shadow-sm"
            >
              <div className="flex min-w-0 items-start gap-3 sm:items-center">
                <span
                  className="shrink-0 pt-0.5 text-[1.25rem] leading-none sm:pt-0 sm:text-2xl"
                  aria-hidden
                >
                  {weatherConditionEmoji(d.condition)}
                </span>
                <div className="min-w-0">
                  <p className="text-[13px] font-bold leading-snug text-slate-900">
                    {formatFlyerWeatherDateLabel(d.date)}
                  </p>
                  <p className="mt-1 truncate text-[13px] leading-snug text-slate-500">
                    {d.condition?.trim() || "상세 없음"}
                  </p>
                </div>
              </div>
              <div className="shrink-0 text-right">
                {d.maxC != null && d.minC != null ? (
                  <p className="text-[14px] font-bold tabular-nums text-slate-900">
                    {Math.round(d.minC)}° / {Math.round(d.maxC)}°
                  </p>
                ) : (
                  <p className="text-[14px] text-slate-400">—</p>
                )}
                {d.chanceOfRain != null && d.chanceOfRain > 0 ? (
                  <p className="mt-1 text-[12px] font-semibold text-sky-700">
                    비 {Math.round(d.chanceOfRain)}%
                  </p>
                ) : null}
              </div>
            </div>
          ))}
        </div>
      ) : null}
    </section>
  );
}

export function FlyerHeaderBlock({ sections, f, sp, typo }: BlockCtx) {
  if (!sections.header) return null;
  const rawSub = f.subtitle?.trim() ?? "";
  const pills = rawSub
    ? rawSub
        .split(/[·•|]/)
        .map((s) => s.trim())
        .filter((s) => s.length > 0)
    : [];
  const usePills = pills.length >= 2;

  return (
    <header
      className={`flyer-block flyer-header-block relative shrink-0 rounded-xl border border-slate-200/80 bg-gradient-to-br from-white via-white to-[var(--primary-soft)]/25 px-4 py-4 sm:px-5 sm:py-5 ${sp.headerMb}`}
    >
      <div
        className="absolute inset-x-0 top-0 h-1 bg-gradient-to-r from-[var(--primary)] via-[var(--primary)]/70 to-[var(--primary)]/30"
        aria-hidden
      />
      <p className="flyer-kicker mt-1 text-[var(--primary)]">여행 안내</p>
      <h1
        className={`${typoTitle(typo)} mt-2 max-w-[22rem] text-balance font-bold tracking-tight text-slate-900 sm:max-w-none`}
      >
        {f.title}
      </h1>
      {usePills ? (
        <ul className="mt-3 flex flex-wrap gap-1.5" aria-label="요약 정보">
          {pills.map((p) => (
            <li
              key={p}
              className="rounded-full border border-slate-200/90 bg-white/80 px-3.5 py-2 text-base font-medium leading-snug text-slate-600 shadow-sm backdrop-blur-sm"
            >
              {p}
            </li>
          ))}
        </ul>
      ) : rawSub ? (
        <p className={`${typoSub(typo)} mt-2.5 max-w-prose text-pretty text-slate-600`}>{rawSub}</p>
      ) : null}
    </header>
  );
}

export function FlyerDepartureBlock({ sections, f, sp, typo }: BlockCtx) {
  if (!sections.departure) return null;
  const row = (label: string, body: string) => (
    <div className="min-w-0">
      <dt className="text-[12px] font-semibold uppercase tracking-wide text-slate-500">{label}</dt>
      <dd className={`${typoBody(typo)} mt-1.5 whitespace-pre-wrap text-slate-800`}>{body}</dd>
    </div>
  );

  return (
    <section
      className={`flyer-card flyer-card--departure shrink-0 rounded-xl border-2 border-[var(--primary)]/45 bg-gradient-to-br from-[var(--primary-soft)]/85 via-[var(--primary-soft)]/35 to-white ${sp.cardPad} shadow-md ring-1 ring-[var(--primary)]/10`}
    >
      <div className="mb-4 flex items-center gap-3 border-b border-[var(--primary)]/25 pb-4">
        <span
          className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-[var(--primary)]/18 text-lg text-[var(--primary)] shadow-sm ring-2 ring-white/80"
          aria-hidden
        >
          ✈️
        </span>
        <div>
          <p className={`${typoSec(typo)} text-slate-950`}>출발 · 미팅</p>
          <p className="mt-1 text-[12px] font-semibold uppercase tracking-wider text-slate-600">
            핵심 일정
          </p>
        </div>
      </div>
      <dl className="space-y-6">
        {f.departureText?.trim() ? row("일정 · 출발", f.departureText.trim()) : null}
        {f.meetingText?.trim() ? row("집합 · 미팅", f.meetingText.trim()) : null}
        {f.airlineText?.trim() ? row("항공 · 이동", f.airlineText.trim()) : null}
        {!f.departureText?.trim() && !f.meetingText?.trim() && !f.airlineText?.trim() ? (
          <p className={`${typoBody(typo)} text-slate-500`}>출발 정보를 입력해 주세요.</p>
        ) : null}
      </dl>
    </section>
  );
}

export function FlyerMainStackBlocks({
  sections,
  f,
  sp,
  typo,
  weatherDays = [],
  outfit,
}: BlockCtx & { weatherDays?: FlyerWeatherDay[]; outfit?: FlyerOutfitDraftState }) {
  const outfitIncluded = outfit?.items.filter((i) => i.included) ?? [];
  return (
    <div className={`flyer-main-col w-full ${sp.mainStack}`}>
      {sections.baggage ? (
        <section
          className={`flyer-card rounded-xl border border-slate-200/70 bg-slate-50/70 ${sp.cardPad} shadow-sm print:bg-slate-50/90`}
        >
          <p className={`${typoSec(typo)} text-slate-900`}>{f.baggageTitle}</p>
          <p className="mt-2 text-[12px] font-medium leading-snug text-slate-600">수하물 · 기내 안내</p>
          <ul
            className={`${typoList(typo)} mt-4 list-outside list-disc space-y-4 pl-5 leading-[1.65] text-slate-800 marker:text-slate-400`}
          >
            {f.baggageLines.map((line, i) => (
              <li key={i} className="break-words ps-0.5 [text-wrap:pretty]">
                {line}
              </li>
            ))}
          </ul>
        </section>
      ) : null}

      {sections.preparation ? (
        <>
          <section
            className={`flyer-card rounded-xl border border-slate-200/70 bg-slate-50/70 ${sp.cardPad} shadow-sm print:bg-slate-50/90`}
          >
            <p className={`${typoSec(typo)} text-slate-900`}>{f.preparationTitle}</p>
            <p className="mt-2 text-[12px] font-semibold leading-snug text-[var(--primary)]">준비물 체크</p>
            <ul
              className={`${typoList(typo)} mt-4 list-outside list-disc space-y-4 pl-5 leading-[1.65] text-slate-800 marker:text-slate-400`}
            >
              {f.preparationLines.map((line, i) => (
                <li key={i} className="break-words ps-0.5 [text-wrap:pretty]">
                  {line}
                </li>
              ))}
            </ul>
          </section>
          {outfitIncluded.length > 0 ? (
            <section
              className={`flyer-card rounded-xl border border-slate-200/70 bg-white ${sp.cardPad} shadow-sm`}
            >
              <p className={`${typoSec(typo)} text-slate-900`}>여행 준비물 (체크)</p>
              {outfit?.summaryText?.trim() ? (
                <p className={`${typoBody(typo)} mt-3 text-pretty leading-[1.68] text-slate-600`}>
                  {outfit.summaryText}
                </p>
              ) : null}
              <ul className={`${typoList(typo)} mt-4 list-none space-y-4 pl-0 text-slate-800`}>
                {outfitIncluded.map((item, i) => (
                  <li key={`${item.text}-${i}`} className="flex gap-4 break-words [text-wrap:pretty]">
                    <span className="mt-0.5 shrink-0 text-lg text-[var(--primary)]" aria-hidden>
                      ✓
                    </span>
                    <span className="leading-[1.65]">{item.text}</span>
                  </li>
                ))}
              </ul>
            </section>
          ) : null}
        </>
      ) : null}

      {sections.includedExcluded ? (
        <section className="flex w-full flex-col gap-4">
          <div
            className={`flyer-card rounded-xl border border-emerald-200/40 bg-emerald-50/25 ${sp.cardPad} ${sp.includedExcludedPadTweak} shadow-sm print:border-emerald-200/50 print:bg-emerald-50/30`}
          >
            <p className={`${typoSec(typo)} text-emerald-900/90`}>{f.includedTitle}</p>
            <ul
              className={`${typoListC(typo)} mt-3 list-outside list-disc space-y-[17px] pl-5 text-slate-800 marker:text-emerald-700/65`}
            >
              {f.includedLines.slice(0, 10).map((line, i) => (
                <li key={i} className="break-words ps-0.5 [text-wrap:pretty]">
                  {line}
                </li>
              ))}
            </ul>
          </div>
          <div
            className={`flyer-card rounded-xl border border-rose-200/40 bg-rose-50/22 ${sp.cardPad} ${sp.includedExcludedPadTweak} shadow-sm print:border-rose-200/50 print:bg-rose-50/28`}
          >
            <p className={`${typoSec(typo)} text-rose-900/90`}>{f.excludedTitle}</p>
            <ul
              className={`${typoListC(typo)} mt-3 list-outside list-disc space-y-[17px] pl-5 text-slate-800 marker:text-rose-700/65`}
            >
              {f.excludedLines.slice(0, 10).map((line, i) => (
                <li key={i} className="break-words ps-0.5 [text-wrap:pretty]">
                  {line}
                </li>
              ))}
            </ul>
          </div>
        </section>
      ) : null}

      {sections.notice ? (
        <section
          className={`flyer-card rounded-xl border border-slate-200/70 bg-slate-50/70 ${sp.cardPad} !pt-8 !pb-8 sm:!pt-9 sm:!pb-9 shadow-sm print:bg-slate-50/90`}
        >
          <p className={`${typoSec(typo)} text-slate-700`}>유의사항</p>
          <p
            className={`${typoBody(typo)} mt-3 whitespace-pre-wrap font-normal leading-[1.7] text-slate-600`}
          >
            {f.noticeText}
          </p>
        </section>
      ) : null}

      {sections.weather ? (
        <FlyerWeatherBlock f={f} typo={typo} sp={sp} weatherDays={weatherDays} outfit={outfit} />
      ) : null}
    </div>
  );
}

export function FlyerGallerySection({
  sections,
  images,
  sp,
  exportMode = false,
}: {
  sections: FlyerSectionToggles;
  images: string[];
  sp: FlyerSpacingClasses;
  exportMode?: boolean;
}) {
  if (!sections.gallery) return null;
  const extUrl = (url: string) =>
    url.startsWith("http://") || url.startsWith("https://") || url.startsWith("data:");
  return (
    <section
      aria-label="이미지 갤러리"
      className={`flyer-gallery-longform mt-1.5 grid w-full ${sp.galleryGridClass} ${sp.galleryGap}`}
    >
      {images.length > 0 ? (
        images.map((url, i) => (
          <div
            key={`${url}-${i}`}
            className="relative aspect-[4/3] w-full overflow-hidden rounded-xl border border-slate-200/80 bg-slate-100 shadow-sm"
          >
            {exportMode ? (
              <img
                src={url}
                alt=""
                crossOrigin={flyerExportImageCrossOrigin(url)}
                referrerPolicy="no-referrer"
                className="absolute inset-0 h-full w-full object-cover object-center"
              />
            ) : (
              <Image
                src={url}
                alt=""
                fill
                className="object-cover object-center"
                sizes="(max-width:640px) 100vw, 400px"
                unoptimized={extUrl(url)}
              />
            )}
          </div>
        ))
      ) : (
        <div className="flyer-gallery-empty col-span-full flex min-h-[8rem] flex-col items-center justify-center gap-3 rounded-xl border border-dashed border-slate-200/80 bg-slate-100/60 px-4 py-8 text-slate-500">
          <div className="rounded-full bg-slate-200/50 p-3 text-slate-400">
            <GalleryPlaceholderIcon className="h-10 w-10" />
          </div>
          <div className="text-center">
            <p className="text-base font-semibold tracking-wide text-slate-600">이미지 준비 중</p>
            <p className="mt-2 max-w-[18rem] text-base leading-[1.7] text-slate-500">
              상품에서 갤러리 이미지를 선택하면 여기에 표시됩니다.
            </p>
          </div>
        </div>
      )}
    </section>
  );
}

const LOGO_PATH = "/thealltour-logo.png";

function isDefaultBrandLabel(s: string): boolean {
  const t = s.trim().toLowerCase();
  return t === "" || t === "the all tour" || t === "더올투어" || t === "theall tour";
}

export function FlyerFooterBlock({ sections, f, typo, exportMode = false }: BlockCtx) {
  if (!sections.footer) return null;
  const showExtraBrand = !isDefaultBrandLabel(f.footerBrandText);

  return (
    <footer className="flyer-footer mt-6 shrink-0 border-t border-slate-200/80 pt-10 pb-2">
      <div className="flex flex-col items-center gap-[18px] px-1">
        <div className="h-px w-16 bg-gradient-to-r from-transparent via-slate-300/90 to-transparent" aria-hidden />
        {exportMode ? (
          <img
            src={LOGO_PATH}
            alt="더올투어"
            crossOrigin={flyerExportImageCrossOrigin(LOGO_PATH)}
            referrerPolicy="no-referrer"
            width={252}
            height={76}
            className="h-[3.15rem] w-auto max-w-[min(252px,88%)] object-contain object-center sm:h-[3.35rem]"
          />
        ) : (
          <Image
            src={LOGO_PATH}
            alt="더올투어"
            width={252}
            height={76}
            className="h-[3.15rem] w-auto max-w-[min(252px,88%)] object-contain object-center sm:h-[3.35rem]"
            unoptimized
          />
        )}
        {showExtraBrand ? (
          <p
            className="text-center text-base font-medium leading-snug text-slate-600"
          >
            {f.footerBrandText.trim()}
          </p>
        ) : null}
        {f.footerInfoText?.trim() ? (
          <p
            className={`max-w-md text-center text-slate-500 ${typo === "compact" ? "flyer-footer-info--compact" : "flyer-footer-info"}`}
          >
            {f.footerInfoText.trim()}
          </p>
        ) : null}
      </div>
    </footer>
  );
}
