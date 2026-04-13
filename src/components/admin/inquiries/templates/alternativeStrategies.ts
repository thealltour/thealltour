import type { AlternativeStrategy } from "../inquiryResponseGuide.types";

export const ALTERNATIVE_STRATEGIES: AlternativeStrategy[] = [
  {
    type: "golf_custom",
    bullets: [
      "동일 지역 내 다른 리조트 제안",
      "인근 골프장으로 라운딩 구성 변경",
      "출발일 ±1~2일 조정 제안",
      "동일 일정 내 가격/컨디션 비교안 구성",
    ],
  },
  {
    type: "travel_quote",
    bullets: [
      "인접 지역·비슷한 테마 상품으로 대체안",
      "성수기 회피 일정으로 가격·좌석 여유 확보",
      "소그룹/단체 구성에 맞춘 차등 옵션",
    ],
  },
  {
    type: "product",
    bullets: [
      "동일 노선·유사 일정의 다른 상품 비교",
      "출발 요일 변경으로 요금 차이 설명",
      "마감 임박 시 다음 모객 일정 안내",
    ],
  },
  {
    type: "general",
    bullets: [
      "예산에 맞춘 단계별(필수/선택) 구성 제안",
      "일정만 먼저 잡고 세부는 후속 조율",
      "유사 문의 사례를 참고한 현실적인 대안",
    ],
  },
];
