import type { Product } from "@/types/product";
import type { AdminProductListWarning } from "./adminProductsList.types";

/** 이보다 짧으면(비어 있지 않을 때) '짧은 상품명' 경고 */
const SHORT_TITLE_WARN_MAX = 2;

export function hasProductPrimaryImage(product: Product): boolean {
  if (product.image_url?.trim()) return true;
  const imgs = product.images_json;
  if (Array.isArray(imgs)) {
    return imgs.some((u) => typeof u === "string" && u.trim().length > 0);
  }
  return false;
}

export function hasProductItinerary(product: Product): boolean {
  const v2 = product.itinerary_v2_json?.days;
  if (Array.isArray(v2) && v2.length > 0) return true;
  if (product.itinerary_days_json && product.itinerary_days_json.length > 0) return true;
  if (product.itinerary_days && product.itinerary_days.length > 0) return true;
  if (product.itinerary?.trim()) return true;
  if (product.detailed_schedule?.trim()) return true;
  return false;
}

/** 운영 편의용 경고 (저장 검증 아님) */
export function getAdminProductWarnings(product: Product): AdminProductListWarning[] {
  const out: AdminProductListWarning[] = [];

  if (!hasProductPrimaryImage(product)) {
    out.push({
      id: "no_image",
      label: "이미지 없음",
      severity: "critical",
      detail: "대표 이미지(URL 또는 갤러리)가 없습니다.",
    });
  }

  if (!product.destination_id?.trim()) {
    out.push({
      id: "no_destination",
      label: "지역 없음",
      severity: "critical",
      detail: "destination_id(택소노미 지역)가 비어 있습니다.",
    });
  }

  if (!hasProductItinerary(product)) {
    out.push({
      id: "no_itinerary",
      label: "일정 없음",
      severity: "warning",
      detail: "구조화 일정·텍스트 일정·상세일정이 모두 비어 있습니다.",
    });
  }

  if (!product.product_line_id?.trim()) {
    out.push({
      id: "no_product_line",
      label: "상품군 없음",
      severity: "info",
      detail: "product_line_id가 비어 있습니다.",
    });
  }

  const title = product.title?.trim() ?? "";
  if (title.length === 0) {
    out.push({
      id: "empty_title",
      label: "상품명 없음",
      severity: "critical",
      detail: "제목이 비어 있습니다.",
    });
  } else if (title.length <= SHORT_TITLE_WARN_MAX) {
    out.push({
      id: "short_title",
      label: "상품명 짧음",
      severity: "warning",
      detail: `상품명이 ${SHORT_TITLE_WARN_MAX}자 이하입니다.`,
    });
  }

  /** 비노출은 목록 '노출' 열 배지로 이미 드러나므로 경고 줄에서 중복 강조하지 않음 */

  return out;
}

const SEVERITY_ORDER: Record<AdminProductListWarning["severity"], number> = {
  critical: 0,
  warning: 1,
  info: 2,
};

/** 치명 → 주의 → 정보 순으로 정렬 (한 줄 wrap 시 앞쪽에 중요 경고) */
export function sortAdminProductWarningsForDisplay(
  warnings: AdminProductListWarning[],
): AdminProductListWarning[] {
  return [...warnings].sort((a, b) => SEVERITY_ORDER[a.severity] - SEVERITY_ORDER[b.severity]);
}

/** 현재 서버 페이지 기준: 문제 상품 수·치명·주의 배지 합계 */
export function aggregatePageWarningStats(products: Product[]): {
  issueProductCount: number;
  criticalTotal: number;
  warningTotal: number;
} {
  let criticalTotal = 0;
  let warningTotal = 0;
  let issueProductCount = 0;
  for (const p of products) {
    const w = getAdminProductWarnings(p);
    const c = w.filter((x) => x.severity === "critical").length;
    const wa = w.filter((x) => x.severity === "warning").length;
    criticalTotal += c;
    warningTotal += wa;
    if (c + wa > 0) issueProductCount += 1;
  }
  return { issueProductCount, criticalTotal, warningTotal };
}

/**
 * 운영 판단용 taxonomy 한 줄 (지역 | 테마 | 상품군 [| 카테고리]).
 * 이름은 taxonomyNameMap 우선.
 */
export function formatAdminProductTaxonomyLine(
  product: Product,
  taxonomyNameMap: Record<string, string>,
): { line: string; titleAttr: string } {
  const destId = product.destination_id?.trim() ?? "";
  const lineId = product.product_line_id?.trim() ?? "";
  const destResolved = destId
    ? (taxonomyNameMap[destId]?.trim() || `ID ${shortProductId(destId)}`)
    : null;
  const lineResolved = lineId
    ? (taxonomyNameMap[lineId]?.trim() || `ID ${shortProductId(lineId)}`)
    : null;
  const destSeg = destResolved ? `지역 ${destResolved}` : "지역 미연결";
  const themeSeg = product.theme?.trim() ? `테마 ${product.theme.trim()}` : "테마 없음";
  const lineSeg = lineResolved ? `상품군 ${lineResolved}` : "상품군 미연결";
  const cat = product.category?.trim();
  const parts = cat ? [destSeg, themeSeg, lineSeg, `카테고리 ${cat}`] : [destSeg, themeSeg, lineSeg];
  const line = parts.join(" | ");
  return { line, titleAttr: parts.join("\n") };
}

/**
 * 목록 1줄용 짧은 taxonomy (이름만 · 구분). 길면 CSS truncate + titleAttr.
 * 예: `도쿄 · 프리미엄 · 도시탐방`
 */
export function formatAdminProductTaxonomyCompactLine(
  product: Product,
  taxonomyNameMap: Record<string, string>,
): { text: string; titleAttr: string } {
  const destId = product.destination_id?.trim() ?? "";
  const lineId = product.product_line_id?.trim() ?? "";
  const dest = destId ? (taxonomyNameMap[destId]?.trim() || shortProductId(destId)) : "—";
  const line = lineId ? (taxonomyNameMap[lineId]?.trim() || shortProductId(lineId)) : "—";
  const theme = product.theme?.trim() || "—";
  const cat = product.category?.trim();
  const text = cat ? `${dest} · ${line} · ${theme} · ${cat}` : `${dest} · ${line} · ${theme}`;
  return { text, titleAttr: formatAdminProductTaxonomyLine(product, taxonomyNameMap).titleAttr };
}

/** 행 경고 툴팁: 라벨만 나열 (계산 규칙 변경 없음) */
export function formatAllWarningLabelsForTooltip(warnings: AdminProductListWarning[]): string {
  return warnings.map((w) => w.label).join(", ");
}

/** 행 hover 시: ID·날짜·경고 요약·원본 URL (목록 본문 최소화용) */
export function buildAdminProductListRowTooltip(
  product: Product,
  taxonomyNameMap: Record<string, string>,
): string {
  const lines: string[] = [];
  lines.push(`ID: ${product.id}`);
  const ws = getAdminProductWarnings(product);
  if (ws.length > 0) {
    lines.push(`경고: ${ws.map((w) => w.label).join(", ")}`);
  }
  lines.push(`수정: ${formatAdminProductListDate(product.updated_at ?? product.created_at)}`);
  lines.push(`생성: ${formatAdminProductListDate(product.created_at)}`);
  if (product.product_source_url?.trim()) {
    lines.push(`원본: ${product.product_source_url.trim()}`);
  }
  if (product.is_recommend) lines.push("추천 컬렉션 노출");
  if (product.is_popular) lines.push("인기 컬렉션 노출");
  lines.push(formatAdminProductTaxonomyLine(product, taxonomyNameMap).line);
  return lines.join("\n");
}

/** 치명·주의 경고 라벨만 툴팁 문구로 (아이콘 열용) */
export function formatSignificantWarningTooltip(warnings: AdminProductListWarning[]): string {
  const sig = warnings.filter((w) => w.severity === "critical" || w.severity === "warning");
  if (sig.length > 0) return sig.map((w) => w.label).join(", ");
  const infos = warnings.filter((w) => w.severity === "info");
  return infos.length > 0 ? infos.map((w) => w.label).join(", ") : "";
}

export function countSignificantWarnings(warnings: AdminProductListWarning[]): number {
  return warnings.filter((w) => w.severity === "critical" || w.severity === "warning").length;
}

/** 클라이언트 '문제만' 필터: 치명·주의만 (정보성 비노출·상품군 미연결 제외) */
export function productHasIssueForFilter(product: Product): boolean {
  return getAdminProductWarnings(product).some(
    (w) => w.severity === "critical" || w.severity === "warning",
  );
}

export function formatAdminProductListDate(iso?: string | null): string {
  if (!iso) return "—";
  try {
    const d = new Date(iso);
    return new Intl.DateTimeFormat("ko-KR", {
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
    }).format(d);
  } catch {
    return "—";
  }
}

export function shortProductId(id: string): string {
  if (!id) return "—";
  return id.length <= 10 ? id : `${id.slice(0, 8)}…`;
}
