import type { Product } from "@/types/product";
import { formatAirlineLabel } from "@/lib/products/formatAirlineLabel";

export type ProductHeroFact = {
  label: string;
  value: string;
};

function firstMatchingLine(text: string | null | undefined, patterns: RegExp[]): string | null {
  const raw = text?.trim();
  if (!raw) return null;
  for (const line of raw.split(/\r?\n/).map((l) => l.trim()).filter(Boolean)) {
    for (const re of patterns) {
      if (re.test(line)) return line.replace(/^[-•*]\s*/, "").trim();
    }
  }
  // 한 줄 필드에 키워드만 있는 경우
  for (const re of patterns) {
    const m = raw.match(re);
    if (m?.[0]) {
      const idx = raw.indexOf(m[0]);
      const slice = raw.slice(Math.max(0, idx - 4), Math.min(raw.length, idx + 48)).trim();
      if (slice) return slice.replace(/\s+/g, " ");
    }
  }
  return null;
}

function isGolfProduct(product: Product | null | undefined): boolean {
  if (!product) return false;
  const category = (product.category ?? "").toLowerCase();
  const line = (product.product_line_id ?? "").toLowerCase();
  return (
    category.includes("golf") ||
    category.includes("골프") ||
    line.includes("golf") ||
    Boolean(product.golf_course_info?.trim())
  );
}

/**
 * 상세 히어로 요약용 핵심 조건. 데이터가 있을 때만 짧게 반환한다.
 * 골프: 홀·그린피·카트·캐디 우선 / 패키지: 자유시간·쇼핑·선택관광 우선.
 */
export function buildProductHeroFacts(
  product: Product | null | undefined,
  fallbacks?: {
    duration?: string | null;
    minDeparturePeople?: string | null;
  },
): ProductHeroFact[] {
  const facts: ProductHeroFact[] = [];
  const push = (label: string, value: string | null | undefined) => {
    const v = value?.trim();
    if (!v) return;
    if (facts.some((f) => f.label === label || f.value === v)) return;
    facts.push({ label, value: v });
  };

  const duration = product?.duration?.trim() || fallbacks?.duration?.trim();
  push("여행기간", duration);

  const departure =
    product?.departure?.trim() ||
    product?.overview_region?.trim() ||
    product?.theme?.trim();
  push("출발", departure);

  const airline = formatAirlineLabel(product ?? undefined);
  push("항공", airline);

  const minPax =
    product?.min_departure_people?.trim() || fallbacks?.minDeparturePeople?.trim();
  push("출발 조건", minPax);

  if (isGolfProduct(product)) {
    const golfText = [product?.title, product?.golf_course_info, product?.description]
      .filter(Boolean)
      .join("\n");
    push(
      "라운드",
      firstMatchingLine(golfText, [
        /\d+\s*홀/,
        /라운드/,
        /18\s*H/i,
        /36\s*H/i,
        /54\s*홀/,
      ]),
    );
    push(
      "그린피·카트·캐디",
      firstMatchingLine(golfText, [/그린피/, /카트/, /캐디/, /캐디피/, /카트비/]),
    );
  } else {
    const packageText = [
      product?.description,
      product?.included_items,
      product?.optional_tours,
      product?.package_catalog_json?.referenceNotes,
      ...(product?.package_catalog_json?.optionalTours?.map((t) => t.name) ?? []),
    ]
      .filter(Boolean)
      .join("\n");
    push(
      "자유시간",
      firstMatchingLine(packageText, [/자유\s*시간/, /자유일정/, /프리\s*타임/i]),
    );
    push("쇼핑", firstMatchingLine(packageText, [/쇼핑/]));
    push("선택관광", firstMatchingLine(packageText, [/선택\s*관광/, /옵션\s*투어/]));
  }

  return facts.slice(0, 6);
}
