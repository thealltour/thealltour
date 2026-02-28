# 관리자 상품 미리보기 – 파일 경로 및 역할 요약

## 1. 실서비스 상품 카드 컴포넌트 (두 번째 이미지 UI)

| 경로 | 역할 |
|------|------|
| **`src/components/products/ProductCardV2.tsx`** | **실서비스용 단일 카드 컴포넌트.** 가로형(이미지 좌/내용 우), 좌측상단 상태·카테고리·테마 칩, 한 줄 타이틀/해시태그 + 오른쪽 그라데이션, 상담 문의 칩. `ProductCardV2Props` 정의. |
| `src/components/ProductCatalogSection.tsx` | 패키지 상품 목록 페이지에서 상품 리스트 렌더. `ENABLE_NEW_PRODUCT_UI`일 때 **ProductCardV2** 사용, `getProductBadges`/`buildV2Badges`/`parseMetaTitleAsHashtags`로 props 구성. |
| `src/components/ProductCard.tsx` | 레거시 카드(세로형). `ENABLE_NEW_PRODUCT_UI`가 false일 때만 사용. |
| `src/components/dev/DevProductCardV2Grid.tsx` | `/dev/products` 전용 데모 그리드. ProductCardV2에 `productToV2Props` 적용. 실서비스와 별도. |

**정리:** 실서비스 카드는 **ProductCardV2 하나**로 통일되어 있으며, 목록은 **ProductCatalogSection**에서만 이 컴포넌트를 씀. 중복 카드 컴포넌트 없음.

---

## 2. 실서비스 상품 상세 컴포넌트 (첫 번째 이미지 UI)

| 경로 | 역할 |
|------|------|
| **`src/components/products/ProductDetailV2.tsx`** | **실서비스용 단일 상세 컴포넌트.** 히어로(태그/제목/한줄소개/가격/유류/옵션/Trust/CTA), 탭(일정/포함·불포함/예약조건/환불). `ProductDetailV2Props` 정의. |
| `src/components/products/ProductDetailStickyV2.tsx` | 상세 페이지 좌/하단 고정 CTA(Desktop/Mobile). 가격·상담·카톡. |
| `src/components/products/ProductQuoteContext.tsx` | 옵션 선택 시 견적 합계/필수 미선택 상태 공유. **ProductDetailV2가 이 컨텍스트를 사용.** |
| `src/app/products/[id]/page.tsx` | 상품 상세 페이지. `ENABLE_NEW_PRODUCT_UI`일 때 **ProductDetailV2** + StickyV2 사용. `ConsultModalProvider` → `ProductQuoteProvider`로 감쌈. |
| `src/components/ProductDetailContentLegacy.tsx` | 레거시 상세 본문. `ENABLE_NEW_PRODUCT_UI`가 false일 때만 사용. |
| `src/components/ProductDetailHero.tsx` | 레거시 상세 히어로. |
| `src/components/ProductDetailTabs.tsx` / `ProductDetailTabsLegacy.tsx` | 레거시 탭. |

**정리:** 실서비스 상세는 **ProductDetailV2 하나**로 통일. 페이지는 **products/[id]/page.tsx** 한 곳에서만 이 컴포넌트를 사용. 상세 컴포넌트 중복 없음.

---

## 3. 관리자 상품 등록/수정 페이지 (폼)

| 경로 | 역할 |
|------|------|
| **`src/components/AdminProductManager.tsx`** | **관리자 상품 등록·수정·목록·카테고리/테마 관리.** 아코디언 폼(기본정보/가격·노출/설명·포인트/포함·일정/항공편/약관·SEO), `ProductFormState` + API 호출. **미리보기 추가 시 수정 대상.** |
| `src/app/admin/products/page.tsx` | Admin 라우트. AdminHeader + **AdminProductManager** 렌더. |
| `src/app/theall_manager_only/products/page.tsx` | theall_manager_only용. `admin/products` 페이지 re-export. |

**정리:** 폼 UI는 **AdminProductManager** 한 컴포넌트에만 있음. 미리보기는 여기 안에 “실시간 미리보기” 섹션으로 넣으면 됨.

---

## 4. 상품 타입/스키마

| 경로 | 역할 |
|------|------|
| **`src/types/product.ts`** | **Product**, ProductOptions, ProductOptionGroup, ProductOptionItem, ProductTrust, SelectedOptions 정의. API/폼/목록/상세 공통 타입. |
| `src/types/productTaxonomy.ts` | ProductTaxonomy, ProductTaxonomyWithUsage (카테고리/테마). |
| `src/app/api/admin/products/route.ts` | Admin 상품 목록/등록. `ProductBody` 타입(요청 body). |
| `src/app/api/admin/products/[id]/route.ts` | Admin 상품 수정/삭제. 동일 `ProductBody`. |

**정리:** 상품 도메인 타입은 **types/product.ts**의 **Product** 하나로 통일. Package/Tour 등 별도 타입 없음.

---

## 5. 분류: 미리보기 구현에 필요한 수정 대상 vs 참고만

### 미리보기 구현에 필요한 수정 대상

| 파일 | 수정 내용 |
|------|-----------|
| **`src/components/AdminProductManager.tsx`** | ① 폼 상태(`form`) → 미리보기용 데이터 변환(useMemo). ② “실시간 미리보기” 섹션 추가(카드 탭 / 상세 탭). ③ ProductCardV2, ProductDetailV2(및 ProductQuoteProvider, ConsultModalProvider) import 후 재사용. ④ CTA는 no-op. |

### 참고만 (로직/매핑 재사용, 파일 수정 없음 또는 최소)

| 파일 | 참고 내용 |
|------|-----------|
| `src/components/products/ProductCardV2.tsx` | 카드 props 스펙·UI. 수정 없이 그대로 사용. |
| `src/components/products/ProductDetailV2.tsx` | 상세 props 스펙·UI. 수정 없이 그대로 사용. |
| `src/components/ProductCatalogSection.tsx` | `parseMetaTitleAsHashtags`, `buildV2Badges`, `getProductBadges`로 Product → ProductCardV2 props 만드는 방식. Admin에서 동일 룰 적용 시 참고. |
| `src/lib/productCategory.ts` | `getProductBadges(product)`. 미리보기용 가짜 Product에 적용해 뱃지 배열 얻기. |
| `src/app/products/[id]/page.tsx` | ProductDetailV2에 넘기는 props 목록·oneLiner/priceMeta/fuelIncluded 등 fallback. ConsultModalProvider·ProductQuoteProvider 감싸는 구조. |
| `src/types/product.ts` | Product 타입. 미리보기용 “가짜 Product” 구조 참고. |
| `src/components/dev/DevProductCardV2Grid.tsx` | `productToV2Props` 형태 참고. Admin에서는 form 기반으로 비슷한 객체 구성. |
| `src/config/featureFlags.ts` | ENABLE_NEW_PRODUCT_UI. 미리보기는 항상 V2 사용하면 됨. |

---

## 6. 재사용 정리 및 제안

- **카드:** 실서비스 카드는 **ProductCardV2 1개**만 사용. ProductCatalogSection·DevProductCardV2Grid는 이 컴포넌트를 쓰는 “사용처”일 뿐. **별도 통합 제안 없음.**
- **상세:** 실서비스 상세는 **ProductDetailV2 1개**만 사용. **별도 통합 제안 없음.**
- **미리보기 시:**  
  - **AdminProductManager**에서 `form` → 카드/상세용 props로 변환하는 **매핑 함수만** 추가.  
  - `parseMetaTitleAsHashtags`는 ProductCatalogSection과 동일 규칙 유지 위해 **같은 로직을 AdminProductManager 안에 복사하거나** `src/lib/` 등 공용 유틸로 한 번만 두고 두 곳에서 import 권장.

---

## 7. 요약 표

| 구분 | 경로 | 비고 |
|------|------|------|
| **실서비스 카드** | `src/components/products/ProductCardV2.tsx` | 수정 없이 미리보기에서 재사용 |
| **실서비스 상세** | `src/components/products/ProductDetailV2.tsx` | 수정 없이 미리보기에서 재사용 |
| **관리자 폼** | `src/components/AdminProductManager.tsx` | **미리보기 추가 시 수정 대상** |
| **상품 타입** | `src/types/product.ts` (Product 등) | 참고만 |
| **카드 props 매핑** | `ProductCatalogSection.tsx`, `DevProductCardV2Grid.tsx` | 참고만 |
| **상세 페이지** | `src/app/products/[id]/page.tsx` | 참고만 |
| **뱃지/해시태그** | `src/lib/productCategory.ts`, Catalog의 parseMetaTitleAsHashtags | 참고만, 동일 룰 적용 |

이대로 구현하면 “비슷하게 새로 만드는 UI” 없이, **실서비스 ProductCardV2 / ProductDetailV2를 그대로 재사용**하면서 관리자 폼 입력값 기반 실시간 미리보기를 붙일 수 있습니다.
