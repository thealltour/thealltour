import type { AdminLandingStatus, AdminLandingSummary, AdminLandingTemplateType } from "@/types/adminLanding";

export const ADMIN_LANDINGS_TITLE = "검색/유입 랜딩 관리";
export const ADMIN_LANDINGS_DESCRIPTION = "AI 검색/추천 유입용 랜딩을 생성하고 운영합니다.";

export const ADMIN_LANDINGS_EMPTY_TITLE = "아직 생성된 검색/유입 랜딩이 없습니다.";
export const ADMIN_LANDINGS_EMPTY_DESCRIPTION = "다음 PR에서 템플릿 기반 생성 기능이 연결됩니다.";
export const ADMIN_LANDINGS_ERROR_TITLE = "랜딩 목록을 불러오지 못했습니다.";
export const ADMIN_LANDINGS_ERROR_DESCRIPTION = "잠시 후 다시 시도해주세요.";

export const ADMIN_LANDINGS_FUTURE_NEW_ROUTE = "/theall_manager_only/landings/new";
export const ADMIN_LANDINGS_FUTURE_EDIT_ROUTE = "/theall_manager_only/landings/[id]";
export const ADMIN_LANDINGS_PREVIEW_ROUTE = "/theall_manager_only/landings/[id]/preview";
export const ADMIN_LANDINGS_GENERATE_FROM_TAXONOMY_ROUTE =
  "/theall_manager_only/landings/generate-from-taxonomy";
export const ADMIN_LANDINGS_ANALYTICS_ROUTE = "/theall_manager_only/landings/analytics";
export const ADMIN_LANDINGS_ROUTE = "/theall_manager_only/landings";

export const ADMIN_LANDINGS_SUMMARY_DEFAULT: AdminLandingSummary = {
  total: 0,
  published: 0,
  draft: 0,
  archived: 0,
};

export const LANDING_STATUS_LABELS: Record<AdminLandingStatus, string> = {
  draft: "드래프트",
  published: "공개",
  archived: "보관",
};

export const LANDING_TEMPLATE_LABELS: Partial<Record<AdminLandingTemplateType, string>> = {
  destination_consulting: "지역 상담형",
  theme_consulting: "테마 상담형",
  product_line_consulting: "상품군 상담형",
  recommended_collection: "추천 컬렉션형",
  custom: "커스텀",
};

export const LANDING_TEMPLATE_OPTIONS: { value: AdminLandingTemplateType; label: string }[] = [
  { value: "destination_consulting", label: "목적지 상담형" },
  { value: "theme_consulting", label: "테마 상담형" },
  { value: "product_line_consulting", label: "상품군 상담형" },
  { value: "recommended_collection", label: "추천 컬렉션형" },
  { value: "custom", label: "사용자 정의" },
];

export function buildAdminLandingEditHref(id: string): string {
  return ADMIN_LANDINGS_FUTURE_EDIT_ROUTE.replace("[id]", encodeURIComponent(id));
}

export function buildAdminLandingPreviewHref(id: string): string {
  return ADMIN_LANDINGS_PREVIEW_ROUTE.replace("[id]", encodeURIComponent(id));
}
