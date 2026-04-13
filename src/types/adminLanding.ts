export type AdminLandingStatus = "draft" | "published" | "archived";

export type AdminLandingTemplateType =
  | "destination_consulting"
  | "theme_consulting"
  | "recommended_collection"
  | "custom";

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
  taxonomyType: "destination" | "theme";
  taxonomyName: string;
  taxonomySlug: string;
  productCount: number;
  suggestedTitle: string;
  suggestedSlug: string;
  suggestedTemplateType: "destination_consulting" | "theme_consulting";
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
  taxonomyType: "destination" | "theme";
};

export type LandingGenerationResultEntry = {
  taxonomyId: string;
  taxonomyType: "destination" | "theme";
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
