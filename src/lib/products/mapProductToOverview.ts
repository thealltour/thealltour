/**
 * [STEP 3] 오버뷰 자동 생성 핵심
 * - 입력: Product
 * - 출력: TravelOverviewModel (렌더 전용)
 * - 순수 함수, 상세/카드/미리보기에서 재사용
 */

import type { Product } from "@/types/product";
import type { ProductOverview, OverviewSummaryCardKind } from "@/types/product";
import { parseThemeTokens } from "@/lib/productTaxonomies";

/** 렌더 전용 오버뷰 모델 */
export type TravelOverviewModel = {
  title: string;
  cards: Array<{ iconKey: string; label: string; value: string }>;
  coverImageUrl: string | null;
  chart?: { items: Array<{ label: string; percent: number }> };
  timeline?: {
    days: Array<{ day: number; headline: string; bullets: string[] }>;
  };
};

const DEFAULT_TITLE = "여행 오버뷰";
const CONSULT_PLACEHOLDER = "상담 시 안내";

/** 카드용 iconKey (TravelOverviewV2 kind와 매핑) */
const CARD_ICONS: Record<string, string> = {
  flight: "flight",
  hotel: "hotel",
  region: "region",
  theme: "theme",
  golf: "golf",
  etc: "etc",
};

/** bullets/첫 줄에서 대표 키워드 추출 → headline */
function inferHeadline(bullets: string[]): string {
  const text = bullets.join(" ").trim();
  if (!text) return "일정";
  const keywords = [
    { pattern: /TEE\s*OFF|티오프|라운드|골프/i, label: "라운드" },
    { pattern: /이동|차량|버스|출발/i, label: "이동" },
    { pattern: /식사|조식|중식|석식|디너/i, label: "식사" },
    { pattern: /도착|체크인|입국/i, label: "도착" },
    { pattern: /관광|시내|투어/i, label: "관광" },
    { pattern: /호텔|숙소|체크인/i, label: "숙소" },
    { pattern: /자유|프리/i, label: "자유일정" },
  ];
  for (const { pattern, label } of keywords) {
    if (pattern.test(text)) return label;
  }
  return bullets[0]?.slice(0, 20) || "일정";
}

/** detailed_schedule / itinerary에서 [N일차] 파싱 → timeline days (타임라인 시각화/일정 섹션에서 재사용) */
export function parseTimelineDays(raw?: string): Array<{ day: number; headline: string; bullets: string[] }> {
  const source = raw?.trim();
  if (!source) return [];

  const lines = source.split(/\r?\n/);
  const days: Array<{ day: number; headline: string; bullets: string[] }> = [];
  let currentDay: number | null = null;
  let currentBullets: string[] = [];

  const flush = () => {
    if (currentDay == null) return;
    const bullets = currentBullets.length > 0 ? currentBullets : [];
    const headline = inferHeadline(bullets);
    days.push({ day: currentDay, headline, bullets });
  };

  for (const line of lines) {
    const match = line.match(/^\[(\d+)(?:일차|일|Day)?\s*\]\s*(.*)$/i);
    if (match) {
      flush();
      currentDay = Math.max(1, parseInt(match[1], 10) || 1);
      const rest = match[2]?.trim();
      currentBullets = rest ? [rest] : [];
      continue;
    }
    const trimmed = line.trim();
    if (trimmed && currentDay != null) {
      currentBullets.push(trimmed);
    }
  }
  flush();

  return days.sort((a, b) => a.day - b.day);
}

/** 항공 카드 값 */
function getFlightValue(p: Product): string {
  const from = p.departure_from_airport?.trim();
  const to = p.departure_to_airport?.trim();
  const flight = p.departure_flight_name?.trim();
  if (from && to) return `${from} → ${to}`;
  if (from) return from;
  if (to) return to;
  if (flight) return flight;
  return "";
}

/** 숙소 카드 값 (overview_accommodation 우선, 없으면 meta_info / itinerary 패턴). PR26 호텔 카드에서도 사용 */
export function getHotelValue(p: Product): string {
  const override = p.overview_accommodation?.trim();
  if (override) return override;
  const meta = p.meta_info?.trim();
  if (meta) {
    const m = meta.match(/(\d+성|전일정\s*\d+성|호텔|리조트)/i);
    if (m) return m[1];
    if (meta.length <= 30) return meta;
  }
  const it = p.itinerary?.trim();
  if (it) {
    const m = it.match(/(\d+성|전일정\s*\d+성|호텔|리조트)/i);
    if (m) return m[1];
  }
  return "";
}

/** 지역 카드 값 (overview_region 우선, 없으면 theme / category) */
function getRegionValue(p: Product): string {
  const override = p.overview_region?.trim();
  if (override) return override;
  return p.theme?.trim() || p.category?.trim() || "";
}

/** 기간 카드 값 (overview_duration 우선, 없으면 duration) */
function getDurationValue(p: Product): string {
  const override = p.overview_duration?.trim();
  if (override) return override;
  return p.duration?.trim() || "";
}

/** 카드 2~3개 보장, 없으면 "상담 시 안내" 또는 일정 N일 (케이스 C: 항공/숙소 없어도 지역·기간·상담 시 안내로 구성) */
function buildCards(product: Product, timelineDayCount: number): TravelOverviewModel["cards"] {
  const cards: TravelOverviewModel["cards"] = [];

  const flightVal = getFlightValue(product);
  cards.push({
    iconKey: "flight",
    label: "항공",
    value: flightVal || CONSULT_PLACEHOLDER,
  });

  const hotelVal = getHotelValue(product);
  cards.push({
    iconKey: "hotel",
    label: "숙소",
    value: hotelVal || CONSULT_PLACEHOLDER,
  });

  const regionVal = getRegionValue(product);
  cards.push({
    iconKey: "region",
    label: "지역",
    value: regionVal || CONSULT_PLACEHOLDER,
  });

  const durationVal = getDurationValue(product);
  if (durationVal) {
    cards.push({ iconKey: "etc", label: "기간", value: durationVal });
  } else if (timelineDayCount > 0) {
    cards.push({ iconKey: "etc", label: "일정", value: `${timelineDayCount}일` });
  }

  const metaVal = product.meta_info?.trim();
  if (metaVal && metaVal.length <= 40 && !cards.some((c) => c.value === metaVal)) {
    cards.push({ iconKey: "etc", label: "기타", value: metaVal });
  }

  return cards.slice(0, 6);
}

/** theme/category에서 chart items 생성 (균등 비율). theme_chart_json 없을 때 fallback */
function buildChartFromTheme(product: Product): TravelOverviewModel["chart"] | undefined {
  const tokens = parseThemeTokens(product.theme);
  const category = product.category?.trim();
  const labels: string[] = [];
  if (category && !labels.includes(category)) labels.push(category);
  tokens.forEach((t) => {
    if (t && !labels.includes(t)) labels.push(t);
  });
  if (labels.length < 2) return undefined;
  const percent = Math.floor(100 / labels.length);
  let remainder = 100 - percent * labels.length;
  const items = labels.map((label) => {
    const p = percent + (remainder > 0 ? 1 : 0);
    if (remainder > 0) remainder -= 1;
    return { label, percent: p };
  });
  return { items };
}

/** theme_chart_json 우선, 없으면 theme 기반 자동 생성 */
function buildChart(product: Product): TravelOverviewModel["chart"] | undefined {
  const custom = product.theme_chart_json?.items;
  if (Array.isArray(custom) && custom.length >= 2) {
    const items = custom
      .filter((i) => i?.label?.trim() && typeof i.percent === "number")
      .map((i) => ({ label: String(i.label).trim(), percent: Number(i.percent) }));
    if (items.length >= 2) return { items };
  }
  return buildChartFromTheme(product);
}

/**
 * Product → TravelOverviewModel (순수 함수)
 * 어떤 Product를 넣어도 크래시 없이 모델 생성. 데이터 부족 시 해당 UI만 숨김.
 */
export function mapProductToOverview(product: Product): TravelOverviewModel {
  if (!product || typeof product !== "object") {
    return {
      title: DEFAULT_TITLE,
      cards: [
        { iconKey: "etc", label: "안내", value: CONSULT_PLACEHOLDER },
      ],
      coverImageUrl: null,
    };
  }

  const scheduleRaw = product.detailed_schedule ?? product.itinerary ?? "";
  const timelineDays = parseTimelineDays(scheduleRaw);
  const cards = buildCards(product, timelineDays.length);

  const coverImageUrl = product.image_url?.trim() || null;

  const chart = buildChart(product);

  const timeline =
    timelineDays.length > 0
      ? { days: timelineDays }
      : undefined;

  return {
    title: DEFAULT_TITLE,
    cards,
    coverImageUrl,
    ...(chart && { chart }),
    ...(timeline && { timeline }),
  };
}

/**
 * TravelOverviewModel → ProductOverview (기존 TravelOverviewV2 호환)
 * 상세/미리보기에서 ProductOverview를 받는 컴포넌트에 전달할 때 사용.
 */
export function toProductOverview(model: TravelOverviewModel): ProductOverview {
  const hasCards = model.cards.length > 0;
  const hasTimeline = (model.timeline?.days?.length ?? 0) > 0;

  const summaryCards = hasCards
    ? model.cards.map((c) => ({
        kind: (CARD_ICONS[c.iconKey] ?? "etc") as OverviewSummaryCardKind,
        label: c.label,
        value: c.value,
      }))
    : hasTimeline
      ? [{ kind: "etc" as OverviewSummaryCardKind, label: "일정", value: `${model.timeline!.days.length}일` }]
      : [];

  return {
    enabled: summaryCards.length > 0 || hasTimeline,
    title: model.title,
    summaryCards,
    coverImageUrl: model.coverImageUrl ?? undefined,
    chart:
      model.chart && model.chart.items.length > 0
        ? { enabled: true, items: model.chart.items }
        : undefined,
    timeline:
      model.timeline && model.timeline.days.length > 0
        ? {
            enabled: true,
            days: model.timeline.days.map((d) => ({
              day: d.day,
              headline: d.headline,
              bullets: d.bullets,
            })),
          }
        : undefined,
  };
}
