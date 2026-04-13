import type { AdminLandingDetail, AdminLandingListItem, AdminLandingStatus } from "@/types/adminLanding";
import type { AdminLandingRecord } from "@/lib/adminLandings/types";

function slugify(input: string): string {
  return input
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9가-힣\s-]/g, "")
    .replace(/\s+/g, "-")
    .replace(/-+/g, "-");
}

function resolveSlug(record: AdminLandingRecord): string {
  if (record.slug && record.slug.trim()) return record.slug.trim();
  if (record.title.trim()) return slugify(record.title);
  return record.id.slice(0, 8);
}

function resolveStatus(record: AdminLandingRecord): AdminLandingStatus {
  if (record.is_active === false) return "archived";
  if (record.landing_enabled === true) return "published";
  return "draft";
}

function resolveUpdatedAt(record: AdminLandingRecord): string {
  return record.updated_at || record.created_at || new Date(0).toISOString();
}

function resolvePublishedAt(record: AdminLandingRecord): string | null {
  if (record.landing_enabled !== true) return null;
  return record.updated_at || record.created_at || null;
}

function resolveTemplateType(record: AdminLandingRecord): string {
  if (record.template_type && record.template_type.trim()) return record.template_type.trim();
  return "recommended_collection";
}

function resolveSourcePath(record: AdminLandingRecord, slug: string): string {
  if (record.source_path && record.source_path.trim()) return record.source_path.trim();
  return slug ? `/recommended/${encodeURIComponent(slug)}` : "/recommended";
}

export function mapRecordToAdminLandingListItem(record: AdminLandingRecord): AdminLandingListItem {
  const slug = resolveSlug(record);
  return {
    id: record.id,
    title: record.title || "(제목 없음)",
    slug,
    status: resolveStatus(record),
    templateType: resolveTemplateType(record),
    updatedAt: resolveUpdatedAt(record),
    publishedAt: resolvePublishedAt(record),
  };
}

export function mapRecordToAdminLandingDetail(record: AdminLandingRecord): AdminLandingDetail {
  const slug = resolveSlug(record);
  return {
    id: record.id,
    title: record.title || "(제목 없음)",
    slug,
    status: resolveStatus(record),
    templateType: resolveTemplateType(record),
    summary: record.description ?? undefined,
    seoTitle: record.seo_title,
    seoDescription: record.seo_description,
    sourcePath: resolveSourcePath(record, slug),
    quoteCategory: record.quote_category,
    sourceTaxonomyId: record.source_taxonomy_id,
    sourceTaxonomyType: record.source_taxonomy_type,
    sourceTaxonomySlug: record.source_taxonomy_slug,
    updatedAt: resolveUpdatedAt(record),
    publishedAt: resolvePublishedAt(record),
  };
}
