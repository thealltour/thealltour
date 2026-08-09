export type KakaoSyncFaqItem = {
  question: string;
  answer: string;
};

export type KakaoSyncBenefitSegment =
  | { type: "text"; value: string }
  | { type: "highlight"; value: string };

/** 예약 인원수별 할인 티어 — 총무(리더) 1인이 가입하면 팀 전체 인원수에 비례해 혜택이 커진다는 프레이밍용.
 *  ⚠️ 카피 상의 목표 금액이며, 실제 결제 시 인원수에 비례해 자동으로 더 큰 금액이 차감되는 백엔드 로직은
 *  아직 구현되어 있지 않다(2026-08 기준). 상세는 kakaoSyncGolf 랜딩 작업 내역 참고. */
export type KakaoSyncDiscountTier = {
  headcountLabel: string;
  amountLabel: string;
  /** "4인 1팀" 등 가장 유리한 티어를 강조 표시 */
  best?: boolean;
};

export const KAKAO_SYNC_GOLF_LANDING_ID = "kakao-sync-golf";

/** 카카오싱크 가입 혜택 포인트 금액(원) — 혜택 문구·상품 정가 표시에 공통 사용
 *  실제 지급 수단은 포인트(마이페이지에서 확인·차감)이지만, 유입 카피에서는
 *  "적립해서 나중에 쓴다"는 인상을 피하기 위해 "5만원 쿠폰팩/즉시 할인"으로 프레이밍한다. */
export const KAKAO_SYNC_COIN_BENEFIT_WON = 50_000;

export const kakaoSyncGolfConfig = {
  seo: {
    title: "카카오 간편가입 | 더올투어 골프투어",
    description:
      "총무님, 카카오 간편가입 1초면 4인 1팀 최대 20만원 할인! 동반자는 별도 가입 없이 총무님 계정 하나로 인원수 비례 할인이 적용됩니다.",
  },
  hero: {
    imageUrl: "/images/landings/kakao-sync-golf-hero.png",
    imageAlt: "더올투어 프리미엄 골프투어",
    title: "4인 1팀 예약 시 최대 20만원 할인",
    subtitle: "총무님, 1초 가입하고\n팀 전체 할인받으세요!",
  },
  benefit: {
    title: "가입 즉시 드리는 혜택",
    /** 광고·심사 대조용 핵심 혜택명 */
    amountLabel: "5만원 쿠폰팩",
    amountSubLabel: "즉시 할인 발급",
    /** 첫 스크롤에서 신뢰를 주는 3가지 핵심 팩트 — 금액·조건 언급 없음 */
    highlights: ["가입비 무료", "1초 완료", "즉시 발급"],
    segments: [
      { type: "text", value: "카카오 간편가입 시 " },
      { type: "highlight", value: "5만원 쿠폰팩 즉시 발급" },
      {
        type: "text",
        value: "\n더올투어 골프투어 예약·상담에 바로 쓸 수 있는 즉시 할인입니다.",
      },
    ] satisfies KakaoSyncBenefitSegment[],
    /** "조건"이라는 표현이 의심을 유발할 수 있어 긍정적 프레이밍으로 서술.
     *  짧은 자격 안내만 담당 — 지급 프로세스 설명은 trustFlow가 전담(중복 방지). */
    footnote: "신규 가입 회원 대상",
    /** 가입 버튼 바로 아래 안심 뱃지 — 전체 플로우를 한눈에 보여줘 "가입만 시키고 안 주는 것 아니냐"는
     *  의심을 해소. CTA 하위 보조 정보이므로 톤/크기를 낮춰 표시(트래킹 sectionName 영향 없음). */
    trustFlow: "⏱️ 1초 간편가입 → 마이페이지 5만P 즉시 지급 → 결제 시 바로 차감",
    /** 총무(리더) 타겟 — 해외골프 투어는 대부분 4인 1팀 예약, 예약 결정권자는 총무 1인이라는 인사이트 기반 티어 섹션.
     *  헤드카운트가 커질수록 할인 총액이 커진다는 프레이밍으로, 총무가 "내가 가입하면 팀 전체에 이득"이라고 느끼게 함. */
    tiersTitle: "예약 인원수만큼, 할인이 커져요",
    tiers: [
      { headcountLabel: "1인 예약 시", amountLabel: "5만원 즉시 할인" },
      { headcountLabel: "2인 예약 시", amountLabel: "10만원 즉시 할인" },
      { headcountLabel: "4인 1팀 예약 시", amountLabel: "총 20만원 즉시 할인", best: true },
    ] satisfies KakaoSyncDiscountTier[],
    /** 동반자도 각자 가입해야 하는 것 아니냐는 의심 해소 — 총무 1인 가입으로 충분함을 명확히 함 */
    tiersNote:
      "동반자분들은 별도 가입하실 필요 없습니다. 총무님 계정 하나로 예약 인원 전체 할인이 자동 적용됩니다.",
  },
  /** 추천 상품 레일 헤딩 — 가치 증거(정가→회원가)와 브라우징을 한 섹션으로 병합.
   *  홈페이지 CMS 설정(home_golf_tour_section_*)과 분리된 이 랜딩 전용 고정 문구. */
  products: {
    eyebrowFallback: "🎁 5만원 할인 쿠폰 적용 가능",
    titleFallback: "5만원 쿠폰팩, 이만큼 아껴요",
    descriptionFallback: "정가에서 5만원 즉시 차감된 회원가로, 지금 바로 확인해보세요.",
  },
  faq: {
    sectionTitle: "자주 묻는 질문",
    items: [
      {
        question: "가입비나 별도 비용이 드나요?",
        answer:
          "아니요. 카카오 간편가입은 완전히 무료이며, 가입 즉시 5만원 쿠폰팩(50,000P)이 지급됩니다. 별도로 결제하실 금액은 없습니다.",
      },
      {
        question: "5만원 쿠폰팩은 언제, 어떻게 지급되나요?",
        answer:
          "카카오 간편가입이 완료되면 가입 즉시 자동 로그인되고, 50,000P가 곧바로 지급됩니다. 마이페이지 > 포인트에서 바로 확인하실 수 있고, 예약·상담 결제 시 즉시 할인으로 차감해서 사용합니다.",
      },
      {
        question: "골프투어 상품에만 할인 가능한가요?",
        answer: "맞춤 골프투어, 패키지 상품 모두 적용해드리고 있습니다.",
      },
      {
        question: "동반자분들도 각자 가입해야 하나요?",
        answer:
          "아니요. 동반자분들은 별도로 가입하실 필요가 없습니다. 예약을 진행하는 총무님 계정 하나만 카카오 간편가입하시면, 예약 인원 전체에 대한 할인이 자동으로 적용됩니다.",
      },
      {
        question: "비회원도 상담을 받을 수 있나요?",
        answer:
          "가입 후 상담 신청이 더 빠르지만, 카카오 채널을 통한 문의도 가능합니다. 간편가입 후 이용을 권장드립니다.",
      },
    ] satisfies KakaoSyncFaqItem[],
  },
  cta: {
    /** 버튼 라벨은 375px 모바일에서 한 줄로 들어가야 하므로 "혜택 숫자(4인 20만원) + 행동(받기)" 핵심만
     *  남긴다. "카카오로 3초 만에" 등 부가 설명은 버튼 색(카카오 옐로우)과 히어로·안심뱃지가 이미
     *  전달하므로 라벨에서는 생략 — 자세한 배경은 kakao-sync-golf 랜딩 CTA 줄바꿈 수정 작업 내역 참고. */
    label: "💬 4인 20만원 쿠폰팩 받기",
  },
} as const;
