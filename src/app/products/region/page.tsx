import { redirect } from "next/navigation";

/**
 * 지역 허브 경로 — 현재는 상품 목록으로 통합 리다이렉트.
 * 브레드크럼·뒤로가기 fallback 앵커용으로 경로만 유지합니다.
 */
export default function ProductsRegionHubPage() {
  redirect("/products");
}
