# PR22 – 모바일 홈 최상단 Hero 이미지 제거 + 검색 중심 Hero 개편 (완료)

## 1. 수정 파일 목록

| 파일 | 변경 요약 |
|------|------------|
| `src/app/page.tsx` | Hero에 `heroChipDestinations`, `heroChipThemes` 전달; `getDestinationLandingHref`/`getThemeLandingHref`로 href 계산; main 상단 패딩 `pt-4 pb-6`(모바일), 섹션 간격 `gap-12`(모바일) |
| `src/components/home/HeroSection.tsx` | 모바일 Hero 이미지 카드 제거; 데스크탑만 배경 이미지+오버레이; 모바일 전용 인기 여행지/추천 테마 칩 블록 추가; `HeroChipItem` 타입 및 props 추가; 모바일 py·간격 축소 |
| `src/components/home/HomeHeroSearch.tsx` | `hideRecentSearchesOnMobile`, `variant="hero-mobile"` 추가; 모바일에서 최근 검색어 칩 블록 `hidden md:flex` 처리; hero-mobile 시 full width·rounded-2xl 스타일 |
| (참고) `src/components/search/SearchSuggestionsDropdown.tsx` | 변경 없음. 기존 `z-50`, `top-[calc(100%+0.5rem)]`, `rounded-2xl`, `shadow-[var(--shadow-modal)]` 유지 |
| (참고) `src/app/globals.css` | 변경 없음. hero-scrim / hero-vignette 등 클래스 정의는 데스크탑·다른 페이지용으로 유지 |

---

## 2. 모바일 홈 Hero Before/After 구조 요약

### Before
- **모바일:** 상단에 Hero 이미지 카드(비율 16/11) + 이미지 하단 오버레이(`image-overlay-bottom`) + “THEALL CURATION” / 배너 제목 텍스트 → 그 아래 브랜드 뱃지, 메인 카피, 서브 카피, 검색창, **최근 검색어** 칩, “또는 지역별·테마별·추천여행” 텍스트 링크.
- **데스크탑:** 전체 배경 이미지 + hero-scrim / hero-overlay-warm / hero-vignette → 동일한 텍스트·검색·최근 검색어·추천 링크.

### After
- **모바일:**
  - Hero **이미지 블록 없음** (배경 이미지·이미지 오버레이·모바일 카드 모두 미렌더).
  - 구조: (선택) 브랜드 뱃지 → 메인 카피 → 서브 카피 → **검색창(핵심 액션)** → **인기 여행지 칩** → **추천 테마 칩**.
  - **최근 검색어** 칩 블록은 모바일에서 **미노출** (`hideRecentSearchesOnMobile` + `hidden md:flex`).
  - 포커스 시 2자 미만이면 기존처럼 `HeaderSearchDropdown`(최근+추천) 표시; 2자 이상이면 `SearchSuggestionsDropdown` 유지.
- **데스크탑:**
  - 기존과 동일: 배경 이미지 + hero-scrim / hero-overlay-warm / hero-vignette, 동일한 문구·검색·**최근 검색어** 칩·“또는 지역별·테마별·추천여행” 텍스트. 칩 그룹(인기 여행지/추천 테마)은 모바일 전용(`md:hidden`)으로만 렌더.

---

## 3. 최근 검색어 처리 방식 설명

- **제거/후순위:** 모바일 홈 **최상단**에서는 “최근 검색어” 칩 블록을 **완전 비노출** 처리했습니다. (1안: 모바일 Hero에서 최근 검색어 블록 제거.)
- **조건:** `HomeHeroSearch`에 `hideRecentSearchesOnMobile={true}` 전달 시, 해당 블록에 `hidden md:flex`를 적용해 **md 미만 뷰포트에서만 숨김**.
- **localStorage:** `hero_recent_searches` 키와 저장/불러오기·검색 시 저장 로직은 **그대로 유지**합니다. 드로어 검색·데스크탑 Hero에서는 계속 사용 가능하며, 추후 “보조 영역”으로 다시 노출할 수 있습니다.
- **죽은 UI 방지:** 모바일에서 해당 블록이 렌더되지 않으므로 불필요한 여백은 없음.

---

## 4. 데스크탑 영향 범위 설명

- **유지된 것:** 데스크탑 Hero는 기존과 동일하게 **배경 이미지 + 모든 오버레이 클래스**(hero-scrim, hero-overlay-warm, hero-vignette, hero-vignette-soft) 사용. 문구, 검색창, 최근 검색어 칩, “또는 지역별·테마별·추천여행” 링크 모두 유지.
- **추가된 것:** `HeroSection`에 `heroChipDestinations` / `heroChipThemes` props가 추가되었으나, 해당 칩 영역은 `md:hidden`으로 **모바일만** 노출. 데스크탑 레이아웃/시각에는 영향 없음.
- **공용 데이터:** `page.tsx`에서 이미 사용 중인 `destinationsForHome` / `themesForHome`을 slice(0,6)하여 칩용으로 넘기며, 링크는 기존 `getDestinationLandingHref` / `getThemeLandingHref`로 생성. 데스크탑 다른 섹션(Destination/Theme)과 동일한 데이터 소스.

---

## 5. 추가로 후속 PR로 분리하면 좋은 작업 제안

1. **인기 여행지/추천 테마 데이터 관리자 연동**  
   현재는 홈 지역/테마 설정(`parseHomeRegionCardIds` / `parseHomeThemeCardIds`)과 동일한 목록 상위 6개를 사용. 관리자에서 “Hero 전용 칩 순서/노출”을 따로 두고 싶다면 API·설정 필드 추가 후 HeroSection에 전달하는 PR 분리.

2. **홈 Hero A/B 테스트**  
   모바일 “검색 중심 Hero” vs “이미지+검색 혼합” 등 변형을 노출 비율로 테스트할 수 있도록 루트/헤더 또는 HeroSection에서 variant 분기 + 분석 이벤트 연동.

3. **상담 CTA 삽입**  
   모바일 Hero 하단(칩 아래) 또는 검색·칩 사이에 “맞춤 상담 요청” 버튼/링크를 넣어 전환 강화. 기존 `HeroQuickConsultButton`·상담 모달과 통합 가능.

4. **접근성·키보드**  
   칩 그룹에 “인기 여행지”, “추천 테마” 등으로 `aria-label` 보강 및 키보드 포커스 순서 점검(현재 링크라 탭 순서는 유지됨).

---

## 6. 완료 기준 체크

| 기준 | 상태 |
|------|------|
| 모바일 홈 최상단에서 큰 Hero 이미지 제거 | ✅ |
| 첫 화면에서 텍스트 카피 + 검색창 + 추천 칩 즉시 노출 | ✅ |
| 최근 검색어 모바일 최상단 핵심 UI에서 제거 | ✅ |
| 인기 여행지 / 추천 테마가 검색 바로 아래 탐색 액션으로 노출 | ✅ |
| 자동완성 검색 UX 유지 | ✅ |
| 모바일 헤더와 시각적 충돌 없음 | ✅ (상단 pt·py 조정) |
| 다음 섹션(DESTINATIONS)과 연결 자연스러움 | ✅ (gap-12, pb 조정) |
| 데스크탑 기존 구조 최대한 보존 | ✅ |
