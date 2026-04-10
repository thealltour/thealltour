"use client";

import type { FlyerDraftState } from "@/lib/flyers/flyer.types";
import { flyerTypographyScale, getFlyerSpacing } from "./flyerSpacing";
import {
  FlyerDepartureBlock,
  FlyerFooterBlock,
  FlyerGallerySection,
  FlyerHeaderBlock,
  FlyerMainStackBlocks,
} from "./FlyerTemplateSections";

/** 롱포맷 기본: 헤더 → 출발 → 본문 카드 세로 누적 → 갤러리 → 푸터 */
export function FlyerTemplateDefault({
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
  const ctx = { sections: draft.sections, f: draft.fields, sp, typo, exportMode };
  return (
    <>
      <FlyerHeaderBlock {...ctx} />
      <div className={`flex w-full flex-col ${sp.stackGap}`}>
        <FlyerDepartureBlock {...ctx} />
        <FlyerMainStackBlocks
          {...ctx}
          weatherDays={draft.weather.isLoaded ? draft.weather.days : []}
          outfit={draft.outfit}
        />
        <FlyerGallerySection sections={draft.sections} images={images} sp={sp} exportMode={exportMode} />
      </div>
      <FlyerFooterBlock {...ctx} />
    </>
  );
}
