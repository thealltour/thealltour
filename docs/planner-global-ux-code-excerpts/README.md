# 여행플래너 전역 노출 UX — 코드 발췌

> 저장일: 2026-09-08  
> 목적: 여행플래너 전역 노출 UX PR 설계용 — 관련 원본 파일 **전체** 복사본  
> 원본 수정 없음. 이 폴더는 문서용 스냅샷입니다.

원본 경로 구조를 `src/...` 그대로 유지합니다.

## 1. HOME

| 발췌 파일 | 원본 경로 |
|-----------|-----------|
| `src/app/page.tsx` | `src/app/page.tsx` |
| `src/components/home/HeroSection.tsx` | `src/components/home/HeroSection.tsx` |
| `src/components/home/HomeHeroSearch.tsx` | `src/components/home/HomeHeroSearch.tsx` |
| `src/components/home/HeroRecommendedLinks.tsx` | `src/components/home/HeroRecommendedLinks.tsx` |
| `src/components/home/HomeQuickKeywords.tsx` | `src/components/home/HomeQuickKeywords.tsx` |
| `src/components/home/HomeQuickAction.tsx` | `src/components/home/HomeQuickAction.tsx` |
| `src/components/home/HeroPanoramaSlideshowClient.tsx` | `src/components/home/HeroPanoramaSlideshowClient.tsx` |
| `src/lib/homeHeroQuickActions.ts` | `src/lib/homeHeroQuickActions.ts` |
| `src/types/homeHeroContent.ts` | `src/types/homeHeroContent.ts` |

모바일 Quick Action 「자유여행 만들기」 → `/planner` (`getHomeHeroQuickActions`, flag on).

## 2. DESTINATIONS

| 발췌 파일 | 원본 경로 |
|-----------|-----------|
| `src/app/destinations/page.tsx` | `src/app/destinations/page.tsx` |
| `src/components/landing/LandingHero.tsx` | `src/components/landing/LandingHero.tsx` |
| `src/components/landing/HeroVisual.tsx` | `src/components/landing/HeroVisual.tsx` |
| `src/components/landing/LandingConsultCtaButton.tsx` | `src/components/landing/LandingConsultCtaButton.tsx` |
| `src/lib/landingMetadata.ts` | `src/lib/landingMetadata.ts` |

허브 Hero 문구/CTA는 `getHubHeroConfig("destinations")`.

## 3. THEMES

| 발췌 파일 | 원본 경로 |
|-----------|-----------|
| `src/app/themes/page.tsx` | `src/app/themes/page.tsx` |

`LandingHero` + `getHubHeroConfig("themes")` — destinations와 동일 공통 Hero.

## 4. HEADER / NAVIGATION

| 발췌 파일 | 원본 경로 |
|-----------|-----------|
| `src/components/site-chrome/SiteHeader.tsx` | `src/components/site-chrome/SiteHeader.tsx` |
| `src/components/site-chrome/SiteHeaderUI.tsx` | `src/components/site-chrome/SiteHeaderUI.tsx` |
| `src/lib/headerNavigation.ts` | `src/lib/headerNavigation.ts` |
| `src/components/header/headerNav.constants.ts` | `src/components/header/headerNav.constants.ts` |
| `src/components/header/headerNav.types.ts` | `src/components/header/headerNav.types.ts` |
| `src/components/header/MobileHeaderDrawer.tsx` | `src/components/header/MobileHeaderDrawer.tsx` |
| `src/components/header/MobileHeaderMenu.tsx` | `src/components/header/MobileHeaderMenu.tsx` |
| `src/components/header/MobileHeaderAccordion.tsx` | `src/components/header/MobileHeaderAccordion.tsx` |
| `src/components/header/DesktopMegaMenu.tsx` | `src/components/header/DesktopMegaMenu.tsx` |
| `src/components/header/DesktopMegaMenuPanel.tsx` | `src/components/header/DesktopMegaMenuPanel.tsx` |
| `src/components/header/DesktopNavItem.tsx` | `src/components/header/DesktopNavItem.tsx` |
| `src/components/header/HeaderMobileShell.tsx` | `src/components/header/HeaderMobileShell.tsx` |
| `src/components/header/UserMenuDropdown.tsx` | `src/components/header/UserMenuDropdown.tsx` |
| `src/components/header/GuestAuthHoverMenu.tsx` | `src/components/header/GuestAuthHoverMenu.tsx` |
| `src/lib/planner/memberAccountNav.ts` | `src/lib/planner/memberAccountNav.ts` |

## 5. PLANNER ENTRY / CTA

| 발췌 파일 | 원본 경로 |
|-----------|-----------|
| `src/config/featureFlags.ts` | `src/config/featureFlags.ts` |
| `src/lib/homeHeroQuickActions.ts` | (HOME과 동일) |
| `src/components/products/ProductPlannerCta.tsx` | `src/components/products/ProductPlannerCta.tsx` |
| `src/app/planner/page.tsx` | `src/app/planner/page.tsx` |
| `src/lib/planner/assertPlannerEnabled.ts` | `src/lib/planner/assertPlannerEnabled.ts` |
| `src/lib/planner/memberAccountNav.ts` | (HEADER와 동일) |

## 6. BUTTON / CARD / LAYOUT

| 발췌 파일 | 원본 경로 |
|-----------|-----------|
| `src/components/ui/Button.tsx` | `src/components/ui/Button.tsx` |
| `src/components/ui/Card.tsx` | `src/components/ui/Card.tsx` |
| `src/components/layout/PageContainer.tsx` | `src/components/layout/PageContainer.tsx` |
| `src/components/layout/SectionHeader.tsx` | `src/components/layout/SectionHeader.tsx` |

## 7. RESPONSIVE CSS

| 발췌 파일 | 원본 경로 |
|-----------|-----------|
| `src/app/globals.css` | `src/app/globals.css` |

Hero 관련: `--hero-*`, `.hero-scrim`, `.hero-mobile-atmosphere`, `.hero-overlay-warm`, `.hero-vignette*`, `.page-hero`.  
레이아웃 breakpoint는 각 컴포넌트 Tailwind class (`sm`/`md`/`lg`/`xl`) 참고.

## 8. PLANNER DRAFT PREFILL

| 발췌 파일 | 원본 경로 |
|-----------|-----------|
| `src/components/planner/PlannerWizard.tsx` | `src/components/planner/PlannerWizard.tsx` |

URL prefill은 `sourceProductId`만 사용. `destination` / `origin` / `interests` 쿼리 prefill 없음.

## 9. ANALYTICS

| 발췌 파일 | 원본 경로 |
|-----------|-----------|
| `src/lib/analytics/trackHomeEvents.ts` | `src/lib/analytics/trackHomeEvents.ts` |
| `src/lib/analytics/trackPlannerEvents.ts` | `src/lib/analytics/trackPlannerEvents.ts` |
| `src/lib/analytics/events.ts` | `src/lib/analytics/events.ts` |

주요 이벤트: `home_quick_action_click`, `planner_landing_view`, `planner_started`, `mobile_menu_click`, `mega_menu_click`.

## 10. TESTS

| 발췌 파일 | 원본 경로 |
|-----------|-----------|
| `src/lib/planner/__tests__/plannerPr1.test.ts` | `src/lib/planner/__tests__/plannerPr1.test.ts` |
| `src/components/products/__tests__/ProductPlannerCta.test.tsx` | `src/components/products/__tests__/ProductPlannerCta.test.tsx` |
| `src/lib/planner/__tests__/plannerPr5.test.ts` | `src/lib/planner/__tests__/plannerPr5.test.ts` |

## 참고

- 헤드라인 「세상 모든 여행을 더 쉽게」 문자열은 repo에 없음. 히어로 카피는 DB `getHeroContent` / `DEFAULT_HERO_CONTENT`.
- `ENABLE_FREE_TRAVEL_PLANNER` (`featureFlags.ts`)가 홈 Quick Action·상품 CTA·멤버 메뉴 노출을 제어.
