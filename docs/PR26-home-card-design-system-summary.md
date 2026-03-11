# PR26 – 홈 카드 디자인 시스템 통합 요약

## 1. 수정 파일 목록

| 파일 | 변경 내용 |
|------|-----------|
| `src/lib/cardTokens.ts` | 홈 카드 공통 토큰 추가 (CARD_BASE_HOME, CARD_PADDING_HOME, CARD_IMAGE_ASPECT_HOME, CARD_TITLE_HOME, CARD_META_HOME, CARD_BADGE_HOME) |
| `src/components/home/HomeTaxonomyGrid.tsx` | 지역/테마 카드에 공용 토큰 적용 (카드 wrapper, 이미지 비율, 본문 패딩, 제목, 메타) |
| `src/components/home/CuratedProductCard.tsx` | 지역 카드 톤으로 정리 – 동일 토큰 사용, 이미지 비율·오버레이·타이포·배지 통일 |

---

## 2. 지역 카드 기준 공통 규칙 요약

지역별 카드 섹션(HomeTaxonomyGrid)을 기준으로 아래 규칙을 추출해 `cardTokens.ts`에 반영했습니다.

| 항목 | 규칙 |
|------|------|
| **카드 라운드** | 모바일 `rounded-xl`, sm 이상 `rounded-2xl` |
| **카드 border / shadow** | `border-[var(--border)]`, `shadow-[var(--shadow-soft)]`, hover 시 `border-strong`, `shadow-soft-strong` |
| **이미지 비율** | `aspect-[16/9]`(모바일), `md:aspect-[4/3]`(데스크탑), `object-cover`, hover `scale-[1.02]` |
| **이미지 오버레이** | 없음 (정보 위주, 장식 최소화) |
| **본문 패딩** | `px-3 pt-2 pb-3`(모바일), `sm:p-4`(데스크탑) |
| **제목** | `font-card-title`, `text-sm`, `font-semibold`, `leading-tight`, `text-[var(--foreground)]` |
| **보조 텍스트** | `text-xs` / `md:type-caption`, `text-[var(--text-muted)]`, `line-clamp-1` |
| **hover / transition** | `transition-all duration-200 ease-out`, border·shadow 강조 |

테마 카드는 동일한 HomeTaxonomyGrid를 사용하므로, 지역 카드와 같은 규칙을 그대로 따릅니다.

---

## 3. 추천상품 카드에서 바뀐 점

| 항목 | 변경 전 | 변경 후 |
|------|--------|--------|
| **라운드** | `CARD_BASE`(rounded-2xl 고정) | `CARD_BASE_HOME`(rounded-xl / sm:rounded-2xl, 지역 카드와 동일) |
| **패딩** | `p-3 sm:p-4` | `CARD_PADDING_HOME`(px-3 pt-2 pb-3 sm:p-4, 지역과 동일) |
| **이미지** | 고정 높이 `h-32 sm:h-36` + 하단 그라데이션 + `overlay-radial-blue-subtle` | `CARD_IMAGE_ASPECT_HOME`(16:9 / 4:3) + 오버레이 제거 + hover `scale-[1.02]`만 유지 |
| **텍스트 위계** | 제목 type-small, 별도 메타 스타일 | `CARD_TITLE_HOME`(text-sm, semibold, leading-tight), 보조는 `CARD_META_HOME` |
| **배지** | section-label, px-2.5 py-1, text-[10px] 등 혼합 | `CARD_BADGE_HOME`(rounded-full, surface-muted, ring-1, text-xs)로 통일 |
| **가격** | type-caption, font-price-strong | text-xs / md:type-caption, font-semibold, font-price-strong 유지(추천상품만 노출, 타이포 밸런스 유지) |

데이터/링크/analytics(trackProductCardClick, sectionTitle) 동작은 변경하지 않았습니다.

---

## 4. 테마 카드에서 바뀐 점

테마 카드는 **지역 카드와 동일한 HomeTaxonomyGrid**를 사용합니다.  
이번 PR에서 HomeTaxonomyGrid가 공용 토큰을 쓰도록 바꿨기 때문에, 테마 카드도 자동으로 아래와 같이 통일되었습니다.

- **카드 wrapper**: `CARD_BASE_HOME`
- **이미지**: `CARD_IMAGE_ASPECT_HOME`, `object-cover`, hover scale
- **본문**: `CARD_PADDING_HOME`
- **제목**: `CARD_TITLE_HOME`
- **보조 텍스트**: `CARD_META_HOME`

별도 ThemeCard 컴포넌트는 없으며, 레이아웃만 grid(테마) / horizontal-scroll(지역)로 다릅니다.

---

## 5. 공용 카드 토큰 정리 (cardTokens.ts)

기존 토큰(CARD_BASE, CARD_PADDING, CARD_HOVER 등)은 유지하고, **홈 카드 전용**으로 아래만 추가했습니다.

| 토큰 | 용도 |
|------|------|
| `CARD_BASE_HOME` | 홈 카드 wrapper (rounded-xl / sm:rounded-2xl, border, shadow) |
| `CARD_PADDING_HOME` | 본문 패딩 (px-3 pt-2 pb-3 sm:p-4) |
| `CARD_IMAGE_ASPECT_HOME` | 이미지 비율 (aspect-[16/9] md:aspect-[4/3]) |
| `CARD_TITLE_HOME` | 제목 (font-card-title, text-sm, semibold, leading-tight) |
| `CARD_META_HOME` | 보조 텍스트 (mt-0.5, line-clamp-1, text-xs, text-muted, md:type-caption) |
| `CARD_BADGE_HOME` | 배지/칩 (추천상품 등) – rounded-full, surface-muted, ring-1, text-xs |

반복되는 스타일만 토큰화했고, 기존 CARD_BASE / CARD_PADDING 등은 다른 페이지에서 그대로 사용됩니다.

---

## 6. 후속 PR 제안

- **홈 섹션 헤더 디자인 통일**: SectionHeader(eyebrow / title / description)를 지역·테마·추천상품에서 동일한 톤으로 정리.
- **카드 hover / interactions 표준화**: focus ring, 터치 영역, 스크롤 버튼 스타일을 홈 전역에서 통일.
- **상세/목록 페이지 카드 시스템 확장**: 상품 목록·랜딩 페이지 카드에 CARD_BASE_HOME 등 홈 토큰 적용 검토 또는 “목록용” 토큰 분리.

---

*기능/데이터/링크/analytics는 변경하지 않았으며, 모바일·데스크탑 모두에서 카드 시각만 통일했습니다.*
