/**
 * Admin products 도메인 - UI/hook 경계 타입만 최소 보관
 * API params/response는 api/adminProducts.types.ts, 도메인 모델은 @/types/product·homeCurated
 */

import type { Product } from "@/types/product";
import type { ProductSortKey } from "@/components/admin/products/api/adminProducts.types";

export type { ProductSortKey } from "@/components/admin/products/api/adminProducts.types";

/** 상품 목록 뷰 props (AdminProductsListView) */
export type AdminProductsListViewProps = {
  products: Product[];
  totalCount: number;
  currentPage: number;
  pageSize: number;
  totalPages: number;
  sortField: ProductSortKey;
  sortDirection: "asc" | "desc";
  keyword: string;
  isLoading: boolean;
  errorMessage: string | null;
  selectedIds: string[];
  pendingMoveId: string | null;
  pendingToggleId: string | null;
  onKeywordChange: (value: string) => void;
  onSortChange: (field: ProductSortKey) => void;
  onPageChange: (page: number) => void;
  onToggleSelectAll: () => void;
  onToggleSelectOne: (id: string) => void;
  onClearSelection: () => void;
  onBulkDelete: () => void;
  onEditProduct: (product: Product) => void;
  onDeleteProduct: (productId: string) => void;
  onQuickToggleActive: (product: Product) => void;
  onMoveSortOrder: (product: Product, direction: "up" | "down") => void;
};
