export type AdminLandingStatus = "draft" | "published" | "archived";

/** Publish 검증 실패 시 API·UI에 전달되는 항목 */
export type LandingPublishValidationIssue = {
  field: string;
  message: string;
};

export type AdminLandingTemplateType =
  | "destination_consulting"
  | "theme_consulting"
  | "product_line_consulting"
  | "recommended_collection"
  | "custom";

export type LandingTaxonomyType = "destination" | "theme" | "product_line";

export type LandingGenerationEligibilityReason = "HAS_PRODUCTS" | "PRODUCT_LINE_PRESEED";

export type AdminLandingSectionType =
  | "hero"
  | "intro"
  | "consulting_points"
  | "recommended_targets"
  | "faq"
  | "cta";

export type AdminLandingSection = {
  id: string;
  landingId: string;
  sectionType: AdminLandingSectionType | string;
  title: string;
  description?: string | null;
  body?: string | null;
  isEnabled: boolean;
  sortOrder: number;
  sectionData?: Record<string, unknown> | null;
  createdAt?: string;
  updatedAt?: string;
};

export type AdminLandingListItem = {
  id: string;
  title: string;
  slug: string;
  status: AdminLandingStatus;
  templateType: AdminLandingTemplateType | string;
  updatedAt: string;
  publishedAt?: string | null;
};

export type AdminLandingDetail = {
  id: string;
  title: string;
  slug: string;
  status: AdminLandingStatus;
  templateType: AdminLandingTemplateType | string;
  summary?: string;
  seoTitle?: string | null;
  seoDescription?: string | null;
  sourcePath?: string | null;
  quoteCategory?: string | null;
  /** taxonomy 기반 생성 랜딩 — analytics funnel용 */
  sourceTaxonomyId?: string | null;
  sourceTaxonomyType?: LandingTaxonomyType | string | null;
  sourceTaxonomySlug?: string | null;
  updatedAt: string;
  publishedAt?: string | null;
  sections?: AdminLandingSection[];
};

export type AdminLandingSummary = {
  total: number;
  published: number;
  draft: number;
  archived: number;
};

export type AdminLandingListResponse = {
  items: AdminLandingListItem[];
  total: number;
};

export type LandingGenerationCandidate = {
  taxonomyId: string;
  taxonomyType: LandingTaxonomyType;
  taxonomyName: string;
  taxonomySlug: string;
  /** slug 정규화 루트(quoteCategory 등과 동일 계열, -travel 제외 전 단계) */
  normalizedRootSlug?: string | null;
  /** 공개 랜딩 canonical 경로 스냅샷 (/recommended/{slug}) */
  suggestedSourcePath?: string | null;
  productCount: number;
  eligibilityReason: LandingGenerationEligibilityReason;
  isPreseedCandidate: boolean;
  suggestedTitle: string;
  suggestedSlug: string;
  suggestedTemplateType:
    | "destination_consulting"
    | "theme_consulting"
    | "product_line_consulting";
  suggestedQuoteCategory: string | null;
  existingLandingId?: string | null;
  existingLandingSlug?: string | null;
  isAlreadyGenerated: boolean;
};

export type LandingGenerationCandidatesResponse = {
  items: LandingGenerationCandidate[];
  total: number;
};

export type LandingGenerationRequestItem = {
  taxonomyId: string;
  taxonomyType: LandingTaxonomyType;
};

export type LandingGenerationResultEntry = {
  taxonomyId: string;
  taxonomyType: LandingTaxonomyType;
  taxonomyName: string;
  landingId?: string;
  landingSlug?: string;
  reason?: string;
};

export type LandingGenerationResult = {
  created: LandingGenerationResultEntry[];
  skipped: LandingGenerationResultEntry[];
  failed: LandingGenerationResultEntry[];
};
