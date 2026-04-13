import type { LandingSectionDraftCopy } from "@/lib/adminLandings/draftCopyBuilder";
import type { AdminLandingSectionType } from "@/types/adminLanding";

/** `createDefaults` 입력 — taxonomy 자동 생성 시 표시 이름으로 섹션 문구 치환 */
export type CreateDefaultLandingSectionsInput = {
  landingId: string;
  templateType: string;
  taxonomyDisplayName?: string | null;
  /** 없으면 templateType에서 추론(destination_consulting → destination 등) */
  taxonomyType?: "destination" | "theme" | "product_line" | null;
  defaultSectionCopy?: LandingSectionDraftCopy | null;
};

export type AdminLandingSectionRecord = {
  id: string;
  landing_key: string;
  section_type: AdminLandingSectionType | string;
  title: string;
  description: string | null;
  body: string | null;
  is_enabled: boolean;
  sort_order: number;
  section_data: Record<string, unknown> | null;
  created_at: string | null;
  updated_at: string | null;
};

export type UpdateLandingSectionInput = {
  title?: string;
  description?: string | null;
  body?: string | null;
  isEnabled?: boolean;
  sortOrder?: number;
};

export interface AdminLandingSectionsRepository {
  listByLandingId(landingId: string): Promise<AdminLandingSectionRecord[]>;
  createDefaults(input: CreateDefaultLandingSectionsInput): Promise<AdminLandingSectionRecord[]>;
  updateById(
    landingId: string,
    sectionId: string,
    input: UpdateLandingSectionInput,
  ): Promise<AdminLandingSectionRecord | null>;
}
