"use client";

import Image from "next/image";
import type { FlyerDraftState } from "@/lib/flyers/flyer.types";
import { flyerExportImageCrossOrigin } from "@/lib/flyers/exportImageUrl";
import { flyerTypographyScale, getFlyerSpacing } from "./flyerSpacing";
import {
  FlyerDepartureBlock,
  FlyerFooterBlock,
  FlyerGallerySection,
  FlyerHeaderBlock,
  FlyerMainStackBlocks,
} from "./FlyerTemplateSections";

function unoptimizedUrl(url: string) {
  return url.startsWith("http://") || url.startsWith("https://") || url.startsWith("data:");
}

/** 롱포맷 비주얼: 상단 히어로(첫 이미지) → 본문 세로 누적 → 나머지 이미지 그리드 */
export function FlyerTemplateVisual({
  draft,
  images,
  exportMode = false,
}: {
  draft: FlyerDraftState;
  images: string[];
  exportMode?: boolean;
}) {
  const sp = getFlyerSpacing(draft);
  const typo = flyerTypographyScale(draft);
  const { sections, fields: f } = draft;
  const ctx = { sections, f, sp, typo, exportMode };

  const showHero = sections.gallery && images.length > 0;
  const heroUrl = showHero ? images[0] : null;
  const galleryImages = showHero ? images.slice(1) : images;

  return (
    <>
      {showHero && heroUrl ? (
        <>
          <div className="flyer-visual-hero relative mb-0 w-full shrink-0 overflow-hidden rounded-xl border border-slate-200/80 shadow-sm aspect-[16/9] min-h-[9rem] max-h-56 sm:max-h-64">
            {exportMode ? (
              <img
                src={heroUrl}
                alt=""
                crossOrigin={flyerExportImageCrossOrigin(heroUrl)}
                referrerPolicy="no-referrer"
                className="absolute inset-0 h-full w-full object-cover object-center"
              />
            ) : (
              <Image
                src={heroUrl}
                alt=""
                fill
                className="object-cover object-center"
                sizes="(max-width:640px) 100vw, 512px"
                unoptimized={unoptimizedUrl(heroUrl)}
              />
            )}
            <div className="pointer-events-none absolute inset-0 bg-gradient-to-t from-black/65 via-black/20 to-transparent" />
            {sections.header ? (
              <div className="absolute inset-x-4 bottom-4">
                <h1
                  className={`${
                    typo === "compact"
                      ? "text-[20px] sm:text-[22px]"
                      : "text-[22px] sm:text-[23px]"
                  } font-bold leading-snug tracking-tight text-white drop-shadow-sm [text-wrap:balance]`}
                >
                  {f.title}
                </h1>
                {f.subtitle ? (
                  <p className="mt-1.5 text-[13px] sm:text-sm leading-snug text-white/88 drop-shadow-sm [text-wrap:pretty]">
                    {f.subtitle}
                  </p>
                ) : null}
              </div>
            ) : null}
          </div>
          {/* 히어로 → 본문: 은은한 그라데이션 + 여백으로 단절감 완화 */}
          <div
            className="h-7 w-full shrink-0 bg-gradient-to-b from-slate-200/25 via-slate-50/40 to-transparent sm:h-9"
            aria-hidden
          />
        </>
      ) : (
        <FlyerHeaderBlock {...ctx} />
      )}

      <div className={`flex w-full flex-col ${showHero && heroUrl ? "mt-1" : ""} ${sp.stackGap}`}>
        <FlyerDepartureBlock {...ctx} />
        <FlyerMainStackBlocks
          {...ctx}
          weatherDays={draft.weather.isLoaded ? draft.weather.days : []}
          outfit={draft.outfit}
        />
        <FlyerGallerySection
          sections={draft.sections}
          images={galleryImages}
          sp={sp}
          exportMode={exportMode}
        />
      </div>
      <FlyerFooterBlock {...ctx} />
    </>
  );
}
