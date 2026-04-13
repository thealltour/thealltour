import type { ProposalGuide } from "../inquiryResponseGuide.types";

export const PROPOSAL_GUIDES: ProposalGuide[] = [
  {
    type: "golf_custom",
    bullets: [
      "최소 2개 일정(예: 6/15, 6/22) 비교 제안",
      "원문 리조트/골프장 유지안 1개 포함",
      "가능 시 대체 골프장 포함 1개 추가",
      "항공 포함/불포함 옵션 구분 제시",
    ],
  },
  {
    type: "travel_quote",
    bullets: [
      "원문 조건(일정·인원·지역)을 그대로 반영한 기본안 1개",
      "일정 ±3일 또는 인원 조정 시 대안 1개",
      "예산 구간별(보수/중간/여유) 구성 차이를 한눈에 비교 가능하게",
    ],
  },
  {
    type: "product",
    bullets: [
      "문의 상품 기준 확정 일정안 + 대기 가능 시 다음 회차 안내",
      "옵션(항공·보험·현지 이동) 포함/미포함 구분",
      "취소·변경 규정 요약을 견적과 함께 첨부",
    ],
  },
  {
    type: "general",
    bullets: [
      "고객이 언급한 키워드(지역·테마)를 반영한 1차 안",
      "조건이 모호하면 선택지 2~3개로 좁혀 제시",
      "다음 액션(회신 기한·추가 확인 사항)을 명확히",
    ],
  },
];
