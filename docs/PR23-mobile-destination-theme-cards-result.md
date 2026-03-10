# PR23 – 모바일 지역/테마 카드 높이 축소 및 레이아웃 최적화 (완료)

## 1. 수정된 파일 목록

| 파일 | 변경 요약 |
|------|------------|
| `src/components/home/HomeTaxonomyGrid.tsx` | 카드 이미지 비율 16:9(모바일)/4:3(태블릿+), 텍스트 이미지 아래로 이동, `layout: "grid" \| "horizontal-scroll"` 추가, 가로 스크롤 시 `min-w-[72%]`/`sm:min-w-[260px]`, 그리드 시 `grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4`, 설명 `line-clamp-1`(모바일)/`md:line-clamp-2` |
| `src/components/home/DestinationSection.tsx` | `HomeTaxonomyGrid`에 `layout="horizontal-scroll"` 전달, 섹션 `space-y-4 sm:space-y-6` 적용 |
| `src/components/home/ThemeSection.tsx` | 섹션 `space-y-4 sm:space-y-6` 적용 (그리드는 Grid 기본값 사용) |

---

## 2. 모바일 카드 Before/After 설명

### Before
- **이미지:** `aspect-[16/10]`, 이미지 위 그라데이션 오버레이 + 하단에 제목만 흰색 텍스트.
- **텍스트:** 이미지 아래 영역에 설명(line-clamp-2) + "자세히 보기".
- **지역:** 1열 그리드(`grid-cols-1`) → 세로로 길게 나열.
- **테마:** 1열 → 2열(sm) → 4열(lg).

### After
- **이미지:** `aspect-[16/9]`(모바일), `md:aspect-[4/3]`(태블릿 이상). 오버레이·이미지 위 텍스트 제거.
- **텍스트:** 이미지 바로 아래 `px-3 pt-2 pb-3` 영역에 제목(h3, text-sm font-semibold) + 설명(line-clamp-1 모바일 / md:line-clamp-2) + "자세히 보기".
- **지역:** 가로 스크롤(`flex overflow-x-auto`), 카드 `min-w-[72%]`(모바일)·`sm:min-w-[260px]`, `scrollbar-hide` 적용.
- **테마:** 모바일 2열(`grid-cols-2 gap-3`) → sm 3열 → lg 4열.

---

## 3. 카드 이미지 aspect ratio 변경 방식

- **방식:** Tailwind `aspect-*` 사용.
- **모바일:** `aspect-[16/9]` (세로 길이 축소).
- **태블릿 이상:** `md:aspect-[4/3]` (기존보다 낮은 비율 유지).
- **구현:** `HomeTaxonomyGrid` 내 카드 이미지 래퍼를  
  `className="relative aspect-[16/9] w-full shrink-0 overflow-hidden bg-[var(--surface-muted)] md:aspect-[4/3]"` 로 통일.  
  이미지 위 오버레이·텍스트용 div 제거하여 비율만으로 높이 제어.

---

## 4. 지역 가로 스크롤 구현 방식

- **레이아웃:** `HomeTaxonomyGrid`에 `layout="horizontal-scroll"` 전달 시 컨테이너를 `ul` 기준으로 `flex gap-4 overflow-x-auto pb-2 scrollbar-hide` 적용.  
  필요 시 가로 패딩 확보를 위해 `-mx-1 px-1 sm:mx-0 sm:px-0` 사용.
- **카드 너비:** 각 `li`에 `min-w-[72%] sm:min-w-[260px] shrink-0` 적용해 모바일에서 화면의 약 72% 너비, sm 이상에서 260px 고정.
- **스크롤바:** `globals.css`에 정의된 `scrollbar-hide` 클래스로 가로 스크롤바 숨김.
- **연결:** `DestinationSection`에서 `<HomeTaxonomyGrid ... layout="horizontal-scroll" />`로 호출.

---

## 5. 테마 grid 반응형 구조 설명

- **기본:** `layout` 미지정 또는 `"grid"`일 때 `HomeTaxonomyGrid`는 그리드 레이아웃 사용.
- **클래스:** `grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4`.
- **동작:**
  - **모바일(~640px):** 2열, gap 12px. 한 화면에 더 많은 테마 노출.
  - **sm(640px~1024px):** 3열.
  - **lg(1024px~):** 4열.
- **테마 섹션:** `ThemeSection`은 `layout`을 넘기지 않아 기본 `"grid"`가 적용되며, 위 반응형 그리드를 그대로 사용.

---

## 6. 완료 기준 체크

| 기준 | 상태 |
|------|------|
| 모바일 지역 카드 가로 스크롤 | ✅ |
| 모바일 테마 카드 2열 그리드 | ✅ |
| 카드 이미지 aspect 16:9 (모바일) | ✅ |
| 텍스트 이미지 아래, 설명 1줄(모바일) | ✅ |
| 스크롤 길이 감소·정보 밀도·탐색 UX 개선 | ✅ |
| 섹션 간격 모바일에서 조정 (space-y-4) | ✅ |

---

## 7. 참고 사항

- **product_line:** `HomeTaxonomyGrid`의 `type="product_line"` 사용처는 현재 홈에 없음. 있다면 기본 `layout="grid"`로 동일한 카드 스타일·반응형 그리드 적용.
- **접근성:** 가로 스크롤 영역은 `aria-label="지역별 탐색"` 유지. 터치 스크롤·포커스 순서는 기존 링크 구조로 유지.
