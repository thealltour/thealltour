import { supabase } from "@/lib/supabase";
import { getDefaultSectionsForTemplate } from "@/lib/adminLandings/templates";
import type {
  AdminLandingSectionRecord,
  AdminLandingSectionsRepository,
  CreateDefaultLandingSectionsInput,
  UpdateLandingSectionInput,
} from "@/lib/adminLandings/sectionTypes";

const PARENT_KIND = "recommended";

function toParentKey(landingId: string): string {
  if (!String(landingId ?? "").trim()) {
    throw new Error("invalid landingId");
  }
  return `landing:${landingId}`;
}

function parseSectionType(payload: Record<string, unknown>): string {
  const raw = payload.sectionType;
  if (typeof raw === "string" && raw.trim()) return raw;
  return "custom";
}

/** 레거시 filter_payload 내 확장 필드는 무시하고, API에는 노출하지 않음(호환·단순화). */
function buildSectionDataView(_payload: Record<string, unknown>): Record<string, unknown> | null {
  return null;
}

function normalizeSectionRow(row: Record<string, unknown>): AdminLandingSectionRecord {
  const payload =
    row.filter_payload && typeof row.filter_payload === "object" && !Array.isArray(row.filter_payload)
      ? (row.filter_payload as Record<string, unknown>)
      : {};
  return {
    id: String(row.id ?? ""),
    landing_key: String(row.parent_slug ?? ""),
    section_type: parseSectionType(payload),
    title: typeof row.title === "string" ? row.title : "",
    description: typeof row.description === "string" ? row.description : null,
    body: typeof payload.body === "string" ? payload.body : null,
    is_enabled: row.is_active === true,
    sort_order: typeof row.sort_order === "number" ? row.sort_order : 0,
    section_data: buildSectionDataView(payload),
    created_at: typeof row.created_at === "string" ? row.created_at : null,
    updated_at: typeof row.updated_at === "string" ? row.updated_at : null,
  };
}

async function listRawByLandingId(landingId: string): Promise<Record<string, unknown>[]> {
  const { data, error } = await supabase
    .from("landing_subnodes")
    .select("*")
    .eq("parent_kind", PARENT_KIND)
    .eq("parent_slug", toParentKey(landingId))
    .order("sort_order", { ascending: true })
    .order("created_at", { ascending: true });
  if (error) throw new Error(error.message);
  return (data ?? []) as Record<string, unknown>[];
}

class SupabaseLandingSectionsRepository implements AdminLandingSectionsRepository {
  async listByLandingId(landingId: string): Promise<AdminLandingSectionRecord[]> {
    const rows = await listRawByLandingId(landingId);
    return rows.map(normalizeSectionRow);
  }

  async createDefaults(input: CreateDefaultLandingSectionsInput): Promise<AdminLandingSectionRecord[]> {
    if (!String(input.landingId ?? "").trim()) {
      throw new Error("landingId 없이 section 생성 시도");
    }
    const existing = await listRawByLandingId(input.landingId);
    if (existing.length > 0) {
      return existing.map(normalizeSectionRow);
    }
    const defaults = getDefaultSectionsForTemplate({
      templateType: input.templateType,
      taxonomyName: input.taxonomyDisplayName ?? null,
      taxonomyType: input.taxonomyType ?? null,
      sectionCopy: input.defaultSectionCopy ?? null,
    });
    const parentSlug = toParentKey(input.landingId);
    const payload = defaults.map((sec, idx) => ({
      parent_kind: PARENT_KIND,
      parent_slug: parentSlug,
      node_type: "custom",
      title: sec.title,
      slug: `section-${idx + 1}-${sec.sectionType}`,
      description: sec.description,
      sort_order: sec.sortOrder,
      is_active: sec.isEnabled,
      filter_payload: {
        sectionType: sec.sectionType,
        body: sec.body,
      },
    }));
    const { data, error } = await supabase
      .from("landing_subnodes")
      .insert(payload)
      .select("*");
    if (error) throw new Error(error.message);
    return (data ?? []).map((row) => normalizeSectionRow(row as Record<string, unknown>));
  }

  async updateById(
    landingId: string,
    sectionId: string,
    input: UpdateLandingSectionInput,
  ): Promise<AdminLandingSectionRecord | null> {
    const { data: existing, error: exErr } = await supabase
      .from("landing_subnodes")
      .select("*")
      .eq("id", sectionId)
      .eq("parent_kind", PARENT_KIND)
      .eq("parent_slug", toParentKey(landingId))
      .maybeSingle();
    if (exErr) throw new Error(exErr.message);
    if (!existing) return null;

    const existingPayload =
      existing.filter_payload && typeof existing.filter_payload === "object" && !Array.isArray(existing.filter_payload)
        ? (existing.filter_payload as Record<string, unknown>)
        : {};
    const updates: Record<string, unknown> = {};
    if (input.title !== undefined) updates.title = input.title;
    if (input.description !== undefined) updates.description = input.description;
    if (input.isEnabled !== undefined) updates.is_active = input.isEnabled;
    if (input.sortOrder !== undefined) updates.sort_order = input.sortOrder;
    if (input.body !== undefined) {
      updates.filter_payload = {
        ...existingPayload,
        body: input.body,
      };
    }
    const { data, error } = await supabase
      .from("landing_subnodes")
      .update(updates)
      .eq("id", sectionId)
      .eq("parent_kind", PARENT_KIND)
      .eq("parent_slug", toParentKey(landingId))
      .select("*")
      .maybeSingle();
    if (error) throw new Error(error.message);
    if (!data) return null;
    return normalizeSectionRow(data as Record<string, unknown>);
  }
}

export function createAdminLandingSectionsRepository(): AdminLandingSectionsRepository {
  return new SupabaseLandingSectionsRepository();
}
