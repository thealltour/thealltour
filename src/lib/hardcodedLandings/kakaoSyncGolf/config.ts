export type KakaoSyncFaqItem = {
  question: string;
  answer: string;
};

/** 히어로 메인 타이틀 세그먼트 — 핵심 수치에 포인트 색을 주기 위함 */
export type KakaoSyncHeroTitleSegment =
  | { type: "text"; value: string }
  | { type: "accent"; value: string };

/** 예약 인원수별 할인 티어 — 총무(리더) 1인이 가입하면 팀 전체 인원수에 비례해 혜택이 커진다는 프레이밍용. */
export type KakaoSyncDiscountTier = {
  headcountLabel: string;
  amountLabel: string;
  /** "4인 1팀" 등 가장 유리한 티어를 강조 표시 */
  best?: boolean;
  /** best 행에 표시할 뱃지. 미지정 시 "BEST" */
  badgeLabel?: string;
  /** 8인 등 보조 강조 행 */
  emphasize?: boolean;
};

export type KakaoSyncTrustReview = {
  name: string;
  persona: string;
  quote: string;
  tags: string[];
};

export const KAKAO_SYNC_GOLF_LANDING_ID = "kakao-sync-golf";

/** 카카오싱크 가입 혜택 포인트 금액(원) — 혜택 문구·상품 정가 표시에 공통 사용
 *  실제 지급 수단은 쿠폰팩/즉시 할인이며, 유입 카피에서는 "1인당 5만원 · 무제한"으로 프레이밍한다. */
export const KAKAO_SYNC_COIN_BENEFIT_WON = 50_000;

/** 상품 카드 팀(4인) 총할인 프레이밍 */
export const KAKAO_SYNC_TEAM_PAX = 4;
export const KAKAO_SYNC_TEAM_DISCOUNT_WON = KAKAO_SYNC_COIN_BENEFIT_WON * KAKAO_SYNC_TEAM_PAX;

/** 히어로 타이틀 수치 강조색 — 카카오 시그니처 옐로우 */
export const KAKAO_SYNC_HERO_ACCENT = "#FFE812";

export const kakaoSyncGolfConfig = {
  seo: {
    title: "카카오 간편가입 | 더올투어 골프투어",
    description:
      "1인당 5만원, 팀 전체 무제한 할인! 동반자 가입 없이 대표 1명만 카카오 간편가입하면 예약 인원 전체에 즉시 할인이 적용됩니다.",
  },
  hero: {
    imageUrl: "/images/landings/kakao-sync-golf-hero.png",
    imageAlt: "더올투어 프리미엄 골프투어",
    /** 상단 태그 — 신규회원 전용 (혜택 먼저) */
    eyebrow: "더올투어 신규회원 전용 혜택",
    /**
     * 메인 타이틀 — Cap(최대 20만) 제거, 무제한 프레이밍.
     */
    titleSegments: [
      { type: "accent", value: "1인당 5만 원" },
      { type: "text", value: ", 팀 전체 " },
      { type: "accent", value: "무제한 할인" },
      { type: "text", value: "!" },
    ] satisfies KakaoSyncHeroTitleSegment[],
    /** 스크린리더·메타용 plain title (titleSegments와 동일 의미) */
    title: "1인당 5만 원, 팀 전체 무제한 할인!",
    /** 총무 편의성 어필 — 1~2인에게도 "대표 1명"으로 부담 없이 읽힘 */
    subtitle: "동반자 가입 없이, 대표 1명 가입으로 전체 할인 자동 적용",
    socialProofSuffix: "명이 5만원 무제한 할인 쿠폰을 받아갔어요",
  },
  benefit: {
    /** 광고·심사 대조용 핵심 혜택명 — 쿠폰 그래픽 바로 아래 초소형 fine print로만 노출(중복 방지) */
    amountLabel: "5만원 쿠폰팩",
    amountSubLabel: "1인당 · 팀 전체 무제한",
    /** 1·2·4·8인 모두 자기 혜택으로 읽히도록 티어 노출. BEST는 4인(1팀). */
    tiersTitle: "예약 인원수만큼, 할인이 커져요",
    tiers: [
      { headcountLabel: "1인 예약 시", amountLabel: "5만원 즉시 할인" },
      { headcountLabel: "2인 예약 시", amountLabel: "10만원 즉시 할인" },
      {
        headcountLabel: "4인(1팀) 예약 시",
        amountLabel: "총 20만원 즉시 할인",
        best: true,
        badgeLabel: "BEST",
      },
      {
        headcountLabel: "8인(2팀) 예약 시",
        amountLabel: "총 40만 원 할인",
        emphasize: true,
        badgeLabel: "무제한 적용!",
      },
    ] satisfies KakaoSyncDiscountTier[],
    /** 동반자도 각자 가입해야 하는 것 아니냐는 의심 해소 — 대표/총무 1인 가입으로 충분 */
    tiersNote: "대표 1명 계정으로 예약 인원 전체 할인이 자동 적용됩니다.",
    /** 자격 안내 + 지급 프로세스를 한 줄로 압축 — 티어 박스 아래 초소형 fine print */
    eligibilityNote: "신규 가입 회원 대상 · 가입 즉시 쿠폰 자동 발급",
  },
  /** 추천 상품 레일 헤딩 — 팀 총할인 가치 증거 */
  products: {
    eyebrowFallback: "🏷️ 4인 기준 팀 총할인 적용 예시",
    titleFallback: "4인 예약 시 총 20만 원 즉시 차감!",
    descriptionFallback: "정가(4인)에서 쿠폰 총액을 뺀 적용가를 바로 확인해보세요.",
  },
  trust: {
    badgesSectionTitle: "🛡️ 더올투어 안심 보장 약속",
    reviewsHeading: "💬 더올투어 이용 고객들의 생생한 한 줄 후기",
    badges: ["현지 직영 가이드", "노쇼핑·노옵션 원칙", "정식 관광사업등록업체"],
    reviews: [
      {
        name: "김O훈",
        persona: "50대 · 모임 총무",
        quote: "동반자 가입 없이 내 계정 하나로 20만 원 할인받았습니다",
        tags: ["4인 20만 원 할인", "동반자 가입 불필요"],
      },
      {
        name: "박O숙",
        persona: "60대 · 부부 골퍼",
        quote: "2명이서 가도 10만 원 즉시 할인되네요",
        tags: ["2인 10만 원 할인", "1초 간편가입"],
      },
      {
        name: "이O철",
        persona: "50대 · 동호회 회장",
        quote: "8명 2팀 예약에 40만 원 할인! 노쇼핑이라 더 만족합니다",
        tags: ["8인 40만 원 할인", "노쇼핑·노옵션"],
      },
    ] satisfies KakaoSyncTrustReview[],
  },
  faq: {
    sectionTitle: "자주 묻는 질문",
    items: [
      {
        question: "가입비나 별도 비용이 드나요?",
        answer:
          "아니요. 카카오 간편가입은 완전히 무료이며, 가입 즉시 1인당 5만원 할인 쿠폰팩이 지급됩니다. 별도로 결제하실 금액은 없습니다.",
      },
      {
        question: "5만원 쿠폰팩은 언제, 어떻게 지급되나요?",
        answer:
          "카카오 간편가입이 완료되면 가입 즉시 자동 로그인되고, 할인 쿠폰팩이 곧바로 지급됩니다. 마이페이지에서 바로 확인하실 수 있고, 예약·상담 결제 시 즉시 할인으로 차감해서 사용합니다.",
      },
      {
        question: "1인만 가도 할인이 되나요? 인원수에 따라 달라지나요?",
        answer:
          "네. 1인이면 5만원, 2인이면 10만원, 4인(1팀)이면 20만원, 8인(2팀)이면 40만원처럼 인원수×5만원이 무제한으로 적용됩니다. 동반자 별도 가입 없이 대표 1명만 가입하시면 됩니다.",
      },
      {
        question: "골프투어 상품에만 할인 가능한가요?",
        answer:
          "네. 이 웰컴쿠폰(5만원 쿠폰팩)은 골프투어 상품 전용 혜택으로, 맞춤 골프투어·골프 패키지 상품 모두에 적용됩니다. 골프투어 외 다른 여행 상품에는 적용되지 않습니다.",
      },
      {
        question: "동반자분들도 각자 가입해야 하나요?",
        answer:
          "아니요. 동반자분들은 별도로 가입하실 필요가 없습니다. 예약을 진행하는 대표(총무)님 계정 하나만 카카오 간편가입하시면, 예약 인원 전체에 대한 할인이 자동으로 적용됩니다.",
      },
      {
        question: "비회원도 상담을 받을 수 있나요?",
        answer:
          "가입 후 상담 신청이 더 빠르지만, 카카오 채널을 통한 문의도 가능합니다. 간편가입 후 이용을 권장드립니다.",
      },
    ] satisfies KakaoSyncFaqItem[],
  },
  cta: {
    label: "💬 1인 5만원 무제한 할인 쿠폰 받기",
  },
} as const;
