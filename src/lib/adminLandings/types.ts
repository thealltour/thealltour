import type { LandingSectionDraftCopy } from "@/lib/adminLandings/draftCopyBuilder";

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
  source_taxonomy_id: string | null;
  source_taxonomy_type: string | null;
  source_taxonomy_slug: string | null;
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
  sourceTaxonomyType?: "destination" | "theme" | "product_line" | null;
  sourceTaxonomySlug?: string | null;
  /** DB 미저장. 섹션 자동 문구용 표시 이름(taxonomy name 등) */
  taxonomyDisplayName?: string | null;
  /** DB 미저장. 생성 직후 기본 섹션 시드에 builder 문구 그대로 적용 */
  defaultSectionCopy?: LandingSectionDraftCopy | null;
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
