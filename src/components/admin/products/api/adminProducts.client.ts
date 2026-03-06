"use client";

import type { Product } from "@/types/product";
import { parseJsonResponse, extractErrorMessage, buildQueryString } from "./adminApiClient.shared";
import type {
  FetchAdminProductsParams,
  AdminProductsListResponse,
  AdminProductMessageResponse,
  AdminProductSaveResponse,
  AdminProductPatchPayload,
} from "./adminProducts.types";
import { ADMIN_PRODUCTS_MESSAGES } from "@/components/admin/products/adminProducts.constants";

const BASE = "/api/admin/products";

/**
 * 목록 조회. 실패 시 throw. 성공 시 { items, total } 반환.
 */
export async function fetchAdminProducts(
  params: FetchAdminProductsParams,
): Promise<AdminProductsListResponse> {
  const qs = buildQueryString({
    page: params.page,
    pageSize: params.pageSize,
    sortField: params.sortField,
    sortDirection: params.sortDirection,
    q: params.q?.trim() || undefined,
  });
  const response = await fetch(`${BASE}?${qs}`, { cache: "no-store" });
  const result = await parseJsonResponse<AdminProductsListResponse | AdminProductMessageResponse>(
    response,
  );
  if (!response.ok || !("items" in result)) {
    throw new Error(extractErrorMessage(result, ADMIN_PRODUCTS_MESSAGES.LIST_FETCH_FAIL));
  }
  return result;
}

/**
 * 단건 조회 (editingId 로드). 실패 시 throw.
 */
export async function fetchAdminProduct(productId: string): Promise<Product> {
  const response = await fetch(`${BASE}/${productId}`, { cache: "no-store" });
  const result = await parseJsonResponse<Product | AdminProductMessageResponse>(response);
  if (!response.ok || !result || typeof result !== "object" || !("id" in result)) {
    throw new Error(extractErrorMessage(result, ADMIN_PRODUCTS_MESSAGES.PRODUCT_FETCH_FAIL));
  }
  return result as Product;
}

/**
 * 상품 생성. 실패 시 throw. 성공 시 body 반환 (message, warningCode 등).
 */
export async function createAdminProduct(
  payload: Record<string, unknown>,
): Promise<AdminProductSaveResponse> {
  const response = await fetch(BASE, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
  const result = await parseJsonResponse<AdminProductSaveResponse>(response);
  if (!response.ok) {
    throw new Error(extractErrorMessage(result, ADMIN_PRODUCTS_MESSAGES.PRODUCT_SAVE_FAIL));
  }
  return result;
}

/**
 * 상품 수정 (전체 payload). 실패 시 throw.
 */
export async function updateAdminProduct(
  productId: string,
  payload: Record<string, unknown>,
): Promise<AdminProductSaveResponse> {
  const response = await fetch(`${BASE}/${productId}`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
  const result = await parseJsonResponse<AdminProductSaveResponse>(response);
  if (!response.ok) {
    throw new Error(extractErrorMessage(result, ADMIN_PRODUCTS_MESSAGES.PRODUCT_SAVE_FAIL));
  }
  return result;
}

/**
 * 상품 부분 수정 (is_active, sort_order 등). 실패 시 throw.
 */
export async function patchAdminProduct(
  productId: string,
  payload: AdminProductPatchPayload,
): Promise<void> {
  const response = await fetch(`${BASE}/${productId}`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
  if (!response.ok) {
    const result = await parseJsonResponse<AdminProductMessageResponse>(response).catch(() => ({}));
    throw new Error(extractErrorMessage(result, "수정에 실패했습니다."));
  }
}

/**
 * 상품 삭제. 실패 시 throw.
 */
export async function deleteAdminProduct(productId: string): Promise<void> {
  const response = await fetch(`${BASE}/${productId}`, { method: "DELETE" });
  if (!response.ok) {
    const result = await parseJsonResponse<AdminProductMessageResponse>(response).catch(() => ({}));
    throw new Error(extractErrorMessage(result, ADMIN_PRODUCTS_MESSAGES.PRODUCT_DELETE_FAIL));
  }
}
