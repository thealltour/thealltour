# 롱포맷 유인물 PNG 저장 시 갤러리 placeholder(붉은 블록) 원인 분석용 코드 발췌

**작성 목적:** PNG 저장 시 텍스트·레이아웃은 정상인데 갤러리만 실제 이미지 대신 placeholder(사용자 관찰: 붉은 블록)로 캡처되는 현상을 추적하기 위한 **실제 코드 전체·긴 발췌**.

**추정 이슈 힌트:** `html-to-image` + 외부 URL CORS, `next/image` 최적화 경로(`/_next/image`)와 export 시점, 로딩 대기 부족, URL 정규화·`unoptimized` 분기, `fill`/`object-cover` 등.

---

## [1] PNG export 유틸 전체

**파일:** `src/lib/flyers/exportFlyerToPng.ts`

```ts
import { toPng } from "html-to-image";

const DOCUMENT_SELECTOR = "[data-flyer-document]";
const LEGACY_PAPER_SELECTOR = "[data-flyer-paper]";

/** 이미지 임베딩 실패 시에도 clone 파이프라인이 reject 되지 않도록 1×1 투명 PNG */
const IMAGE_PLACEHOLDER_PNG =
  "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==";

function triggerDownload(dataUrl: string, fileName: string) {
  const a = document.createElement("a");
  a.href = dataUrl;
  a.download = fileName;
  a.rel = "noopener";
  document.body.appendChild(a);
  a.click();
  a.remove();
}

/** 파일명용: 공백·특수문자 정리 */
export function sanitizeFlyerPngFileName(rawTitle: string): string {
  const base = rawTitle
    .trim()
    .slice(0, 60)
    .replace(/[^\p{L}\p{N}\s\-_]+/gu, "")
    .replace(/\s+/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "");
  return (base || "product") + "-flyer.png";
}

type ToPngOpts = Parameters<typeof toPng>[1];

function buildOptions(pixelRatio: number): ToPngOpts {
  return {
    pixelRatio,
    backgroundColor: "#ffffff",
    /** Supabase 서명 URL, `/_next/image?...` 등 쿼리가 깨지면 페치 실패 → PNG 전체 실패 */
    cacheBust: false,
    /** 웹폰트 임베드 실패 시 전체 중단되는 경우 완화 */
    skipFonts: true,
    imagePlaceholder: IMAGE_PLACEHOLDER_PNG,
  };
}

/**
 * 롱포맷 문서 루트(`data-flyer-document`)를 우선 캡처해 PNG 다운로드.
 * `previewRoot`는 FlyerLongformPreview 최상위 루트(ref)를 넘긴다.
 */
export async function exportFlyerToPng(previewRoot: HTMLElement, fileName: string): Promise<void> {
  const doc =
    (previewRoot.querySelector(DOCUMENT_SELECTOR) as HTMLElement | null) ??
    (previewRoot.querySelector(LEGACY_PAPER_SELECTOR) as HTMLElement | null) ??
    previewRoot;

  const ratio = typeof window !== "undefined" ? Math.min(2, window.devicePixelRatio || 1) : 2;

  let dataUrl: string;
  try {
    dataUrl = await toPng(doc, buildOptions(ratio));
  } catch (first) {
    try {
      dataUrl = await toPng(doc, buildOptions(1));
    } catch {
      const detail = first instanceof Error ? first.message : String(first);
      throw new Error(
        `PNG로 옮기지 못했습니다. (${detail}) 이미지 주소(CORS)·문서 길이·브라우저 보안 제한일 수 있습니다. 갤러리 이미지 수를 줄이거나 다른 브라우저에서 다시 시도해 보세요.`,
      );
    }
  }

  try {
    triggerDownload(dataUrl, fileName);
  } catch (e) {
    const detail = e instanceof Error ? e.message : String(e);
    throw new Error(`다운로드를 시작하지 못했습니다. (${detail})`);
  }
}
```

**요약:** `toPng` 옵션은 `pixelRatio`, `backgroundColor: "#ffffff"`, `cacheBust: false`, `skipFonts: true`, `imagePlaceholder`(1×1 투명 PNG). **이미지 페치 실패 시 라이브러리/브라우저 조합에 따라 시각적으로 “색 블록”으로 보일 수 있으나, 코드상 placeholder는 투명**이다. selector는 `[data-flyer-document]` → `[data-flyer-paper]` → `previewRoot` 순.

---

## [2] 관리자 모달의 PNG 저장 핸들러 관련

**파일:** `src/components/admin/products/modals/FlyerGenerateModal.tsx`

**import (export 관련):**

```ts
import { FlyerLongformPreview } from "./FlyerLongformPreview";
import { exportFlyerToPng, sanitizeFlyerPngFileName } from "@/lib/flyers/exportFlyerToPng";
```

**`FlyerModalShell` 내부 — `previewRef`, `exportPending`:**

```tsx
function FlyerModalShell({ product, onClose, showToast, persistedBootstrap }: FlyerModalShellProps) {
  const previewRef = useRef<HTMLDivElement>(null);
  const draftRef = useRef<FlyerDraftState>(
    persistedBootstrap?.draft
      ? normalizePersistedFlyerDraft(persistedBootstrap.draft, product)
      : buildInitialFlyerDraft(product),
  );

  const [draft, setDraft] = useState<FlyerDraftState>(() => draftRef.current);
  const [dirty, setDirty] = useState(() => !persistedBootstrap);
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  // ... 중략 ...
  const [exportPending, setExportPending] = useState(false);
```

**`handlePngExport` 전체 + 토스트:**

```tsx
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
      const msg = e instanceof Error ? e.message : "PNG 저장에 실패했습니다.";
      showToast?.("error", msg);
    } finally {
      setExportPending(false);
    }
  }, [product.title, showToast]);
```

**미리보기 영역 + `FlyerLongformPreview` 연결:**

```tsx
          <div className="min-h-0 flex-1 overflow-auto p-4 lg:p-6">
            {draft.selectedImageUrls.length > 4 ? (
              <div className="mb-3 rounded-lg border border-sky-300/50 bg-sky-500/10 px-3 py-2 text-xs text-sky-900 dark:text-sky-100 print:hidden">
                갤러리는 최대 4장만 표시·저장됩니다. (현재 {draft.selectedImageUrls.length}장)
              </div>
            ) : null}
            <div className="flex justify-center">
              <FlyerLongformPreview ref={previewRef} draft={draft} product={product} />
            </div>
          </div>
```

**푸터 — 저장 / 공유 / 인쇄 / PNG 버튼 (`exportPending` 연동):**

```tsx
      <footer className="flex shrink-0 flex-col gap-3 border-t border-[var(--border)] px-5 py-3 sm:flex-row sm:items-center sm:justify-between">
        <p className="order-2 text-xs text-[var(--text-muted)] sm:order-1">{statusLine}</p>
        <div className="order-1 flex flex-wrap justify-end gap-2 sm:order-2">
          <button type="button" onClick={onClose} className="...">닫기</button>
          <button type="button" disabled={saving} onClick={() => void saveFlyer()} className="...">저장</button>
          <button type="button" disabled={saving || exportPending} onClick={() => void copyShareLink()} className="...">
            공유 링크 복사
          </button>
          <button type="button" disabled={saving || exportPending} onClick={() => void copyAdminLink()} className="...">
            관리자 링크
          </button>
          <button type="button" disabled={saving || exportPending} onClick={handlePrint} className="...">
            인쇄
          </button>
          <button
            type="button"
            disabled={exportPending || saving}
            onClick={() => void handlePngExport()}
            className="rounded-lg border border-sky-300/50 bg-sky-500/10 px-4 py-2 text-sm font-semibold text-sky-900 hover:opacity-90 disabled:opacity-50 dark:border-sky-800 dark:text-sky-100"
          >
            {exportPending ? "PNG 생성 중…" : "PNG 저장 (전체 세로)"}
          </button>
        </div>
      </footer>
```

**참고:** export 직전 **이미지 로드 완료 대기(`await` 이미지 decode 등)** 는 없음.

---

## [3] 공개 페이지 PNG 저장 핸들러 전체

**파일:** `src/components/flyers/PublicFlyerClient.tsx`

```tsx
"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { FlyerLongformPreview } from "@/components/admin/products/modals/FlyerLongformPreview";
import { exportFlyerToPng, sanitizeFlyerPngFileName } from "@/lib/flyers/exportFlyerToPng";
import type { FlyerDraftState } from "@/lib/flyers/flyer.types";
import type { PublicFlyerApiError, PublicFlyerApiSuccess } from "@/lib/flyers/publicFlyer";
import { flyerTemplateLabel } from "@/components/admin/products/modals/flyerTemplates";

type PublicFlyerClientProps = {
  slug: string;
};

export default function PublicFlyerClient({ slug }: PublicFlyerClientProps) {
  const previewRef = useRef<HTMLDivElement>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [draft, setDraft] = useState<FlyerDraftState | null>(null);
  const [displayTitle, setDisplayTitle] = useState("유인물");
  const [pngPending, setPngPending] = useState(false);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      setLoading(true);
      setError(null);
      try {
        const res = await fetch(`/api/public/flyers/${encodeURIComponent(slug.trim())}`);
        const json = (await res.json()) as PublicFlyerApiSuccess | PublicFlyerApiError;
        if (cancelled) return;
        if (!res.ok || !json.ok) {
          setError("message" in json ? json.message : "불러올 수 없습니다.");
          setDraft(null);
          return;
        }
        setDraft(json.draft);
        setDisplayTitle(json.displayTitle);
      } catch {
        if (!cancelled) setError("네트워크 오류가 발생했습니다.");
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [slug]);

  const handlePrint = useCallback(() => {
    document.body.classList.add("print-flyer-only");
    const cleanup = () => document.body.classList.remove("print-flyer-only");
    window.addEventListener("afterprint", cleanup, { once: true });
    window.setTimeout(cleanup, 120_000);
    window.print();
  }, []);

  const handlePng = useCallback(async () => {
    const root = previewRef.current;
    if (!root || !draft) return;
    setPngPending(true);
    try {
      const name = sanitizeFlyerPngFileName(draft.fields.title || displayTitle || "flyer");
      await exportFlyerToPng(root, name);
    } catch (e) {
      console.error(e);
      const msg = e instanceof Error ? e.message : "PNG 저장에 실패했습니다.";
      window.alert(msg);
    } finally {
      setPngPending(false);
    }
  }, [draft, displayTitle]);

  // ... loading / error 분기 ...

  return (
    <div className="min-h-screen bg-[var(--bg)] text-[var(--text-primary)]">
      <header className="flyer-public-toolbar ... print:hidden sm:px-4">
        {/* ... */}
            <button type="button" disabled={pngPending} onClick={() => void handlePng()} className="...">
              {pngPending ? "PNG…" : "PNG 저장"}
            </button>
      </header>

      <main className="mx-auto w-full max-w-2xl px-2 py-4 sm:px-4 sm:py-8 print:max-w-none print:px-0 print:py-0">
        <FlyerLongformPreview ref={previewRef} draft={draft} product={null} className="w-full" />
      </main>
    </div>
  );
}
```

---

## [4] 롱포맷 미리보기 전체

**파일:** `src/components/admin/products/modals/FlyerLongformPreview.tsx`

```tsx
"use client";

import { forwardRef } from "react";
import type { Product } from "@/types/product";
import type { FlyerDraftState } from "@/lib/flyers/flyer.types";
import { isFlyerTemplateVisualVariant } from "@/lib/flyers/flyer.types";
import { getFlyerSpacing } from "./flyerSpacing";
import { FlyerTemplateDefault } from "./FlyerTemplateDefault";
import { FlyerTemplateVisual } from "./FlyerTemplateVisual";

const MAX_GALLERY = 4;

export type FlyerLongformPreviewProps = {
  draft: FlyerDraftState;
  product?: Product | null;
  className?: string;
};

/**
 * 모바일 친화 세로 롱포맷 유인물 미리보기.
 * PNG 캡처는 내부 `[data-flyer-document]` 기준 (`exportFlyerToPng`).
 */
export const FlyerLongformPreview = forwardRef<HTMLDivElement, FlyerLongformPreviewProps>(
  function FlyerLongformPreview({ draft, className }, ref) {
    const images = draft.selectedImageUrls.filter(Boolean).slice(0, MAX_GALLERY);
    const sp = getFlyerSpacing(draft);
    const isVisual = isFlyerTemplateVisualVariant(draft.templateKey);

    return (
      <div
        ref={ref}
        className={`flyer-longform-preview-root flex w-full justify-center bg-gradient-to-b from-slate-100/80 via-slate-50/50 to-slate-100/60 px-2 py-4 sm:px-4 sm:py-6 print:w-full print:bg-white print:px-0 print:py-0 ${className ?? ""}`}
        data-flyer-preview="longform"
        data-flyer-template={draft.templateKey}
      >
        <div
          data-flyer-document
          className="flyer-longform-document flyer-longform-doc-surface w-full max-w-[min(100%,28rem)] rounded-2xl border border-slate-200/90 bg-white text-[var(--flyer-ink,#0f172a)] shadow-[0_4px_24px_rgba(15,23,42,0.06),0_1px_3px_rgba(15,23,42,0.04)] sm:max-w-xl print:max-w-none print:rounded-none print:border-0 print:shadow-none"
        >
          <div className={`flex flex-col ${sp.inner}`}>
            {isVisual ? (
              <FlyerTemplateVisual draft={draft} images={images} />
            ) : (
              <FlyerTemplateDefault draft={draft} images={images} />
            )}
          </div>
        </div>
      </div>
    );
  },
);
```

**이미지 배열:** `draft.selectedImageUrls` → 필터·`slice(0, 4)` → `FlyerTemplateVisual` 또는 `FlyerTemplateDefault`에 `images`로 전달.

---

## [5] 비주얼 템플릿 전체

**파일:** `src/components/admin/products/modals/FlyerTemplateVisual.tsx`

```tsx
"use client";

import Image from "next/image";
import type { FlyerDraftState } from "@/lib/flyers/flyer.types";
import { flyerTypographyScale, getFlyerSpacing } from "./flyerSpacing";
import {
  FlyerDepartureBlock,
  FlyerFooterBlock,
  FlyerGallerySection,
  FlyerHeaderBlock,
  FlyerMainStackBlocks,
} from "./FlyerTemplateSections";

function unoptimizedUrl(url: string) {
  return url.startsWith("http://") || url.startsWith("https://") || url.startsWith("data:");
}

/** 롱포맷 비주얼: 상단 히어로(첫 이미지) → 본문 세로 누적 → 나머지 이미지 그리드 */
export function FlyerTemplateVisual({ draft, images }: { draft: FlyerDraftState; images: string[] }) {
  const sp = getFlyerSpacing(draft);
  const typo = flyerTypographyScale(draft);
  const { sections, fields: f } = draft;
  const ctx = { sections, f, sp, typo };

  const showHero = sections.gallery && images.length > 0;
  const heroUrl = showHero ? images[0] : null;
  const galleryImages = showHero ? images.slice(1) : images;

  return (
    <>
      {showHero && heroUrl ? (
        <>
          <div className="flyer-visual-hero relative mb-0 w-full shrink-0 overflow-hidden rounded-xl border border-slate-200/80 shadow-sm aspect-[16/9] min-h-[9rem] max-h-56 sm:max-h-64">
            <Image
              src={heroUrl}
              alt=""
              fill
              className="object-cover object-center"
              sizes="(max-width:640px) 100vw, 512px"
              unoptimized={unoptimizedUrl(heroUrl)}
            />
            <div className="pointer-events-none absolute inset-0 bg-gradient-to-t from-black/65 via-black/20 to-transparent" />
            {sections.header ? (
              <div className="absolute inset-x-3 bottom-3">
                <h1
                  className={`${typo === "compact" ? "text-lg sm:text-xl" : "text-xl sm:text-2xl"} font-bold leading-tight tracking-tight text-white drop-shadow-sm [text-wrap:balance]`}
                >
                  {f.title}
                </h1>
                {f.subtitle ? (
                  <p className="mt-1 text-xs sm:text-sm leading-snug text-white/90 drop-shadow-sm [text-wrap:pretty]">
                    {f.subtitle}
                  </p>
                ) : null}
              </div>
            ) : null}
          </div>
          <div
            className="h-7 w-full shrink-0 bg-gradient-to-b from-slate-200/25 via-slate-50/40 to-transparent sm:h-9"
            aria-hidden
          />
        </>
      ) : (
        <FlyerHeaderBlock {...ctx} />
      )}

      <div className={`flex w-full flex-col ${showHero && heroUrl ? "mt-1" : ""} ${sp.stackGap}`}>
        <FlyerDepartureBlock {...ctx} />
        <FlyerMainStackBlocks
          {...ctx}
          weatherDays={draft.weather.isLoaded ? draft.weather.days : []}
          outfit={draft.outfit}
        />
        <FlyerGallerySection sections={draft.sections} images={galleryImages} sp={sp} />
      </div>
      <FlyerFooterBlock {...ctx} />
    </>
  );
}
```

**핵심:** `http(s)://`·`data:` → `unoptimized={true}`; **상대 경로·동일 출처 문자열이면 `unoptimized={false}` → Next 최적화 경로 사용 가능.**

---

## [6] 섹션 템플릿 — 갤러리 / placeholder / Image

**파일:** `src/components/admin/products/modals/FlyerTemplateSections.tsx`

**상단 — `Image` import + `GalleryPlaceholderIcon`:**

```tsx
"use client";

import Image from "next/image";
// ... types ...

function GalleryPlaceholderIcon({ className }: { className?: string }) {
  return (
    <svg
      className={className}
      xmlns="http://www.w3.org/2000/svg"
      width="32"
      height="32"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.5"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
    >
      <rect x="3" y="5" width="18" height="14" rx="2" />
      <circle cx="8.5" cy="10.5" r="1.5" />
      <path d="M21 15l-5-5L5 21" />
    </svg>
  );
}
```

**`FlyerGallerySection` 전체:**

```tsx
export function FlyerGallerySection({
  sections,
  images,
  sp,
}: {
  sections: FlyerSectionToggles;
  images: string[];
  sp: FlyerSpacingClasses;
}) {
  if (!sections.gallery) return null;
  const extUrl = (url: string) =>
    url.startsWith("http://") || url.startsWith("https://") || url.startsWith("data:");
  return (
    <section
      aria-label="이미지 갤러리"
      className={`flyer-gallery-longform grid w-full ${sp.galleryGridClass} ${sp.galleryGap}`}
    >
      {images.length > 0 ? (
        images.map((url, i) => (
          <div
            key={`${url}-${i}`}
            className="relative aspect-[4/3] w-full overflow-hidden rounded-xl border border-slate-200/80 bg-slate-100 shadow-sm"
          >
            <Image
              src={url}
              alt=""
              fill
              className="object-cover object-center"
              sizes="(max-width:640px) 100vw, 400px"
              unoptimized={extUrl(url)}
            />
          </div>
        ))
      ) : (
        <div className="flyer-gallery-empty col-span-full flex min-h-[8rem] flex-col items-center justify-center gap-3 rounded-xl border border-dashed border-slate-200/80 bg-slate-100/60 px-4 py-8 text-slate-500">
          <div className="rounded-full bg-slate-200/50 p-3 text-slate-400">
            <GalleryPlaceholderIcon className="h-10 w-10" />
          </div>
          <div className="text-center">
            <p className="text-[0.65rem] font-semibold tracking-wide text-slate-600">이미지 준비 중</p>
            <p className="mt-1.5 max-w-[15rem] text-[0.5rem] leading-relaxed text-slate-500">
              상품에서 갤러리 이미지를 선택하면 여기에 표시됩니다.
            </p>
          </div>
        </div>
      )}
    </section>
  );
}
```

**푸터 로고 `Image` (동일 파일, export 시 포함될 수 있음):**

```tsx
const LOGO_PATH = "/thealltour-logo.png";

export function FlyerFooterBlock({ sections, f, typo }: BlockCtx) {
  // ...
        <Image
          src={LOGO_PATH}
          alt="더올투어"
          width={252}
          height={76}
          className="h-[3.15rem] w-auto max-w-[min(252px,88%)] object-contain object-center sm:h-[3.35rem]"
          unoptimized
        />
```

**`FlyerTemplateDefault` (갤러리 연결만):** `src/components/admin/products/modals/FlyerTemplateDefault.tsx`

```tsx
        <FlyerGallerySection sections={draft.sections} images={images} sp={sp} />
```

---

## [7] 이미지 URL 후보 수집 / 정규화

### 유인물에서 실제 사용하는 경로

**`collectFlyerCandidateImageUrls` + `buildInitialFlyerDraft` + `normalizePersistedFlyerDraft`**

**파일:** `src/components/admin/products/modals/flyerModal.utils.ts`

```ts
import { getPrimaryImageUrl, normalizeImageList } from "@/lib/products/images";
import { normalizeProductImageUrl } from "@/lib/media/normalizeProductImageUrl";

/** 대표 이미지 우선, 이후 images_json 순 — 유인물 후보 URL (중복 제거) */
export function collectFlyerCandidateImageUrls(product: Product): string[] {
  const hero = getPrimaryImageUrl(product);
  const list = normalizeImageList(product.images_json);
  const merged: string[] = [];
  const pushU = (u: string) => {
    const n = normalizeProductImageUrl(u.trim()) || u.trim();
    if (n && !merged.includes(n)) merged.push(n);
  };
  if (hero) pushU(hero);
  for (const u of list) pushU(u);
  return merged;
}

export function buildInitialFlyerDraft(product: Product): FlyerDraftState {
  const { resolvedIncludedItems, resolvedExcludedItems } = resolveProductDetailBodyFields(product);

  const merged = collectFlyerCandidateImageUrls(product);
  const selectedImageUrls = merged.slice(0, 4);

  return {
    // ...
    selectedImageUrls,
  };
}

export function normalizePersistedFlyerDraft(input: Partial<FlyerDraftState> | FlyerDraftState, product: Product): FlyerDraftState {
  const base = buildInitialFlyerDraft(product);
  return {
    // ...
    selectedImageUrls: (() => {
      const raw = input.selectedImageUrls?.filter(Boolean) ?? [];
      return (raw.length > 0 ? raw : base.selectedImageUrls).slice(0, 4);
    })(),
  };
}
```

**`getPrimaryImageUrl` / `normalizeImageList`:** `src/lib/products/images.ts`

```ts
export function normalizeImageList(images: Array<string | null | undefined> | null | undefined): string[] {
  if (!Array.isArray(images)) return [];
  const seen = new Set<string>();
  const result: string[] = [];
  for (const raw of images) {
    if (typeof raw !== "string") continue;
    const url = raw.trim();
    if (!url || seen.has(url)) continue;
    seen.add(url);
    result.push(url);
  }
  return result;
}

export function getPrimaryImageUrl(product: Pick<Product, "image_url" | "images_json">): string {
  const list = normalizeImageList(product.images_json);
  if (list.length > 0) return list[0];
  return product.image_url?.trim() || "";
}
```

**`normalizeProductImageUrl`:** `src/lib/media/normalizeProductImageUrl.ts` (전체)

```ts
/**
 * 상품 이미지 URL 정규화
 *
 * - 모두투어(img.modetour.com) 썸네일 URL: resize_w=157 등 리사이즈 쿼리 제거 → 고해상도 원본 요청
 * - Supabase storage: 옵션 시 render URL 변환
 */
type ImageTransformOptions = {
  width?: number;
  quality?: number;
  mode?: "cover" | "contain" | "fill";
};

/** 모두투어 CDN 썸네일 URL을 고해상도 URL로 변환 (resize_w/resize_h 등 제거). */
function toModetourHighResUrl(url: string): string {
  try {
    const u = new URL(url, "https://x");
    if (u.hostname.toLowerCase() !== "img.modetour.com") return url;
    const drop = new Set([
      "resize", "resize_w", "resize_h", "w", "h", "width", "height",
      "utm_source", "utm_medium", "utm_campaign", "cache", "v", "ver", "t", "timestamp", "quality",
    ]);
    let changed = false;
    u.searchParams.forEach((_, k) => {
      const low = k.toLowerCase();
      if (drop.has(low) || /^_\d+$/.test(low)) {
        u.searchParams.delete(k);
        changed = true;
      }
    });
    return changed ? u.href : url;
  } catch {
    return url;
  }
}

function toSupabaseRenderUrl(url: string, options?: ImageTransformOptions): string {
  const enableRender = process.env.NEXT_PUBLIC_ENABLE_SUPABASE_RENDER === "true";
  if (!enableRender) return url;
  if (!options?.width) return url;
  const match = url.match(
    /^(https?:\/\/[^/]+)\/storage\/v1\/object\/public\/([^/]+)\/(.+)$/,
  );
  if (!match) return url;

  const [, host, bucket, objectPath] = match;
  const base = `${host}/storage/v1/render/image/public/${bucket}/${objectPath}`;
  const params = new URLSearchParams();
  params.set("width", String(Math.max(1, Math.floor(options.width))));
  if (typeof options.quality === "number") {
    params.set("quality", String(Math.max(20, Math.min(100, Math.floor(options.quality)))));
  }
  if (options.mode) {
    params.set("resize", options.mode);
  }
  return `${base}?${params.toString()}`;
}

export function normalizeProductImageUrl(
  url: string | null | undefined,
  options?: ImageTransformOptions,
): string {
  if (!url?.trim()) return "";
  let normalized = url.trim();
  normalized = toModetourHighResUrl(normalized);
  return toSupabaseRenderUrl(normalized, options);
}
```

### 후보 파일이나 유인물 초기화와 직접 연결되지 않는 유틸

- `src/lib/images/normalizeImageUrl.ts` — 일반 이미지 편집 파이프라인용 `trim`·공백 정리만 (유인물 `collectFlyerCandidateImageUrls`에서는 미사용).
- `getEventImageUrl`, `normalizeEventImages`, `dedupeEventImages` 등은 `src/lib/images/` 이벤트·일정 이미지 쪽; **유인물 `selectedImageUrls` 생성 경로에는 포함되지 않음.**

---

## [8] `next.config` — images / remotePatterns

**파일:** `next.config.ts` (전체 — `rewrites`/`proxy` 없음, `images`만 해당)

```ts
import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  experimental: {
    serverActions: {
      bodySizeLimit: "110mb",
    },
    proxyClientMaxBodySize: "110mb",
  },
  turbopack: {
    root: __dirname,
  },
  images: {
    formats: ["image/avif", "image/webp"],
    minimumCacheTTL: 86400,
    deviceSizes: [360, 375, 640, 768, 1024, 1280, 1536, 1920],
    imageSizes: [96, 128, 192, 256, 360, 384],
    remotePatterns: [
      { protocol: "https", hostname: "picsum.photos" },
      { protocol: "https", hostname: "images.unsplash.com" },
      { protocol: "https", hostname: "img.modetour.com" },
      { protocol: "https", hostname: "qmswixmwquuazrhfyils.supabase.co" },
      { protocol: "https", hostname: "images.kiwi.com" },
      { protocol: "https", hostname: "prod-files-secure.s3.us-west-2.amazonaws.com" },
      { protocol: "https", hostname: "s3.us-west-2.amazonaws.com" },
      { protocol: "https", hostname: "www.notion.so" },
      { protocol: "https", hostname: "notion.so" },
      { protocol: "https", hostname: "images.notion.so" },
      { protocol: "https", hostname: "file.notion.so" },
      { protocol: "https", hostname: "img.notionusercontent.com" },
      { protocol: "https", hostname: "quick-hen-cc9.notion.site" },
      { protocol: "https", hostname: "image-tc.galaxy.tf" },
      { protocol: "https", hostname: "*.googleusercontent.com" },
    ],
  },
};

export default nextConfig;
```

**시사점:** `remotePatterns`에 없는 호스트의 **절대 URL**은 Next Image가 거부할 수 있음. 반면 `unoptimized`인 경우 브라우저가 직접 로드.

---

## [9] 상품 이미지 소스 타입 / `selectedImageUrls` 경로

**`Product` — `src/types/product.ts` 발췌:**

```ts
export type Product = {
  id: string;
  title: string;
  description: string;
  /** 상세 히어로용 (hero 1920px). 카드 썸네일은 image_card_url 우선, 없으면 이 값 사용 */
  image_url: string;
  /** 상품 이미지 갤러리 URL 배열. 첫 번째가 대표 이미지로 사용됨 */
  images_json?: string[];
  // ...
};
```

**`FlyerDraftState` — `src/lib/flyers/flyer.types.ts` 발췌:**

```ts
export type FlyerDraftState = {
  templateKey: FlyerTemplateKey;
  layoutOptions: FlyerLayoutOptions;
  sections: FlyerSectionToggles;
  fields: FlyerEditableFields;
  weather: FlyerWeatherDraftState;
  outfit: FlyerOutfitDraftState;
  selectedImageUrls: string[];
};
```

**비주얼 템플릿이 쓰는 URL 배열:** `FlyerLongformPreview`에서 `draft.selectedImageUrls` → 최대 4장 → `FlyerTemplateVisual`의 `images`; 첫 장은 히어로, 나머지는 `FlyerGallerySection`.

---

## [10] placeholder / 갤러리 관련 CSS

**파일:** `src/app/globals.css` (유인물 갤러리·롱포맷 관련 일부)

```css
.flyer-gallery-empty {
  font-size: 0.5rem;
  line-height: 1.35;
}

/* 롱포맷 문서 카드 내부: 섹션 타이틀·본문 리듬 */
.flyer-longform-doc-surface .flyer-section-title {
  font-size: 0.7rem;
  letter-spacing: -0.02em;
}
/* ... flyer-longform-doc-surface 하위 타이포 ... */
```

**관찰:** 갤러리 카드·빈 상태는 Tailwind에서 `bg-slate-100`, `bg-slate-100/60` 등 **회색 계열**. **전역 CSS에 “붉은 블록” 전용 클래스는 없음.** 사용자가 본 붉은 영역은 (1) 브라우저/캔버스·CORS 실패 시각화, (2) `html-to-image` 내부 실패 표현, (3) 다른 오버레이 등 **런타임/라이브러리 층** 가능성을 열어두는 것이 타당.

---

## [11] 디버그 시 확인할 항목

### 1) PNG 저장 직전 DOM

개발자 도구에서 `[data-flyer-document]` 안 갤러리 셀을 검사:

- 실제 `<img src="...">`인지 (Next 13+는 종종 `img`에 `src`가 `/_next/image?url=...` 형태).
- `unoptimized={true}`인 외부 URL은 원본 `https://...`가 `img`에 직접 붙는지.
- **wrapper만 있고 `img`의 `naturalWidth === 0`** 이면 export 시점에 아직 로드 실패·대기 부족 가능.

### 2) 콘솔 에러 키워드

- `Tainted canvases may not be exported`
- `Failed to fetch resource` / `net::ERR_FAILED`
- `CORS policy` / `blocked by CORS`
- `Error loading image` / Next Image 관련
- `html-to-image` / `cloneNode` / `SecurityError`

### 3) URL 샘플

실패 재현 시 **2~3개**를 메모:

- 화면에는 보이나 PNG에만 비는 URL
- `remotePatterns`에 없는 호스트인지
- 서명·쿼리가 긴 Supabase URL인지
- `/_next/image?...`로 변환된 상대 경로인지

### 4) 코드와 직결되는 체크포인트

| 항목 | 코드 위치 |
|------|-----------|
| 캡처 대상 | `[data-flyer-document]` (`exportFlyerToPng.ts`) |
| 외부 URL → `unoptimized` | `FlyerTemplateVisual` / `FlyerGallerySection`의 `http(s)/data` 분기 |
| 상대·동일 출처 문자열 → Next 최적화 | 위 분기에서 `unoptimized={false}` |
| 이미지 페치 실패 시 placeholder | `imagePlaceholder` = 1×1 투명 PNG (`exportFlyerToPng.ts`) |
| export 전 로드 대기 | **없음** (`handlePngExport` / `handlePng`) |

---

*문서는 저장소 스냅샷 기준이며, 라인 번호는 IDE에서 파일을 열어 확인하면 됩니다.*
