# 프론트엔드 리팩터링 로드맵

단계별로 작은 PR로 진행합니다.

## 1단계 — 관리자 콘솔 공통화 ✅ (진행됨)

- [x] `AdminRouteProviders`: `/admin`·`/theall_manager_only` 레이아웃 중복 제거
- [x] `adminConsolePaths`: URL 정규화로 메뉴 활성·권한 판별 통일
- [x] `/admin/*` 경로도 사이드바 stem과 매칭되도록 `canAccessPath` 보강
- [x] `/login` 공개 경로 화이트리스트 (`isAdminConsolePublicPath`)
- [x] `docs/admin-route-map.md` 라우트 표

**다음 (1단계 확장, 선택)**

- [ ] `app/admin/(console)/...` + `app/theall_manager_only` thin re-export로 페이지 소스 단일화
- [ ] 미들웨어에서 prefix 하나만 외부 노출 검토

## 2단계 — `components` 도메인 정리 ✅ (1차 완료)

- [x] 루트 `components/*.tsx` 실구현을 기능 폴더로 이동 (`header/`, `site-chrome/`, `product-detail/`, `inquiry/`, `auth/`, `pdf/`, `guides/`, `reviews/` 보강)
- [x] 기존 `@/components/Foo` 경로 유지용 루트 **re-export 스텁**
- [x] `docs/components-structure.md` 네이밍·폴더 안내

**2차(선택)** ✅

- [x] `@/components/<domain>/...` 직접 import로 통일 (`scripts/fix-component-imports.mjs` 참고)
- [x] 루트 re-export 스텁 제거

## 3단계 — 상품 상세 레거시 ✅ (1차 완료)

- [x] `ProductDetailContentLegacy` / `ProductDetailTabsLegacy` / `ProductDetailHero` / `ProductDetailSticky`(구 스티키) 제거 — 본 페이지는 `ProductDetailV2` + `ProductDetailStickyV2`만 사용
- [x] 미사용 `ScheduleTimelineV2`(구 시각화) 및 `mapProductToTimelineModel` 내 `TimelineViewModel` 레거시 어댑터 제거 — 일정 UI는 `InteractiveTimelineV2` + `TimelineModel` 경로

## 4단계 — 횡단 규칙

- [ ] 아이콘: `lucide` vs `@/icons` 사용 기준 + ESLint(가능 시)
- [ ] 서버 전용 데이터: `server-only` / `lib/server/*` 구분 문서
- [ ] 디자인 토큰: 신규 컴포넌트는 CSS 변수 우선

---

*최종 수정: 로드맵 1단계 초기 구현 시점*
