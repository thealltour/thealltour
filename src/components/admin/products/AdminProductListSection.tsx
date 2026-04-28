"use client";

import { useEffect } from "react";
import type { Product } from "@/types/product";
import type { StoredImageDownloadPreset } from "@/lib/images/imageDownloadPreset.storage";
import AdminProductsListView from "@/components/admin/products/AdminProductsListView";
import { useAdminProductsListController } from "@/components/admin/products/hooks/useAdminProductsListController";
export type AdminProductListSectionProps = {
  showToast: (type: "success" | "error", message: string) => void;
  confirm: (options: {
    title: string;
    description: string;
    confirmLabel: string;
    cancelLabel: string;
  }) => Promise<boolean>;
  /** 상품 삭제 성공 후 호출 (현재 편집 중이던 상품이 삭제된 경우 상위에서 편집 상태 초기화용) */
  onAfterDelete?: (deletedId: string) => void;
  /** 상품 수정 클릭 시 (상위에서 편집 모드로 전환) */
  onEditProduct: (product: Product) => void;
  /** 스마트스토어 HTML 생성 (목록 작업 열) */
  onOpenSmartstoreHtml?: (product: Product) => void;
  /** 블로그 텍스트 생성 (목록 작업 열) */
  onOpenBlogPost?: (product: Product) => void;
  /** 네이버 밴드 공유용 훅 생성 (목록 작업 열) */
  onOpenBandHook?: (product: Product) => void;
  /** 카카오채널 게시글 생성 (목록 작업 열) */
  onOpenKakaoPost?: (product: Product) => void;
  /** 이미지 ZIP 옵션 모달 (목록 작업 열) */
  onOpenDownloadOptions?: (product: Product) => void;
  /** preset 즉시 다운로드 */
  onRunProductImageDownloadWithPreset?: (product: Product, preset: StoredImageDownloadPreset) => void;
  downloadPresets?: StoredImageDownloadPreset[];
  downloadDefaultPresetId?: string | null;
  downloadRecentPresetIds?: string[];
  /** preset 관리 모달 */
  onOpenDownloadPresetManager?: () => void;
  /** 이미지 선택 다운로드 */
  onOpenImageSelector?: (product: Product) => void;
  /** ZIP 다운로드 진행 중인 상품 id */
  pendingDownloadId?: string | null;
  /** A4 유인물 빌더 (목록 작업 열) */
  onOpenFlyer?: (product: Product) => void;
  /** 새 상품 등록 링크 (없으면 버튼 비표시) */
  newProductHref?: string;
  /** 목록 새로고침 함수 등록 (저장 후 등 호출용) */
  registerRefresh?: (refresh: () => Promise<void>) => void;
};

export default function AdminProductListSection({
  showToast,
  confirm,
  onAfterDelete,
  onEditProduct,
  onOpenSmartstoreHtml,
  onOpenBlogPost,
  onOpenBandHook,
  onOpenKakaoPost,
  onOpenDownloadOptions,
  onRunProductImageDownloadWithPreset,
  downloadPresets,
  downloadDefaultPresetId,
  downloadRecentPresetIds,
  onOpenDownloadPresetManager,
  onOpenImageSelector,
  pendingDownloadId,
  onOpenFlyer,
  newProductHref,
  registerRefresh,
}: AdminProductListSectionProps) {
  const ctrl = useAdminProductsListController({
    showToast,
    confirm,
    onAfterDelete,
  });

  useEffect(() => {
    registerRefresh?.(ctrl.loadProducts);
  }, [registerRefresh, ctrl.loadProducts]);

  return (
    <AdminProductsListView
      products={ctrl.displayProducts}
      pageSourceCount={ctrl.products.length}
      pageActiveCount={ctrl.pageActiveCount}
      pageWarningStats={ctrl.pageWarningStats}
      taxonomyNameMap={ctrl.taxonomyNameMap}
      totalCount={ctrl.totalCount}
      currentPage={ctrl.currentPage}
      pageSize={ctrl.pageSize}
      pageSizeOptions={ctrl.pageSizeOptions}
      onPageSizeChange={ctrl.setPageSize}
      totalPages={ctrl.totalPages}
      sortField={ctrl.sortField}
      sortDirection={ctrl.sortDirection}
      keyword={ctrl.keyword}
      isSearchPending={ctrl.isSearchPending}
      isLoading={ctrl.isLoading}
      errorMessage={ctrl.errorMessage || null}
      selectedIds={ctrl.selectedIds}
      pendingMoveId={ctrl.pendingMoveId}
      pendingToggleId={ctrl.pendingToggleId}
      pendingDeleteId={ctrl.pendingDeleteId}
      pendingDownloadId={pendingDownloadId}
      onKeywordChange={ctrl.setKeyword}
      onSortChange={ctrl.handleSortChange}
      onPageChange={ctrl.movePage}
      onToggleSelectAll={ctrl.toggleSelectAllForPage}
      onToggleSelectOne={ctrl.toggleSelectOne}
      onClearSelection={() => ctrl.setSelectedIds([])}
      onBulkDelete={ctrl.handleBulkDeleteSelected}
      onEditProduct={onEditProduct}
      onOpenSmartstoreHtml={onOpenSmartstoreHtml}
      onOpenBlogPost={onOpenBlogPost}
      onOpenBandHook={onOpenBandHook}
      onOpenKakaoPost={onOpenKakaoPost}
      onOpenDownloadOptions={onOpenDownloadOptions}
      onRunProductImageDownloadWithPreset={onRunProductImageDownloadWithPreset}
      downloadPresets={downloadPresets}
      downloadDefaultPresetId={downloadDefaultPresetId}
      downloadRecentPresetIds={downloadRecentPresetIds}
      onOpenDownloadPresetManager={onOpenDownloadPresetManager}
      onOpenImageSelector={onOpenImageSelector}
      onOpenFlyer={onOpenFlyer}
      onDeleteProduct={ctrl.handleDelete}
      onQuickToggleActive={ctrl.quickToggleActive}
      onMoveSortOrder={ctrl.moveSortOrder}
      filterActive={ctrl.filterActive}
      filterStatus={ctrl.filterStatus}
      filterDestinationId={ctrl.filterDestinationId}
      filterProductLineId={ctrl.filterProductLineId}
      filterThemeQuery={ctrl.filterThemeQuery}
      filterIssuesOnly={ctrl.filterIssuesOnly}
      destinationOptions={ctrl.destinationOptions}
      productLineOptions={ctrl.productLineOptions}
      themeNameOptions={ctrl.themeNameOptions}
      onFilterActiveChange={ctrl.setFilterActive}
      onFilterStatusChange={ctrl.setFilterStatus}
      onFilterDestinationIdChange={ctrl.setFilterDestinationId}
      onFilterProductLineIdChange={ctrl.setFilterProductLineId}
      onFilterThemeQueryChange={ctrl.setFilterThemeQuery}
      onFilterIssuesOnlyChange={ctrl.setFilterIssuesOnly}
      newProductHref={newProductHref}
      onRetryLoad={ctrl.loadProducts}
    />
  );
}
