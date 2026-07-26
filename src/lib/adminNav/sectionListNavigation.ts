/**
 * 관리자 섹션 「목록」 복귀 URL 빌더.
 *
 * 상품·공지·가이드는 목록과 수정이 같은 경로를 쓰고 수정 여부를 쿼리(editingId 등)로 구분한다.
 * 사이드바·서브헤더가 현재 쿼리를 그대로 물고 이동하면 수정 화면에서 목록으로 못 돌아오므로,
 * 목록 이동은 항상 이 빌더가 만드는 깨끗한 URL을 쓴다.
 */

import {
  ADMIN_PRODUCTS_QUERY_KEYS,
  ADMIN_PRODUCTS_VIEW,
} from "@/components/admin/products/adminProducts.constants";
import { ADMIN_MANAGER_PREFIX, type MainMenuKey } from "@/lib/adminNav/adminNav.config";

const PRODUCTS_PATH = `${ADMIN_MANAGER_PREFIX}/products`;
const NOTICES_PATH = `${ADMIN_MANAGER_PREFIX}/notices`;
const GUIDES_PATH = `${ADMIN_MANAGER_PREFIX}/guides`;

export function buildAdminProductsHref(view?: string | null): string {
  return view ? `${PRODUCTS_PATH}?${ADMIN_PRODUCTS_QUERY_KEYS.VIEW}=${view}` : PRODUCTS_PATH;
}

export function buildAdminProductsListHref(): string {
  return buildAdminProductsHref(ADMIN_PRODUCTS_VIEW.LIST);
}

/** 목록과 같은 경로에서 여는 상품 수정 URL */
export function buildAdminProductEditHref(productId: string): string {
  return `${buildAdminProductsListHref()}&${ADMIN_PRODUCTS_QUERY_KEYS.EDITING_ID}=${encodeURIComponent(productId)}`;
}

export type AdminNoticesView = "list" | "create" | "legal";

export function buildAdminNoticesHref(view: AdminNoticesView = "list"): string {
  return `${NOTICES_PATH}?view=${view}`;
}

export type AdminGuidesView = "list" | "notion" | "general";

export function buildAdminGuidesHref(view: AdminGuidesView = "list"): string {
  return `${GUIDES_PATH}?view=${view}`;
}

/** 사이드바 섹션 클릭 시 이동할 URL. 인페이지 에디터가 있는 섹션만 목록 URL로 고정한다. */
export function buildAdminSectionHomeHref(mainKey: MainMenuKey, fallbackHref: string): string {
  switch (mainKey) {
    case "product":
      return buildAdminProductsListHref();
    case "notices":
      return buildAdminNoticesHref("list");
    case "guides":
      return buildAdminGuidesHref("list");
    default:
      return fallbackHref;
  }
}
