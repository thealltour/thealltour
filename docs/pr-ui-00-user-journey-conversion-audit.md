# [PR-UI-00] User Journey / Conversion Architecture Audit

> **조사일:** 2026-08-26  
> **성격:** Read-only UX / Conversion Audit (앱 소스 수정 없음)  
> **목적:** 첫 방문 → 신뢰 → 탐색 → 가입 → 상품 선택 → 예약 → 결제 중심 UI PR(PR-UI-01~) 설계용 사실 조사

---

## A. 전체 Route Map

### 존재 여부 (요청 최소 목록)

| Route | 존재 | 역할 |
|-------|------|------|
| `/` | Yes | 홈 |
| `/products` | Yes | 전체 상품 목록(+필터/검색 q) |
| `/products/[id]` | Yes | 상품 상세(운영: ProductDetailV2) |
| `/products/region/[slug]` | Yes | 지역 허브 셸(Destinations와 유사) |
| `/products/theme/[slug]` | Yes | 테마 허브 셸 |
| `/products/region` | Yes | **`redirect("/products")`** |
| `/products/theme` | Yes | **`redirect("/products")`** |
| `/destinations` | Yes | 지역 허브 인덱스 |
| `/destinations/[slug]` | Yes | 지역 상세 랜딩 |
| `/themes` | Yes | 테마 허브 인덱스 |
| `/themes/[slug]` | Yes | 테마 상세 랜딩 |
| `/recommended` | Yes | 추천 허브 |
| `/recommended/[slug]` | Yes | 추천 CMS 랜딩 |
| `/search` | Yes | 검색 결과(별도 UX) |
| `/login` | Yes | Auth 모달 auto-open |
| `/signup` | Yes | Auth 모달 auto-open |
| `/quote` | Yes | 맞춤 견적 문의 |
| `/mypage/*` | Yes | 회원 영역 |
| `/deposit` | Yes | 상담 후 예약금 안내(`?inquiryId`) |
| `/cart` | **No** | — |
| `/checkout` | **No** | 상품상세 **모달**로 대체 |
| `/order` | **No** | — |
| `/booking` | **No** | `/mypage/bookings`만 |
| `/payment` | **No** | API `/api/payments/portone/*` |
| `/success` | **No** | 회원→mypage / 게스트→alert |
| `/auth/complete-profile` | Yes | 소셜 가입 후 프로필 |
| `/auth/link-account` | Yes | 계정 연결 |
| `/golf/kakao-sync` | Yes | 카카오싱크 골프 하드코딩 랜딩 |
| `/reviews`, `/guides`, `/blog`, `/about`, `/support`, `/terms`, `/privacy` | Yes | 콘텐츠·신뢰·지원 |

### Route 상세 예시

```text
[Route]
/products/[id]

[역할]
상품 상세 · 예약/결제(Sticky) · 상담(매진·일정 CTA)

[주요 진입 경로]
HomeProductCard / ProductCard / ProductListCard
검색(/search, /products?q=)
지역·테마·추천 허브 CuratedBlock
헤더 메가메뉴

[다음 이동]
예약하기 → ProductCheckoutModal → PortOne
카톡/상담 → ConsultModal 또는 외부 카카오
매진 → ProductConsultCTA
(consultHref=/quote 는 props로 전달되나 본문 CTA로 미사용)

[핵심 파일]
src/app/products/[id]/page.tsx
src/components/products/ProductDetailV2.tsx
src/components/products/ProductDetailStickyV2.tsx
src/components/products/ProductStickyCheckoutRail.tsx
src/components/products/ProductCheckoutModal.tsx
```

```text
[Route]
/search  vs  /products?q=

[역할]
둘 다 키워드 상품 탐색이나 UX·카드·필터가 다름

[주요 진입]
Hero HomeHeroSearch → /search?q=
Header HeaderProductSearch → /products?q=

[핵심 파일]
src/components/home/HomeHeroSearch.tsx (router.push `/search?q=`)
src/components/header/HeaderProductSearch.tsx (router.push `/products?q=`)
src/app/search/page.tsx
src/app/products/page.tsx
```

```text
[Route]
/login · /signup

[역할]
페이지 자체는 AuthPageAutoOpen → AuthModal(AuthIdentifierFlow)
이메일/소셜(카카오 등) · next 쿼리로 복귀

[핵심 파일]
src/app/login/page.tsx
src/app/signup/page.tsx
src/components/auth/* (AuthModal, AuthIdentifierFlow)
src/lib/auth/redirect.ts (sanitizeNextPath)
```

```text
[Route]
/mypage/bookings/[id]

[역할]
회원 예약 상세 · 잔금 PortOne 가능
게스트 결제 성공 시에는 이 경로로 자동 이동하지 않음(alert만)

[핵심 파일]
src/app/mypage/bookings/[id]/page.tsx
```

---

## B. First Visit / Home Journey

### 실제 컴포넌트 순서 (`src/app/page.tsx`)

```text
SiteHeader
  └ GuestSignupPromoBanner (비로그인·홈만)
  └ Header (desktop lg+ / MobileHeaderMenu)
↓
HeroSection
  └ (md+) 파노라마 배너
  └ h1 카피
  └ HomeHeroSearch → /search
  └ HomeQuickKeywords
  └ HeroRecommendedLinks (lg+)
↓
PageContainer
  HomeDeferredSections (dynamic + skeleton)
    GolfTourProductsSection → HomeProductCardRail → HomeProductCard
    GolfDepartureCalendarSection
    DestinationSection → ExploreCategoryCard 레일
    ThemeSection → ExploreCategoryCard 레일
    CuratedProductsSection → HomeProductCard
    HomeBlogSection
    HomeReviewSection
  HomeTrustSection (관광업 등록번호 포함 가능)
  #contact SectionBlock → HeroQuickConsultButton
↓
(RootLayout) KakaoFloatingButton (sm 미만, 상품상세 제외)
GlobalSiteFooter
```

### 홈에서 가능한 주요 행동

| CTA/링크 | 위치 | 이동 | 컴포넌트 |
|----------|------|------|----------|
| 검색 제출 | Hero | `/search?q=` | `HomeHeroSearch` |
| 빠른 키워드 | Hero 하단 | 키워드별 href | `HomeQuickKeywords` |
| 골프 상품 카드 | 골프 섹션 | `/products/[id]` | `HomeProductCard` |
| 골프 더보기 | 섹션 헤더 | golf moreHref / products golf | `GolfTourProductsSection` |
| 지역/테마 카드 | 레일 | destinations/themes slug | `ExploreCategoryCard` |
| 큐레이션 카드 | 큐레이션 | `/products/[id]` | `HomeProductCard` |
| 큐레이션 더보기 | | `/recommended` 등 | curated settings |
| 후기 | 리뷰 섹션 | `/reviews/...` | `HomeReviewSection` |
| 블로그 | | 외부/내부 blog | `HomeBlogSection` |
| 상담 | contact | Consult API (독립 모달) | `HeroQuickConsultButton` |
| 가입 띠배너 | Header 위 | 카카오 OAuth start | `GuestSignupPromoBanner` |
| 로그인/가입 | Header | Auth 모달 | `GuestAuthHoverMenu` |
| 상담·카톡 | Header desktop | 모달 / 외부 | `HeaderQuickConsultCtas` |
| 문의하기 | Mobile header | ConsultModal | `MobileHeaderMenu` |

### 첫 방문 회원가입 유도 (홈)

| 요소 | 내용 |
|------|------|
| GuestSignupPromoBanner | 홈+비로그인만. 「신규회원 5만원 쿠폰팩」→ `/api/auth/kakao/start?next=/mypage&...` |
| GuestAuthHoverMenu | 로그인/회원가입하기 → `openAuth` |
| HomeProductCard coinBenefit | 코드에 「회원가」UI 존재하나 **홈 호출처가 `default`** — 실질 미노출 |
| teamCouponBenefit | `/golf/kakao-sync` 랜딩에서 사용 |
| 상품가격↔가입 연결(홈) | **약함** — 띠배너 카피 중심, 카드 가격과 미연결 |

**질문에 대한 코드 기준 답:**

1. 가입 이득을 홈에서 알 수 있는가? → **부분적**. 띠배너(5만 쿠폰팩)만 명확. 일반 상품 카드에는 회원가 미연결.
2. 회원가입 CTA 위치? → 띠배너(카카오 OAuth), Header GuestAuthHoverMenu, `/signup`.
3. 가입 혜택↔탐색 연결? → **약함** (배너와 카드 분리).
4. 단순 배너 vs 가격 연결? → **주로 배너**. 가격 연동은 카카오싱크 골프 랜딩·상세 골프 쿠폰(로그인 시)에 국한.

---

## C. Header / Navigation Journey

### Desktop (`lg+`) — `SiteHeaderUI`

```text
GuestSignupPromoBanner (홈·비로그인)
유틸바: 회사소개 / 견적문의 / 여행후기 / (가이드) / 블로그 / 고객센터
메인바: Logo | DesktopMegaMenu(primaryNav) | HeaderExpandSearch | GuestAuth/UserMenu | 상담문의+카톡
```

Primary nav keys (`headerNav.constants.ts`): region→`/destinations`, theme→`/themes`, 상품·추천 등 데이터/`DEFAULT_HREF`.

### Mobile (`lg:hidden`) — `MobileHeaderMenu`

```text
[☰] [Logo] [문의하기]
(+ 홈 제외) HeaderProductSearch 행 → /products?q=
MobileHeaderDrawer: 아코디언 nav + 로그인/가입
```

### Header UX 목적 평가 (코드 근거)

1. **상품 탐색 명확성:** MegaMenu + ExpandSearch 있음. 홈 모바일은 검색행 숨김 → Hero 검색에 의존 (`showHeaderSearchRow={!isHomePath}`).
2. **로그인/가입 발견:** Desktop hover 메뉴에 명시. Mobile은 드로어 하단 — 탑바 CTA는 「문의하기」가 더 강조.
3. **검색 발견:** Desktop ExpandSearch. Mobile 홈은 Hero만 / 비홈은 검색행.
4. **상담 vs 가입 강조:** Desktop에 accent「상담 문의」+카톡이 상시. 가입은 hover. Mobile 탑바 CTA=문의(가입 아님).
5. **Desktop/Mobile 목적:** 탐색·상담은 유지되나, **검색 목적지 불일치**(Hero→/search, Header→/products)와 CTA 우선순위(가입 vs 문의)가 다름.

---

## D. Product Discovery Map

| Context | Route | Page | 카드 | 필터 | 상세 진입 | 회원혜택 표시 |
|---------|-------|------|------|------|-----------|---------------|
| A 홈 큐레이션/골프 | `/` | `page.tsx` | **HomeProductCard** | 없음 | Link `/products/[id]` | default 가격(회원가 미사용) |
| B 지역 | `/destinations`, `/[slug]`, `/products/region/[slug]` | hub pages | **ProductCard** via CuratedBlock | HubFilterSidebar→/products | hrefDetail | 배지·일반가 |
| C 테마 | `/themes`, `/[slug]`, `/products/theme/[slug]` | hub | **ProductCard** | 동일 | 동일 | 동일 |
| D 추천 | `/recommended`, `/[slug]` | hub/landing | **ProductCard** | HubFilter / CMS | 동일 | 동일 |
| E 전체 상품 | `/products` | ProductsPageContent | **ProductListCard(+Mobile)** | Sidebar/Drawer/Sort | + onClickConsult | 목록 CTA |
| F 검색 | `/search` | SearchResults | **ProductCard** grid | SearchFilters select | Link | 옵션 CTA |

지역 허브(`/destinations/[slug]`)와 `/products/region/[slug]`는 **유사 셸·카드**(중복 Journey 후보).

---

## E. Product Card Context 3종

### Discovery Card — `HomeProductCard`

**위치:** HOME 큐레이션, 골프 레일, (kakao-sync 등)

**표시(코드):** 이미지(aspect-video→4/3 / rail 4/3), 캠페인·하이라이트 배지, info 칩(모바일 1개), 지역, 제목, pitch/oneLiner(sm+), 가격(단일/구간가), 평점(sm+). **상담 CTA 없음**(카드 전체 Link).

**판정:** **관심 유도(Discovery)** 카드. 비교·결제 판단용 아님.

### Recommendation Card — `ProductCard` (CuratedBlock, layout 기본/related)

**위치:** destinations/themes/recommended 랜딩, RelatedProducts, 일부 가이드

**표시:** 썸네일, 배지, 제목, oneLiner, duration·meta, 가격, 태그, 평점, **옵션 onClickConsult**. layout=`related`는 세로 4/3.

**vs Discovery:** Product 엔티티 직접 vs props 매핑; 홈보다 리스트/그리드 범용; 상담 버튼 가능.

**판정:** **추천·관심 유지** + 허브 브라우징. 검색 결과 전용 고밀도 비교 UI는 아님.

### Search Result Card

| Route | 컴포넌트 |
|-------|----------|
| `/products` | ProductListCard (md+) / ProductListCardMobile |
| `/search` | ProductCard grid |

**목록 카드:** 이미지·제목·메타·가격·평점·**상담 CTA** (`ProductCatalogSection`이 onClickConsult 전달).

**판정:** **비교·선택(Search/Listing)** 에 가깝고, `/search`의 ProductCard는 중간 밀도.

### 공통 계약 (lib)

존재: `lib/productCardProps.ts`, `productCardSignals.ts`, `productCampaignBadges.ts`, `productCardHighlightTag.ts`, `productCardSeasonalPriceDisplay.ts`, `analytics/trackProductClick.ts`, `media/normalizeProductImageUrl`, `products/images`.

공통으로 가져갈 요소: 이미지 정규화, 제목, 가격/구간가, 배지/하이라이트, status 칩, 평점, analytics source, hrefDetail.  
**회원가·항공·호텔**은 Context별로 불균일(목록/홈에 항공·호텔 약함).

---

## F. Search / Filter Journey

```text
HomeHeroSearch ──submit──► /search?q=
HeaderProductSearch ──submit──► /products?q=
Schema.org SearchAction target: /products?search=... (layout)  ※ 실제 UI q= 사용
```

| 질문 | 답 (코드) |
|------|-----------|
| 같은 검색어 이동처 | **진입 UI에 따라 분기** |
| /search vs /products 차이 | 카드·필터·페이지네이션·추천 섹션 상이 |
| 결과 카드 | search=ProductCard / products=ListCard |
| 필터 모델 | **불일치** (select 3종 vs 트리+collection) |
| UX 일관성 | **달라짐** |

### 구현된 필터 (`/products`)

region, theme, product_line, collection(추천/인기/신규), sort, q. 골프 시 golfRegion preset.

### `/search` 필터

destination, theme, product_line, sort, **page**(페이지네이션 있음).

### 미구현

출발일, 여행기간, 가격대, 인원, 항공, 호텔등급, 출발확정(필터로서) — **코드에서 필터 UI로 발견되지 않음**.

---

## G. Region / Theme Journey

```text
HOME ExploreRail → /destinations/[slug] 또는 /themes/[slug]
Header MegaMenu → destinations / themes
HubFilterSidebar 선택 → /products?region=|theme=
「전체 상품」CTA → /products?...
/products/region/[slug] ≈ destinations/[slug] 중복 셸
/products/region · /products/theme → redirect /products
```

**중복:** destinations vs products/region, themes vs products/theme — 역할이 거의 겹침.

---

## H. Product Detail Journey

### 운영: `ProductDetailV2` + StickyV2

**본문 대략 순서 (코드):**

```text
NavigationContextHeader (breadcrumb / mobile back)
↓
TagRow (상태·지역·카테고리)
h1 제목
리뷰 앵커 링크
oneLiner
Price Summary Card (+ 테마차트/키워드)
ProductImageCarousel
ProductSummaryInfo (기간·출발·항공·호텔·최소인원·포함요약 등)
Description / SellingPoints / Package
(md-hidden) mobile badges / ProductTrustSummary / QuickInfoBar
Highlights / QuickSummary / TrustSignals
Itinerary preview / Feature / Flight / Hotel
Tabs: 일정 | 포함불포함 | 예약조건 | 유의사항 | 환불
↓
(페이지 레벨) ProductReviewSection / ProductReviewsSection
RelatedProductsSection (ProductCard)
Guides / AlertCard
↓
Sticky Desktop aside | Sticky Mobile bottom
```

### 상단 1 viewport (추정)

- **Mobile:** 태그·제목·가격카드·캐러셀 일부 + 하단 Sticky CTA 상시. 항공/호텔은 Summary가 스크롤 아래일 수 있음.
- **Desktop:** 좌 본문 상단 + 우 Sticky(가격·선택·예약).

### 상세 회원가입 유도

| 항목 | 코드 사실 |
|------|-----------|
| 비회원/회원가 병기 | 일반 상품 **없음**. 골프 쿠폰 모드에서만 `memberLoggedIn`일 때 pax 할인 preview |
| 가입 CTA near 예약 | Sticky 예약 모달에 **가입 유도 CTA 없음**(비회원 연락처 폼) |
| 로그인 후 복귀 | Auth `next`/`nextPath` — 상세에서 openAuth 시 pathname 전달 가능. **결제 CTA는 로그인 강제 없음** |

**질문 답:**

1. 상세에서 가입 필요성? → **약함**(골프 할인·홈 배너 제외).
2. 회원가 확인 위해 가입? → **일반 상품은 해당 구조 아님**. Guest도 결제 가능.
3. 혜택 near 예약 CTA? → **거의 없음**.
4. 로그인 후 복귀? → **가능(부분)** — `sanitizeNextPath` + AuthModalProvider `pathname` 기본값. 결제 성공 게스트는 mypage 미진입.

---

## I. Trust Architecture

| 위치 | 요소 |
|------|------|
| HOME | `HomeTrustSection` (제휴·상담·맞춤·안전 + tourism_reg_no) |
| FOOTER | 사업자/연락/채널 (`GlobalSiteFooter` + site-settings) |
| PRODUCT DETAIL | TrustSignals, ProductTrustSummary, Reviews, Tabs(포함·환불), AlertCard 상담안내 |
| Reviews 허브 | `/reviews` |
| Guides | `/guides` |
| Deposit | 입금 안내 페이지(상담 후) |

결제 안전성 UI 카피·보험 배지 전용 블록은 **상품 sticky에 별도 강조로 확인되지 않음**(추가 확인 필요 수준).

---

## J. Signup / Login Journey

```text
/login|/signup → AuthPageAutoOpen → AuthModal → AuthIdentifierFlow
  ├ 이메일 로그인/퀵가입
  └ Social (카카오 등) → /api/auth/[provider]/start?next=
       → callback → (link-account | complete-profile | next)
GuestSignupPromoBanner → 카카오 start (next=/mypage)
```

- `callbackUrl`/`returnUrl`/`from` **미사용**. **`next`** 만.
- `SignupForm`/`MemberLoginForm` **import 0** (레거시).
- 가입 완료: `router.push(nextPath)` (기본 `/`). 카카오 웰컴 시 dashboard 등 특수 next.

### 로그인 후 return

```ts
// src/lib/auth/redirect.ts
sanitizeNextPath(raw, fallback="/")
// AuthModalProvider: next ?? pathname
```

→ **상품 상세에서 모달 열면 복귀 가능**. 결제 자체는 로그인 불필요.

---

## K. Membership Benefit Architecture

| 혜택 | 노출 | 비로그인 | 가격 연결 |
|------|------|----------|-----------|
| 5만 쿠폰팩 카피 | GuestSignupPromoBanner | Yes(홈) | 가입 후 지급(카카오 웰컴) |
| teamCouponBenefit | kakao-sync 랜딩 HomeProductCard | Yes | UI상 쿠폰 적용가 |
| coinBenefit/회원가 | HomeProductCard | 코드만, **caller 미사용** | — |
| 골프 pax 할인 preview | ProductDetailV2 | **로그인만** | 체크아웃 benefit mode |
| 포인트 | Header/MyPage | No | — |
| 대시보드 보유 쿠폰 | mypage/dashboard | No | — |

---

## L. MyPage / Retention Features

| 기능 | 상태 |
|------|------|
| 예약 내역 | `/mypage/bookings` Yes |
| 포인트 | `/mypage/points` Yes |
| 리워드/교환 | rewards/redemptions Yes |
| 리뷰 | mypage/reviews Yes |
| 프로필 | mypage/profile Yes |
| 알림 | mypage/notifications Yes |
| 쿠폰 전용 메뉴 | **없음**(대시보드 카드) |
| 찜/위시리스트 | **없음** |
| 최근 본 상품 | **없음** |
| 장바구니 | **없음** |
| 비교함 | **없음** |
| 최근 검색어 | localStorage Yes |

---

## M. Booking Journey

```text
상품상세 Sticky
  ConnectedProductBookingSelectionPanel (출발일·인원·옵션)
  ProductStickyCheckoutRail 「예약하기」
    → ProductCheckoutModal (약관·예약자)
      → submitPayment (REQUIRE_LOGIN_FOR_PAYMENT=false)
        → POST /api/bookings/checkout/prepare
        → PortOne.requestPayment
        → POST /api/payments/portone/complete
```

### CTA 종류 (상세)

| Action | 컴포넌트 | Route/API |
|--------|----------|-----------|
| 예약하기/결제 | ProductStickyCheckoutRail → Modal | prepare + PortOne |
| 카톡 | sticky / Consult fallback | 외부 href |
| 상담(매진·일정) | ProductConsultCTA | ConsultModal → `/api/inquiries` |
| 견적 페이지 | 헤더 등 | `/quote` |
| consultHref | ProductDetailV2 props | **본문 미사용** |

### 날짜/인원/옵션

구현: 출발일(calendar/chips), 성인 등 travelerCount, OptionGroup.  
아동/유아 세분·객실 등은 상품 옵션 스키마에 종속 — **전 상품 공통 UI로 단정 불가**.

---

## N. Checkout / Payment Journey

```text
상품 상세
  ↓ 예약하기
ProductCheckoutModal (페이지 내, /checkout route 없음)
  ↓
prepare → pending_deposit booking
  ↓
PortOne V2 CARD
  ↓
complete
  ↓
회원: /mypage/bookings/{bookingNumber}
게스트: alert(예약번호) — 완료 전용 페이지 없음
```

- PortOne: `isPortOneEnabled()` = env `PORTONE_ENABLED≠false` + store/channel/secret.
- `/deposit`: **상담 후 예약금(계좌/링크)** — PortOne 인라인 상품결제와 별 퍼널.

### Guest 결제

**가능 (Yes).** `REQUIRE_LOGIN_FOR_PAYMENT = false`, prepare/complete 비회원 허용, 모달 「비회원 간편 예약」.

---

## O. Consult Journey

```text
A. 상담 중심
탐색 → ConsultModal / HeroQuickConsult / Header CTA /quote
  → /api/inquiries
  → (운영) 상담 → /deposit?inquiryId= 예약금 안내 가능

B. 즉시 예약/결제
탐색 → 상세 → 선택 → CheckoutModal → PortOne
```

두 경로 **병존**. Sticky 주경로는 **B**. 매진·일정·홈 contact는 **A**.

---

## P. Mobile Journey

| 영역 | 동작 |
|------|------|
| Header | 문의 CTA 강조, 홈 검색행 숨김 |
| Search | Hero→/search, Header→/products |
| Cards | Home 2열; List Mobile; Sticky bottom detail |
| Filter | Drawer/Sheet |
| Tabs | wrap |
| FAB Kakao | sm 미만, **상품상세 제외** |
| Sticky CTA | fixed + visualViewport offset + safe-area |
| Checkout | 모달(시트와 동시 주의 필요 — 코드상 BookingSheet + CheckoutModal 스택) |

충돌 후보: 상세에서 FAB 숨김은 Sticky와 중복 방지. Booking sheet open 시 sticky와 레이어 순서 — `ProductDetailStickyV2`/`ProductBookingSheet` 확인됨.

---

## Q. Analytics / Funnel Tracking

### 존재하는 이벤트 (`src/lib/analytics/events.ts`)

header_*, search_*, hero_search*, cta_click, landing_*, **product_card_click**, product_detail_*, product_cta_click, quote_*, consult_open/submit, deposit_*, kakao_oauth_*, **kakao_signup_new**, kakao_login_returning.

### 없음

`home_view`, 일반 `signup_complete`(카카오만), **`purchase` / checkout_start / booking_start` 전용 이벤트명**, `product_view` 단명(유사: product_detail_view_summary).

### Funnel 측정

| 단계 | 측정 |
|------|------|
| HOME VIEW | 부분(landing_view는 랜딩; 홈 전용 home_view **없음**) |
| PRODUCT CLICK | **가능** product_card_click |
| PRODUCT DETAIL | **부분** product_detail_view_summary 등 |
| SIGNUP | **부분** kakao_signup_new / 픽셀 completeRegistration |
| BOOKING START | **부분/약함** product_cta_click·모달 오픈 명시 purchase 전 단계 빈약 |
| CHECKOUT | **약함** prepare API 로그는 서버, 클라이언트 purchase 이벤트 **없음** |
| PURCHASE | **불가능**(클라이언트 ANALYTICS_EVENTS에 purchase 없음) |

---

## R. 30초 First Visit Simulation (코드 가능 경로)

### Scenario A — 다낭(대략 탐색)

```text
ENTRY /
→ Hero 검색 "다낭" → /search?q=다낭
→ ProductCard 클릭 → /products/[id]
→ Sticky 예약 또는 상담
가입: 홈 배너를 이미 지나친 뒤면 상세에서 가입 동기 약함
```

대안: DestinationSection → /destinations/... → ProductCard.

### Scenario B — 효도여행

```text
ENTRY /
→ ThemeSection 또는 MegaMenu 테마 → /themes/[slug]
→ ProductCard → 상세
→ Tabs/포함·일정 확인 → Sticky 예약 또는 상담
가입: 배너/헤더 가입, 상세 회원가 유도 약함
```

### Scenario C — 골프

```text
ENTRY /
→ GolfTourProductsSection / GolfDepartureCalendar
→ HomeProductCard 또는 달력→상품 /products?tourType=골프…
→ 상세: 로그인 시 골프 pax 할인 preview 가능
→ Sticky 예약 또는 /golf/kakao-sync 팀쿠폰 UI
가입: 카카오싱크·홈 배너가 상대적으로 강함
```

---

## S. Conversion Funnel Audit

| 단계 | 현재 UI | CTA | 문제 | 근거 |
|------|---------|-----|------|------|
| AWARENESS | Hero 카피+검색 | 검색 | 모바일 배너 없음 | HeroSection |
| TRUST | TrustSection+Footer | — | 상세와 연결 약함 | HomeTrustSection |
| DISCOVERY | 다경로 | 카드/레일 | 검색 분기 | Hero vs Header search |
| INTEREST | 3종 카드 | Link/Consult | 정보량·CTA 불균일 | Home vs List vs ProductCard |
| MEMBERSHIP VALUE | 홈 띠배너 | 카카오 OAuth | 상품가 미연결 | GuestSignupPromoBanner |
| SIGNUP | Auth 모달 | next | login/signup mode UI 미반영(조사결과) | AuthModalProvider |
| CONSIDERATION | 상세 장문 | Tabs | 정보 과다 | ProductDetailV2 |
| BOOKING INTENT | Sticky 예약 | 예약하기 | 선택 누락 시 유도 | BookingSelectionPanel |
| CHECKOUT | Modal | PortOne | 완료페이지 게스트 약함 | ProductCheckoutModal |
| POST | mypage/alert | — | 게스트 retention 약함 | submitPayment 성공 분기 |

---

## T. Conversion Blockers

### P0

- (코드상 Guest 결제 가능·Sticky 존재로 **완전 예약 불가는 아님**)  
- PortOne env 미설정 시 prepare **503** → 운영 설정 의존 (**확인 필요**: 배포 env).

### P1

1. **Hero `/search` vs Header `/products?q=`** — 동일 의도·다른 UX/카드/필터.
2. **가입 동기↔상품가 연결 약함** — 배너는 강하나 상세/목록 회원가 부재(일반).
3. **게스트 결제 성공 = alert만** — 예약번호 회수·마이페이지 유도 약함.
4. **Funnel analytics에 purchase/booking_start 부재** — 전환 측정 불가.
5. **상담 CTA(헤더/모바일) vs 예약 CTA** 경쟁 — 모바일 탑바=문의 우선.

### P2

- destinations vs products/region 중복.
- ProductCard 3 Context 정보/CTA 불일치.
- 상세 섹션 중복(요약·하이라이트·탭).
- ConsultModal vs HeroQuickConsultButton 이중.
- `/products` 페이지네이션 없음.

### P3

- HomeProductCard picsum placeholder.
- coinBenefit dead path.
- ProductDetailV2 consultHref 미사용.

---

## U. UX Dead Ends

| 상태 | 다음 행동 |
|------|-----------|
| /products 상품 0 | 인라인 안내문 — 탐색 CTA 약함 |
| /search 조건 없음 | 「검색어 입력」안내 |
| SearchEmpty | 추천·관련 있음(`SearchEmpty`, Related*) |
| 로그인/가입 완료 | nextPath로 이동 — dead end 아님 |
| 게스트 결제 완료 | **alert만** — mypage/완료페이지 **약함** |
| 상품 notFound | **전용 not-found UI 없음**(guides만) |
| /deposit inquiry 없음 | notFound |

---

## V. 중복 Journey / Component

| A | B | 차이 | 사용자 체감 | 통합 필요? |
|---|---|------|-------------|------------|
| /search | /products?q= | 카드·필터·페이징 | 같은 검색인데 화면 다름 | **모델 정합 필요**(카드 Context는 유지) |
| ConsultModal | HeroQuickConsult | accent vs primary, 필드 | 상담인데 폼·색 다름 | 진입 통일 검토 |
| /destinations/[slug] | /products/region/[slug] | 유사 셸 | 지역이 두 주소 | 역할 정리 |
| HomeProductCard | ProductCard | Discovery vs hub | 밀도·CTA | **Context 유지**, Design Contract만 공유 |
| ProductListCard | ProductCard | listing vs grid | /products vs /search | Search Result Context로 계약 |
| 상담 Sticky vs 예약 Sticky | | 매진만 상담 | 상태별 전환 | 유지 |

**주의:** Product Card를 **하나로 합친다고 가정하지 않음**. Discovery / Recommendation / Search Result Context 유지.

---

## W. 추천 PR Architecture (코드 반영안)

```text
PR-UI-01  Design System Foundation
PR-UI-02  Global Header / Navigation
          (검색 목적지 정책, 가입 vs 상담 우선순위)
PR-UI-03  Homepage Conversion UX
          (배너↔혜택, Hero 탐색, Trust)
PR-UI-04  Discovery / Region / Theme UX
          (destinations vs products/region 역할)
PR-UI-05  Product Card System
          - Discovery Card (HomeProductCard)
          - Recommendation Card (ProductCard hub)
          - Search Result Card (ListCard / search grid)
          ※ 단일 컴포넌트 강제 통합 금지 · Design Contract 공유
PR-UI-06  Search / Filter UX
          (/search·/products 정합, 필터 확장은 후순위)
PR-UI-07  Product Detail Conversion UX
          (상단 스캔, 탭, Sticky)
PR-UI-08  Membership Conversion UX
          (회원가·쿠폰·가입 CTA를 탐색/상세에 연결)
PR-UI-09  Booking / Checkout UX
          (모달·게스트 완료·성공 랜딩)
PR-UI-10  Mobile / Loading / Error / A11y / Analytics Funnel
```

**권장 순서:** 01 → 06(검색 분기 정책) → 05 → 03 → 08 → 07 → 09 → 02 → 04 → 10  
근거: 검색 분기는 전 Journey를 오염; 카드 Contract는 홈/허브/목록에 동시 영향; 멤버십은 가입 전환; 결제는 Sticky가 이미 있으므로 UX polish+완료 경험.

---

## 코드 발췌 (핵심만)

### 검색 분기

```ts
// HomeHeroSearch.tsx
router.push(`/search?q=${encodeURIComponent(trimmedQuery)}`);

// HeaderProductSearch.tsx
router.push(`/products?q=${encodeURIComponent(trimmed)}`);
```

### 가입 배너

```ts
// GuestSignupPromoBanner.tsx
const BANNER_HREF =
  "/api/auth/kakao/start?next=%2Fmypage&landing_slug=home-banner&...";
// 카피: 신규회원 5만원 쿠폰팩 / 카카오 1초 간편가입
```

### next 복귀

```ts
// src/lib/auth/redirect.ts
export function sanitizeNextPath(raw, fallback = "/") { ... }
```

### Guest 결제

```ts
// src/lib/payments/submitPayment.ts
export const REQUIRE_LOGIN_FOR_PAYMENT = false;
/**
 * 1) prepare API (회원/비회원 공용)
 * 2) PortOne.requestPayment
 * 3) complete API
 */
```

### 상세 골프 회원 할인 (로그인만)

```ts
// ProductDetailV2.tsx
const paxDiscountPreview = useMemo(() => {
  if (!isGolfCoupon || !memberLoggedIn) return null;
  ...
}, [isGolfCoupon, memberLoggedIn, travelerCount, hasPreviousBooking]);
```

---

```text
[PR-UI-00 조사 결과 요약]

1. 첫 방문 시 사용자가 가장 먼저 보게 되는 것:
SiteHeader(+홈 비로그인 시 GuestSignupPromoBanner) → Hero(검색·카피) → 골프/지역/테마/큐레이션 …

2. 현재 사이트가 전달하는 핵심 가치:
맞춤 상담·골프/패키지 여행, 제휴·안심(TrustSection), 카카오 간편가입 쿠폰팩.

3. 여행 탐색 주요 경로:
Hero/Header 검색, MegaMenu 지역·테마, 홈 레일/큐레이션, /products 필터, /recommended.

4. 상품카드 Context:
- Home: HomeProductCard (Discovery, Link only)
- Region/Theme: ProductCard via CuratedBlock (Recommendation)
- Search: /search=ProductCard, /products=ProductListCard(+Mobile)

5. 회원가입의 현재 주요 동기:
홈 띠배너 5만 쿠폰팩(카카오), 마이페이지 포인트/쿠폰, 골프 로그인 시 pax 할인.
일반 상품 “회원가 잠금” 구조는 아님.

6. 회원가입 CTA 주요 위치:
GuestSignupPromoBanner, GuestAuthHoverMenu, /signup|/login 모달, (간접) 카카오싱크 랜딩.

7. 상품 상세에서 회원 혜택 노출:
일반 약함. 골프_coupon 모드+로그인 시 paxDiscountPreview. 체크아웃 모달 가입 CTA 없음.

8. 로그인 후 원래 Journey 복귀:
부분 가능 (next / AuthModal pathname). 결제는 로그인 불필요.

9. 예약 경로:
상세 Sticky 선택 → 예약하기 → CheckoutModal → prepare → PortOne.
별도 /booking route 없음.

10. 결제 경로:
ProductCheckoutModal 내 PortOne V2. /checkout·/success 페이지 없음.
상담 후 /deposit 별도.

11. Guest 결제:
가능 (REQUIRE_LOGIN_FOR_PAYMENT=false)

12. 상담 중심 경로:
ConsultModal / HeroQuickConsult / Header CTA /quote → inquiries → (운영) deposit.

13. 즉시 예약/결제 경로:
Sticky CheckoutRail → Modal → PortOne → 회원 mypage / 게스트 alert.

14. 현재 가장 큰 Conversion 문제 5개:
1. 검색 목적지 이중화(/search vs /products)
2. 가입 혜택과 상품 가격 UI 단절
3. 게스트 결제 완료 경험 약함(alert)
4. purchase/booking funnel analytics 부재
5. 모바일 탑바=문의 우선 vs 예약 동선

15. 가장 먼저 개선할 UX 5개:
1. 검색 Journey 단일 정책
2. Card Design Contract(3 Context 유지)
3. Membership value를 목록/상세에 연결
4. 상세 상단 스캔+Sticky 예약 명확화
5. 게스트 결제 완료/예약 회수 UX

16. PR-UI-01 적용 전 반드시 결정할 사항:
검색 결과 canonical route; 3 Card Context 정보 계약; 상담 vs 즉시예약 우선 메시지; Guest 완료 랜딩 정책; accent hex(#e0612a) 확정(이전 DS 조사).

17. 추천 최종 PR 순서:
PR-UI-01 → 06 → 05 → 03 → 08 → 07 → 09 → 02 → 04 → 10
```

---

## 완료 체크리스트

- [x] 첫 방문 화면 순서
- [x] 상품 발견 경로
- [x] 홈/지역·테마/검색 카드 차이
- [x] 회원가입 동기·CTA·혜택 위치
- [x] 가입 후 이동·next 복귀
- [x] 상세 진입·결정 정보
- [x] 상담 vs 즉시 예약
- [x] 예약·결제 시작점
- [x] Guest 결제 가능
- [x] 결제 완료 후 이동
- [x] 모바일 흐름
- [x] Funnel 측정 가능 여부
- [x] Conversion Blocker
- [x] 이후 PR 순서

*(앱 소스 수정 없음. 본 문서만 `docs/`에 저장.)*
