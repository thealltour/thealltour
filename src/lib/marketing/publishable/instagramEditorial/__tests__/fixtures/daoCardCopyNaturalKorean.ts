/**
 * Dao package qualitative fixtures for Card Copy Natural Korean Consumer Voice.
 * Old surface = production cardPlan/card-copy (problematic AI-editorial cluster).
 * Naturalized fixture = instructional expected direction (not live LLM output).
 * Not a blacklist — used only for qualitative contract assertions.
 */

export const DAO_CARD_COPY_OLD_PROBLEM_PHRASES = [
  "여행의 리듬",
  "휴양 프레임",
  "생활문화 기록",
  "결이 다른",
  "핵심 증거",
  "생활 리듬",
  "문화적 맥락",
  "읽어내",
] as const;

/** Production Dao card-copy (2026-09-18 package) — old surface. */
export const DAO_CARD_COPY_OLD_SURFACE = {
  source: "cmc_daily_marketing_production_2026_09_18_e0/context/instagram-card-copy.json",
  cards: [
    {
      cardId: "card-01",
      headline: "다낭·푸꾸옥의 해변을 떠올렸다면",
      body: "우리가 아는 베트남은 주로 찬란한 해변과 리조트, 대도시의 풍경입니다. 하지만 시선을 완전히 다른 곳으로 돌리면 전혀 다른 베트남이 펼쳐집니다.",
    },
    {
      cardId: "card-02",
      headline: "북쪽 국경으로 향하는 순간",
      body: "남쪽과 중부의 휴양 프레임에서 벗어나 북부 국경 산악 지대로 올라가면 지형과 여행의 리듬 자체가 완전히 달라집니다.",
    },
    {
      cardId: "card-03",
      headline: "랑선 북부 국경의 Dao족 마을",
      body: "랑선을 비롯한 북부 국경 산악 지대에는 해변 도시의 풍경과는 결이 다른 Dao족의 고유한 생활문화 기록이 깊게 자리 잡고 있습니다.",
    },
    {
      cardId: "card-04",
      headline: "전통 판축 가옥 nhà trình tường",
      body: "이 지역의 삶을 보여주는 핵심 증거는 흙을 단단히 다져 쌓아 올린 전통 건축 양식인 'nhà trình tường' 흙다짐 주택입니다. 산악 지형의 기후와 환경에 맞춘 독특한 주거 형태를 보여줍니다.",
    },
    {
      cardId: "card-05",
      headline: "휴양 프레임 밖에서 읽는 생활 리듬",
      body: "익숙한 해변과 대도시를 넘어 북부 국경의 건축과 생활문화를 마주할 때, 하나의 나라 안에서 전혀 다른 여행 경험과 문화적 맥락을 읽어내게 됩니다.",
    },
  ],
} as const;

/**
 * Manual naturalized sample — same semantic beats, consumer Korean.
 * Instructional expected direction for qualitative tests (not a live regen artifact).
 */
export const DAO_CARD_COPY_NATURALIZED_FIXTURE = {
  cards: [
    {
      cardId: "card-01",
      headline: "다낭·푸꾸옥의 해변을 떠올렸다면",
      body: "익숙한 베트남 이미지는 해변과 리조트, 큰 도시입니다. 시선을 북쪽으로 옮기면 전혀 다른 풍경이 나옵니다.",
    },
    {
      cardId: "card-02",
      headline: "북쪽 국경으로 가면 풍경부터 달라집니다",
      body: "남쪽·중부의 해변 휴양 코스와 달리, 북부 국경 산악으로 올라가면 지형과 분위기부터 바뀝니다.",
    },
    {
      cardId: "card-03",
      headline: "랑선 북부 국경의 Dao족 마을",
      body: "랑선을 비롯한 북부 국경 산악 지대에는 Dao족이 이어온 전통 주거와 생활 모습이 남아 있습니다. 해변 도시의 풍경과 많이 다릅니다.",
    },
    {
      cardId: "card-04",
      headline: "전통 흙다짐 가옥 nhà trình tường",
      body: "그 차이를 잘 보여주는 것은 흙을 다져 쌓아 올린 nhà trình tường입니다. 산악 기후에 맞춰 지어진 주거 형태를 확인할 수 있습니다.",
    },
    {
      cardId: "card-05",
      headline: "해변 밖에서 만나는 또 다른 베트남",
      body: "익숙한 해변과 도시를 지나 북부 국경의 건축과 생활을 보면, 같은 나라 안에서도 전혀 다른 여행을 만날 수 있습니다.",
    },
  ],
} as const;

export function countProblemPhraseHits(surface: {
  cards: readonly { headline: string; body: string }[];
}): number {
  const text = surface.cards.map((c) => `${c.headline}\n${c.body}`).join("\n");
  return DAO_CARD_COPY_OLD_PROBLEM_PHRASES.reduce(
    (n, phrase) => n + (text.includes(phrase) ? 1 : 0),
    0,
  );
}

/** Soft cluster score — how many abstraction-family tokens appear (diagnostic only). */
export function scoreAbstractionCluster(surface: {
  cards: readonly { headline: string; body: string }[];
}): number {
  const families = [
    "프레임",
    "리듬",
    "맥락",
    "면모",
    "단서",
    "읽어내",
    "생활문화",
    "핵심 증거",
    "결이",
  ];
  const text = surface.cards.map((c) => `${c.headline}\n${c.body}`).join("\n");
  return families.reduce((n, t) => n + (text.includes(t) ? 1 : 0), 0);
}
