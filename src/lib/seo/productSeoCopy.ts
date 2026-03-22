/**
 * 상품군 단위 SEO/OG 카피 (slug·제목·태그 등에 키워드가 포함될 때 패턴 매칭).
 * 우선순위: DB meta → 이 매핑 → fallback (getProductSeoData).
 */

export type ProductSeoCopy = {
  description: string;
  ogSubtitle: string;
};

export const productSeoCopy = {
  bali: {
    description: "발리에서 즐기는 골프와 휴양을 함께하는 맞춤 여행 상품입니다.",
    ogSubtitle: "휴양과 골프를 함께",
  },
  danang: {
    description: "다낭에서 즐기는 인기 골프여행을 일정에 맞게 편하게 준비하세요.",
    ogSubtitle: "인기 골프여행 맞춤 제안",
  },
  japan: {
    description: "가깝고 만족도 높은 일본 골프여행을 맞춤 일정으로 준비해드립니다.",
    ogSubtitle: "가까운 프리미엄 골프여행",
  },
  jeju: {
    description: "제주에서 즐기는 편안한 국내 골프여행을 맞춤 일정으로 제안합니다.",
    ogSubtitle: "국내 프리미엄 골프여행",
  },
  filial: {
    description: "부모님과 함께하는 편안한 맞춤형 효도여행 상품입니다.",
    ogSubtitle: "부모님과 함께하는 여행",
  },
  family: {
    description: "가족과 함께 즐기기 좋은 맞춤형 여행 상품을 준비했습니다.",
    ogSubtitle: "가족과 함께하는 여행",
  },
  premium: {
    description: "숙소, 일정, 이동까지 세심하게 준비된 프리미엄 맞춤 여행입니다.",
    ogSubtitle: "더 세심한 맞춤 여행",
  },
} as const satisfies Record<string, ProductSeoCopy>;

export type ProductSeoCopyKey = keyof typeof productSeoCopy;
