# PR-FLYER-LONGFORM 설계용 코드 발췌

유인물을 A4 1장 고정에서 **모바일 친화 세로 롱포맷**으로 전환할 때 참고할 현행 구조 요약입니다.  
(발췌 시점 기준 경로·라인은 저장소 기준입니다.)

---

## 1. 전체 흐름: state → render → export

1. **단일 소스**: `FlyerDraftState` (`draft`)가 모달·미리보기·공개 페이지 모두에서 동일하게 사용됩니다.
2. **렌더**: `FlyerA4Preview`가 `draft`를 받아 `FlyerTemplateDefault` 또는 `FlyerTemplateVisual`로 분기합니다.
3. **오버플로 측정**: `measureRef`가 붙은 영역(`flyer-a4-measure`)의 `scrollHeight > clientHeight`로 A4 초과 여부를 판단합니다.
4. **PNG**: `FlyerA4Preview` **최상위 루트** `ref`를 넘기고, 그 안에서 `[data-flyer-paper]` 노드만 `html-to-image`의 `toPng`로 캡처합니다.
5. **인쇄**: `body.print-flyer-only` 클래스로 미리보기 루트만 보이게 한 뒤 `window.print()`; `@media print`에서 `[data-flyer-paper]`를 210mm×297mm로 고정합니다.

---

## 2. Draft 타입 및 도메인 (`flyer.types.ts`)

섹션 키, 템플릿 키, 레이아웃 옵션, 편집 필드, 날씨·복장 상태가 한 객체에 묶입니다.

```13:80:src/lib/flyers/flyer.types.ts
export type FlyerSectionKey =
  | "header"
  | "departure"
  | "baggage"
  | "preparation"
  | "includedExcluded"
  | "notice"
  | "weather"
  | "gallery"
  | "footer";

export type FlyerSectionToggles = Record<FlyerSectionKey, boolean>;

/** 저장·공개 페이지에서 동일하게 사용 */
export type FlyerTemplateKey =
  | "a4-portrait-default"
  | "a4-portrait-compact"
  | "a4-portrait-visual";

export type FlyerLayoutOptions = {
  /** 여백·타이포 소폭 축소 (인쇄물에 반영) */
  compactMode: boolean;
  /** 갤러리 셀·열 비중 */
  imageDensity: "normal" | "compact";
  /** 섹션 간 간격 */
  spacingMode: "normal" | "tight";
};

// ...

export type FlyerDraftState = {
  templateKey: FlyerTemplateKey;
  layoutOptions: FlyerLayoutOptions;
  sections: FlyerSectionToggles;
  fields: FlyerEditableFields;
  /** 조회 메타·일별 요약 (fields_json 내 `weather` 키로 저장) */
  weather: FlyerWeatherDraftState;
  /** 날씨 기반 복장·준비물 체크리스트 (fields_json `outfit`) */
  outfit: FlyerOutfitDraftState;
  selectedImageUrls: string[];
};
```

모달 props 타입은 `flyerModal.types.ts`에서 도메인 타입을 re-export합니다.

```1:24:src/components/admin/products/modals/flyerModal.types.ts
import type { Product } from "@/types/product";
import type { FlyerPersistedBootstrap } from "@/lib/flyers/flyer.types";

export type {
  FlyerSectionKey,
  FlyerSectionToggles,
  FlyerEditableFields,
  FlyerDraftState,
  FlyerOutfitChecklistItem,
  FlyerOutfitDraftState,
  FlyerWeatherDay,
  FlyerWeatherDraftState,
} from "@/lib/flyers/flyer.types";

export { FLYER_SECTION_KEYS, FLYER_SECTION_LABELS } from "@/lib/flyers/flyer.types";

export type FlyerGenerateModalProps = {
  open: boolean;
  product: Product | null;
  onClose: () => void;
  showToast?: (kind: "success" | "error" | "warning", message: string) => void;
  /** /theall_manager_only/flyers/[id] 등에서 저장본으로 열 때 */
  persistedBootstrap?: FlyerPersistedBootstrap | null;
};
```

---

## 3. 유인물 생성 모달: 상태·저장·미리보기·보내기 연결

### 3.1 ref·state·commit 패턴

- `draftRef` + `useState(draft)` 이중 유지로 최신 draft를 콜백에서 안전히 참조.
- `previewRef`는 **미리보기 루트**(`FlyerA4Preview`의 forwardRef 타겟)에 연결 → PNG 시 이 노드에서 `[data-flyer-paper]` 탐색.

```106:159:src/components/admin/products/modals/FlyerGenerateModal.tsx
function FlyerModalShell({ product, onClose, showToast, persistedBootstrap }: FlyerModalShellProps) {
  const previewRef = useRef<HTMLDivElement>(null);
  const draftRef = useRef<FlyerDraftState>(
    persistedBootstrap?.draft
      ? normalizePersistedFlyerDraft(persistedBootstrap.draft, product)
      : buildInitialFlyerDraft(product),
  );

  const [draft, setDraft] = useState<FlyerDraftState>(() => draftRef.current);
  // ...
  const [exportPending, setExportPending] = useState(false);
  const [a4Overflow, setA4Overflow] = useState(false);
  const [previewSize, setPreviewSize] = useState<"fit" | "full">("fit");
  // ...

  const commitDraft = useCallback((next: FlyerDraftState) => {
    draftRef.current = next;
    setDraft(next);
    setDirty(true);
  }, []);
```

### 3.2 저장 API 페이로드 (draft → 서버)

```307:321:src/components/admin/products/modals/FlyerGenerateModal.tsx
  const saveFlyer = useCallback(async (): Promise<string | null> => {
    // ...
    const d = draftRef.current;
    try {
      const body = {
        productId: product.id,
        templateKey: d.templateKey,
        layoutOptions: d.layoutOptions,
        sections: d.sections,
        fields: d.fields,
        weather: d.weather,
        outfit: d.outfit,
        imageUrls: d.selectedImageUrls.slice(0, 4),
      };
```

### 3.3 공유 링크

저장 후 `share_slug`를 ref/state에 보관하고, `buildPublicFlyerUrl(origin, slug)`로 `/flyers/{slug}` URL을 클립보드에 복사합니다.

```383:398:src/components/admin/products/modals/FlyerGenerateModal.tsx
  const copyShareLink = useCallback(async () => {
    if (typeof window === "undefined") return;
    if (!savedDraftIdRef.current || dirty) {
      await saveFlyer();
    } else if (!savedShareSlugRef.current?.trim()) {
      await saveFlyer();
    }
    const sl = savedShareSlugRef.current?.trim();
    if (!sl) {
      showToast?.("error", "공유 링크(slug)가 없습니다. 저장을 다시 시도해 주세요.");
      return;
    }
    const url = buildPublicFlyerUrl(window.location.origin, sl);
    try {
      await navigator.clipboard.writeText(url);
      showToast?.("success", "공유 링크가 복사되었습니다.");
```

### 3.4 인쇄·PNG (previewRef → export)

```420:445:src/components/admin/products/modals/FlyerGenerateModal.tsx
  const handlePrint = useCallback(() => {
    document.body.classList.add("print-flyer-only");
    const cleanup = () => document.body.classList.remove("print-flyer-only");
    window.addEventListener("afterprint", cleanup, { once: true });
    window.setTimeout(cleanup, 120_000);
    window.print();
  }, []);

  const handlePngExport = useCallback(async () => {
    const root = previewRef.current;
    if (!root) {
      showToast?.("error", "미리보기를 찾을 수 없습니다.");
      return;
    }
    setExportPending(true);
    try {
      const name = sanitizeFlyerPngFileName(draftRef.current.fields.title || product.title || "product");
      await exportFlyerToPng(root, name);
      showToast?.("success", "PNG 파일을 저장했습니다.");
    } catch (e) {
      // ...
    } finally {
      setExportPending(false);
    }
  }, [product.title, showToast]);
```

### 3.5 미리보기 영역에서 ref 연결

오버플로 힌트 → `FlyerA4Preview`에 `onOverflowChange` · `previewSize` 전달.

```1055:1078:src/components/admin/products/modals/FlyerGenerateModal.tsx
            <div className="flex justify-center">
              <FlyerA4Preview
                ref={previewRef}
                draft={draft}
                product={product}
                previewSize={previewSize}
                onOverflowChange={setA4Overflow}
              />
            </div>
```

---

## 4. A4 Preview: 래퍼·종이·측정 (`FlyerA4Preview.tsx`)

- **루트**: `data-flyer-preview="a4"`, `ref`가 여기에 붙음 → PNG/인쇄 숨김 로직의 기준점.
- **종이**: `data-flyer-paper`, `aspectRatio: 210/297`, `overflow-hidden` → **내용이 잘려 보이는 구조**(롱포맷 전환 시 이 제약이 핵심).
- **내부**: `flyer-sheet-inner` + `getFlyerSpacing(draft)` 패딩.
- **템플릿 분기**: `templateKey === "a4-portrait-visual"` → `FlyerTemplateVisual`, 아니면 `FlyerTemplateDefault`.

```51:78:src/components/admin/products/modals/FlyerA4Preview.tsx
  const isVisual = draft.templateKey === "a4-portrait-visual";

  const paperWidthClass =
    previewSize === "full"
      ? "w-[420px] min-w-[280px] max-w-[min(420px,100%)]"
      : "w-full max-w-[min(420px,100%)]";

  return (
    <div
      ref={ref}
      className="flyer-a4-preview-root flex w-full justify-center print:w-full"
      data-flyer-preview="a4"
      data-flyer-template={draft.templateKey}
    >
      <div
        data-flyer-paper
        className={`flyer-sheet relative ${paperWidthClass} overflow-hidden rounded-xl border border-[var(--flyer-border,#e5e7eb)] bg-white text-[var(--flyer-ink,#111827)] shadow-[0_12px_40px_rgba(0,0,0,0.1)] print:shadow-none print:border-0 print:rounded-none`}
        style={{ aspectRatio: "210 / 297" }}
      >
        <div className={`flyer-sheet-inner absolute inset-0 flex flex-col overflow-hidden ${sp.inner}`}>
          {isVisual ? (
            <FlyerTemplateVisual draft={draft} measureRef={measureRef} images={images} />
          ) : (
            <FlyerTemplateDefault draft={draft} measureRef={measureRef} images={images} />
          )}
        </div>
      </div>
    </div>
  );
```

오버플로 감지(ResizeObserver):

```36:49:src/components/admin/products/modals/FlyerA4Preview.tsx
  const checkOverflow = useCallback(() => {
    const el = measureRef.current;
    if (!el || !onOverflowChange) return;
    onOverflowChange(el.scrollHeight > el.clientHeight + 2);
  }, [onOverflowChange]);

  useEffect(() => {
    const el = measureRef.current;
    if (!el || !onOverflowChange) return;
    checkOverflow();
    const ro = new ResizeObserver(() => checkOverflow());
    ro.observe(el);
    return () => ro.disconnect();
  }, [draft, checkOverflow, onOverflowChange]);
```

---

## 5. PNG: 라이브러리·selector·다운로드 (`exportFlyerToPng.ts`)

- **`html-to-image`** `toPng`만 사용(dom-to-image 없음).
- 캡처 대상: `previewRoot.querySelector("[data-flyer-paper]")`, 없으면 `previewRoot` 전체.
- 파일명 접미사 현재 `-flyer-a4.png` (롱포맷 시 변경 후보).

```1:40:src/lib/flyers/exportFlyerToPng.ts
import { toPng } from "html-to-image";

const PAPER_SELECTOR = "[data-flyer-paper]";

function triggerDownload(dataUrl: string, fileName: string) {
  const a = document.createElement("a");
  a.href = dataUrl;
  a.download = fileName;
  a.rel = "noopener";
  document.body.appendChild(a);
  a.click();
  a.remove();
}

// ...

export async function exportFlyerToPng(previewRoot: HTMLElement, fileName: string): Promise<void> {
  const paper =
    (previewRoot.querySelector(PAPER_SELECTOR) as HTMLElement | null) ?? previewRoot;
  const dataUrl = await toPng(paper, {
    pixelRatio: 2,
    backgroundColor: "#ffffff",
    cacheBust: true,
  });
  triggerDownload(dataUrl, fileName);
}
```

---

## 6. 공개 페이지·API

### 6.1 라우트

- 페이지: `src/app/flyers/[slug]/page.tsx` → 클라이언트에 slug만 넘김.
- 데이터: `GET /api/public/flyers/[slug]` → `flyerDraftStateFromRowParts`로 `FlyerDraftState` 복원.

```1:6:src/app/flyers/[slug]/page.tsx
import PublicFlyerClient from "@/components/flyers/PublicFlyerClient";

export default async function PublicFlyerPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  return <PublicFlyerClient slug={slug} />;
}
```

```16:62:src/app/api/public/flyers/[slug]/route.ts
  const { data, error } = await supabaseAdmin
    .from("flyer_drafts")
    .select(
      "sections_json, fields_json, image_urls_json, title, subtitle, share_slug, template_key, layout_options_json",
    )
    .eq("share_slug", slug)
    .maybeSingle();
  // ...
  const draft = flyerDraftStateFromRowParts(
    row.sections_json,
    row.fields_json,
    row.image_urls_json,
    row.template_key,
    row.layout_options_json,
  );
```

### 6.2 공개 UI: 동일 미리보기·동일 PNG 경로

`PublicFlyerClient`도 `previewRef` + `FlyerA4Preview` + `exportFlyerToPng(previewRef.current)` 패턴을 **모달과 동일**하게 사용합니다.

```61:71:src/components/flyers/PublicFlyerClient.tsx
  const handlePng = useCallback(async () => {
    const root = previewRef.current;
    if (!root || !draft) return;
    setPngPending(true);
    try {
      const name = sanitizeFlyerPngFileName(draft.fields.title || displayTitle || "flyer");
      await exportFlyerToPng(root, name);
    } finally {
      setPngPending(false);
    }
  }, [draft, displayTitle]);
```

```131:133:src/components/flyers/PublicFlyerClient.tsx
      <main className="mx-auto flex max-w-3xl justify-center px-4 py-8 print:py-0 print:px-0">
        <FlyerA4Preview ref={previewRef} draft={draft} product={null} onOverflowChange={setA4Overflow} />
      </main>
```

URL 빌더:

```9:12:src/lib/flyers/publicFlyer.ts
export function buildPublicFlyerUrl(origin: string, slug: string): string {
  const base = origin.replace(/\/$/, "");
  return `${base}/flyers/${encodeURIComponent(slug.trim())}`;
}
```

---

## 7. 섹션 렌더 구조

### 7.1 Default 템플릿: 헤더 / 측정 영역 / 푸터

측정 ref는 **본문 스크롤 가능 영역**에 붙고, 좌측 스택(`FlyerMainStackBlocks`) + 우측 갤러리 열(`FlyerGalleryColumn`) 구조입니다.

```14:45:src/components/admin/products/modals/FlyerTemplateDefault.tsx
export function FlyerTemplateDefault({
  draft,
  measureRef,
  images,
}: {
  draft: FlyerDraftState;
  measureRef: RefObject<HTMLDivElement | null>;
  images: string[];
}) {
  const sp = getFlyerSpacing(draft);
  const typo = flyerTypographyScale(draft);
  const ctx = { sections: draft.sections, f: draft.fields, sp, typo };
  return (
    <>
      <FlyerHeaderBlock {...ctx} />
      <div ref={measureRef} className="flyer-a4-measure min-h-0 flex-1 overflow-hidden">
        <div className={`flex h-full min-h-0 flex-col ${sp.stackGap} overflow-hidden`}>
          <FlyerDepartureBlock {...ctx} />
          <div className={`flex min-h-0 flex-1 ${sp.rowGap} overflow-hidden`}>
            <FlyerMainStackBlocks
              {...ctx}
              weatherDays={draft.weather.isLoaded ? draft.weather.days : []}
              outfit={draft.outfit}
            />
            <FlyerGalleryColumn sections={draft.sections} images={images} sp={sp} />
          </div>
        </div>
      </div>
      <FlyerFooterBlock {...ctx} />
    </>
  );
}
```

### 7.2 Visual 템플릿: 히어로 이미지 + 헤더 오버레이

첫 번째 이미지를 히어로로 쓰고, 나머지를 사이드 갤러리로 넘깁니다.

```33:88:src/components/admin/products/modals/FlyerTemplateVisual.tsx
  const showHero = sections.gallery && images.length > 0;
  const heroUrl = showHero ? images[0] : null;
  const sideImages = showHero ? images.slice(1) : images;
  // ...
      {showHero && heroUrl ? (
        <div className={`flyer-visual-hero relative mb-2 shrink-0 overflow-hidden rounded-lg border border-[var(--flyer-border,#e5e7eb)] ${heroH}`}>
          <Image
            src={heroUrl}
            alt=""
            fill
            className="object-cover object-center"
            sizes="400px"
            unoptimized={unoptimizedUrl(heroUrl)}
          />
```

### 7.3 `FlyerTemplateSections.tsx`: 블록 단위

- `FlyerHeaderBlock`, `FlyerDepartureBlock`, `FlyerMainStackBlocks`(baggage, preparation+outfit, included/excluded, notice, weather), `FlyerGalleryColumn`, `FlyerFooterBlock`.
- 섹션 on/off는 `sections.*` 불리언으로 제어.

`FlyerMainStackBlocks` 시작 부분(수하물·준비물·복장·포함불포함·유의사항·날씨):

```63:92:src/components/admin/products/modals/FlyerTemplateSections.tsx
export function FlyerMainStackBlocks({
  sections,
  f,
  sp,
  typo,
  weatherDays = [],
  outfit,
}: BlockCtx & { weatherDays?: FlyerWeatherDay[]; outfit?: FlyerOutfitDraftState }) {
  const outfitIncluded = outfit?.items.filter((i) => i.included) ?? [];
  return (
    <div className={`flyer-main-col min-w-0 flex-1 overflow-hidden ${sp.mainStack}`}>
      {sections.baggage ? (
        <section
          className={`flyer-card rounded-lg border border-amber-200/90 bg-amber-50/60 ${sp.cardPad} print:border-amber-300 print:bg-amber-50`}
        >
          <p className={`${typoSec(typo)} text-amber-950`}>{f.baggageTitle}</p>
          <ul className={`${typoList(typo)} mt-1.5 list-outside list-disc pl-4 text-[var(--flyer-ink,#1f2937)]`}>
            {f.baggageLines.map((line, i) => (
              <li key={i} className="break-words py-px [text-wrap:pretty]">
                {line}
              </li>
            ))}
          </ul>
        </section>
      ) : null}

      {sections.preparation ? (
        <section
          className={`flyer-card rounded-lg border border-sky-200/90 bg-sky-50/50 ${sp.cardPad} print:border-sky-200 print:bg-sky-50/80`}
        >
```

갤러리 열: `next/image` `fill`, 외부 URL은 `unoptimized`.

```197:224:src/components/admin/products/modals/FlyerTemplateSections.tsx
export function FlyerGalleryColumn({
  sections,
  images,
  sp,
}: {
  sections: FlyerSectionToggles;
  images: string[];
  sp: FlyerSpacingClasses;
}) {
  if (!sections.gallery) return null;
  return (
    <aside className={`flyer-gallery flex ${sp.galleryW} shrink-0 flex-col ${sp.galleryGap} overflow-hidden print:max-w-[44%]`}>
      {images.length > 0 ? (
        images.map((url, i) => (
          <div
            key={`${url}-${i}`}
            className="relative aspect-[4/3] w-full overflow-hidden rounded-md border border-[var(--flyer-border,#e5e7eb)] bg-neutral-100"
          >
            <Image
              src={url}
              alt=""
              fill
              className="object-cover object-center"
              sizes="200px"
              unoptimized={
                url.startsWith("http://") || url.startsWith("https://") || url.startsWith("data:")
              }
            />
```

---

## 8. 간격·타이포 (`flyerSpacing.ts`)

`layoutOptions`와 `templateKey`가 패딩·갤러리 폭 등 Tailwind 클래스 문자열을 결정합니다.

```14:40:src/components/admin/products/modals/flyerSpacing.ts
export function getFlyerSpacing(draft: FlyerDraftState): FlyerSpacingClasses {
  const lo = draft.layoutOptions;
  const compress = lo.compactMode || lo.spacingMode === "tight";
  const imgCompact = lo.imageDensity === "compact" || draft.templateKey === "a4-portrait-compact";

  let galleryW = "w-[38%]";
  if (draft.templateKey === "a4-portrait-visual") {
    galleryW = imgCompact ? "w-[40%]" : "w-[44%]";
  } else if (imgCompact) {
    galleryW = "w-[26%]";
  }

  return {
    inner: compress ? "px-[5%] py-[4%]" : "px-[5.5%] py-[5%]",
    stackGap: compress ? "gap-1.5" : "gap-2.5",
    rowGap: compress ? "gap-1.5" : "gap-2.5",
    mainStack: compress ? "space-y-1.5" : "space-y-2.5",
    cardPad: compress ? "p-2" : "p-2.5",
    galleryW,
    galleryGap: compress ? "gap-1" : "gap-1.5",
    headerMb: compress ? "mb-2 pb-2" : "mb-3 pb-3",
  };
}
```

---

## 9. 이미지 후보·선택 (`flyerModal.utils` + `FlyerImageSelector`)

- 후보 URL: `collectFlyerCandidateImageUrls` — 대표 이미지 우선 + `images_json` (유틸에 정의).
- 선택: 최대 4장, 순서 조정, 썸네일은 작은 `Image` + 외부 URL `unoptimized`.

```21:33:src/components/admin/products/modals/FlyerImageSelector.tsx
export function FlyerImageSelector({ product, selected, onChange, disabled }: FlyerImageSelectorProps) {
  const candidates = collectFlyerCandidateImageUrls(product);

  const toggle = (url: string) => {
    if (disabled) return;
    const i = selected.indexOf(url);
    if (i >= 0) {
      onChange(selected.filter((u) => u !== url));
      return;
    }
    if (selected.length >= MAX) return;
    onChange([...selected, url]);
  };
```

`FlyerA4Preview`는 `draft.selectedImageUrls.slice(0, 4)`만 템플릿에 넘깁니다.

---

## 10. 인쇄용 글로벌 CSS (`globals.css`)

- `@page size: A4 portrait`
- `[data-flyer-paper]`: 인쇄 시 **210mm × 297mm**, `overflow: hidden`
- `print-flyer-only`: 모달에서 미리보기 트리만 visibility 복구

```1255:1320:src/app/globals.css
@media print {
  @page {
    size: A4 portrait;
    margin: 0;
  }
  /* ... */
  [data-flyer-paper] {
    box-shadow: none !important;
    border-radius: 0 !important;
    max-width: none !important;
    width: 210mm !important;
    height: 297mm !important;
    aspect-ratio: auto !important;
    border: none !important;
    page-break-after: avoid;
    page-break-inside: avoid;
    overflow: hidden !important;
  }

  .flyer-a4-preview-root {
    width: 100% !important;
    display: flex !important;
    justify-content: center !important;
  }

  .flyer-sheet-inner {
    padding: 12mm 11mm !important;
  }
}

/* 관리자 모달 인쇄: 본문만 보이게 */
@media print {
  body.print-flyer-only * {
    visibility: hidden;
  }
  body.print-flyer-only .flyer-a4-preview-root,
  body.print-flyer-only .flyer-a4-preview-root * {
    visibility: visible;
  }
  body.print-flyer-only .flyer-a4-preview-root {
    position: fixed;
    left: 0;
    top: 0;
    width: 100%;
    height: auto;
    z-index: 99999;
    display: flex !important;
    justify-content: center;
    padding: 0 !important;
    margin: 0 !important;
  }
}
```

---

## 11. 롱포맷 전환 시 직접 건드릴 가능성이 큰 지점 (체크리스트)

| 영역 | 파일·요소 |
|------|-----------|
| 고정 비율·클리핑 | `FlyerA4Preview` `aspectRatio`, `overflow-hidden`, `absolute inset-0` |
| PNG 캡처 단위 | `[data-flyer-paper]` 단일 사각형 가정 |
| 오버플로 UX | `flyer-a4-measure` + A4 초과 배지·힌트 (`buildFlyerOverflowHints`) |
| 인쇄 | `globals.css` A4 `@page` 및 mm 고정 |
| 템플릿 키·이름 | `FlyerTemplateKey` A4 접두어, 모달 배지 문구「A4 세로 1장」 |
| 파일명 | `sanitizeFlyerPngFileName` → `*-flyer-a4.png` |

---

*문서 끝. PR-FLYER-LONGFORM 설계·태스크 분해 시 이 파일을 기준으로 diff 범위를 잡으면 됩니다.*
