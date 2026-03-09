# 메가메뉴 UX/UI 고도화 제안

헤더 메가메뉴(데스크톱)의 현재 구조와 적용된 개선, 추가 제안을 정리한 문서입니다.

---

## 현재 구조 요약

- **DesktopMegaMenu**: 1차 메뉴(추천여행, 지역별 여행, 테마별 여행 등) 렌더, 열림/닫힘 상태 관리
- **DesktopNavItem**: 각 항목. 링크 전용 또는 **링크 + 패널**(hover/포커스 시 드롭다운)
- **DesktopMegaMenuPanel**: 드롭다운 내용
  - **지역(region)**: 3단 캐스케이드(허브 링크 | 대분류 해외/국내 | 중분류·소분류)
  - **테마/추천**: 2열 그룹 그리드
- **headerNavigation.ts**: taxonomy·curated 기반 네비 데이터 빌드

---

## 이미 적용된 개선 (이번 수정)

### 1. 마우스 리브 시 닫힘 지연 (150ms)
- **목적**: 트리거 → 패널로 마우스를 옮길 때, 잠깐만 경계를 벗어나도 패널이 닫히지 않도록 함
- **구현**: `DesktopNavItem`에서 `onMouseLeave` 시 150ms 타이머로 `onClose` 호출. `onMouseEnter` 시 타이머 취소
- **효과**: 패널로 이동 시 닫힘 플리커 감소, 사용성이 좋아짐

### 2. 패널 등장 애니메이션
- **목적**: 패널이 갑자기 나타나지 않고 부드럽게 보이도록 함
- **구현**: `globals.css`에 `@keyframes mega-menu-panel-enter` (opacity 0→1, translateY -6px→0), 패널 루트에 `mega-menu-panel-enter` 클래스 (0.18s ease-out)
- **효과**: 메뉴 열림이 시각적으로 더 자연스러움

---

## 추가 고도화 제안 (우선순위별)

### 높음 — 바로 적용 권장

1. **테마 패널도 3단 캐스케이드로 통일**
   - 테마 taxonomy에 `parent_id` 계층이 있으면, 지역과 동일하게 “대분류 → 중분류 → 세부” 3단 캐스케이드로 표시
   - **이점**: 지역/테마 탐색 패턴 통일, 계층이 많을 때 스캔이 쉬움
   - **수정 위치**: `DesktopMegaMenuPanel`에서 `item.key === "theme"`이고 `subGroups`가 있으면 `RegionCascadePanel`과 유사한 `ThemeCascadePanel` 사용 (또는 공용 캐스케이드 컴포넌트로 통합)

2. **키보드 네비게이션 강화**
   - 패널 열린 상태에서 **화살표 키**(↑↓←→)로 포커스 이동, **Enter**로 선택, **Escape**로 닫기
   - **이점**: 키보드·스크린리더 사용자 접근성 및 전반적 UX 향상
   - **참고**: `role="menu"` / `role="menuitem"` 이미 사용 중이므로, 포커스 관리와 roving tabindex만 추가하면 됨

3. **긴 목록 스크롤 처리**
   - 중분류/소분류 항목이 많을 때 패널에 `max-height` + `overflow-y-auto` 적용
   - **이점**: 창이 작거나 항목이 많을 때 패널이 화면을 넘지 않음

### 중간 — 여유 있을 때

4. **“전체 보기” 등 허브 링크 강조**
   - “전체 보기”, “전체 상품 보기”를 상단 고정 영역이나 버튼 스타일로 조금 더 강조
   - **이점**: 진입점이 눈에 잘 들어옴

5. **패널 닫힐 때 fade-out (선택)**
   - 닫을 때도 짧은 fade-out 적용하면 닫힘이 더 부드러움
   - **구현**: 닫기 시 즉시 unmount 대신 “closing” 상태로 전환 → 애니메이션 종료 후 unmount (구현 복잡도는 중간)

6. **모바일 메뉴와의 일관성**
   - 모바일에서도 같은 네비 데이터(`primaryNav`)를 사용하는지 확인하고, 지역/테마 계층이 접이식 등으로 동일하게 드러나도록 정리
   - **이점**: 데스크톱·모바일 간 인지적 일관성

### 낮음 — 장기 개선

7. **인기/추천 배지**
   - 관리자에서 “헤더 클릭 수” 등 집계가 있다면, 인기 항목에 작은 “인기” 뱃지 표시
   - **이점**: 결정 장애 완화, 클릭 유도

8. **최근 방문/자주 가는 지역**
   - 로컬 스토리지 등으로 “최근 본 지역” 2~3개를 패널 상단에 노출 (선택)
   - **이점**: 재방문 시 빠른 접근

---

## 참고: 수정된 파일

- `src/components/header/DesktopNavItem.tsx` — 닫힘 지연 로직
- `src/components/header/DesktopMegaMenuPanel.tsx` — 패널 루트에 `mega-menu-panel-enter` 클래스
- `src/app/globals.css` — `mega-menu-panel-enter` 키프레임 및 클래스

데이터/타입은 기존 `headerNavigation.ts`, `headerNav.types.ts` 그대로 사용 가능합니다.
