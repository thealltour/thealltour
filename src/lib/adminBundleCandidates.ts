/**
 * `npm run analyze`(@next/bundle-analyzer)로 실제 청크를 확인한 뒤,
 * 초기 로드에서 분리하기 좋은 후보 모듈·경로를 한곳에 모아 둡니다.
 * (정적 분석 기준 — 빌드 리포트와 함께 갱신하면 됩니다.)
 */
export const ADMIN_HEAVY_CLIENT_MODULES = [
  "recharts (랜딩 분석 차트·전환 카드)",
  "@dnd-kit/* (상품 일정 EventList 드래그)",
  "pdfjs-dist (PdfViewer, PDF 썸네일)",
  "html-to-image (플라이어 PNG보내기)",
  "jszip (상품 이미지 ZIP)",
] as const;

export const ADMIN_HEAVY_COMPONENT_PATHS = [
  "src/components/admin/landings/AdminLandingAnalyticsTrendChart.tsx",
  "src/components/admin/landings/AdminLandingAnalyticsConversionCards.tsx",
  "src/components/admin/product/schedule/EventList.tsx",
  "src/components/pdf/PdfViewer.tsx",
] as const;
