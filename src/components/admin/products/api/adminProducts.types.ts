import type { Product } from "@/types/product";

export type ProductSortKey = "title" | "category" | "price" | "sort_order" | "created_at";

export type FetchAdminProductsParams = {
  page: number;
  pageSize: number;
  sortField: ProductSortKey;
  sortDirection: "asc" | "desc";
  q?: string;
};

export type AdminProductsListResponse = {
  items: Product[];
  total: number;
};

export type AdminProductMessageResponse = { message?: string };

export type AdminProductSaveResponse = { message?: string; warningCode?: string };

/** PATCH body for partial update (e.g. is_active, sort_order only) */
export type AdminProductPatchPayload = Partial<{
  is_active: boolean;
  sort_order: number;
}>;
