# AdminProductManager 폼/아코디언 발췌

## 1. 아코디언 섹션 정의 및 렌더링 (복사용)

**위치**: `src/components/AdminProductManager.tsx`  
**섹션 렌더링 시작** ~ **저장 버튼 직전**까지의 구조만 발췌.  
각 `id === "basic" | "price" | "description" | "included" | "schedule" | "flight" | "terms"` 블록은 파일 내 해당 라인 참고.

### 1-1. 섹션 목록 정의 + 아코디언 래퍼 (시작부)

```tsx
        <div className="space-y-2">
          {[
            { id: "basic", title: "기본 정보" },
            { id: "price", title: "가격·노출" },
            { id: "description", title: "설명·포인트" },
            { id: "included", title: "포함·불포함·선택관광" },
            { id: "schedule", title: "상세 일정" },
            { id: "flight", title: "항공편" },
            { id: "terms", title: "약관·SEO" },
          ].map(({ id, title }) => (
            <div
              key={id}
              id={`form-section-${id}`}
              className="overflow-hidden rounded-lg border border-[var(--border)] bg-[var(--surface)] ring-1 ring-[var(--border)]"
            >
              <button
                type="button"
                onClick={() =>
                  setProductFormOpenSections((prev) => ({ ...prev, [id]: !prev[id] }))
                }
                className="flex w-full items-center justify-between px-4 py-3 text-left font-semibold text-[var(--primary)] hover:bg-[var(--primary-soft)]"
              >
                <span>{title}</span>
                <ChevronDown
                  className={`h-5 w-5 shrink-0 transition ${productFormOpenSections[id] ? "rotate-180" : ""}`}
                />
              </button>
              <div
                className={productFormOpenSections[id] ? "block" : "hidden"}
                aria-hidden={!productFormOpenSections[id]}
              >
                <div className="border-t border-[var(--divider)] p-4">
                  {id === "basic" && (
                    // ... 기본 정보 필드 (상품명 required, 한줄소개, 카테고리/테마, 이미지, 원본주소 등)
                  )}
                  {id === "price" && ( /* 가격·노출 필드 */ )}
                  {id === "description" && ( /* 설명·포인트 */ )}
                  {id === "included" && ( /* 포함·불포함·선택관광 */ )}
                  {id === "schedule" && ( /* 상세 일정 (시각화/레거시) */ )}
                  {id === "flight" && ( /* 항공편 */ )}
                  {id === "terms" && ( /* 약관·SEO */ )}
                </div>
              </div>
            </div>
          ))}
        </div>

        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={() => { void handleSubmit(); }}
            disabled={isSubmitting}
            className="rounded-lg bg-[#1d4ed8] px-4 py-2 text-sm font-semibold text-white ..."
          >
            {isSubmitting ? "저장 중..." : editingId ? "수정 저장" : "상품 등록"}
          </button>
          {errorMessage ? <p className="text-xs text-red-600">{errorMessage}</p> : null}
        </div>
```

- **섹션별 실제 필드 JSX**: 파일 라인 **1792(basic) ~ 2772(terms)** 구간 참고.
- **필수 여부**: `basic`의 상품명 `required`, 대표 이미지/설명은 `handleSubmit` 내 검증.
- **검증**: `handleSubmit`에서 `title`/`description`/대표이미지 누락 시 토스트 후 `return`; 메인 추천 개수 초과 시 동일.

---

## 2. form state 구조 (초기값 / 저장 payload / validate)

### 2-1. Form 타입 및 초기값

**타입** (`ProductFormState`): 파일 **47~114라인**  
- `title`, `description`, `product_source_url`, 포인트/항공/일정/약관/메타/이미지/가격/노출/옵션/일정v2·days·media 등 전 필드 정의.

**초기값** (`initialFormState`): 파일 **144~213라인**  
- 문자열 필드 `""`, `point_*` 등 `"X"`, `images_json: []`, `itinerary_v2_json: { days: [] }`, `is_active: true`, `status: "AVAILABLE"` 등.

**상태 초기화**:

```tsx
const [form, setForm] = useState<ProductFormState>(initialFormState);
```

(파일 **439라인**)

### 2-2. 저장/검증 — handleSubmit 요약

**위치**: 파일 **861~1008** 라인 부근.

- **event?.preventDefault()** 후 **setIsSubmitting(true)**, **setErrorMessage("")**.
- **검증(필수)**  
  - `form.title.trim()` 없으면 → `showLocalToast("error", "상품명을 입력해 주세요.")` 후 return.  
  - `form.description.trim()` 없으면 → "상품 설명을 입력해 주세요." 후 return.  
  - 대표 이미지 없음( image_url + images_json 정규화 후 비어 있음) → "대표 이미지를 1장 이상 등록해 주세요." 후 return.  
  - 메인 추천 체크 시 기존 추천 개수 ≥ FEATURED_PRODUCT_LIMIT 이면 → "메인 추천상품은 최대 N개까지..." 후 return.
- **payload 구성**: `form` 기준으로 API용 객체 생성  
  - `title`, `description`, 메타/포인트/항공/일정(detailed_schedule 또는 itinerary_days_json 직렬화), `image_url`, `images_json`, `category`, `theme`, `price`(숫자화), `duration`, `itinerary`, `inclusions`, `is_active`, `is_featured_home`, `sort_order`, `status`, `one_liner`, `price_meta`, `meta_info`, `fuel_included`, `options`(options_json 파싱), `itinerary_media_json`, `itinerary_days_json`, `itinerary_v2_json` 등.
- **POST/PATCH**: `editingId` 있으면 PATCH `/api/admin/products/[id]`, 없으면 POST `/api/admin/products` 호출 후 성공 시 토스트, 실패 시 `setErrorMessage` 또는 토스트.

**onSubmit** (폼 제출):

```tsx
<form
  onSubmit={(event) => { void handleSubmit(event); }}
  noValidate
>
```

(파일 **1734~1737**)

---

## 3. 현재 아코디언 UX 스펙 (5줄 요약)

1. **기본 열림**: `productFormOpenSections` 초기값이 `basic: true`, 나머지 `false`라서 **첫 섹션(기본 정보)만 열리고**, 가격·설명·포함·일정·항공·약관은 **처음에 모두 닫힌 상태**입니다.
2. **섹션 완료 표시**: 아코디언 헤더에 **완료(체크/프로그레스) 표시는 없습니다**. 섹션별 완료 여부 UI 없음.
3. **저장 버튼 위치**: 아코디언 블록 **바로 아래**(폼 내부 하단)에 **저장 버튼 1개**만 있으며, 상단에는 없습니다.
4. **필수 누락 시 안내**: **저장 시** `handleSubmit` 안에서 `showLocalToast("error", "상품명을 입력해 주세요.")` 등으로 **토스트만 띄우고**, 해당 필드가 있는 **섹션을 자동으로 열어주지는 않습니다**.
5. **미리보기 품질 경고**: 우측 미리보기 패널의 **"미리보기 품질 경고"** 목록에서 항목 클릭 시 `handleWarningClick(sectionId)`가 호출되어 **해당 섹션 아코디언을 열고** `form-section-{sectionId}`로 **스크롤**합니다. (카테고리/가격/이미지/일정 등 누락 시 여기서 해당 섹션으로 유도)
