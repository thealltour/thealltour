export type AdminLandingRecord = {
  id: string;
  title: string;
  description: string | null;
  slug: string | null;
  is_active: boolean | null;
  landing_enabled: boolean | null;
  template_type: string | null;
  source_path: string | null;
  quote_category: string | null;
  seo_title: string | null;
  seo_description: string | null;
  created_at: string | null;
  updated_at: string | null;
};

export type CreateLandingInput = {
  title: string;
  slug: string;
  templateType: string;
  status: "draft" | "published" | "archived";
  summary?: string | null;
  seoTitle?: string | null;
  seoDescription?: string | null;
  sourcePath?: string | null;
  quoteCategory?: string | null;
  sourceTaxonomyId?: string | null;
  sourceTaxonomyType?: "destination" | "theme" | null;
  sourceTaxonomySlug?: string | null;
};

export type UpdateLandingInput = Partial<CreateLandingInput> & {
  status?: "draft" | "published" | "archived";
};

export interface AdminLandingsRepository {
  list(): Promise<AdminLandingRecord[]>;
  getById(id: string): Promise<AdminLandingRecord | null>;
  getBySlug(slug: string): Promise<AdminLandingRecord | null>;
  create(input: CreateLandingInput): Promise<AdminLandingRecord>;
  update(id: string, input: UpdateLandingInput): Promise<AdminLandingRecord | null>;
  remove(id: string): Promise<boolean>;
}
