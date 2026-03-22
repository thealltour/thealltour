/**
 * 지역/테마 랜딩 slug별 SEO·OG 카피 (주요 slug만).
 * getRegionSeoData / getThemeSeoData 에서 DB 값 다음 우선순위로 병합.
 */

/** DB·매핑에서 온 제목에 `| 더올투어`가 없으면 붙임. */
export function ensureLandingDocumentTitle(segmentOrFull: string): string {
  const s = segmentOrFull.trim();
  if (!s) return "더올투어";
  if (/\|\s*더올투어\s*$/i.test(s)) return s;
  return `${s} | 더올투어`;
}

export type LandingSeoCopy = {
  /** `<title>` / OG 메타용 전체 문구 (보통 `… | 더올투어` 포함) */
  title?: string;
  description?: string;
  /** OG 이미지 카드 메인 짧은 제목 */
  ogTitle?: string;
  /** OG 이미지 카드 보조 한 줄 */
  ogSubtitle?: string;
};

export const regionSeoCopy: Record<string, LandingSeoCopy> = {
  jeju: {
    title: "제주 골프투어 | 더올투어",
    description: "제주에서 즐기는 맞춤형 골프·테마 여행 상품을 한눈에 확인해보세요.",
    ogTitle: "제주",
    ogSubtitle: "맞춤형 골프·테마 여행",
  },
  japan: {
    title: "일본 골프투어 | 더올투어",
    description: "가까우면서도 만족도 높은 일본 맞춤 골프여행 상품을 만나보세요.",
    ogTitle: "일본",
    ogSubtitle: "가까운 프리미엄 골프여행",
  },
  vietnam: {
    title: "베트남 골프투어 | 더올투어",
    description: "베트남에서 즐기는 합리적이고 만족도 높은 맞춤형 골프여행 상품을 확인해보세요.",
    ogTitle: "베트남",
    ogSubtitle: "합리적인 맞춤 골프여행",
  },
  thailand: {
    title: "태국 골프투어 | 더올투어",
    description: "태국 인기 골프여행 상품과 맞춤 일정을 더올투어에서 확인해보세요.",
    ogTitle: "태국",
    ogSubtitle: "인기 골프여행 맞춤 제안",
  },
  china: {
    title: "중국 골프투어 | 더올투어",
    description: "중국 지역 골프·테마 여행 상품을 목적과 일정에 맞게 살펴보세요.",
    ogTitle: "중국",
    ogSubtitle: "목적에 맞는 맞춤 여행",
  },
  bali: {
    title: "발리 골프투어 | 더올투어",
    description: "휴양과 라운딩을 함께 즐길 수 있는 발리 맞춤 골프여행 상품을 만나보세요.",
    ogTitle: "발리",
    ogSubtitle: "휴양과 골프를 함께",
  },
  danang: {
    title: "다낭 골프투어 | 더올투어",
    description: "인기 높은 다낭 골프여행 상품을 일정과 예산에 맞게 확인해보세요.",
    ogTitle: "다낭",
    ogSubtitle: "인기 높은 맞춤 골프여행",
  },
  nhatrang: {
    title: "나트랑 골프투어 | 더올투어",
    description: "휴양과 골프를 함께 즐기기 좋은 나트랑 맞춤 여행 상품을 살펴보세요.",
    ogTitle: "나트랑",
    ogSubtitle: "휴양형 맞춤 골프여행",
  },
  "phu-quoc": {
    title: "푸꾸옥 여행 | 더올투어",
    description: "여유로운 휴양과 테마여행을 함께 즐길 수 있는 푸꾸옥 맞춤 상품을 만나보세요.",
    ogTitle: "푸꾸옥",
    ogSubtitle: "여유로운 휴양·테마 여행",
  },
  hokkaido: {
    title: "홋카이도 골프여행 | 더올투어",
    description: "자연과 함께 즐기는 홋카이도 맞춤 골프여행 상품을 확인해보세요.",
    ogTitle: "홋카이도",
    ogSubtitle: "자연과 함께하는 골프여행",
  },
  osaka: {
    title: "오사카 골프여행 | 더올투어",
    description: "접근성 좋은 오사카 맞춤 골프여행 상품을 더올투어에서 만나보세요.",
    ogTitle: "오사카",
    ogSubtitle: "접근성 좋은 골프여행",
  },
  kyushu: {
    title: "규슈 골프여행 | 더올투어",
    description: "온천과 라운딩을 함께 즐길 수 있는 규슈 맞춤 골프여행 상품을 확인해보세요.",
    ogTitle: "규슈",
    ogSubtitle: "온천과 골프를 함께",
  },
};

export const themeSeoCopy: Record<string, LandingSeoCopy> = {
  golf: {
    title: "골프투어 | 더올투어",
    description: "해외·국내 맞춤형 골프여행 상품을 일정과 취향에 맞게 살펴보세요.",
    ogTitle: "골프투어",
    ogSubtitle: "해외·국내 맞춤 골프여행",
  },
  family: {
    title: "가족여행 | 더올투어",
    description: "가족과 함께하기 좋은 맞춤형 여행 상품을 더올투어에서 만나보세요.",
    ogTitle: "가족여행",
    ogSubtitle: "함께 떠나는 맞춤 여행",
  },
  filial: {
    title: "효도여행 | 더올투어",
    description: "부모님과 함께하는 편안한 맞춤형 효도여행 상품을 확인해보세요.",
    ogTitle: "효도여행",
    ogSubtitle: "부모님과 함께하는 맞춤 여행",
  },
  theme: {
    title: "테마여행 | 더올투어",
    description: "취향과 목적에 맞는 다양한 테마여행 상품을 한눈에 살펴보세요.",
    ogTitle: "테마여행",
    ogSubtitle: "취향에 맞는 여행 제안",
  },
  relax: {
    title: "휴양여행 | 더올투어",
    description: "편안한 휴식과 여유를 즐길 수 있는 맞춤형 휴양여행 상품을 만나보세요.",
    ogTitle: "휴양여행",
    ogSubtitle: "편안한 휴식과 여유",
  },
  couple: {
    title: "커플여행 | 더올투어",
    description: "둘만의 시간을 더 특별하게 만드는 맞춤형 커플여행 상품을 확인해보세요.",
    ogTitle: "커플여행",
    ogSubtitle: "둘만의 특별한 여행",
  },
  premium: {
    title: "프리미엄 여행 | 더올투어",
    description: "숙소, 일정, 이동까지 더 세심하게 준비한 프리미엄 맞춤 여행 상품을 만나보세요.",
    ogTitle: "프리미엄 여행",
    ogSubtitle: "더 세심한 맞춤 여행",
  },
  group: {
    title: "단체여행 | 더올투어",
    description: "일정과 목적에 맞춰 준비하는 맞춤형 단체여행 상품을 살펴보세요.",
    ogTitle: "단체여행",
    ogSubtitle: "목적에 맞춘 맞춤 일정",
  },
};
