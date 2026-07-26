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
    /** "조건"이라는 표현이 의심을 유발할 수 있어 즉시 확인 가능하다는 긍정적 프레이밍으로 서술 */
    footnote: "신규 가입 회원 대상 · 지급 즉시 마이페이지에서 바로 확인할 수 있어요.",
  },
  /** 추천 상품 레일 헤딩 — 가치 증거(정가→회원가)와 브라우징을 한 섹션으로 병합.
   *  홈페이지 CMS 설정(home_golf_tour_section_*)과 분리된 이 랜딩 전용 고정 문구. */
  products: {
    eyebrowFallback: "",
    titleFallback: "3만 포인트, 이만큼 아껴요",
    descriptionFallback: "정가에서 3만 포인트 즉시 차감된 회원가로, 지금 바로 확인해보세요.",
  },
  faq: {
    sectionTitle: "자주 묻는 질문",
    items: [
      {
        question: "가입비나 별도 비용이 드나요?",
        answer:
          "아니요. 카카오 간편가입은 완전히 무료이며, 가입 즉시 3만 포인트가 지급됩니다. 별도로 결제하실 금액은 없습니다.",
      },
      {
        question: "3만 포인트는 언제 지급되나요?",
        answer:
          "카카오 간편가입이 완료되면 3만 포인트(30,000P)가 자동으로 지급됩니다. 마이페이지 > 포인트에서 확인하실 수 있습니다. 쿠폰이 아닌 포인트이며, 예약·상담 시 사용할 수 있습니다.",
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
    /** "지금"(긴급성) → "가입하고"(행동) → "3만 포인트 받기"(혜택) 순으로 배치 */
    label: "지금 가입하고 3만 포인트 받기",
  },
} as const;
