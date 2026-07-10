export type KakaoSyncTimelineStep = {
  title: string;
  description: string;
};

export type KakaoSyncFaqItem = {
  question: string;
  answer: string;
};

export type KakaoSyncBenefitSegment =
  | { type: "text"; value: string }
  | { type: "highlight"; value: string };

export const KAKAO_SYNC_GOLF_LANDING_ID = "kakao-sync-golf";

/** 카카오싱크 가입 혜택 포인트 금액(원) — 혜택 문구·상품 정가 표시에 공통 사용 */
export const KAKAO_SYNC_COIN_BENEFIT_WON = 30_000;

export const kakaoSyncGolfConfig = {
  seo: {
    title: "카카오 간편가입 | 더올투어 골프투어",
    description:
      "카카오 간편가입하고 30,000포인트 혜택 받으세요. 하이난·사이판 시그니처 골프투어와 10만 원 예약제로 편하게 시작하세요.",
  },
  hero: {
    imageUrl: "/images/landings/kakao-sync-golf-hero.png",
    imageAlt: "더올투어 프리미엄 골프투어",
    title: "더올투어 프리미엄 골프투어",
    subtitle: "카카오 간편가입하고\n지금 바로 혜택 받기",
  },
  benefit: {
    title: "가입 즉시 드리는 혜택",
    segments: [
      { type: "text", value: "카카오 간편가입 시 " },
      { type: "highlight", value: "30,000포인트 지급" },
      { type: "text", value: "\n더올투어 골프투어 예약·상담에 바로 사용할 수 있습니다." },
    ] satisfies KakaoSyncBenefitSegment[],
    footnote: "신규 가입 회원 대상. 자세한 조건은 마이페이지에서 확인하세요.",
  },
  products: {
    eyebrowFallback: "GOLF TOURS",
    titleFallback: "추천 골프투어",
    descriptionFallback: "인기 골프·파크골프 여행을 만나보세요.",
  },
  timeline: {
    sectionTitle: "10만 원 예약제, 이렇게 진행됩니다",
    sectionDescription: "복잡한 절차 없이 4단계로 원하는 명문 코스를 가장 먼저 선점하세요.",
    steps: [
      {
        title: "카카오 간편가입",
        description:
          "하단 버튼을 통해 단 1초 만에 안전하게 가입하고 30,000포인트를 즉시 확보합니다.",
      },
      {
        title: "10만 원 예약금 결제",
        description:
          "원하는 일정과 명문 코스 타임라인, 황금 좌석을 단 10만 원의 예약금만으로 가장 먼저 안전하게 선점(홀딩)합니다.",
      },
      {
        title: "1:1 전담 매니저 매칭 및 일정 확정",
        description:
          "결제 즉시 골프 전문 베테랑 매니저가 1:1로 배정되어 해피콜을 통해 고객님의 취향에 맞춘 디테일한 라운딩 일정과 항공, 숙소를 꼼꼼하게 조율하고 확정해 드립니다.",
      },
      {
        title: "잔금 결제 후 출발",
        description:
          "매니저와 상담 후 최종 확정된 일정에 따라 안심하고 잔금을 결제하시면 모든 여행 준비가 완료됩니다. 여행을 마치실 때마다 30,000포인트가 추가로 자동 적립됩니다.",
      },
    ] satisfies KakaoSyncTimelineStep[],
  },
  faq: {
    sectionTitle: "자주 묻는 질문",
    items: [
      {
        question: "30,000포인트는 언제 지급되나요?",
        answer:
          "카카오 간편가입이 완료되면 자동으로 지급됩니다. 마이페이지 > 포인트에서 확인하실 수 있습니다.",
      },
      {
        question: "10만 원 예약금은 환불이 가능한가요?",
        answer:
          "출발일 확정 전까지는 상담을 통해 환불 규정에 따라 처리해 드립니다. 자세한 내용은 상담 시 안내해 드립니다.",
      },
      {
        question: "골프투어 상품에만 포인트 할인 가능한가요?",
        answer: "맞춤 골프투어, 패키지 상품 모두 적용해드리고 있습니다.",
      },
      {
        question: "비회원도 상담을 받을 수 있나요?",
        answer:
          "가입 후 상담 신청이 더 빠르지만, 카카오 채널을 통한 문의도 가능합니다. 간편가입 후 이용을 권장드립니다.",
      },
    ] satisfies KakaoSyncFaqItem[],
  },
  cta: {
    label: "30,000포인트 받고 1초 간편가입",
  },
} as const;
