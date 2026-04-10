"use client";

import { forwardRef } from "react";
import type { Product } from "@/types/product";
import type { FlyerDraftState } from "@/lib/flyers/flyer.types";
import { isFlyerTemplateVisualVariant } from "@/lib/flyers/flyer.types";
import { buildFlyerExportImageUrl } from "@/lib/flyers/exportImageUrl";
import { getFlyerSpacing } from "./flyerSpacing";
import { FlyerTemplateDefault } from "./FlyerTemplateDefault";
import { FlyerTemplateVisual } from "./FlyerTemplateVisual";

const MAX_GALLERY = 4;

export type FlyerLongformPreviewProps = {
  draft: FlyerDraftState;
  product?: Product | null;
  className?: string;
  /** true면 PNG 캡처용: 순수 img + same-origin 프록시 URL(`buildFlyerExportImageUrl`) */
  exportMode?: boolean;
};

/**
 * 모바일 친화 세로 롱포맷 유인물 미리보기.
 * PNG 캡처는 내부 `[data-flyer-document]` 기준 (`exportFlyerToPng`).
 */
export const FlyerLongformPreview = forwardRef<HTMLDivElement, FlyerLongformPreviewProps>(
  function FlyerLongformPreview({ draft, className, exportMode = false }, ref) {
    const rawImages = draft.selectedImageUrls.filter(Boolean).slice(0, MAX_GALLERY);
    const images = exportMode ? rawImages.map(buildFlyerExportImageUrl) : rawImages;
    const sp = getFlyerSpacing(draft);
    const isVisual = isFlyerTemplateVisualVariant(draft.templateKey);

    return (
      <div
        ref={ref}
        className={`flyer-longform-preview-root flex w-full justify-center bg-gradient-to-b from-slate-100/80 via-slate-50/50 to-slate-100/60 px-2 py-4 sm:px-4 sm:py-6 print:w-full print:bg-white print:px-0 print:py-0 ${className ?? ""}`}
        data-flyer-preview="longform"
        data-flyer-template={draft.templateKey}
      >
        <div
          data-flyer-document
          className="flyer-longform-document flyer-longform-doc-surface w-full max-w-[min(100%,28rem)] rounded-2xl border border-slate-200/90 bg-white text-[var(--flyer-ink,#0f172a)] shadow-[0_4px_24px_rgba(15,23,42,0.06),0_1px_3px_rgba(15,23,42,0.04)] sm:max-w-xl print:max-w-none print:rounded-none print:border-0 print:shadow-none"
        >
          <div className={`flex flex-col ${sp.inner}`}>
            {isVisual ? (
              <FlyerTemplateVisual draft={draft} images={images} exportMode={exportMode} />
            ) : (
              <FlyerTemplateDefault draft={draft} images={images} exportMode={exportMode} />
            )}
          </div>
        </div>
      </div>
    );
  },
);
