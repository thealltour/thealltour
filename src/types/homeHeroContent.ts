/** 홈 히어로 문구 설정 (관리자에서 편집, 단일 행) */
export type HomeHeroContent = {
  id: string;
  badge: string | null;
  main_copy_accent: string | null;
  main_copy_tail: string | null;
  sub_description: string | null;
  bullet_1: string | null;
  bullet_2: string | null;
  bullet_3: string | null;
  recommended_text: string | null;
  search_placeholder: string | null;
  created_at: string | null;
  updated_at: string | null;
};

export const DEFAULT_HERO_CONTENT: Omit<HomeHeroContent, "id" | "created_at" | "updated_at"> = {
  badge: "THEALL TOUR PREMIUM GOLF",
  main_copy_accent: "품격 있는",
  main_copy_tail: " 골프와 여행의 시작",
  sub_description:
    "전담 상담사가 1:1 맞춤 설계를 진행하여, 일정·동행 구성·예산에 맞는 골프&여행 코스를 함께 정리해 드립니다.",
  bullet_1: "전화·메신저로 편하게 상담 시작",
  bullet_2: "일정·항공·골프장까지 한 번에 비교 제안",
  bullet_3: "출발 전·후 안내까지 전담 상담사가 지속 케어",
  recommended_text: "또는 지역별 여행 · 테마별 여행 · 추천여행 으로 탐색",
  search_placeholder: "지역, 테마, 상품명을 검색해보세요 (예: 일본 골프, 남미 여행)",
};
