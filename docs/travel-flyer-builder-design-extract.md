# 여행 유인물(A4) 생성기 — 설계용 코드 발췌본

> 목적: 관리자 상품 목록 **작업 열**에서 **유인물 생성** 모달(체크박스·편집 가능 텍스트·실시간 미리보기·향후 링크+PNG)을 설계·구현할 때, 기존 패턴을 그대로 판단에 쓸 수 있도록 **파일 경로 + 역할 + 발췌 + 재사용 코멘트**를 정리한다.  
> 기준 시점: 저장소 `main` 기준 (스마트스토어 HTML 생성 기능 포함).

---

## [1] 관리자 상품 목록 / 작업 열 렌더링 위치

### 1-1. 페이지 진입·목록 조립

| 파일 | 역할 | 유인물 기능에서 |
|------|------|------------------|
| `src/components/admin/products/AdminProductManager.tsx` | 상품 관리 메인 셸: 목록 vs 편집 뷰, 토스트, **스마트스토어 모달 state** | **유인물 모달 state + 핸들러를 동일 패턴으로 추가하기 가장 자연스러운 상위** |
| `src/components/admin/products/AdminProductListSection.tsx` | 목록 데이터 훅 + `AdminProductsListView`에 props 전달 | `onOpenFlyer` 같은 콜백을 여기서부터 내려내면 됨 |
| `src/components/admin/products/AdminProductsListView.tsx` | 테이블/모바일 카드, **작업 열**, 행 렌더 | **작업 열 너비·`<AdminProductsQuickActions />` 위치** 그대로 옆에 버튼 추가 |
| `src/components/admin/products/AdminProductsQuickActions.tsx` | **작업 열 버튼 묶음** (편집·활성·HTML·미리보기·삭제) | **유인물 버튼 추가 1순위 위치** |
| `src/components/admin/products/adminProducts.types.ts` | `AdminProductsListViewProps` (예: `onOpenSmartstoreHtml`) | 동일하게 `onOpenFlyer?: (product: Product) => void` 패턴 권장 |

**작업 열 헤더·컬럼 폭**

```526:527:src/components/admin/products/AdminProductsListView.tsx
                  <th className="w-[158px] min-w-[158px] px-1 py-2 text-right text-[10px] font-semibold">작업</th>
```

**데스크톱 행 → 작업 셀 (`Product` 전체 전달)**

```238:248:src/components/admin/products/AdminProductsListView.tsx
        <td className="w-[158px] min-w-[158px] px-1 py-1.5 align-middle">
          <AdminProductsQuickActions
            product={product}
            pendingToggleId={pendingToggleId}
            pendingDeleteId={pendingDeleteId}
            onEdit={onEditProduct}
            onSmartstoreHtml={onOpenSmartstoreHtml}
            onDelete={onDeleteProduct}
            onToggleActive={onQuickToggleActive}
            dense
          />
        </td>
```

**모바일 행**도 동일하게 `onSmartstoreHtml` 전달 (파일 하단 `renderMobileRow` 내부, 동일 컴포넌트).

**재사용 코멘트:** 행 데이터는 **`Product` 전 객체**. 목록 API가 채우는 필드만 쓰면 되고, 유인물에 더 필요하면 **목록 조회 API 확장** 또는 **모달 오픈 시 `getProductById`로 상세 로드** 중 선택.

---

### 1-2. 작업 열 버튼 패턴 (아이콘·툴팁·스타일)

```36:99:src/components/admin/products/AdminProductsQuickActions.tsx
  const btnBase = dense
    ? "inline-flex items-center justify-center gap-0.5 rounded border text-[10px] font-semibold transition disabled:cursor-not-allowed disabled:opacity-50"
    : "inline-flex items-center justify-center gap-1 rounded-md border text-[11px] font-semibold transition disabled:cursor-not-allowed disabled:opacity-50";
  const iconBtn = compact || dense ? "h-7 w-7 p-0" : "px-2 py-1";
  const icoCls = "h-3.5 w-3.5 shrink-0";

  return (
    <div className="flex shrink-0 flex-nowrap items-center justify-end gap-1">
      <button ... title="편집 화면으로"><Pencil ... /></button>
      <button ... title={active ? "비노출로 전환" : "노출로 전환"}><Power ... /></button>
      {onSmartstoreHtml ? (
        <button ... title="스마트스토어 상세 HTML 생성">
          <FileCode2 className={icoCls} />
          {!compact && !dense ? <span className="max-w-[4.5rem] truncate">HTML 생성</span> : null}
        </button>
      ) : null}
      <Link ... title="유저 상품 상세(새 탭)"><ExternalLink ... /></Link>
      <button ... title="삭제"><Trash2 ... /></button>
    </div>
  );
```

**재사용 코멘트:** `dense` 목록 행에서는 **아이콘-only + `title` 툴팁**이 표준. 유인물은 `lucide-react`에서 `FileImage`, `Printer`, `LayoutTemplate` 등 선택 후 **sky 계열 HTML 버튼과 구분되는 색** 권장.

---

### 1-3. 상위에서 모달 연결 (스마트스토어와 동일 패턴)

```2003:2018:src/components/admin/products/AdminProductManager.tsx
          onOpenSmartstoreHtml={(product) => {
            setSmartstoreHtmlProduct(product);
            setSmartstoreHtmlModalOpen(true);
          }}
        />
      ) : null}

      <SmartstoreHtmlGenerateModal
        open={smartstoreHtmlModalOpen}
        productId={smartstoreHtmlProduct?.id ?? null}
        productTitle={smartstoreHtmlProduct?.title?.trim() ?? ""}
        onClose={() => {
          setSmartstoreHtmlModalOpen(false);
          setSmartstoreHtmlProduct(null);
        }}
        onCopied={() => showToast("success", "HTML이 복사되었습니다.")}
      />
```

**재사용 코멘트:** 유인물도 `useState` 두 개(`flyerModalOpen`, `flyerProduct`) + `onOpenFlyer` 콜백이 **가장 단순하고 기존과 일관**됨.

---

### [1] 질문에 대한 직접 답

1. **작업 열 버튼 배열/렌더:** `AdminProductsQuickActions` 내부 `flex` 가로 정렬; 테이블에서는 `AdminProductsListView.renderProductRow` 마지막 `<td>`.
2. **공통 패턴:** `btnBase` + `iconBtn` + lucide `h-3.5 w-3.5` + `title`.
3. **row 데이터:** `Product` 전체 (`id`, `title`, `image_url`, `images_json`, `price`, `status`, `is_active`, `sort_order`, `destination_id`, `product_line_id`, …). 썸네일은 `normalizeProductImageUrl(product.image_url)`.
4. **모달 연결 최적 위치:** `AdminProductManager` (state) + `AdminProductsQuickActions` (버튼) + props 체인 `AdminProductListSection` → `AdminProductsListView`.

---

## [2] 네이버 스마트스토어 HTML 생성 기능 (참고 구현)

### 2-1. 모달 컴포넌트·상태

| 파일 | 역할 | 유인물에서 |
|------|------|-------------|
| `src/components/admin/products/modals/SmartstoreHtmlGenerateModal.tsx` | 고정 백드롭 + 내부 패널, **API fetch**, 탭(미리보기/원문), 복사 | **큰 빌더 모달**로 확장 시 레이아웃만 바꾸고 fetch/미리보기 패턴 참고 |
| `src/components/admin/products/modals/smartstoreHtmlModal.types.ts` | `open`, `productId`, `productTitle`, `onClose`, fetch state 유니온 | 동일하게 `FlyerModalProps` + `idle|loading|error|ok` 패턴 재사용 가능 |

**모달 상태 (로컬 `useState`, 공용 `Modal` 미사용)**

```17:52:src/components/admin/products/modals/SmartstoreHtmlGenerateModal.tsx
  const [tab, setTab] = useState<TabKey>("preview");
  const [state, setState] = useState<SmartstoreHtmlModalFetchState>({ status: "idle" });
  ...
  const load = useCallback(async () => {
    if (!productId?.trim()) return;
    setState({ status: "loading" });
    ...
      const res = await fetch(`/api/admin/products/${encodeURIComponent(productId.trim())}/smartstore-html`, {
        method: "GET",
        credentials: "same-origin",
      });
```

**열릴 때 자동 로드, 닫을 때 초기화:** `useEffect([open, load])`.

**재사용 코멘트:** **실시간 미리보기(폼 입력 반영)**는 현재 구조에 **없음** — 서버가 만든 HTML을 `iframe srcDoc`으로만 보여줌. 유인물은 **클라이언트에서 VM + React 미리보기** 또는 **debounced POST**가 필요.

---

### 2-2. API route

| 파일 | 역할 |
|------|------|
| `src/app/api/admin/products/[id]/smartstore-html/route.ts` | `requireAdminSession` → `getProductByIdFresh` → `resolveProductNoticesForDetailPage` → `buildSmartstoreDetailHtmlFromProduct` |

```26:35:src/app/api/admin/products/[id]/smartstore-html/route.ts
    const product = await getProductByIdFresh(rawId);
    ...
    const notices = await resolveProductNoticesForDetailPage(product);
    const { html, meta } = buildSmartstoreDetailHtmlFromProduct(product, notices);

    return NextResponse.json({ ok: true, html, meta });
```

---

### 2-3. HTML 생성·ViewModel·상품 매핑

| 파일 | 역할 |
|------|------|
| `src/lib/smartstore/buildSmartstoreDetailHtml.ts` | `mapProductToSmartstoreHtmlViewModel` → 섹션 HTML 조립 → 안전성 분석 → `meta` |
| `src/lib/smartstore/mapProductToSmartstoreHtmlViewModel.ts` | **이미지·일정·포함/불포함·요약 텍스트**를 스마트스토어용으로 정제 |
| `src/lib/products/resolveProductDetailBodyFields.ts` | 상세 페이지와 동일한 포함/불포함/선택관광 해석 |
| `src/lib/smartstore/smartstoreHtml.types.ts` | `SmartstoreHtmlViewModel`, `SmartstoreHtmlBuildMeta`, API 응답 타입 |

**ViewModel 필드 (유인물 프리필 참고용)**

```5:27:src/lib/smartstore/smartstoreHtml.types.ts
export type SmartstoreHtmlViewModel = {
  productId: string;
  title: string;
  oneLiner: string;
  heroImageUrl: string;
  galleryImageUrls: string[];
  priceText?: string;
  ...
  includedLines: string[];
  excludedLines: string[];
  optionalLines: string[];
  ...
  timeline: TimelineModel | null;
  detailedScheduleText: string;
};
```

**이미지 우선순위 (발췌)**

```75:83:src/lib/smartstore/mapProductToSmartstoreHtmlViewModel.ts
  const heroRaw = getPrimaryImageUrl(product).trim();
  const heroImageUrl = heroRaw ? toSmartstoreImageUrl(heroRaw) : "";

  const list = normalizeImageList(product.images_json);
  const galleryRaw = list.filter((u) => u.trim() !== heroRaw);
  const galleryImageUrls = galleryRaw
    .map((u) => toSmartstoreImageUrl(u))
    .filter((u): u is string => u.length > 0)
    .slice(0, 4);
```

---

### [2] 질문에 대한 직접 답

1. **모달 상태:** 컴포넌트 내부 `useState` + `useEffect`로 open 시 fetch.
2. **props로 넘기는 상품 데이터:** **id + title만** 모달에 넘기고, 본문은 **API에서 풀 로드** (스마트스토어). 유인물은 체크박스/편집을 위해 **클라이언트에 Product 또는 draft**를 더 넘기는 편이 나을 수 있음.
3. **실시간 결과 생성:** **없음** (한 번 생성 후 탭 전환만).
4. **공통 Dialog:** **`Modal` (`@/components/ui/Modal`) 미사용**. 인라인 `fixed inset-0` 패턴.
5. **유인물 재사용:** **타입·API·ViewModel 매핑·안전 정제 로직**은 재사용 가치 큼. **UI 셸**은 좌우 2단이라 **새 컴포넌트**가 현실적.

---

## [3] 관리자 공용 모달 / 다이얼로그

### 3-1. `Modal` (공용)

| 파일 | 역할 | 유인물에서 |
|------|------|-------------|
| `src/components/ui/Modal.tsx` | `fixed` + `bg-[var(--overlay)]` + `rounded-2xl` + Escape | **큰 빌더**에 쓰려면 `className`으로 `max-w-*`·`max-h-*`·`p-0` 확장 |

```46:68:src/components/ui/Modal.tsx
    <div
      className={cn(
        "fixed inset-0 z-50 flex items-center justify-center bg-[var(--overlay)] p-4 backdrop-blur-[2px]",
        wrapperClassName,
      )}
      ...
    >
      <div
        className={cn(
          "rounded-2xl border border-[var(--border)] bg-[var(--surface-elevated)] p-6 shadow-[var(--shadow-modal)]",
          className,
        )}
```

**한계:** **fullscreen / xl 프리셋 이름은 없음** — Tailwind 클래스로만 확장. z-index는 `50` (스마트스토어 모달은 `z-[80]`).

**다른 예:** `src/components/admin/members/AdminMemberDetailDrawer.tsx` — `Modal` 사용.

---

### [3] 질문에 대한 직접 답

1. **대형 모달 패턴:** 현재는 (1) `Modal` 작은 폼용 (2) **인라인 full-screen 래퍼** (`SmartstoreHtmlGenerateModal` 스타일) 두 갈래.
2. **좌우 2단:** 공용 컴포넌트에 **그리드가 없음** — `flex`/`grid`를 모달 **children**에서 직접 구성.
3. **sticky header/footer:** 공용에 없음. 스마트스토어 모달은 `header`/`footer` `shrink-0` + 본문 `min-h-0 flex-1 overflow-hidden` 패턴.

---

## [4] 상품 데이터 — 유인물 프리필에 쓸 필드

### 4-1. `Product` 타입 (발췌)

핵심 필드는 `src/types/product.ts`의 `export type Product`:

```176:300:src/types/product.ts
export type Product = {
  id: string;
  title: string;
  description: string;
  image_url: string;
  images_json?: string[];
  category: string;
  theme?: string;
  destination_id?: string | null;
  product_line_id?: string | null;
  ...
  price?: number;
  seasonal_price_bands?: SeasonalPriceBands | null;
  duration?: string;
  departure?: string;
  airline?: string;
  hotel?: string;
  travelStyle?: string;
  departures?: string[];
  itinerary_days?: ProductItineraryDay[];
  itinerary?: string;
  included_items?: string;
  excluded_items?: string;
  detailed_schedule?: string;
  optional_tours?: string;
  ...
  departure_from_airport?: string;
  departure_from_date?: string;
  departure_from_time?: string;
  ...
  departure_flight_name?: string;
  ...
  one_liner?: string;
  overview_json?: ProductOverview | null;
  itinerary_media_json?: Record<string, string> | null;
  itinerary_days_json?: ItineraryStructuredDay[] | null;
  itinerary_v2_json?: ItineraryV2 | null;
  overview_region?: string;
  overview_duration?: string;
  ...
};
```

### 4-2. 포함/불포함 해석 (상세와 동일)

```7:25:src/lib/products/resolveProductDetailBodyFields.ts
export function resolveProductDetailBodyFields(product: Product): {
  resolvedIncludedItems: string;
  resolvedExcludedItems: string;
  resolvedOptionalTours: string | undefined;
} {
  ...
}
```

### [4] 질문에 대한 직접 답

1. **이미 있는 필드:** 상품명·설명·한줄요약·가격·기간·지역(overview/taxonomy)·이미지·포함/불포함/선택관광·일정(v2/텍스트)·항공/출발 **DB 필드 다수** (`departure_from_*`, `departure_flight_name` 등).
2. **자동 초안 범위:** 스마트스토어 VM 수준 + 유인물용 **짧은 불릿 요약**은 `mapProductToTimelineModel`·`one_liner`·`overview_json`로 확장 가능.
3. **출발/항공:** **필드는 있음** — 다만 운영 입력이 비어 있으면 **수동 입력/플레이스홀더**가 필요할 수 있음.

---

## [5] 이미지 관련 유틸

| 파일 | 역할 |
|------|------|
| `src/lib/products/images.ts` | `normalizeImageList`, **`getPrimaryImageUrl`** (`images_json[0]` 우선) |
| `src/lib/media/normalizeProductImageUrl.ts` | 모두투어 CDN 등 URL 정규화 (목록 썸네일에 사용) |
| `src/components/admin/products/AdminProductsListView.tsx` | 목록 썸네일: `normalizeProductImageUrl(product.image_url)` |

```17:21:src/lib/products/images.ts
export function getPrimaryImageUrl(product: Pick<Product, "image_url" | "images_json">): string {
  const list = normalizeImageList(product.images_json);
  if (list.length > 0) return list[0];
  return product.image_url?.trim() || "";
}
```

**스마트스토어에서 갤러리 + 일정에서 보충:** `mapProductToSmartstoreHtmlViewModel`의 `itineraryExtras` 루프 (최대 6장까지).

### [5] 질문에 대한 직접 답

1. **소스:** `images_json` 배열 → 없으면 `image_url`.
2. **우선순위:** 위와 동일; 스마트스토어는 https·도메인 필터(`acceptSmartstoreHttpsImageUrl`).
3. **유인물 미리보기:** **동일 유틸로 URL 리스트 구성 가능**; 레이아웃은 새로 작성.

---

## [6] 스타일 / 디자인 토큰

| 파일 | 역할 |
|------|------|
| `src/app/globals.css` | `:root` 브랜드·**`--primary`**, `--surface`, `--border`, `--danger`, `--shadow-modal`, `--overlay`** 등 |

```64:71:src/app/globals.css
  --primary: var(--theall-brand-blue);
  ...
  --on-primary: #ffffff;
```

```114:115:src/app/globals.css
  --shadow-modal: 0 22px 70px rgba(11, 18, 32, 0.2);
  --overlay: rgba(11, 18, 32, 0.45);
```

관리자 컴포넌트는 Tailwind에서 `bg-[var(--surface)]`, `text-[var(--text-primary)]` 패턴을 광범위하게 사용.

### [6] 질문에 대한 직접 답

1. **토큰 재사용:** `--primary`, `--text-*`, `--border`, `--surface`, `--danger/success` 및 `dark` 변형.
2. **모달 vs 인쇄물:** 미리보기 영역만 토큰을 쓰고, **인쇄용 A4**는 `@media print` 또는 **별도 `mm` 단위 컨테이너** + 내장 폰트 스택이 안전.
3. **print CSS:** `src` 아래 `*.css`에서 **`@media print` 검색 시 현재 거의 없음** — 유인물에서 **새로 추가**할 여지 큼.

---

## [7]보내기 / PNG / 업로드

**html2canvas / dom-to-image:** 코드베이스에서 **미사용** (검색 기준).

**Canvas `toBlob` 사용처 (PDF/이미지 파이프라인):**

- `src/lib/pdf/renderFirstPageToWebp.ts`
- `src/lib/images/resizeAndConvertToWebp.ts`
- `src/lib/images/deriveCardAndHeroWebp.ts`

→ **브라우저 DOM → PNG**가 아니라 **서버/캔버스 기반 이미지 처리**에 가깝습니다. **유인물 A4 DOM 캡처**는 `html-to-image` 등 **신규 의존성** 또는 **인쇄 PDF** 검토.

**공유 링크 저장 패턴:** 유인물 전용 **기존 구조 없음**. 상품은 DB `products` 단일; 부가 콘텐츠는 홈 큐레이션 등 **별도 테이블** 패턴이 있음 (아래 [8]).

### [7] 질문에 대한 직접 답

1. **A4 DOM → PNG 기존 자산:** **없음**.
2. **고유 링크 부여:** **제품 코드 없음** — 새 API·테이블 또는 Storage 경로 규칙 설계 필요.
3. **Storage 업로드 후 URL:** `src/app/api/admin/uploads/image` 등 기존 업로드 API 활용 가능 (별도 확인 시 라우트 구현 참고).
4. **관리자 URL vs 공개 링크:** 관리자는 `/theall_manager_only/...`; 공개 유인물은 **slug 또는 서명 URL**로 분리하는 것이 일반적.

---

## [8] Draft / 템플릿 / JSON 저장 패턴

| 파일 | 역할 |
|------|------|
| `src/components/admin/products/editor/hooks/useProductFormAutosave.ts` | **로컬 스토리지** 기반 draft 지문 + debounce |
| `src/components/admin/products/editor/hooks/useEditorSectionPersistence.ts` | `localStorage` 키 `admin-product-editor-ui:...` |
| `src/types/adminProductForm.ts` (별도) | 폼 상태 전체 구조 — **상품 본문과 동일 스키마 아님** |

**유인물 전용 `product_id + template_key + content_json`:** DB에 **현재 컬럼 없음**으로 보이며, **신규 테이블** 또는 `products`에 jsonb 컬럼 추가가 설계 선택지.

### [8] 질문에 대한 직접 답

1. **별도 테이블:** 캠페인·큐레이션처럼 **부가 엔티티**로 두는 것이 자연스러움.
2. **기존 구조에 붙이기:** 초기 MVP는 **localStorage + export만** 가능; 영속은 DB.
3. **`product_id + template_key + content_json`:** **잘 맞는 키 설계** (버전 필드 추가 권장).

---

## [9] 파일별 요약 표 (스마트스토어·목록 핵심만)

| 경로 | 역할 (1~2줄) | 유인물에서 왜 중요 | 재사용 vs 신규 |
|------|----------------|-------------------|----------------|
| `AdminProductManager.tsx` | 목록/편집 전환, 모달 state | 모달 오픈의 단일 진입점 | **패턴 재사용** |
| `AdminProductListSection.tsx` | 목록 컨트롤러 → 뷰 | 콜백 props 한 단계 전달 | **확장** |
| `AdminProductsListView.tsx` | 테이블·작업 열 | 열 폭·행 구조 | **버튼만 추가** |
| `AdminProductsQuickActions.tsx` | 작업 버튼 | 유인물 버튼 추가 위치 | **확장** |
| `adminProducts.types.ts` | ListView props 타입 | `onOpenFlyer` 타입 추가 | **확장** |
| `SmartstoreHtmlGenerateModal.tsx` | HTML 모달 | 미리보기/푸터 패턴 참고 | **레이아웃은 신규** |
| `smartstore-html/route.ts` | 서버 HTML 생성 | 유인물 PDF/PNG API 병행 시 참고 | **유사 라우트 신규** |
| `buildSmartstoreDetailHtml*.ts` | VM→HTML | 텍스트 조립·섹션 분리 학습 | **로직 일부 공유 가능** |
| `mapProductToSmartstoreHtmlViewModel.ts` | Product→VM | 프리필 소스 | **함수 분리·재사용 추천** |
| `resolveProductDetailBodyFields.ts` | 포함/불포함 | 유인물 체크박스 기본값 | **직접 재사용** |
| `smartstoreHtml.types.ts` | VM/Meta 타입 | FlyerViewModel 타입 모델링 참고 | **별도 타입 신규** |
| `Modal.tsx` | 공용 다이얼로그 | 토큰 정렬된 래퍼 | **확장 또는 인라인 z-80** |
| `types/product.ts` | Product | 필드 전체 | **참조만** |
| `lib/products/images.ts` | 대표 이미지 | 갤러리 2~4장 | **재사용** |
| `globals.css` | CSS 변수 | 브랜딩 일치 | **토큰 재사용** |
| `useProductFormAutosave.ts` | 로컬 draft | 유인물 임시저장 아이디어 | **패턴 참고** |

---

## [10] 결론 (구현 판단용)

### A. 작업 열 버튼 추가 수정 위치

1. `AdminProductsQuickActions.tsx` — 버튼·아이콘·optional 콜백 `onFlyer?`  
2. `adminProducts.types.ts` — `AdminProductsListViewProps`에 `onOpenFlyer?`  
3. `AdminProductsListView.tsx` — `onOpenFlyer={onOpenFlyer}` 전달 (데스크톱+모바일)  
4. `AdminProductListSection.tsx` — props 전달  
5. `AdminProductManager.tsx` — state + 모달 렌더

### B. 유인물 모달을 여는 가장 자연스러운 위치

**`AdminProductManager.tsx`** — 스마트스토어와 동일. (목록만 쓰는 다른 진입이 생기면 동일 props만 복제.)

### C. 스마트스토어 HTML 모달에서 재사용 가능한 범위

- **재사용:** 세션/인증 fetch 패턴, `meta` 요약 UI 아이디어, 푸터 액션(닫기·복사·재생성), 토스트 연동, **Product→텍스트/이미지 VM** (`mapProductToSmartstoreHtmlViewModel` / `resolveProductDetailBodyFields`).  
- **부분 재사용:** API의 “상품 풀 로드 → 가공” 흐름.  
- **비재사용:** 좌측 폼+체크박스+편집, **실시간** 미리보기, A4 레이아웃 컴포넌트.

### D. A4 미리보기 컴포넌트

**새로 만드는 것이 맞음.** 고정 비율(`210mm × 297mm` 스케일 또는 `aspect-[210/297]`), 인쇄용 폰트·여백은 **유인물 전용**으로 두는 편이 안전.

### E. “링크 + PNG” 동시 제공

- **프론트만:** PNG는 **클라이언트 캡처 라이브러리**로 가능(의존성 추가). “공유 링크”는 **어딘가에 저장**하지 않으면 **불가** (북마크 가능한 URL이 없음).  
- **API + Storage:** PNG(또는 PDF) 업로드 → **공개 읽기 URL** 또는 **서명 URL** + DB에 `flyer_asset_url`, `slug` 저장이 **일반적**.  
- **결론:** 링크가 **진짜 링크**여야 하면 **서버·스토리지·DB**가 필요.

### F. PR 분할 제안 (안전한 순서)

1. **PR1 — UI 뼈대:** 작업 열 버튼 + 빈/플레이스홀더 모달 + 좌우 레이아웃 + 디자인 토큰만.  
2. **PR2 — 데이터:** `FlyerViewModel` + Product 프리필 + 체크박스 전체선택/해제 + 로컬 state 실시간 미리보기.  
3. **PR3 — Export:** 인쇄 CSS / 클라이언트 PNG 또는 서버 PDF.  
4. **PR4 — 영속:** DB/Storage + 공유 링크 API + (선택) draft 복원.

---

*문서 끝.*
