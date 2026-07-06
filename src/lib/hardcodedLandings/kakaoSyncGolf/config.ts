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

/** 카카오싱크 가입 혜택 코인 금액(원) — 혜택 문구·상품 정가 표시에 공통 사용 */
export const KAKAO_SYNC_COIN_BENEFIT_WON = 30_000;

export const kakaoSyncGolfConfig = {
  seo: {
    title: "카카오 간편가입 | 더올투어 골프투어",
    description:
      "카카오 간편가입하고 30,000코인 혜택 받으세요. 하이난·사이판 시그니처 골프투어와 10만 원 예약제로 편하게 시작하세요.",
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
      { type: "highlight", value: "30,000코인 지급" },
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
    sectionDescription: "복잡한 절차 없이 4단계로 간편하게 예약하세요.",
    steps: [
      {
        title: "카카오 간편가입",
        description: "하단 버튼으로 30초 만에 회원가입을 완료합니다.",
      },
      {
        title: "10만 원 예약금 결제",
        description: "원하시는 골프투어 상품을 선택하고 예약금을 결제합니다.",
      },
      {
        title: "출발일·일정 확정",
        description: "전담 매니저가 출발일과 세부 일정을 안내해 드립니다.",
      },
      {
        title: "잔금 결제 후 출발",
        description: "잔금 안내에 따라 결제하시면 여행 준비가 완료됩니다.",
      },
    ] satisfies KakaoSyncTimelineStep[],
  },
  faq: {
    sectionTitle: "자주 묻는 질문",
    items: [
      {
        question: "30,000코인은 언제 지급되나요?",
        answer:
          "카카오 간편가입이 완료되면 자동으로 지급됩니다. 마이페이지 > 포인트에서 확인하실 수 있습니다.",
      },
      {
        question: "10만 원 예약금은 환불이 가능한가요?",
        answer:
          "출발일 확정 전까지는 상담을 통해 환불 규정에 따라 처리해 드립니다. 자세한 내용은 상담 시 안내해 드립니다.",
      },
      {
        question: "골프투어 상품에만 코인 할인 가능한가요?",
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
    label: "30,000코인 받고 1초 간편가입",
  },
} as const;
