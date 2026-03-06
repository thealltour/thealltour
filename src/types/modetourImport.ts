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
  };

  terms?: {
    termsText?: string;
    cancelText?: string;
    noticeText?: string;
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
  };

  warnings?: ModetourImportWarning[];

  raw?: {
    textSnippets?: Record<string, string>;
  };
};
