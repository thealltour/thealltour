# 상품 관리자 6가지 필드 설계안

유저 페이지(패키지 상품·상품 카드·상품 상세)에서 노출은 되지만 관리자 상품 등록/수정에서 설정할 수 없었던 6가지 기능에 대한 DB·API·타입·관리자 UI·유저 페이지 매핑 설계입니다.

---

## 목차

1. [상품 상태 (status)](#1-상품-상태-status)
2. [상품 옵션 (options)](#2-상품-옵션-options)
3. [유류할증료 포함 여부 (fuel_included)](#3-유류할증료-포함-여부-fuel_included)
4. [가격 기준 문구 (price_meta)](#4-가격-기준-문구-price_meta)
5. [카드 메타 문구 (meta_info)](#5-카드-메타-문구-meta_info)
6. [한 줄 소개 (one_liner)](#6-한-줄-소개-one_liner)
7. [DB 마이그레이션 요약](#7-db-마이그레이션-요약)
8. [API 변경 요약](#8-api-변경-요약)
9. [관리자 UI 배치](#9-관리자-ui-배치)
10. [유저 페이지 매핑 체크리스트](#10-유저-페이지-매핑-체크리스트)

---

## 1. 상품 상태 (status)

### 목적
카드/상세에 "예약 가능", "잔여 한정", "마감", "상담 후 안내" 태그를 표시하고, 관리자가 상품별로 설정할 수 있게 한다.

### DB
- **테이블**: `public.products`
- **컬럼**: `status text`
- **제약**: `CHECK (status IN ('AVAILABLE','LIMITED','SOLD_OUT','CONSULT_REQUIRED'))` 또는 없이 허용, 기본값 `'AVAILABLE'`
- **nullable**: 가능. null/미설정 시 프론트에서 `AVAILABLE`로 간주 (기존 동작 유지)

### 타입 (기존 유지)
- `Product.status`: `"AVAILABLE" | "LIMITED" | "SOLD_OUT" | "CONSULT_REQUIRED" | undefined`

### API
- **POST /api/admin/products**, **PATCH /api/admin/products/[id]**
  - 요청 body에 `status?: "AVAILABLE" | "LIMITED" | "SOLD_OUT" | "CONSULT_REQUIRED" | null` 추가
  - null/미포함 시 DB에는 저장하지 않거나 null 유지 (공개 API에서 undefined → AVAILABLE 처리)

### 관리자 UI
- **위치**: 상품 등록/수정 폼 상단 또는 "상품명 · 카테고리 · 테마" 블록 직후
- **컴포넌트**: 라디오 버튼 또는 셀렉트
  - 예약 가능 (AVAILABLE)
  - 잔여 한정 (LIMITED)
  - 마감 (SOLD_OUT)
  - 상담 후 안내 (CONSULT_REQUIRED)
- **기본값**: "예약 가능"(AVAILABLE)
- **폼 상태**: `ProductFormState.status: "" | "AVAILABLE" | "LIMITED" | "SOLD_OUT" | "CONSULT_REQUIRED"` (빈 값이면 저장 시 null 또는 AVAILABLE)

### 유저 페이지 매핑
- **ProductCardV2**: `status={product.status ?? "AVAILABLE"}` (이미 적용 가능)
- **ProductDetailV2**: `statusTag={product.status ?? "AVAILABLE"}` (이미 적용 가능)
- **ProductCatalogSection**: `status: product.status ?? "AVAILABLE"` (이미 사용 중)

---

## 2. 상품 옵션 (options)

### 목적
상품 상세에서 "기간", "룸 타입" 등 옵션 그룹을 선택하게 하고, 선택에 따라 견적(가격·일정 라벨)을 계산해 표시한다. 관리자에서 옵션 정의를 등록/수정할 수 있게 한다.

### DB
- **테이블**: `public.products`
- **컬럼**: `options jsonb`
- **저장 형식**: 아래 ProductOptions 타입에 맞는 JSON
  - `{ "basePrice": number, "currency": "KRW", "requiredGroups": string[], "groups": ProductOptionGroup[] }`
  - `groups[]`: `{ "key": string, "title": string, "type": "radio"|"select"|"stepper"|"multi", "items": ProductOptionItem[] }`
  - `items[]`: `{ "value": string, "label": string, "priceDelta"?: number, "meta"?: string, "isDefault"?: boolean }`
- **nullable**: 가능. null/빈 배열이면 옵션 UI 미노출 (기존 동작)

### 타입 (기존 유지)
- `Product.options`: `ProductOptions | undefined`
- `ProductOptions`, `ProductOptionGroup`, `ProductOptionItem` (types/product.ts) 그대로 사용

### API
- **POST /api/admin/products**, **PATCH /api/admin/products/[id]**
  - 요청 body에 `options?: ProductOptions | null` 추가
  - 검증: `groups` 배열 존재, 각 그룹에 `key`, `title`, `items`(배열) 필수. `basePrice`는 number. `requiredGroups`는 groups 내 key만 허용
  - 저장 시 JSON 그대로 `options` 컬럼에 저장

### 관리자 UI
- **위치**: 상품 등록/수정 폼에서 "가격 · 일정" 블록 근처 또는 별도 접이식 섹션 "상품 옵션 (기간/룸 등)"
- **구성**:
  1. **옵션 사용 여부**: 체크박스 "옵션 사용 (기간·룸 등 선택 시 견적 계산)"
  2. **기준가(basePrice)**: 숫자 입력. 비워두면 기존 `price` 값을 기본으로 사용 가능하도록 안내
  3. **필수 그룹**: 그룹 key 다중 선택(체크박스) — "이 그룹은 반드시 하나 선택"
  4. **그룹 목록**: 동적 리스트 (추가/삭제/순서 변경)
     - 그룹 하나: **키(key)** (영문, 폼 내 고유), **제목(title)** (노출용), **타입** (radio/select)
     - **항목 목록**: 동적 리스트
       - 항목: **value**, **label**, **priceDelta**(원, 선택), **meta**(선택), **기본 선택(isDefault)** 체크
  5. **미리보기**: 저장하지 않고 현재 입력값으로 OptionPanel/QuoteSummary 비슷한 미리보기(선택)

- **저장 시**: 폼 상태를 `ProductOptions` 형태로 직렬화해 `options`로 전송. 옵션 미사용 시 `options: null` 전송.

### 유저 페이지 매핑
- **ProductDetailV2**: `options={product.options}`, `basePrice={product.price}` (이미 적용됨)
- **lib/products**: `normalizeOptions(row.options, productPrice)` (이미 적용됨)

---

## 3. 유류할증료 포함 여부 (fuel_included)

### 목적
상품 상세 요약 카드에 "유류할증료 포함" 또는 "유류할증료 별도" 문구를 노출하고, 관리자가 상품별로 설정할 수 있게 한다.

### DB
- **테이블**: `public.products`
- **컬럼**: `fuel_included boolean`
- **nullable**: true. null이면 해당 문구 미노출 (기존 동작)

### 타입
- `Product.fuel_included`: `boolean | undefined` 추가

### API
- **POST /api/admin/products**, **PATCH /api/admin/products/[id]**
  - 요청 body에 `fuel_included?: boolean | null` 추가
  - DB에 boolean 또는 null 저장

### 관리자 UI
- **위치**: 상품 등록/수정 폼의 "가격 · 일정" 블록 안 또는 바로 아래
- **컴포넌트**: 라디오 3개
  - "표시 안 함" (null)
  - "유류할증료 포함" (true)
  - "유류할증료 별도" (false)
- **폼 상태**: `fuel_included: boolean | null` (또는 "" | "true" | "false" 후 변환)

### 유저 페이지 매핑
- **ProductDetailV2**: `fuelIncluded={product.fuel_included}` 로 전달
- **products/[id]/page.tsx**: ProductDetailV2에 `fuelIncluded={product.fuel_included}` 추가
- **lib/products**: `normalizeProduct`에서 `fuel_included: row.fuel_included === true ? true : row.fuel_included === false ? false : undefined` 로 매핑

---

## 4. 가격 기준 문구 (price_meta)

### 목적
카드와 상세에 표시하는 "1인 기준", "2인 기준" 등의 문구를 상품별로 설정할 수 있게 한다.

### DB
- **테이블**: `public.products`
- **컬럼**: `price_meta text`
- **nullable**: true. null/빈 문자열이면 기존처럼 "1인 기준" 등 기본값 사용 가능 (프론트 기본값 "1인 기준")

### 타입
- `Product.price_meta`: `string | undefined` 추가

### API
- **POST /api/admin/products**, **PATCH /api/admin/products/[id]**
  - 요청 body에 `price_meta?: string | null` 추가
  - trim 후 빈 문자열이면 null 저장

### 관리자 UI
- **위치**: "가격 · 일정" 블록 안, 가격/일정 입력 옆
- **컴포넌트**: 한 줄 텍스트 입력, placeholder "예: 1인 기준 (비우면 기본값 1인 기준)"
- **폼 상태**: `price_meta: string`

### 유저 페이지 매핑
- **ProductCardV2**: `priceMeta={product.price_meta || "1인 기준"}` (ProductCatalogSection에서 전달)
- **ProductDetailV2**: `priceMeta={product.price_meta || "1인 기준"}` (products/[id]/page.tsx에서 전달)
- **ProductCatalogSection**: 카드 렌더 시 `priceMeta={product.price_meta || "1인 기준"}`

---

## 5. 카드 메타 문구 (meta_info)

### 목적
상품 카드 하단 메타 영역(duration, region 옆)에 "항공 포함", "조식 포함" 등 부가 문구를 노출하고, 관리자가 입력할 수 있게 한다.

### DB
- **테이블**: `public.products`
- **컬럼**: `meta_info text`
- **nullable**: true. null/빈 문자열이면 카드에서 해당 줄 생략 또는 표시 안 함

### 타입
- `Product.meta_info`: `string | undefined` 추가

### API
- **POST /api/admin/products**, **PATCH /api/admin/products/[id]**
  - 요청 body에 `meta_info?: string | null` 추가
  - trim 후 빈 문자열이면 null 저장

### 관리자 UI
- **위치**: "가격 · 일정" 블록 또는 "카드 노출용" 소제목 하단
- **컴포넌트**: 한 줄 텍스트 입력, placeholder "예: 항공 포함 (카드에 일정·지역 옆 표시)"
- **폼 상태**: `meta_info: string`

### 유저 페이지 매핑
- **ProductCardV2**: `metaInfo={product.meta_info ?? ""}` (ProductCatalogSection에서 전달)
- **ProductCatalogSection**: `<ProductCardV2 ... metaInfo={product.meta_info ?? ""} />`

---

## 6. 한 줄 소개 (one_liner)

### 목적
상품 상세 상단의 한 줄 요약 문구를 관리자가 직접 입력할 수 있게 한다. 기존에는 description 첫 줄로 대체했음.

### DB
- **테이블**: `public.products`
- **컬럼**: `one_liner text`
- **nullable**: true. null/빈 문자열이면 기존처럼 description 첫 줄로 fallback

### 타입
- `Product.one_liner`: `string | undefined` 추가

### API
- **POST /api/admin/products**, **PATCH /api/admin/products/[id]**
  - 요청 body에 `one_liner?: string | null` 추가
  - trim 후 빈 문자열이면 null 저장

### 관리자 UI
- **위치**: 상품 등록/수정 폼에서 "상품명" 직후 또는 "상품 설명" 직전
- **컴포넌트**: 한 줄 텍스트 입력(또는 textarea 1줄), placeholder "상세 상단 한 줄 소개 (비우면 상품 설명 첫 줄 사용)"
- **폼 상태**: `one_liner: string`

### 유저 페이지 매핑
- **ProductDetailV2**: `oneLiner={product.one_liner ?? product.description?.trim().split(/\n/)[0]?.slice(0, 200) ?? product.title}` (products/[id]/page.tsx에서 계산 후 전달)
- **products/[id]/page.tsx**:  
  `oneLiner={product.one_liner?.trim() || product.description?.trim().split(/\n/)[0]?.slice(0, 200) || product.title}`

---

## 7. DB 마이그레이션 요약

다음 컬럼을 `public.products`에 추가하는 마이그레이션을 적용한다.

| 컬럼          | 타입      | nullable | 기본값     | 비고                    |
|---------------|-----------|----------|------------|-------------------------|
| status        | text      | yes      | (없음)     | CHECK 또는 앱에서 검증  |
| options       | jsonb     | yes      | (없음)     | 옵션 정의 JSON          |
| fuel_included | boolean   | yes      | (없음)     |                         |
| price_meta    | text      | yes      | (없음)     |                         |
| meta_info     | text      | yes      | (없음)     |                         |
| one_liner     | text      | yes      | (없음)     |                         |

마이그레이션 파일: `supabase/products_admin_six_fields_upgrade.sql` (별도 생성).

---

## 8. API 변경 요약

### ProductBody 확장 (POST /api/admin/products, PATCH /api/admin/products/[id])

```ts
// 추가 필드
status?: "AVAILABLE" | "LIMITED" | "SOLD_OUT" | "CONSULT_REQUIRED" | null;
options?: ProductOptions | null;  // JSON 객체
fuel_included?: boolean | null;
price_meta?: string | null;
meta_info?: string | null;
one_liner?: string | null;
```

- POST 시: `insertPayload`에 위 필드 조건부 추가.
- PATCH 시: `body.* !== undefined` 일 때만 `updates`에 포함.

### 응답
- GET 목록/단건 응답은 기존처럼 `select("*")`로 반환하므로, 새 컬럼이 있으면 자동으로 포함. 프론트 `Product` 타입과 `normalizeProduct`만 새 필드 반영하면 됨.

---

## 9. 관리자 UI 배치

권장 배치 순서(상품 등록/수정 폼 기준):

1. **상품명** (기존)
2. **한 줄 소개** (신규) — 상세 상단 요약
3. **카테고리 · 테마** (기존)
4. **상품 상태** (신규) — 예약 가능/잔여 한정/마감/상담 후 안내
5. **이미지 URL** (기존)
6. **상품 원본주소** (기존)
7. **가격 · 일정 · 가격 기준 문구 · 유류할증료 · 카드 메타 문구** (가격/일정 기존, 나머지 신규)
   - price, duration  
   - price_meta  
   - fuel_included (라디오 3개)  
   - meta_info  
8. **상품 옵션** (신규) — 접이식 섹션 "상품 옵션 (기간/룸 등)", 기준가·필수 그룹·그룹/항목 편집
9. **상품 설명** (기존)
10. **포인트/포함·불포함/일정/선택관광/약관/항공편/메타 SEO/노출·추천** 등 (기존)

---

## 10. 유저 페이지 매핑 체크리스트

구현 시 아래 매핑이 모두 적용되었는지 확인한다.

| 페이지/컴포넌트            | 항목        | 적용 내용 |
|---------------------------|-------------|-----------|
| ProductCatalogSection     | status      | `product.status ?? "AVAILABLE"` (이미 가능) |
| ProductCatalogSection     | priceMeta   | `product.price_meta \|\| "1인 기준"` |
| ProductCatalogSection     | metaInfo    | `product.meta_info ?? ""` |
| products/[id]/page.tsx    | statusTag   | `product.status ?? "AVAILABLE"` (이미 가능) |
| products/[id]/page.tsx    | oneLiner    | `product.one_liner ?? description 첫 줄 ?? title` |
| products/[id]/page.tsx    | priceMeta   | `product.price_meta ?? "1인 기준"` |
| products/[id]/page.tsx    | fuelIncluded| `product.fuel_included` |
| products/[id]/page.tsx    | options     | `product.options` (이미 전달됨) |
| lib/products.ts           | normalizeProduct | status, options, fuel_included, price_meta, meta_info, one_liner 매핑 추가 |

---

## 구현 순서 제안

1. **DB**: `products_admin_six_fields_upgrade.sql` 적용
2. **타입**: `Product`에 `fuel_included`, `price_meta`, `meta_info`, `one_liner` 추가 (status, options는 이미 있음)
3. **lib/products**: `normalizeProduct`에 새 컬럼 매핑 추가
4. **API**: admin products POST/PATCH에 6개 필드 추가
5. **관리자 폼**: ProductFormState 확장 후 UI 6개 블록 추가 (status → one_liner → price_meta, fuel_included, meta_info → options)
6. **유저 페이지**: ProductCatalogSection, products/[id]/page.tsx에서 새 필드 전달 및 oneLiner fallback 로직 적용

이 순서로 진행하면 기존 동작을 깨지 않으면서 6가지 기능을 모두 관리자에서 사용할 수 있다.
