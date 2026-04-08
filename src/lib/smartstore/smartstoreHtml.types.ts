import type { TimelineModel } from "@/lib/products/mapProductToTimelineModel";
import type { SmartstoreHtmlSafetyReport } from "@/lib/smartstore/smartstoreHtml.safety";

/** 스마트스토어 상세 HTML 생성용 ViewModel (외부 CSS 없이 문자열 조립) */
export type SmartstoreHtmlViewModel = {
  productId: string;
  title: string;
  oneLiner: string;
  heroImageUrl: string;
  /** 대표 외 갤러리(정규화 URL, 중복 제거) */
  galleryImageUrls: string[];
  priceText?: string;
  priceMeta?: string;
  durationText?: string;
  regionText?: string;
  categoryText?: string;
  minDeparturePeopleText?: string;
  fuelIncluded?: boolean;
  includedLines: string[];
  excludedLines: string[];
  optionalLines: string[];
  bookingConditionLines: string[];
  bookingNotesLines: string[];
  /** 일정: 구조화 타임라인 우선, 없으면 텍스트 일정 */
  timeline: TimelineModel | null;
  detailedScheduleText: string;
};

export type SmartstoreHtmlBuildMeta = {
  title: string;
  productId: string;
  characterCount: number;
  /** 최종 HTML 기준 https 이미지 태그 수 */
  imageCount: number;
  includedSections: string[];
  hasHeroImage: boolean;
  hasTimeline: boolean;
  hasIncludedExcluded: boolean;
  hasOptionalTours: boolean;
  hasNoticesBlock: boolean;
  /** 네이버 업로드 안전성 검증 결과 */
  safety: SmartstoreHtmlSafetyReport;
};

export type SmartstoreHtmlApiResponse =
  | {
      ok: true;
      html: string;
      meta: SmartstoreHtmlBuildMeta;
    }
  | { ok: false; message: string };
