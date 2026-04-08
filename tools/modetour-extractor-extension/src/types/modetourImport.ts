/**
 * 앱의 ModetourImportV1과 동일 구조 유지.
 * version / source.provider 는 반드시 동일해야 함.
 */

/** 익스텐션 수집 휴리스틱 — 자동 삭제 금지, 관리자 배지용 */
export type ModetourImageHeuristicHints = {
  isThumbnailCandidate: boolean;
  isLogoCandidate: boolean;
  isLowResolution: boolean;
};

export type ModetourImportWarning = {
  code: string;
  message: string;
  path?: string;
};

export type ModetourImportV1 = {
  version: "modetour-import-v1";

  source: {
    provider: "modetour";
    url: string;
    fetchedAtISO: string;
  };

  product: {
    title?: string;
    summary?: string;
    nights?: number;
    days?: number;
    regionText?: string;
    priceText?: string;
  };

  inclusions?: {
    includedText?: string;
    excludedText?: string;
    /** DOM 파싱으로 추출한 포함 사항 리스트 (우선 사용) */
    includedItems?: string[];
    /** DOM 파싱으로 추출한 불포함 사항 리스트 (우선 사용) */
    excludedItems?: string[];
  };

  terms?: {
    termsText?: string;
    cancelText?: string;
    noticeText?: string;
  };

  /** 탭형 상세정보 (일정 안내 / 예약 조건 / 환불·취소 규정) DOM 파싱 결과 */
  detailTabs?: {
    scheduleNotice?: { title: string; rawText: string; sections: { heading?: string | null; lines: string[] }[]; lines: string[] } | null;
    bookingTerms?: { title: string; rawText: string; sections: { heading?: string | null; lines: string[] }[]; lines: string[] } | null;
    cancellationPolicy?: { title: string; rawText: string; sections: { heading?: string | null; lines: string[] }[]; lines: string[] } | null;
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

  media?: {
    heroImageUrl?: string;
    galleryImageUrls?: string[];
    unassignedImageUrls?: string[];
    /** 정규화된 절대 URL 키 — 썸네일/로고/저해상도 의심 배지용 */
    imageHintsByUrl?: Record<string, ModetourImageHeuristicHints>;
  };

  warnings?: ModetourImportWarning[];

  raw?: {
    textSnippets?: Record<string, string>;
  };
};
