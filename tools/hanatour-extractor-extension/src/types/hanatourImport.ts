/**
 * 앱의 HanatourImportV1과 동일 구조 유지.
 */

export type HanatourImageHeuristicHints = {
  isThumbnailCandidate: boolean;
  isLogoCandidate: boolean;
  isLowResolution: boolean;
};

export type HanatourImportWarning = {
  code: string;
  message: string;
  path?: string;
};

export type HanatourImportV1 = {
  version: "hanatour-import-v1";

  source: {
    provider: "hanatour";
    url: string;
    fetchedAtISO: string;
    pkgCd?: string;
    ptnCd?: string;
    inpPathCd?: string;
    type?: string;
  };

  product: {
    title?: string;
    summary?: string;
    nights?: number;
    days?: number;
    regionText?: string;
    priceText?: string;
    productCode?: string;
    departureCityText?: string;
    airlineText?: string;
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
    imageHintsByUrl?: Record<string, HanatourImageHeuristicHints>;
  };

  warnings?: HanatourImportWarning[];

  raw?: {
    textSnippets?: Record<string, string>;
    jsonLd?: unknown;
  };
};
