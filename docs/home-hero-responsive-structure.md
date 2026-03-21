# 홈 히어로 반응형 구조 (코드 발췌)

홈 히어로가 모바일 / 태블릿 / 데스크톱에서 어떻게 분기되는지 파악하기 위한 문서입니다.  
Tailwind 기본 breakpoint: `sm` 640px, `md` 768px, `lg` 1024px, `xl` 1280px.

**갱신(tune hero-tablet):** `md`에서 한꺼번에 켜지던 “완성형 데스크톱” 요소를 **`lg`로 일부 이연**해, 태블릿(768–1023px)은 **압축형 히어로**로 동작합니다.

---

## 1. 관련 파일 목록

| 파일 | 역할 |
|------|------|
| `src/app/page.tsx` | `<HeroSection heroBanners={topBanners} hero={...} />` 호출, `main` 상단 spacing |
| `src/components/home/HeroSection.tsx` | 홈 히어로 레이아웃·반응형 분기 |
| `src/components/home/HomeHeroSearch.tsx` | 히어로 검색 폼·variant 스타일 |
| `src/components/home/HomeQuickKeywords.tsx` | 검색 아래 빠른 선택 허브 (`md` 미만만) |
| `src/components/home/HeroRecommendedLinks.tsx` | 데스크톱 추천 링크 문구 파싱(히어로에서 사용) |
| `src/app/globals.css` | `--hero-*` 토큰, `.hero-scrim`, `.heading-display-hero`, `.type-h1` 등 |

**참고:** `useMediaQuery` / `isMobile` 같은 JS 미디어 쿼리 훅은 히어로에 없음 — 전부 **Tailwind breakpoint + `hidden` / `lg:block` 등 클래스**로 분기합니다.

---

## 2. 구간별 요약 (현행)

| 구간 | 배너 이미지 | 제목 마크업 | 서브설명 | `HomeQuickKeywords` | 추천 링크 문단 | 2열 그리드 | 검색 폭·형태 |
|------|-------------|-------------|----------|---------------------|----------------|------------|--------------|
| **&lt; md** | 없음 | `MobileHeroHeadline` | 숨김 | 표시 | 숨김 | 1열 | full, 카드형 |
| **md ~ lg−1 (태블릿)** | 표시 (`md:block lg:hidden` 스택, `object-center`, **`mobile_image_url ?? image_url`**) | 데스크 인라인 (`md:inline`) | 표시(폭 압축) | 숨김 | 숨김 | 1열 | max 560px, 카드형 |
| **≥ lg** | 표시 (`hidden lg:block` 스택, `object-[right_center]`, **`image_url`**) | 동일 | `lg:max-w-xl` | 숨김 | 표시 | 2열 + 오른쪽 슬롯 | max 720px, pill |

제목 타이포: **md**에서 `2rem / 1.2`, **lg**에서 `2.5rem / 1.15` + `type-h1`.

---

## 3. `HeroSection.tsx` — 핵심 분기 (발췌 개념)

- 배지(eyebrow, `hero.badge` / 기본 THEALL TOUR): **`md:hidden`** — 모바일만 노출, 태블릿·데스크톱에서는 숨김.
- 타이틀·서브·검색 블록은 **`md:max-w-[560px] md:mx-auto`** 로 태블릿에서 가운데 정렬, 내부는 좌측 기준 일치; **`lg:max-w-[720px] lg:mx-0`** 로 데스크톱은 왼쪽 열 정렬 (`HomeHeroSearch` 폼은 `hero-mobile`에서 **`mx-0`**).
- 배너 래퍼·`hero-vignette-soft`: **`hidden md:block`** (태블릿·데스크톱). 배경은 **두 스택**(태블릿 `md:block lg:hidden` / 데스크 `hidden lg:block`)으로 겹치며 **동일 `active` 인덱스**로 fade 슬라이드. 이미지 **`object-center` / `object-[right_center]`** 로 태블릿·데스크 크롭 분리.
- 그리드: **`lg:grid-cols-[...] lg:items-center lg:gap-6`**
- 오른쪽 빈 칸: **`hidden lg:block`**
- 외곽 세로 여백: **`md:py-7 lg:py-10`**, 스택 **`md:space-y-4 lg:space-y-5`**
- 검색 래퍼: **`md:max-w-[560px] lg:max-w-[720px]`**, **`md:pt-2 lg:pt-3`**
- 추천 링크 문단: **`lg:block`**
- `h1`: **`md:text-[2rem] md:leading-[1.2] lg:type-h1 lg:text-[2.5rem] lg:leading-[1.15]`**
- 서브: **`max-w-[32rem] md:block ... lg:max-w-xl`**

---

## 4. `HomeHeroSearch.tsx` — `variant="hero-mobile"` (홈)

- 루트 spacing: **`space-y-1 md:space-y-1.5 lg:space-y-2`**
- 폼: **`max-w-full md:max-w-[560px] lg:max-w-[720px]`**
- 입력 줄: 카드형(`rounded-2xl` 등) 유지 → **`lg:rounded-full`** 및 **`lg:border-[var(--border)]` 등**으로 데스크톱 표면 전환
- 히어로 본문 아래 **인라인 최근 검색어 칩 없음** — 포커스 시 `HeaderSearchDropdown`에서만 최근/추천 노출.

---

## 5. `HomeQuickKeywords.tsx`

**`md:hidden`** → **768px 미만만** 빠른 선택 허브. 태블릿·데스크톱에서는 비노출(변경 없음).

---

## 6. Wrapper / spacing (`page.tsx` + HeroSection)

`page.tsx` `main` (발췌):

```tsx
<main className="flex w-full min-w-0 max-w-full flex-col pt-2 pb-6 sm:pt-0 sm:pb-10 md:pb-14">
```

`HeroSection` 내부: `PageContainer` 패딩은 기존과 동일(`px-3 sm:px-6 lg:px-8 xl:px-10`). 히어로 본문 세로 패딩은 위 표 참고.

---

## 7. 이미지 처리

- `next/image` `fill` + `absolute inset-0`
- **`hidden md:block`** 일 때 배너·오버레이 노출(모바일 제외)
- **다중 배너**: `heroBanners` 길이 0 → 배경 없음 / 1 → 단일 / 2+ → 5초 간격·700ms opacity fade (`prefers-reduced-motion` 시 첫 장만)
- 태블릿 스택: **`mobile_image_url`(trim 후 비어 있지 않을 때) 우선, 없으면 `image_url`**
- 데스크톱 스택: **`image_url`**
- 태블릿: **`object-center`**, lg+: **`object-[right_center]`** (좌측 카피·2열 레이아웃과 맞춤)
- LCP: **첫 슬라이드만** `priority` + `fetchPriority="high"`, 나머지 `loading="lazy"`

---

## 8. 태블릿 vs 데스크톱 판단 (요약)

- **태블릿(768–1023px):** 배너·스크림 동일 노출(이미지 중앙 크롭), 1열, 데스크 카피 구조 + 작은 제목, 서브만, 추천 링크 없음, 배지 없음, 검색 560px·카드형(검색 포커스 시에만 드롭다운으로 최근 검색).
- **데스크톱(1024px+):** 배너·2열·완성 타이포·추천 링크·720px pill 검색, 배지 없음(인라인 최근 검색 칩 없음; 포커스 시 드롭다운).

---

## 9. 문서 이력

- 초안: 홈 히어로 반응형 구조 코드 발췌.
- **tune(hero-tablet):** `md` 단일 전환 → **태블릿 압축형 + `lg` 완성형** 문서 반영.
- **태블릿 배너:** 배경 이미지 노출을 다시 **`md`~** 로 확대, `object-position` 태블릿/데스크톱 분리.
- **feat(home-hero):** `heroBanners` 다중 fade 슬라이드 + 태블릿·데스크 이미지 URL 분기 문서 반영.
- **tune(hero):** 태블릿·데스크에서 배지 숨김, 히어로 인라인 최근 검색어 칩 제거(드롭다운만 유지).
