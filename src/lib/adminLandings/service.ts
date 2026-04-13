import { mapRecordToAdminLandingDetail, mapRecordToAdminLandingListItem } from "@/lib/adminLandings/mappers";
import { createAdminLandingsRepository } from "@/lib/adminLandings/repository";
import { createDefaultLandingSections, listLandingSections } from "@/lib/adminLandings/sectionService";
import type { CreateLandingInput, UpdateLandingInput } from "@/lib/adminLandings/types";
import { validateLandingForPublish } from "@/lib/adminLandings/validation";
import type { AdminLandingDetail, AdminLandingListResponse, LandingPublishValidationIssue } from "@/types/adminLanding";

const repository = createAdminLandingsRepository();

export class AdminLandingServiceError extends Error {
  status: number;
  code: string;
  constructor(status: number, code: string, message: string) {
    super(message);
    this.status = status;
    this.code = code;
  }
}

/** Publish 검증 실패 — API는 422 + issues 반환 */
export class AdminLandingPublishValidationError extends Error {
  status = 422;
  code = "VALIDATION_FAILED";
  issues: LandingPublishValidationIssue[];
  constructor(issues: LandingPublishValidationIssue[]) {
    super("Publish 검증에 실패했습니다.");
    this.name = "AdminLandingPublishValidationError";
    this.issues = issues;
  }
}

function normalizeSlug(input: string): string {
  return input
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9가-힣\s-]/g, "")
    .replace(/\s+/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-+/, "")
    .replace(/-+$/, "");
}

function validateTemplateType(templateType: string): boolean {
  return (
    templateType === "destination_consulting" ||
    templateType === "theme_consulting" ||
    templateType === "product_line_consulting" ||
    templateType === "recommended_collection" ||
    templateType === "custom"
  );
}

export function sanitizeLandingInput(input: {
  title?: string;
  slug?: string;
  templateType?: string;
  status?: "draft" | "published" | "archived";
  summary?: string | null;
  seoTitle?: string | null;
  seoDescription?: string | null;
  sourcePath?: string | null;
  quoteCategory?: string | null;
  sourceTaxonomyId?: string | null;
  sourceTaxonomyType?: "destination" | "theme" | "product_line" | null;
  sourceTaxonomySlug?: string | null;
  taxonomyDisplayName?: string | null;
}) {
  const title = String(input.title ?? "").trim();
  const slug = normalizeSlug(String(input.slug ?? ""));
  const templateType = String(input.templateType ?? "").trim();
  const status = input.status;

  if (!title) {
    throw new AdminLandingServiceError(400, "INVALID_TITLE", "title은 필수입니다.");
  }
  if (!slug) {
    throw new AdminLandingServiceError(400, "INVALID_SLUG", "slug는 필수입니다.");
  }
  if (!templateType || !validateTemplateType(templateType)) {
    throw new AdminLandingServiceError(400, "INVALID_TEMPLATE_TYPE", "templateType이 올바르지 않습니다.");
  }
  if (!(status === "draft" || status === "published" || status === "archived")) {
    throw new AdminLandingServiceError(400, "INVALID_STATUS", "status가 올바르지 않습니다.");
  }

  return {
    title,
    slug,
    templateType,
    status,
    summary: input.summary?.trim() || null,
    seoTitle: input.seoTitle?.trim() || null,
    seoDescription: input.seoDescription?.trim() || null,
    sourcePath: input.sourcePath?.trim() || null,
    quoteCategory: input.quoteCategory?.trim() || null,
    sourceTaxonomyId: input.sourceTaxonomyId?.trim() || null,
    sourceTaxonomyType: input.sourceTaxonomyType ?? null,
    sourceTaxonomySlug: input.sourceTaxonomySlug?.trim() || null,
    taxonomyDisplayName: input.taxonomyDisplayName?.trim() || null,
  };
}

export async function listAdminLandings(): Promise<AdminLandingListResponse> {
  const rows = await repository.list();
  const items = rows.map(mapRecordToAdminLandingListItem);
  return { items, total: items.length };
}

export async function getAdminLandingById(id: string): Promise<AdminLandingDetail | null> {
  const row = await repository.getById(id);
  if (!row) return null;
  const detail = mapRecordToAdminLandingDetail(row);
  detail.sections = await listLandingSections(id);
  return detail;
}

export async function getPublicLandingBySlug(slug: string): Promise<AdminLandingDetail | null> {
  const normalized = slug.trim().toLowerCase();
  if (!normalized) return null;
  const row = await repository.getBySlug(normalized);
  if (!row) return null;
  const detail = mapRecordToAdminLandingDetail(row);
  if (detail.status !== "published") return null;
  if (!row.landing_enabled) return null;
  if (!detail.slug) return null;
  detail.sections = await listLandingSections(detail.id);
  return detail;
}

export async function createAdminLanding(input: CreateLandingInput): Promise<AdminLandingDetail> {
  try {
    const row = await repository.create(input);
    if (!row.id?.trim()) {
      throw new AdminLandingServiceError(500, "MISSING_LANDING_ID", "랜딩 ID 생성 실패");
    }
    const detail = mapRecordToAdminLandingDetail(row);
    detail.sections = await createDefaultLandingSections(
      row.id,
      input.templateType,
      input.taxonomyDisplayName,
      input.sourceTaxonomyType ?? null,
      input.defaultSectionCopy ?? null,
    );
    if (process.env.NODE_ENV !== "production" && (!detail.sections || detail.sections.length === 0)) {
      console.warn("[createAdminLanding] no sections after createDefaultLandingSections", { landingId: row.id });
    }
    return detail;
  } catch (error) {
    if (error instanceof AdminLandingServiceError) throw error;
    if (error instanceof Error && error.message === "SLUG_CONFLICT") {
      throw new AdminLandingServiceError(409, "SLUG_CONFLICT", "이미 사용 중인 slug입니다.");
    }
    throw new AdminLandingServiceError(500, "CREATE_FAILED", error instanceof Error ? error.message : "랜딩 생성에 실패했습니다.");
  }
}

export async function updateAdminLanding(id: string, input: UpdateLandingInput): Promise<AdminLandingDetail | null> {
  try {
    const row = await repository.update(id, input);
    if (!row) return null;
    const detail = mapRecordToAdminLandingDetail(row);
    detail.sections = await listLandingSections(id);
    return detail;
  } catch (error) {
    if (error instanceof AdminLandingServiceError) throw error;
    if (error instanceof Error && error.message === "SLUG_CONFLICT") {
      throw new AdminLandingServiceError(409, "SLUG_CONFLICT", "이미 사용 중인 slug입니다.");
    }
    throw new AdminLandingServiceError(500, "UPDATE_FAILED", error instanceof Error ? error.message : "랜딩 수정에 실패했습니다.");
  }
}

/**
 * 검증 통과 시에만 published. (PATCH로 status만 올리는 것은 막음 — 전용 API 사용)
 */
export async function publishLanding(id: string): Promise<AdminLandingDetail | null> {
  const detail = await getAdminLandingById(id);
  if (!detail) return null;
  if (detail.status === "published") {
    return detail;
  }
  const v = validateLandingForPublish(detail);
  if (!v.ok) {
    throw new AdminLandingPublishValidationError(v.issues);
  }
  return updateAdminLanding(id, { status: "published" });
}

/** 공개 즉시 차단 — draft + landing_enabled false 매핑 */
export async function unpublishLanding(id: string): Promise<AdminLandingDetail | null> {
  const detail = await getAdminLandingById(id);
  if (!detail) return null;
  if (detail.status === "draft") {
    return detail;
  }
  return updateAdminLanding(id, { status: "draft" });
}

export async function deleteAdminLanding(id: string): Promise<boolean> {
  return repository.remove(id);
}
