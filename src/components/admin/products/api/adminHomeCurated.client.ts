"use client";

import type {
  HomeCuratedSettings,
  HomeCuratedSectionWithCount,
  SectionProductMappingRow,
} from "@/types/homeCurated";
import { parseJsonResponse, extractErrorMessage } from "./adminApiClient.shared";

const BASE = "/api/admin/home-curated";

export type AdminHomeCuratedData = {
  settings: HomeCuratedSettings | null;
  sections: HomeCuratedSectionWithCount[];
};

export type AdminHomeCuratedSettingsPayload = Partial<{
  section_label: string;
  section_title: string;
  section_description: string;
  catalog_button_label: string;
  catalog_button_href: string;
  is_active: boolean;
}>;

export type AdminHomeCuratedSectionPayload = {
  title: string;
  description?: string;
  sort_order: number;
  max_items?: number;
  is_active?: boolean;
};

export type AdminHomeCuratedSectionSortPayload = { sort_order: number };

/** 섹션 활성/비활성 토글용 (PATCH 부분 업데이트) */
export type AdminHomeCuratedSectionActivePayload = { is_active: boolean };

export type AdminHomeCuratedSectionProductPayload = { productId: string };

export type AdminHomeCuratedSectionProductSortPayload = { sort_order: number };

/**
 * GET /api/admin/home-curated - 전체 설정·섹션 목록
 */
export async function fetchAdminHomeCurated(): Promise<AdminHomeCuratedData> {
  const response = await fetch(BASE);
  if (!response.ok) {
    const data = await parseJsonResponse<{ message?: string }>(response).catch(() => ({}));
    throw new Error(extractErrorMessage(data, "데이터를 불러오지 못했습니다."));
  }
  const data = await parseJsonResponse<AdminHomeCuratedData>(response);
  return data;
}

/**
 * PATCH /api/admin/home-curated/settings
 */
export async function updateAdminHomeCuratedSettings(
  payload: AdminHomeCuratedSettingsPayload,
): Promise<{ message?: string }> {
  const response = await fetch(`${BASE}/settings`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
  const data = await parseJsonResponse<{ message?: string }>(response).catch(() => ({}));
  if (!response.ok) {
    throw new Error(extractErrorMessage(data, "설정 저장에 실패했습니다."));
  }
  return data;
}

/**
 * POST /api/admin/home-curated/sections
 */
export async function createAdminHomeCuratedSection(
  payload: AdminHomeCuratedSectionPayload,
): Promise<HomeCuratedSectionWithCount> {
  const response = await fetch(`${BASE}/sections`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
  const data = await parseJsonResponse<HomeCuratedSectionWithCount & { message?: string }>(
    response,
  ).catch(() => ({}));
  if (!response.ok) {
    throw new Error(extractErrorMessage(data, "섹션 추가에 실패했습니다."));
  }
  return data as HomeCuratedSectionWithCount;
}

/**
 * PATCH /api/admin/home-curated/sections/[id]
 */
export async function updateAdminHomeCuratedSection(
  sectionId: string,
  payload:
    | AdminHomeCuratedSectionPayload
    | AdminHomeCuratedSectionSortPayload
    | AdminHomeCuratedSectionActivePayload,
): Promise<HomeCuratedSectionWithCount> {
  const response = await fetch(`${BASE}/sections/${sectionId}`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
  const data = await parseJsonResponse<HomeCuratedSectionWithCount & { message?: string }>(
    response,
  ).catch(() => ({}));
  if (!response.ok) {
    throw new Error(extractErrorMessage(data, "섹션 수정에 실패했습니다."));
  }
  return data as HomeCuratedSectionWithCount;
}

/**
 * DELETE /api/admin/home-curated/sections/[id]
 */
export async function deleteAdminHomeCuratedSection(sectionId: string): Promise<{ message?: string }> {
  const response = await fetch(`${BASE}/sections/${sectionId}`, { method: "DELETE" });
  const data = await parseJsonResponse<{ message?: string }>(response).catch(() => ({}));
  if (!response.ok) {
    throw new Error(extractErrorMessage(data, "섹션 삭제에 실패했습니다."));
  }
  return data;
}

/**
 * GET /api/admin/home-curated/sections/[id]/products
 */
export async function fetchAdminHomeCuratedSectionProducts(
  sectionId: string,
): Promise<SectionProductMappingRow[]> {
  const response = await fetch(`${BASE}/sections/${sectionId}/products`);
  if (!response.ok) {
    return [];
  }
  const data = await parseJsonResponse<SectionProductMappingRow[]>(response);
  return data ?? [];
}

/**
 * POST /api/admin/home-curated/sections/[id]/products
 */
export async function addAdminHomeCuratedSectionProduct(
  sectionId: string,
  payload: AdminHomeCuratedSectionProductPayload,
): Promise<void> {
  const response = await fetch(`${BASE}/sections/${sectionId}/products`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
  if (!response.ok) {
    const data = await parseJsonResponse<{ message?: string }>(response).catch(() => ({}));
    const msg = response.status === 409 ? "이미 이 섹션에 등록된 상품입니다." : (data && "message" in data ? data.message : undefined) ?? "상품 추가에 실패했습니다.";
    throw new Error(msg);
  }
}

/**
 * PATCH /api/admin/home-curated/sections/[sectionId]/products/[mappingId]
 */
export async function updateAdminHomeCuratedSectionProduct(
  sectionId: string,
  mappingId: string,
  payload: AdminHomeCuratedSectionProductSortPayload,
): Promise<void> {
  const response = await fetch(`${BASE}/sections/${sectionId}/products/${mappingId}`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
  if (!response.ok) {
    throw new Error("순서 변경에 실패했습니다.");
  }
}

/**
 * DELETE /api/admin/home-curated/sections/[sectionId]/products/[mappingId]
 */
export async function deleteAdminHomeCuratedSectionProduct(
  sectionId: string,
  mappingId: string,
): Promise<void> {
  const response = await fetch(`${BASE}/sections/${sectionId}/products/${mappingId}`, {
    method: "DELETE",
  });
  if (!response.ok) {
    const data = await parseJsonResponse<{ message?: string }>(response).catch(() => ({}));
    throw new Error(extractErrorMessage(data, "제거에 실패했습니다."));
  }
}
