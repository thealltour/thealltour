import type { AdminLandingSectionType } from "@/types/adminLanding";

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
  createDefaults(
    landingId: string,
    templateType: string,
  ): Promise<AdminLandingSectionRecord[]>;
  updateById(
    landingId: string,
    sectionId: string,
    input: UpdateLandingSectionInput,
  ): Promise<AdminLandingSectionRecord | null>;
}
