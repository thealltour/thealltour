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
      "카카오 간편가입하고 3만 포인트(30,000P) 즉시 받으세요. 가입비 없이 1초, 골프투어 예약·상담에 바로 사용하는 포인트입니다.",
  },
  hero: {
    imageUrl: "/images/landings/kakao-sync-golf-hero.png",
    imageAlt: "더올투어 프리미엄 골프투어",
    title: "더올투어 프리미엄 골프투어",
    subtitle: "카카오 간편가입하고\n3만 포인트 받기",
  },
  benefit: {
    title: "가입 즉시 드리는 혜택",
    /** 광고·심사 대조용 핵심 혜택명 (쿠폰 아님) */
    amountLabel: "3만 포인트",
    amountSubLabel: "30,000P 즉시 지급",
    /** 첫 스크롤에서 신뢰를 주는 3가지 핵심 팩트 — 금액·조건 언급 없음 */
    highlights: ["가입비 무료", "1초 완료", "즉시 지급"],
    segments: [
      { type: "text", value: "카카오 간편가입 시 " },
      { type: "highlight", value: "3만 포인트(30,000P) 지급" },
      {
        type: "text",
        value: "\n더올투어 골프투어 예약·상담에 바로 사용할 수 있는 포인트입니다.",
      },
    ] satisfies KakaoSyncBenefitSegment[],
    footnote: "신규 가입 회원 대상. 자세한 조건은 마이페이지에서 확인하세요.",
  },
  products: {
    eyebrowFallback: "GOLF TOURS",
    titleFallback: "추천 골프투어",
    descriptionFallback: "인기 골프·파크골프 여행을 만나보세요.",
  },
  timeline: {
    sectionTitle: "3만 포인트, 이렇게 받고 사용해요",
    sectionDescription: "복잡한 절차 없이 딱 3단계, 가입비도 조건도 없습니다.",
    steps: [
      {
        title: "카카오 1초 간편가입",
        description:
          "별도 회원가입 없이 카카오 계정으로 바로 가입 완료. 이름과 연락처만 자동으로 연동됩니다.",
      },
      {
        title: "3만 포인트 즉시 적립",
        description:
          "가입이 완료되는 순간 3만 포인트(30,000P)가 마이페이지에 자동으로 지급됩니다.",
      },
      {
        title: "원하는 골프투어에 바로 사용",
        description:
          "상담 신청 시 포인트를 바로 차감해 드립니다. 추가 조건이나 부담스러운 절차는 없습니다.",
      },
    ] satisfies KakaoSyncTimelineStep[],
  },
  faq: {
    sectionTitle: "자주 묻는 질문",
    items: [
      {
        question: "3만 포인트는 언제 지급되나요?",
        answer:
          "카카오 간편가입이 완료되면 3만 포인트(30,000P)가 자동으로 지급됩니다. 마이페이지 > 포인트에서 확인하실 수 있습니다. 쿠폰이 아닌 포인트이며, 예약·상담 시 사용할 수 있습니다.",
      },
      {
        question: "가입비나 별도 비용이 드나요?",
        answer:
          "아니요. 카카오 간편가입은 완전히 무료이며, 가입 즉시 3만 포인트가 지급됩니다. 별도로 결제하실 금액은 없습니다.",
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
    label: "3만 포인트 받고 1초 간편가입",
  },
} as const;
