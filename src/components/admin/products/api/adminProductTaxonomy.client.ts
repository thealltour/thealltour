"use client";

import type { ProductTaxonomyWithUsage, TaxonomyType } from "@/types/productTaxonomy";
import { parseJsonResponse, extractErrorMessage } from "./adminApiClient.shared";

const BASE = "/api/admin/product-taxonomies";

export type CreateAdminTaxonomyPayload = {
  /** 권장. 없으면 type/category_type 으로 호환 */
  taxonomy_type?: TaxonomyType;
  /** @deprecated taxonomy_type 사용 */
  type?: "category" | "theme";
  name: string;
  slug?: string | null;
  sort_order?: number | null;
  /** 대분류 id (지역이면 해외/국내 등). 없으면 최상위 */
  parent_id?: string | null;
  is_active?: boolean;
  /** @deprecated taxonomy_type 사용 */
  category_type?: "destination" | "product_line" | "highlight" | "other" | null;
  is_hub_visible?: boolean;
  is_landing_enabled?: boolean;
  card_image_url?: string | null;
  card_title?: string | null;
  card_description?: string | null;
  landing_title?: string | null;
  landing_description?: string | null;
  hero_image_url?: string | null;
  display_label?: string | null;
  badge_priority?: number | null;
  badge_visible?: boolean;
  badge_tone?: string | null;
  badge_description?: string | null;
};

/**
 * taxonomy 목록 조회. options.taxonomy_type 이 있으면 해당 타입만 반환.
 */
export async function fetchAdminProductTaxonomy(
  options?: { taxonomy_type?: TaxonomyType },
): Promise<ProductTaxonomyWithUsage[]> {
  const url =
    options?.taxonomy_type != null
      ? `${BASE}?taxonomy_type=${encodeURIComponent(options.taxonomy_type)}`
      : BASE;
  const response = await fetch(url, { cache: "no-store" });
  const result = await parseJsonResponse<ProductTaxonomyWithUsage[] | { message?: string }>(
    response,
  );
  if (!response.ok) {
    throw new Error(extractErrorMessage(result, "분류 목록 조회에 실패했습니다."));
  }
  if (!Array.isArray(result)) {
    throw new Error("분류 목록 조회에 실패했습니다.");
  }
  return result;
}

/**
 * category 또는 theme 생성. taxonomy_type 또는 type(category/theme) 지정.
 * 신규는 taxonomy_type 권장.
 */
export async function createAdminProductTaxonomy(
  payload: CreateAdminTaxonomyPayload,
): Promise<void> {
  const body: Record<string, unknown> = {
    name: payload.name,
  };
  if (payload.taxonomy_type != null) body.taxonomy_type = payload.taxonomy_type;
  if (payload.type != null) body.type = payload.type;
  if (payload.slug !== undefined) body.slug = payload.slug?.trim() || null;
  if (payload.sort_order !== undefined) body.sort_order = payload.sort_order;
  if (payload.parent_id !== undefined) body.parent_id = payload.parent_id?.trim() || null;
  if (payload.is_active !== undefined) body.is_active = payload.is_active;
  if (payload.category_type !== undefined) body.category_type = payload.category_type ?? null;
  if (payload.is_hub_visible !== undefined) body.is_hub_visible = payload.is_hub_visible;
  if (payload.is_landing_enabled !== undefined) body.is_landing_enabled = payload.is_landing_enabled;
  if (payload.card_image_url !== undefined) body.card_image_url = payload.card_image_url?.trim() || null;
  if (payload.card_title !== undefined) body.card_title = payload.card_title?.trim() || null;
  if (payload.card_description !== undefined) body.card_description = payload.card_description?.trim() || null;
  if (payload.landing_title !== undefined) body.landing_title = payload.landing_title?.trim() || null;
  if (payload.landing_description !== undefined) body.landing_description = payload.landing_description?.trim() || null;
  if (payload.hero_image_url !== undefined) body.hero_image_url = payload.hero_image_url?.trim() || null;
  if (payload.display_label !== undefined) body.display_label = payload.display_label?.trim() || null;
  if (payload.badge_priority !== undefined) body.badge_priority = payload.badge_priority;
  if (payload.badge_visible !== undefined) body.badge_visible = payload.badge_visible;
  if (payload.badge_tone !== undefined) body.badge_tone = payload.badge_tone?.trim() || null;
  if (payload.badge_description !== undefined) body.badge_description = payload.badge_description?.trim() || null;

  const response = await fetch(BASE, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  if (!response.ok) {
    const result = await parseJsonResponse<{ message?: string }>(response).catch(() => ({}));
    const msg =
      payload.type === "category"
        ? extractErrorMessage(result, "카테고리 추가에 실패했습니다.")
        : extractErrorMessage(result, "테마 추가에 실패했습니다.");
    throw new Error(msg);
  }
}

/**
 * taxonomy 항목 삭제. 실패 시 throw.
 */
export async function deleteAdminProductTaxonomy(id: string): Promise<void> {
  const response = await fetch(`${BASE}/${id}`, { method: "DELETE" });
  if (!response.ok) {
    const result = await parseJsonResponse<{ message?: string }>(response).catch(() => ({}));
    throw new Error(extractErrorMessage(result, "삭제에 실패했습니다."));
  }
}

export type UpdateAdminTaxonomyPayload = {
  taxonomy_type?: TaxonomyType;
  slug?: string | null;
  sort_order?: number | null;
  is_active?: boolean;
  /** 대분류 id. null이면 최상위로 */
  parent_id?: string | null;
  /** @deprecated taxonomy_type 사용 */
  category_type?: "destination" | "product_line" | "highlight" | "other" | null;
  is_hub_visible?: boolean;
  is_landing_enabled?: boolean;
  /** 허브 카드 이미지 URL (지역/테마 카드용) */
  card_image_url?: string | null;
  card_title?: string | null;
  card_description?: string | null;
  /** 랜딩(히어로) 제목. 비우면 이름 사용 */
  landing_title?: string | null;
  /** 랜딩(히어로) 설명 */
  landing_description?: string | null;
  /** 랜딩(히어로) 배경 이미지 URL */
  hero_image_url?: string | null;
  display_label?: string | null;
  badge_priority?: number | null;
  badge_visible?: boolean;
  badge_tone?: string | null;
  badge_description?: string | null;
};

/**
 * taxonomy 항목 수정 (slug, sort_order, is_active). 실패 시 throw.
 */
export async function updateAdminProductTaxonomy(
  id: string,
  payload: UpdateAdminTaxonomyPayload,
): Promise<void> {
  const response = await fetch(`${BASE}/${id}`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
  if (!response.ok) {
    const result = await parseJsonResponse<{ message?: string }>(response).catch(() => ({}));
    throw new Error(extractErrorMessage(result, "수정에 실패했습니다."));
  }
}
