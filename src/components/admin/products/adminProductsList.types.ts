/**
 * 관리자 상품 목록 전용 UI 타입 (Product 모델과 분리)
 */

export type AdminProductListWarningSeverity = "critical" | "warning" | "info";

export type AdminProductListWarning = {
  id: string;
  /** 짧은 라벨 (배지) */
  label: string;
  severity: AdminProductListWarningSeverity;
  /** title / 툴팁 */
  detail?: string;
};

/** 빠른 필터: 테마는 상품 문자열 컬럼 기준(택소노미 이름으로 좁히기) */
export type AdminProductsTaxonomyOption = { id: string; name: string };
