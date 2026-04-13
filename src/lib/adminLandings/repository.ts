import { supabase } from "@/lib/supabase";
import type {
  AdminLandingsRepository,
  AdminLandingRecord,
  CreateLandingInput,
  UpdateLandingInput,
} from "@/lib/adminLandings/types";

type SectionRow = Record<string, unknown>;

function asStringOrNull(v: unknown): string | null {
  return typeof v === "string" ? v : null;
}

function asBooleanOrNull(v: unknown): boolean | null {
  return typeof v === "boolean" ? v : null;
}

function normalizeRow(row: Record<string, unknown>): AdminLandingRecord {
  return {
    id: String(row.id ?? ""),
    title: typeof row.title === "string" ? row.title : "",
    description: asStringOrNull(row.description),
    slug: asStringOrNull(row.slug),
    is_active: asBooleanOrNull(row.is_active),
    landing_enabled: asBooleanOrNull(row.landing_enabled),
    template_type: asStringOrNull(row.template_type),
    source_path: asStringOrNull(row.source_path),
    quote_category: asStringOrNull(row.quote_category),
    source_taxonomy_id: asStringOrNull(row.source_taxonomy_id),
    source_taxonomy_type: asStringOrNull(row.source_taxonomy_type),
    source_taxonomy_slug: asStringOrNull(row.source_taxonomy_slug),
    seo_title: asStringOrNull(row.seo_title),
    seo_description: asStringOrNull(row.seo_description),
    created_at: asStringOrNull(row.created_at),
    updated_at: asStringOrNull(row.updated_at),
  };
}

function statusToFlags(status: "draft" | "published" | "archived"): {
  is_active: boolean;
  landing_enabled: boolean;
} {
  if (status === "published") return { is_active: true, landing_enabled: true };
  if (status === "archived") return { is_active: false, landing_enabled: false };
  return { is_active: true, landing_enabled: false };
}

function pickMissingColumn(message: string): string | null {
  const m =
    message.match(/column "([^"]+)" of relation "([^"]+)" does not exist/i) ||
    message.match(/Could not find the '([^']+)' column/i);
  return m ? m[1] : null;
}

async function insertWithUnknownColumnFallback(payload: Record<string, unknown>): Promise<SectionRow> {
  const attempt: Record<string, unknown> = { ...payload };
  // PostgREST 에러 메시지에서 존재하지 않는 컬럼을 제거하며 재시도
  for (let i = 0; i < 8; i += 1) {
    const { data, error } = await supabase
      .from("home_curated_sections")
      .insert(attempt)
      .select("*")
      .maybeSingle();
    if (!error && data) return data as SectionRow;
    if (!error && !data) throw new Error("랜딩 생성 결과를 확인할 수 없습니다.");
    if (!error) throw new Error("랜딩 생성 중 알 수 없는 오류가 발생했습니다.");
    const missing = pickMissingColumn(error.message ?? "");
    if (!missing || !(missing in attempt)) throw new Error(error.message);
    delete attempt[missing];
  }
  throw new Error("랜딩 생성에 실패했습니다.");
}

async function updateWithUnknownColumnFallback(
  id: string,
  payload: Record<string, unknown>,
): Promise<SectionRow | null> {
  const attempt: Record<string, unknown> = { ...payload };
  for (let i = 0; i < 8; i += 1) {
    const { data, error } = await supabase
      .from("home_curated_sections")
      .update(attempt)
      .eq("id", id)
      .select("*")
      .maybeSingle();
    if (!error) return data ? (data as SectionRow) : null;
    const missing = pickMissingColumn(error.message ?? "");
    if (!missing || !(missing in attempt)) throw new Error(error.message);
    delete attempt[missing];
  }
  throw new Error("랜딩 수정에 실패했습니다.");
}

async function ensureHomeCuratedSettingId(): Promise<string> {
  const { data: row, error } = await supabase
    .from("home_curated_settings")
    .select("id")
    .eq("setting_key", "home_curated")
    .maybeSingle();
  if (error) throw new Error(error.message);
  if (row?.id) return String(row.id);

  const insert = await supabase
    .from("home_curated_settings")
    .upsert(
      {
        setting_key: "home_curated",
        section_label: "THEALL CURATED PICKS",
        section_title: "검색/유입 랜딩",
        section_description: "관리자 랜딩 기본 설정",
        catalog_button_label: "전체 상품 보기",
        catalog_button_href: "/products",
        is_active: true,
      },
      { onConflict: "setting_key" },
    )
    .select("id")
    .maybeSingle();
  if (insert.error || !insert.data?.id) {
    throw new Error(insert.error?.message ?? "home_curated 설정을 생성하지 못했습니다.");
  }
  return String(insert.data.id);
}

async function ensureSlugUnique(slug: string, selfId?: string): Promise<void> {
  const query = supabase.from("home_curated_sections").select("id").eq("slug", slug);
  const { data, error } = selfId ? await query.neq("id", selfId).limit(1) : await query.limit(1);
  if (error) {
    const missing = pickMissingColumn(error.message ?? "");
    // slug 컬럼이 없는 환경에서는 유니크 검사를 건너뛰고 fallback slug 사용
    if (missing === "slug") return;
    throw new Error(error.message);
  }
  if ((data ?? []).length > 0) {
    throw new Error("SLUG_CONFLICT");
  }
}

class HomeCuratedLandingsRepository implements AdminLandingsRepository {
  async list(): Promise<AdminLandingRecord[]> {
    const { data, error } = await supabase
      .from("home_curated_sections")
      .select("*")
      .order("sort_order", { ascending: true })
      .order("created_at", { ascending: true });

    if (error) throw new Error(error.message);
    return (data ?? []).map((row) => normalizeRow(row as Record<string, unknown>));
  }

  async getById(id: string): Promise<AdminLandingRecord | null> {
    const { data, error } = await supabase
      .from("home_curated_sections")
      .select("*")
      .eq("id", id)
      .maybeSingle();

    if (error) throw new Error(error.message);
    if (!data) return null;
    return normalizeRow(data as Record<string, unknown>);
  }

  async getBySlug(slug: string): Promise<AdminLandingRecord | null> {
    const { data, error } = await supabase
      .from("home_curated_sections")
      .select("*")
      .eq("slug", slug)
      .maybeSingle();
    if (error) throw new Error(error.message);
    if (!data) return null;
    return normalizeRow(data as Record<string, unknown>);
  }

  async create(_input: CreateLandingInput): Promise<AdminLandingRecord> {
    const input = _input;
    await ensureSlugUnique(input.slug);
    const settingId = await ensureHomeCuratedSettingId();
    const { is_active, landing_enabled } = statusToFlags(input.status);

    const { data: maxRow } = await supabase
      .from("home_curated_sections")
      .select("sort_order")
      .eq("setting_id", settingId)
      .order("sort_order", { ascending: false })
      .limit(1)
      .maybeSingle();
    const nextOrder = typeof maxRow?.sort_order === "number" ? maxRow.sort_order + 1 : 0;

    const created = await insertWithUnknownColumnFallback({
      setting_id: settingId,
      title: input.title,
      description: input.summary ?? "",
      slug: input.slug,
      landing_enabled,
      is_active,
      template_type: input.templateType,
      source_path: input.sourcePath ?? null,
      quote_category: input.quoteCategory ?? null,
      source_taxonomy_id: input.sourceTaxonomyId ?? null,
      source_taxonomy_type: input.sourceTaxonomyType ?? null,
      source_taxonomy_slug: input.sourceTaxonomySlug ?? null,
      seo_title: input.seoTitle ?? null,
      seo_description: input.seoDescription ?? null,
      sort_order: nextOrder,
      max_items: 8,
      updated_at: new Date().toISOString(),
    });
    return normalizeRow(created);
  }

  async update(_id: string, _input: UpdateLandingInput): Promise<AdminLandingRecord | null> {
    const id = _id;
    const input = _input;
    const updates: Record<string, unknown> = {};
    if (typeof input.title === "string") updates.title = input.title;
    if (typeof input.summary === "string" || input.summary === null) updates.description = input.summary ?? "";
    if (typeof input.slug === "string") {
      await ensureSlugUnique(input.slug, id);
      updates.slug = input.slug;
    }
    if (typeof input.templateType === "string") updates.template_type = input.templateType;
    if (input.sourcePath !== undefined) updates.source_path = input.sourcePath ?? null;
    if (input.quoteCategory !== undefined) updates.quote_category = input.quoteCategory ?? null;
    if (input.seoTitle !== undefined) updates.seo_title = input.seoTitle ?? null;
    if (input.seoDescription !== undefined) updates.seo_description = input.seoDescription ?? null;
    if (input.status) {
      const flags = statusToFlags(input.status);
      updates.is_active = flags.is_active;
      updates.landing_enabled = flags.landing_enabled;
    }
    updates.updated_at = new Date().toISOString();
    if (Object.keys(updates).length === 0) {
      const row = await this.getById(id);
      return row;
    }
    const updated = await updateWithUnknownColumnFallback(id, updates);
    return updated ? normalizeRow(updated) : null;
  }

  async remove(_id: string): Promise<boolean> {
    throw new Error("NOT_IMPLEMENTED");
  }
}

export function createAdminLandingsRepository(): AdminLandingsRepository {
  return new HomeCuratedLandingsRepository();
}
