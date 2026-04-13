import { createAdminLandingSectionsRepository } from "@/lib/adminLandings/sectionRepository";
import type { UpdateLandingSectionInput } from "@/lib/adminLandings/sectionTypes";
import type { AdminLandingSection } from "@/types/adminLanding";

const sectionRepository = createAdminLandingSectionsRepository();

function mapRecordToSection(record: {
  id: string;
  landing_key: string;
  section_type: string;
  title: string;
  description: string | null;
  body: string | null;
  is_enabled: boolean;
  sort_order: number;
  section_data: Record<string, unknown> | null;
  created_at: string | null;
  updated_at: string | null;
}): AdminLandingSection {
  return {
    id: record.id,
    landingId: record.landing_key.replace(/^landing:/, ""),
    sectionType: record.section_type,
    title: record.title,
    description: record.description,
    body: record.body,
    isEnabled: record.is_enabled,
    sortOrder: record.sort_order,
    sectionData: record.section_data,
    createdAt: record.created_at ?? undefined,
    updatedAt: record.updated_at ?? undefined,
  };
}

export async function listLandingSections(landingId: string): Promise<AdminLandingSection[]> {
  const rows = await sectionRepository.listByLandingId(landingId);
  return rows.map(mapRecordToSection);
}

export async function createDefaultLandingSections(
  landingId: string,
  templateType: string,
): Promise<AdminLandingSection[]> {
  const rows = await sectionRepository.createDefaults(landingId, templateType);
  return rows.map(mapRecordToSection);
}

export async function updateLandingSection(
  landingId: string,
  sectionId: string,
  input: UpdateLandingSectionInput,
): Promise<AdminLandingSection | null> {
  const row = await sectionRepository.updateById(landingId, sectionId, input);
  return row ? mapRecordToSection(row) : null;
}
