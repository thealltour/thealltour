/**
 * Content script에서 추출한 원시 DOM 데이터.
 * buildImport.ts에서 ModetourImportV1으로 변환.
 */

export type ExtractedDomData = {
  source: {
    url: string;
    fetchedAtISO: string;
  };
  product: {
    title: string;
    summary?: string;
    nights?: number;
    days?: number;
    regionText?: string;
    priceText?: string;
  };
  itinerary?: {
    days: Array<{
      dayNumber: number;
      title?: string;
      dateText?: string;
      descriptionText?: string;
      imageUrls?: string[];
      events: Array<{
        order: number;
        timeText?: string;
        title?: string;
        typeText?: string;
        descriptionText?: string;
        imageUrls?: string[];
      }>;
    }>;
  };
  inclusions?: {
    includedText?: string;
    excludedText?: string;
  };
  terms?: {
    termsText?: string;
    cancelText?: string;
    noticeText?: string;
  };
  media?: {
    heroImageUrl?: string;
    galleryImageUrls: string[];
    unassignedImageUrls: string[];
  };
  /** raw 스니펫 (파싱 실패/불확실 시 원문) */
  rawSnippets?: {
    itinerary?: string;
    inclusions?: string;
    terms?: string;
    /** DOM 일정 파서 실패 시 디버깅용 힌트 (dayHeader 텍스트, 첫 컨테이너 앞부분 등) */
    itineraryDomHint?: string;
  };
  /** DOM에서 어떤 섹션을 찾지 못했는지 */
  missingSections?: string[];
};

/** 추출 시 사용한 소스 (팝업 배지용) */
export type ExtractMeta = {
  usedJsonLd: boolean;
  usedItineraryText: boolean;
  /** 일정 추출 소스: DOM | TEXT | RAW */
  itinerarySource?: "DOM" | "TEXT" | "RAW";
  /** DOM 일정 파서 디버그 정보 */
  itineraryDomDebug?: {
    dayHeaderCount: number;
    dayContainerCount: number;
    eventCount: number;
    eventItemCount?: number;
    eventAcceptedCount?: number;
    timelineItemCount?: number;
    cardCount?: number;
    eventCountByDay?: number[];
  };
  /** 일정 스코프 컨테이너 발견 여부 */
  itineraryScopeFound?: boolean;
  /** 일정 스코프 텍스트 길이 */
  itineraryTextLength?: number;
  /** 이미지 개수 (hero/gallery/itinerary) */
  imageCounts?: { hero: number; gallery: number; itinerary: number };
  /** 이미지 신뢰도 낮음 플래그 */
  imagesLowConfidence?: boolean;
  /** 추출 전 UI 준비: 일정 탭 클릭, 아코디언 펼침 */
  uiPrep?: {
    didClickTab: boolean;
    expandedCount: number;
    debug?: { tabText?: string; expandedButtonCount: number; firstDayHeaderTexts?: string[] };
  };
};
