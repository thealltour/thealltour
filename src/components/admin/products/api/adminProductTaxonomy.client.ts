"use client";

import type { ProductTaxonomyWithUsage } from "@/types/productTaxonomy";
import { parseJsonResponse, extractErrorMessage } from "./adminApiClient.shared";

const BASE = "/api/admin/product-taxonomies";

export type CreateAdminTaxonomyPayload = {
  type: "category" | "theme";
  name: string;
  slug?: string | null;
  sort_order?: number | null;
  is_active?: boolean;
};

/**
 * taxonomy 목록 조회. 실패 시 throw.
 */
export async function fetchAdminProductTaxonomy(): Promise<ProductTaxonomyWithUsage[]> {
  const response = await fetch(BASE, { cache: "no-store" });
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
 * category 또는 theme 생성. 실패 시 throw.
 */
export async function createAdminProductTaxonomy(
  payload: CreateAdminTaxonomyPayload,
): Promise<void> {
  const body: Record<string, unknown> = {
    type: payload.type,
    name: payload.name,
  };
  if (payload.slug !== undefined) body.slug = payload.slug?.trim() || null;
  if (payload.sort_order !== undefined) body.sort_order = payload.sort_order;
  if (payload.is_active !== undefined) body.is_active = payload.is_active;

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
  slug?: string | null;
  sort_order?: number | null;
  is_active?: boolean;
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
