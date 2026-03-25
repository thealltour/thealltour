import type { Product } from "@/types/product";

export type ProductSortKey =
  | "title"
  | "category"
  | "price"
  | "sort_order"
  | "created_at"
  | "updated_at";

export type FetchAdminProductsParams = {
  page: number;
  pageSize: number;
  sortField: ProductSortKey;
  sortDirection: "asc" | "desc";
  q?: string;
  /** 노출 필터: true=노출만, false=비노출만, 미설정=전체 */
  is_active?: boolean;
  /** 예약 상태 필터: AVAILABLE | LIMITED | SOLD_OUT | CONSULT_REQUIRED, 미설정=전체 */
  status?: "AVAILABLE" | "LIMITED" | "SOLD_OUT" | "CONSULT_REQUIRED";
  /** 지역 taxonomy id */
  destination_id?: string;
  /** 상품군 taxonomy id */
  product_line_id?: string;
  /** theme 컬럼 부분 일치 (관리자 빠른 필터) */
  theme_q?: string;
};

export type AdminProductsListResponse = {
  items: Product[];
  total: number;
};

export type AdminProductMessageResponse = { message?: string };

export type AdminProductSaveResponse = { message?: string; warningCode?: string; id?: string };

/** PATCH body for partial update (e.g. is_active, sort_order only) */
export type AdminProductPatchPayload = Partial<{
  is_active: boolean;
  sort_order: number;
}>;
