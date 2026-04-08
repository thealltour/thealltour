/**
 * Admin products 도메인 - UI/hook 경계 타입만 최소 보관
 * API params/response는 api/adminProducts.types.ts, 도메인 모델은 @/types/product·homeCurated
 */

import type { Product } from "@/types/product";
import type { ProductSortKey } from "@/components/admin/products/api/adminProducts.types";
import type { AdminProductsTaxonomyOption } from "@/components/admin/products/adminProductsList.types";

export type { ProductSortKey } from "@/components/admin/products/api/adminProducts.types";

/** 상품 목록 뷰 props (AdminProductsListView) */
export type AdminProductsListViewProps = {
  /** 표시 행 (서버 페이지 결과 + 클라이언트 '문제만' 필터 적용 후) */
  products: Product[];
  /** 같은 페이지에서 API로 받은 원본 행 수 (요약·빈 상태 메시지용) */
  pageSourceCount: number;
  /** 현재 서버 페이지에서 노출(is_active !== false) 상품 수 */
  pageActiveCount: number;
  /** 현재 서버 페이지 기준 경고 집계(상품 수·치명·주의 배지 합) */
  pageWarningStats: {
    issueProductCount: number;
    criticalTotal: number;
    warningTotal: number;
  };
  totalCount: number;
  currentPage: number;
  pageSize: number;
  totalPages: number;
  sortField: ProductSortKey;
  sortDirection: "asc" | "desc";
  keyword: string;
  isLoading: boolean;
  isSearchPending?: boolean;
  errorMessage: string | null;
  selectedIds: string[];
  pendingMoveId: string | null;
  pendingToggleId: string | null;
  pendingDeleteId: string | null;
  filterActive: "all" | "active" | "inactive";
  filterStatus: "all" | "AVAILABLE" | "LIMITED" | "SOLD_OUT" | "CONSULT_REQUIRED";
  filterDestinationId: string;
  filterProductLineId: string;
  filterThemeQuery: string;
  filterIssuesOnly: boolean;
  destinationOptions: AdminProductsTaxonomyOption[];
  productLineOptions: AdminProductsTaxonomyOption[];
  themeNameOptions: string[];
  onKeywordChange: (value: string) => void;
  onSortChange: (field: ProductSortKey, direction?: "asc" | "desc") => void;
  onPageChange: (page: number) => void;
  onToggleSelectAll: () => void;
  onToggleSelectOne: (id: string) => void;
  onClearSelection: () => void;
  onBulkDelete: () => void;
  onEditProduct: (product: Product) => void;
  /** 스마트스토어 HTML 생성 모달 (목록 작업 열) */
  onOpenSmartstoreHtml?: (product: Product) => void;
  onDeleteProduct: (productId: string) => void;
  onQuickToggleActive: (product: Product) => void;
  onMoveSortOrder: (product: Product, direction: "up" | "down") => void;
  onFilterActiveChange: (value: "all" | "active" | "inactive") => void;
  onFilterStatusChange: (value: "all" | "AVAILABLE" | "LIMITED" | "SOLD_OUT" | "CONSULT_REQUIRED") => void;
  onFilterDestinationIdChange: (id: string) => void;
  onFilterProductLineIdChange: (id: string) => void;
  onFilterThemeQueryChange: (value: string) => void;
  onFilterIssuesOnlyChange: (value: boolean) => void;
  /** 목록 상단 "새 상품 등록" 링크 (없으면 버튼 비표시) */
  newProductHref?: string;
  /** 목록 조회 실패 시 다시 불러오기 (없으면 버튼 비표시) */
  onRetryLoad?: () => void;
  /** id → taxonomy name (destination_id, product_line_id용). 있으면 목록 "지역·상품군" 셀에서 이름 표시 */
  taxonomyNameMap?: Record<string, string>;
};
