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
  filterActive: "all" | "active" | "inactive";
  filterStatus: "all" | "AVAILABLE" | "LIMITED" | "SOLD_OUT" | "CONSULT_REQUIRED";
  onKeywordChange: (value: string) => void;
  onSortChange: (field: ProductSortKey, direction?: "asc" | "desc") => void;
  onPageChange: (page: number) => void;
  onToggleSelectAll: () => void;
  onToggleSelectOne: (id: string) => void;
  onClearSelection: () => void;
  onBulkDelete: () => void;
  onEditProduct: (product: Product) => void;
  onDeleteProduct: (productId: string) => void;
  onQuickToggleActive: (product: Product) => void;
  onMoveSortOrder: (product: Product, direction: "up" | "down") => void;
  onFilterActiveChange: (value: "all" | "active" | "inactive") => void;
  onFilterStatusChange: (value: "all" | "AVAILABLE" | "LIMITED" | "SOLD_OUT" | "CONSULT_REQUIRED") => void;
  /** 목록 상단 "새 상품 등록" 링크 (없으면 버튼 비표시) */
  newProductHref?: string;
  /** 목록 조회 실패 시 다시 불러오기 (없으면 버튼 비표시) */
  onRetryLoad?: () => void;
  /** id → taxonomy name (destination_id, product_line_id용). 있으면 목록 "지역·상품군" 셀에서 이름 표시 */
  taxonomyNameMap?: Record<string, string>;
};
