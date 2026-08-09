export type KakaoSyncFaqItem = {
  question: string;
  answer: string;
};

export type KakaoSyncBenefitSegment =
  | { type: "text"; value: string }
  | { type: "highlight"; value: string };

/** 히어로 메인 타이틀 세그먼트 — 핵심 수치에 포인트 색을 주기 위함 */
export type KakaoSyncHeroTitleSegment =
  | { type: "text"; value: string }
  | { type: "accent"; value: string };

/** 예약 인원수별 할인 티어 — 총무(리더) 1인이 가입하면 팀 전체 인원수에 비례해 혜택이 커진다는 프레이밍용.
 *  ⚠️ 카피 상의 목표 금액이며, 실제 결제 시 인원수에 비례해 자동으로 더 큰 금액이 차감되는 백엔드 로직은
 *  아직 구현되어 있지 않다(2026-08 기준). 상세는 kakaoSyncGolf 랜딩 작업 내역 참고. */
export type KakaoSyncDiscountTier = {
  headcountLabel: string;
  amountLabel: string;
  /** "4인 1팀" 등 가장 유리한 티어를 강조 표시 */
  best?: boolean;
  /** best 행에 표시할 뱃지. 미지정 시 "BEST" */
  badgeLabel?: string;
};

export const KAKAO_SYNC_GOLF_LANDING_ID = "kakao-sync-golf";

/** 카카오싱크 가입 혜택 포인트 금액(원) — 혜택 문구·상품 정가 표시에 공통 사용
 *  실제 지급 수단은 포인트(마이페이지에서 확인·차감)이지만, 유입 카피에서는
 *  "적립해서 나중에 쓴다"는 인상을 피하기 위해 "5만원 쿠폰팩/즉시 할인"으로 프레이밍한다. */
export const KAKAO_SYNC_COIN_BENEFIT_WON = 50_000;

/** 히어로 타이틀 수치 강조색 — 카카오 시그니처 옐로우 */
export const KAKAO_SYNC_HERO_ACCENT = "#FFE812";

export const kakaoSyncGolfConfig = {
  seo: {
    title: "카카오 간편가입 | 더올투어 골프투어",
    description:
      "1인당 5만원, 팀 전체 최대 20만원 할인! 동반자 가입 없이 대표 1명만 카카오 간편가입하면 예약 인원 전체에 즉시 할인이 적용됩니다.",
  },
  hero: {
    imageUrl: "/images/landings/kakao-sync-golf-hero.png",
    imageAlt: "더올투어 프리미엄 골프투어",
    /** 상단 태그 — 신규회원 전용 (혜택 먼저) */
    eyebrow: "더올투어 신규회원 전용 혜택",
    /**
     * 메인 타이틀 — 옵션 A 직관형.
     * Hierarchy: 핵심 혜택(1인당 5만~최대 20만) → 서브에서 총무 편의 → 뱃지에서 사회적 증거
     */
    titleSegments: [
      { type: "accent", value: "1인당 5만 원" },
      { type: "text", value: ", 팀 전체 " },
      { type: "accent", value: "최대 20만 원" },
      { type: "text", value: " 할인!" },
    ] satisfies KakaoSyncHeroTitleSegment[],
    /** 스크린리더·메타용 plain title (titleSegments와 동일 의미) */
    title: "1인당 5만 원, 팀 전체 최대 20만 원 할인!",
    /** 총무 편의성 어필 — 1~2인에게도 "대표 1명"으로 부담 없이 읽힘 */
    subtitle: "동반자 가입 없이, 대표 1명 가입으로 전체 할인 자동 적용",
  },
  benefit: {
    title: "가입 즉시 드리는 혜택",
    /** 광고·심사 대조용 핵심 혜택명 */
    amountLabel: "5만원 쿠폰팩",
    amountSubLabel: "1인당 · 최대 20만원",
    /** 첫 스크롤에서 신뢰를 주는 3가지 핵심 팩트 — 금액·조건 언급 없음 */
    highlights: ["가입비 무료", "1초 완료", "즉시 발급"],
    segments: [
      { type: "text", value: "카카오 간편가입 시 " },
      { type: "highlight", value: "1인당 5만원 · 팀 최대 20만원 할인" },
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
    /** 1·2·4인 모두 자기 혜택으로 읽히도록 티어 노출. BEST는 4인(1팀). */
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
    ] satisfies KakaoSyncDiscountTier[],
    /** 동반자도 각자 가입해야 하는 것 아니냐는 의심 해소 — 대표/총무 1인 가입으로 충분 */
    tiersNote:
      "동반자분들은 별도 가입하실 필요 없습니다. 대표 1명 계정으로 예약 인원 전체 할인이 자동 적용됩니다.",
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
        question: "1인만 가도 할인이 되나요? 인원수에 따라 달라지나요?",
        answer:
          "네. 1인이면 5만원, 2인이면 10만원, 4인(1팀)이면 최대 20만원까지 인원수에 따라 할인됩니다. 동반자 별도 가입 없이 대표 1명만 가입하시면 됩니다.",
      },
      {
        question: "골프투어 상품에만 할인 가능한가요?",
        answer: "맞춤 골프투어, 패키지 상품 모두 적용해드리고 있습니다.",
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
    /** 옵션 A 최종 CTA — 1인·커플·4인 총무 모두가 자기 혜택으로 인지하도록 구성.
     *  375px에서는 leading-snug로 최대 2줄까지 자연스럽게 감싼다. */
    label: "💬 1인당 5만원 (최대 20만) 쿠폰팩 받기",
  },
} as const;
